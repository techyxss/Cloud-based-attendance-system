import { Router, Response } from 'express';
import { dbManager } from '../db.ts';
import { authenticate, requireRole, AuthenticatedRequest } from '../auth.ts';
import { logAudit } from '../audit.ts';

const router = Router();

// Protect all lecturer routes
router.use(authenticate, requireRole('lecturer', 'admin'));

// GET /api/lecturer/courses - Get courses assigned to current lecturer
router.get('/courses', (req: AuthenticatedRequest, res: Response) => {
  try {
    const lecturerId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';

    let sql = `
      SELECT c.*, d.name as department_name, d.code as department_code,
             s.name as session_name, s.semester as session_semester,
             (SELECT COUNT(*) FROM student_enrollments se WHERE se.course_id = c.id AND se.status = 'enrolled') as enrolled_count,
             (SELECT COUNT(*) FROM attendance_sessions att WHERE att.course_id = c.id) as sessions_held
      FROM courses c
      JOIN departments d ON c.department_id = d.id
      JOIN course_assignments ca ON ca.course_id = c.id
      JOIN academic_sessions s ON ca.session_id = s.id
      WHERE s.is_active = 1
    `;
    const params: any[] = [];

    if (!isAdmin) {
      sql += ' AND ca.lecturer_id = ?';
      params.push(lecturerId);
    }

    sql += ' ORDER BY c.code ASC';
    const courses = dbManager.query(sql, params);
    res.json({ courses });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/lecturer/courses/:id/students - Get enrolled students for a course with attendance breakdown
router.get('/courses/:id/students', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const courseId = Number(req.params.id);
    const lecturerId = req.user!.id;

    // Verify lecturer is assigned or admin
    if (req.user!.role !== 'admin') {
      const isAssigned = dbManager.queryOne(
        'SELECT id FROM course_assignments WHERE course_id = ? AND lecturer_id = ?',
        [courseId, lecturerId]
      );
      if (!isAssigned) {
        res.status(403).json({ error: 'You are not assigned to teach this course.' });
        return;
      }
    }

    const course = dbManager.queryOne(`
      SELECT c.*, d.name as department_name
      FROM courses c
      JOIN departments d ON c.department_id = d.id
      WHERE c.id = ?
    `, [courseId]);

    if (!course) {
      res.status(404).json({ error: 'Course not found.' });
      return;
    }

    const totalSessions = dbManager.queryOne(
      'SELECT COUNT(*) as count FROM attendance_sessions WHERE course_id = ?',
      [courseId]
    )?.count || 0;

    const students = dbManager.query(`
      SELECT u.id, u.full_name, u.email, u.identifier, u.level, u.phone,
             se.enrolled_at,
             (SELECT COUNT(*) FROM attendance_records ar
              JOIN attendance_sessions s ON ar.session_id = s.id
              WHERE s.course_id = ? AND ar.student_id = u.id AND ar.status = 'Present') as present_count,
             (SELECT COUNT(*) FROM attendance_records ar
              JOIN attendance_sessions s ON ar.session_id = s.id
              WHERE s.course_id = ? AND ar.student_id = u.id AND ar.status = 'Late') as late_count,
             (SELECT COUNT(*) FROM attendance_records ar
              JOIN attendance_sessions s ON ar.session_id = s.id
              WHERE s.course_id = ? AND ar.student_id = u.id AND ar.status = 'Absent') as absent_count
      FROM users u
      JOIN student_enrollments se ON u.id = se.student_id
      WHERE se.course_id = ? AND se.status = 'enrolled'
      ORDER BY u.identifier ASC, u.full_name ASC
    `, [courseId, courseId, courseId, courseId]);

    // Calculate percentage for each student
    const enrichedStudents = students.map((s: any) => {
      const effectivePresent = Number(s.present_count) + (Number(s.late_count) * 0.5);
      const percentage = totalSessions > 0 ? Math.round((effectivePresent / totalSessions) * 1000) / 10 : 0;
      return {
        ...s,
        total_sessions: totalSessions,
        percentage,
        is_eligible: percentage >= 75
      };
    });

    res.json({
      course,
      totalSessions,
      students: enrichedStudents
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/lecturer/attendance - Submit attendance for a lecture session (Transaction Safe with Duplicate Prevention)
router.post('/attendance', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const lecturerId = req.user!.id;
    const { course_id, date, start_time, end_time, topic, venue, records } = req.body;

    if (!course_id || !date || !start_time || !end_time || !topic || !Array.isArray(records)) {
      res.status(400).json({ error: 'Course, date, start time, end time, topic, and student records are required.' });
      return;
    }

    // Verify assignment if not admin
    if (req.user!.role !== 'admin') {
      const isAssigned = dbManager.queryOne(
        'SELECT id FROM course_assignments WHERE course_id = ? AND lecturer_id = ?',
        [Number(course_id), lecturerId]
      );
      if (!isAssigned) {
        res.status(403).json({ error: 'You are not authorized to mark attendance for this course.' });
        return;
      }
    }

    // Check duplicate session for same course and date/start_time
    const duplicateSession = dbManager.queryOne(`
      SELECT id, date, start_time, topic
      FROM attendance_sessions
      WHERE course_id = ? AND date = ? AND start_time = ?
    `, [Number(course_id), date, start_time]);

    if (duplicateSession) {
      res.status(409).json({
        error: `An attendance session already exists for this course on ${date} at ${start_time} (Topic: "${duplicateSession.topic}"). Please edit the existing session or choose a different time.`
      });
      return;
    }

    const activeSession = dbManager.queryOne('SELECT id FROM academic_sessions WHERE is_active = 1');
    if (!activeSession) {
      res.status(400).json({ error: 'No active academic session found. Please contact Administrator.' });
      return;
    }

    const now = new Date().toISOString();

    // Execute transaction: create session and batch insert attendance records atomically
    const sessionResult = dbManager.transaction(() => {
      const createdSession = dbManager.run(`
        INSERT INTO attendance_sessions (course_id, lecturer_id, session_id, date, start_time, end_time, topic, venue, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        Number(course_id),
        lecturerId,
        activeSession.id,
        date,
        start_time,
        end_time,
        topic.trim(),
        venue ? venue.trim() : 'Lecture Hall 1',
        now
      ]);

      const sessionId = createdSession.lastInsertRowid;

      let presentCount = 0;
      let lateCount = 0;
      let absentCount = 0;

      for (const rec of records) {
        const studentId = Number(rec.student_id);
        const status = ['Present', 'Absent', 'Late'].includes(rec.status) ? rec.status : 'Present';
        const remarks = rec.remarks ? String(rec.remarks).trim() : null;

        if (status === 'Present') presentCount++;
        else if (status === 'Late') lateCount++;
        else absentCount++;

        dbManager.run(`
          INSERT INTO attendance_records (session_id, student_id, course_id, status, remarks, marked_by, marked_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          sessionId,
          studentId,
          Number(course_id),
          status,
          remarks,
          lecturerId,
          now,
          now
        ]);
      }

      return { sessionId, presentCount, lateCount, absentCount, totalMarked: records.length };
    });

    logAudit(
      req,
      'MARK_ATTENDANCE',
      'attendance_session',
      sessionResult.sessionId,
      `Marked attendance for Course ID ${course_id} on ${date}. Total students: ${sessionResult.totalMarked} (Present: ${sessionResult.presentCount}, Late: ${sessionResult.lateCount}, Absent: ${sessionResult.absentCount})`
    );

    res.status(201).json({
      message: 'Attendance submitted and securely recorded.',
      ...sessionResult
    });
  } catch (err: any) {
    console.error('Error submitting attendance:', err);
    res.status(500).json({ error: err.message || 'Failed to submit attendance.' });
  }
});

// GET /api/lecturer/attendance/sessions - List attendance sessions for a course
router.get('/attendance/sessions', (req: AuthenticatedRequest, res: Response) => {
  try {
    const courseId = Number(req.query.course_id);
    if (!courseId) {
      res.status(400).json({ error: 'Course ID is required.' });
      return;
    }

    const sessions = dbManager.query(`
      SELECT s.*,
             c.code as course_code, c.title as course_title,
             u.full_name as lecturer_name,
             (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = s.id AND ar.status = 'Present') as present_count,
             (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = s.id AND ar.status = 'Late') as late_count,
             (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = s.id AND ar.status = 'Absent') as absent_count,
             (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = s.id) as total_students
      FROM attendance_sessions s
      JOIN courses c ON s.course_id = c.id
      JOIN users u ON s.lecturer_id = u.id
      WHERE s.course_id = ?
      ORDER BY s.date DESC, s.start_time DESC
    `, [courseId]);

    res.json({ sessions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/lecturer/attendance/sessions/:id - Get records for a specific session
router.get('/attendance/sessions/:id', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const sessionId = Number(req.params.id);

    const session = dbManager.queryOne(`
      SELECT s.*, c.code as course_code, c.title as course_title, u.full_name as lecturer_name
      FROM attendance_sessions s
      JOIN courses c ON s.course_id = c.id
      JOIN users u ON s.lecturer_id = u.id
      WHERE s.id = ?
    `, [sessionId]);

    if (!session) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }

    const records = dbManager.query(`
      SELECT ar.*, u.full_name as student_name, u.identifier as student_identifier, u.email as student_email
      FROM attendance_records ar
      JOIN users u ON ar.student_id = u.id
      WHERE ar.session_id = ?
      ORDER BY u.identifier ASC, u.full_name ASC
    `, [sessionId]);

    res.json({ session, records });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/lecturer/attendance/records/:id - Authorized correction of a single attendance record
router.put('/attendance/records/:id', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const recordId = Number(req.params.id);
    const { status, remarks, correction_reason } = req.body;

    if (!['Present', 'Absent', 'Late'].includes(status)) {
      res.status(400).json({ error: 'Status must be Present, Absent, or Late.' });
      return;
    }

    if (!correction_reason || correction_reason.trim().length < 5) {
      res.status(400).json({ error: 'A valid correction reason is required for institutional audit compliance.' });
      return;
    }

    const existingRecord = dbManager.queryOne(`
      SELECT ar.*, u.full_name as student_name, c.code as course_code
      FROM attendance_records ar
      JOIN users u ON ar.student_id = u.id
      JOIN courses c ON ar.course_id = c.id
      WHERE ar.id = ?
    `, [recordId]);

    if (!existingRecord) {
      res.status(404).json({ error: 'Attendance record not found.' });
      return;
    }

    const now = new Date().toISOString();
    dbManager.run(`
      UPDATE attendance_records
      SET status = ?, remarks = ?, correction_reason = ?, updated_at = ?
      WHERE id = ?
    `, [status, remarks || existingRecord.remarks, correction_reason.trim(), now, recordId]);

    logAudit(
      req,
      'CORRECT_ATTENDANCE_RECORD',
      'attendance_record',
      recordId,
      `Corrected attendance for ${existingRecord.student_name} (${existingRecord.course_code}) from ${existingRecord.status} to ${status}. Reason: ${correction_reason.trim()}`
    );

    res.json({ message: 'Attendance record updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/lecturer/corrections - List correction requests for lecturer courses
router.get('/corrections', (req: AuthenticatedRequest, res: Response) => {
  try {
    const lecturerId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';

    let sql = `
      SELECT cr.*,
             u.full_name as student_name, u.identifier as student_identifier, u.email as student_email,
             c.code as course_code, c.title as course_title,
             s.date as lecture_date, s.topic as lecture_topic,
             ar.status as current_status
      FROM correction_requests cr
      JOIN users u ON cr.student_id = u.id
      JOIN courses c ON cr.course_id = c.id
      JOIN attendance_records ar ON cr.attendance_record_id = ar.id
      JOIN attendance_sessions s ON ar.session_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (!isAdmin) {
      sql += ' AND cr.lecturer_id = ?';
      params.push(lecturerId);
    }

    sql += ' ORDER BY cr.created_at DESC';
    const requests = dbManager.query(sql, params);
    res.json({ requests });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/lecturer/corrections/:id/review - Approve or Reject correction request
router.post('/corrections/:id/review', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const requestId = Number(req.params.id);
    const { action, notes } = req.body; // action: 'approve' | 'reject'
    const reviewerId = req.user!.id;

    if (!['approve', 'reject'].includes(action)) {
      res.status(400).json({ error: 'Action must be approve or reject.' });
      return;
    }

    const request = dbManager.queryOne(`
      SELECT cr.*, ar.session_id, u.full_name as student_name, c.code as course_code
      FROM correction_requests cr
      JOIN attendance_records ar ON cr.attendance_record_id = ar.id
      JOIN users u ON cr.student_id = u.id
      JOIN courses c ON cr.course_id = c.id
      WHERE cr.id = ?
    `, [requestId]);

    if (!request) {
      res.status(404).json({ error: 'Correction request not found.' });
      return;
    }

    if (request.status !== 'pending') {
      res.status(400).json({ error: `Request has already been ${request.status}.` });
      return;
    }

    const now = new Date().toISOString();

    dbManager.transaction(() => {
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      dbManager.run(`
        UPDATE correction_requests
        SET status = ?, admin_or_lecturer_notes = ?, reviewed_by = ?, reviewed_at = ?
        WHERE id = ?
      `, [newStatus, notes ? notes.trim() : null, reviewerId, now, requestId]);

      if (action === 'approve') {
        dbManager.run(`
          UPDATE attendance_records
          SET status = ?, correction_reason = ?, updated_at = ?
          WHERE id = ?
        `, [
          request.requested_status,
          `Approved request: ${request.reason} (Reviewer notes: ${notes || 'None'})`,
          now,
          request.attendance_record_id
        ]);
      }
    });

    logAudit(
      req,
      action === 'approve' ? 'APPROVE_CORRECTION' : 'REJECT_CORRECTION',
      'correction_request',
      requestId,
      `${action === 'approve' ? 'Approved' : 'Rejected'} correction request for ${request.student_name} (${request.course_code}). Notes: ${notes || 'None'}`
    );

    res.json({ message: `Correction request ${action === 'approve' ? 'approved and attendance updated' : 'rejected'}.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
