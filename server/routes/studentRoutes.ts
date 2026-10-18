import { Router, Response } from 'express';
import { dbManager } from '../db.ts';
import { authenticate, requireRole, AuthenticatedRequest } from '../auth.ts';
import { logAudit } from '../audit.ts';

const router = Router();

// Protect all student routes
router.use(authenticate, requireRole('student', 'admin'));

// GET /api/student/dashboard - Summary and enrolled courses with attendance stats
router.get('/dashboard', (req: AuthenticatedRequest, res: Response) => {
  try {
    const studentId = req.user!.id;

    // Get active session
    const activeSession = dbManager.queryOne('SELECT * FROM academic_sessions WHERE is_active = 1');

    // Get enrolled courses
    const enrolledCourses = dbManager.query(`
      SELECT c.*, d.name as department_name, d.code as department_code,
             se.enrolled_at,
             u.full_name as lecturer_name, u.email as lecturer_email,
             (SELECT COUNT(*) FROM attendance_sessions att WHERE att.course_id = c.id) as total_sessions,
             (SELECT COUNT(*) FROM attendance_records ar
              JOIN attendance_sessions s ON ar.session_id = s.id
              WHERE s.course_id = c.id AND ar.student_id = ? AND ar.status = 'Present') as present_count,
             (SELECT COUNT(*) FROM attendance_records ar
              JOIN attendance_sessions s ON ar.session_id = s.id
              WHERE s.course_id = c.id AND ar.student_id = ? AND ar.status = 'Late') as late_count,
             (SELECT COUNT(*) FROM attendance_records ar
              JOIN attendance_sessions s ON ar.session_id = s.id
              WHERE s.course_id = c.id AND ar.student_id = ? AND ar.status = 'Absent') as absent_count
      FROM student_enrollments se
      JOIN courses c ON se.course_id = c.id
      JOIN departments d ON c.department_id = d.id
      LEFT JOIN course_assignments ca ON ca.course_id = c.id
      LEFT JOIN users u ON ca.lecturer_id = u.id
      WHERE se.student_id = ? AND se.status = 'enrolled'
      ORDER BY c.code ASC
    `, [studentId, studentId, studentId, studentId]);

    // Calculate aggregated institutional percentage
    let totalClassesHeld = 0;
    let totalPresent = 0;
    let totalLate = 0;
    let totalAbsent = 0;

    const coursesWithCalculations = enrolledCourses.map((c: any) => {
      const held = Number(c.total_sessions);
      const pres = Number(c.present_count);
      const lt = Number(c.late_count);
      const abs = Number(c.absent_count);

      totalClassesHeld += held;
      totalPresent += pres;
      totalLate += lt;
      totalAbsent += abs;

      const effectivePresent = pres + (lt * 0.5);
      const percentage = held > 0 ? Math.round((effectivePresent / held) * 1000) / 10 : 100;
      const isEligible = percentage >= 75;

      return {
        ...c,
        percentage,
        is_eligible: isEligible
      };
    });

    const totalEffectivePresent = totalPresent + (totalLate * 0.5);
    const overallPercentage = totalClassesHeld > 0
      ? Math.round((totalEffectivePresent / totalClassesHeld) * 1000) / 10
      : 100;

    // Get recent correction requests
    const correctionRequests = dbManager.query(`
      SELECT cr.*, c.code as course_code, c.title as course_title,
             s.date as lecture_date, s.topic as lecture_topic
      FROM correction_requests cr
      JOIN courses c ON cr.course_id = c.id
      JOIN attendance_records ar ON cr.attendance_record_id = ar.id
      JOIN attendance_sessions s ON ar.session_id = s.id
      WHERE cr.student_id = ?
      ORDER BY cr.created_at DESC
    `, [studentId]);

    res.json({
      activeSession,
      summary: {
        totalEnrolled: coursesWithCalculations.length,
        totalClassesHeld,
        totalPresent,
        totalLate,
        totalAbsent,
        overallPercentage,
        isOverallEligible: overallPercentage >= 75
      },
      courses: coursesWithCalculations,
      correctionRequests
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/student/courses/:id/history - Full attendance history for a single course
router.get('/courses/:id/history', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const courseId = Number(req.params.id);
    const studentId = req.user!.id;

    const course = dbManager.queryOne(`
      SELECT c.*, d.name as department_name, u.full_name as lecturer_name
      FROM courses c
      JOIN departments d ON c.department_id = d.id
      LEFT JOIN course_assignments ca ON ca.course_id = c.id
      LEFT JOIN users u ON ca.lecturer_id = u.id
      WHERE c.id = ?
    `, [courseId]);

    if (!course) {
      res.status(404).json({ error: 'Course not found.' });
      return;
    }

    const history = dbManager.query(`
      SELECT s.id as session_id, s.date, s.start_time, s.end_time, s.topic, s.venue,
             ar.id as record_id, ar.status, ar.remarks, ar.correction_reason, ar.marked_at,
             (SELECT cr.id FROM correction_requests cr WHERE cr.attendance_record_id = ar.id ORDER BY cr.id DESC LIMIT 1) as existing_request_id,
             (SELECT cr.status FROM correction_requests cr WHERE cr.attendance_record_id = ar.id ORDER BY cr.id DESC LIMIT 1) as request_status
      FROM attendance_sessions s
      LEFT JOIN attendance_records ar ON ar.session_id = s.id AND ar.student_id = ?
      WHERE s.course_id = ?
      ORDER BY s.date DESC, s.start_time DESC
    `, [studentId, courseId]);

    res.json({ course, history });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/student/available-courses - Courses available for student to register
router.get('/available-courses', (req: AuthenticatedRequest, res: Response) => {
  try {
    const studentId = req.user!.id;
    const student = req.user!;

    const activeSession = dbManager.queryOne('SELECT * FROM academic_sessions WHERE is_active = 1');
    if (!activeSession) {
      res.json({ available: [], enrolledCourseIds: [] });
      return;
    }

    // Courses already enrolled
    const enrolled = dbManager.query(
      'SELECT course_id FROM student_enrollments WHERE student_id = ? AND status = "enrolled"',
      [studentId]
    );
    const enrolledIds = enrolled.map((e: any) => e.course_id);

    let sql = `
      SELECT c.*, d.name as department_name, d.code as department_code,
             u.full_name as lecturer_name
      FROM courses c
      JOIN departments d ON c.department_id = d.id
      LEFT JOIN course_assignments ca ON ca.course_id = c.id
      LEFT JOIN users u ON ca.lecturer_id = u.id
      WHERE c.status = 'active'
    `;
    const params: any[] = [];

    // Filter by student department if set
    if (student.department_id) {
      sql += ' AND (c.department_id = ? OR c.code LIKE "GNS%")';
      params.push(student.department_id);
    }

    sql += ' ORDER BY c.code ASC';
    const allCourses = dbManager.query(sql, params);

    const available = allCourses.map((c: any) => ({
      ...c,
      is_enrolled: enrolledIds.includes(c.id)
    }));

    res.json({ available, enrolledCourseIds: enrolledIds, activeSession });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/student/register-course - Register/Enroll in a course
router.post('/register-course', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const studentId = req.user!.id;
    const { course_id } = req.body;

    if (!course_id) {
      res.status(400).json({ error: 'Course ID is required.' });
      return;
    }

    const activeSession = dbManager.queryOne('SELECT id FROM academic_sessions WHERE is_active = 1');
    if (!activeSession) {
      res.status(400).json({ error: 'No active academic session for course registration.' });
      return;
    }

    const course = dbManager.queryOne('SELECT * FROM courses WHERE id = ?', [Number(course_id)]);
    if (!course) {
      res.status(404).json({ error: 'Course does not exist.' });
      return;
    }

    const existing = dbManager.queryOne(`
      SELECT id, status FROM student_enrollments
      WHERE course_id = ? AND student_id = ? AND session_id = ?
    `, [Number(course_id), studentId, activeSession.id]);

    const now = new Date().toISOString();

    if (existing) {
      if (existing.status === 'enrolled') {
        res.status(409).json({ error: 'You are already registered for this course.' });
        return;
      } else {
        dbManager.run('UPDATE student_enrollments SET status = "enrolled", enrolled_at = ? WHERE id = ?', [now, existing.id]);
      }
    } else {
      dbManager.run(`
        INSERT INTO student_enrollments (course_id, student_id, session_id, enrolled_at, status)
        VALUES (?, ?, ?, ?, 'enrolled')
      `, [Number(course_id), studentId, activeSession.id, now]);
    }

    logAudit(req, 'REGISTER_COURSE', 'student_enrollment', course_id, `Student registered for ${course.code}: ${course.title}`);
    res.status(201).json({ message: `Successfully registered for ${course.code} - ${course.title}!` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/student/corrections - Submit attendance correction request
router.post('/corrections', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const studentId = req.user!.id;
    const { attendance_record_id, requested_status, reason } = req.body;

    if (!attendance_record_id || !requested_status || !reason) {
      res.status(400).json({ error: 'Attendance record, requested status, and detailed reason are required.' });
      return;
    }

    if (!['Present', 'Late'].includes(requested_status)) {
      res.status(400).json({ error: 'Requested status must be Present or Late.' });
      return;
    }

    if (reason.trim().length < 10) {
      res.status(400).json({ error: 'Please provide a detailed justification (at least 10 characters).' });
      return;
    }

    const record = dbManager.queryOne(`
      SELECT ar.*, s.lecturer_id, c.code as course_code
      FROM attendance_records ar
      JOIN attendance_sessions s ON ar.session_id = s.id
      JOIN courses c ON ar.course_id = c.id
      WHERE ar.id = ? AND ar.student_id = ?
    `, [Number(attendance_record_id), studentId]);

    if (!record) {
      res.status(404).json({ error: 'Attendance record not found or does not belong to you.' });
      return;
    }

    // Check for existing pending request
    const existingReq = dbManager.queryOne(`
      SELECT id, status FROM correction_requests
      WHERE attendance_record_id = ? AND status = 'pending'
    `, [Number(attendance_record_id)]);

    if (existingReq) {
      res.status(409).json({ error: 'A pending correction request already exists for this attendance record.' });
      return;
    }

    const now = new Date().toISOString();
    const result = dbManager.run(`
      INSERT INTO correction_requests (attendance_record_id, student_id, lecturer_id, course_id, requested_status, reason, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
    `, [
      Number(attendance_record_id),
      studentId,
      record.lecturer_id,
      record.course_id,
      requested_status,
      reason.trim(),
      now
    ]);

    logAudit(
      req,
      'SUBMIT_CORRECTION_REQUEST',
      'correction_request',
      result.lastInsertRowid,
      `Student requested status ${requested_status} for ${record.course_code}. Reason: ${reason.trim()}`
    );

    res.status(201).json({
      message: 'Correction request submitted successfully. Your lecturer has been notified.',
      requestId: result.lastInsertRowid
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
