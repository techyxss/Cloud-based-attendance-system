import { Router, Response } from 'express';
import { dbManager } from '../db.ts';
import { authenticate, requireRole, AuthenticatedRequest, hashPassword } from '../auth.ts';
import { logAudit } from '../audit.ts';

const router = Router();

// Protect all admin routes with authentication and 'admin' role
router.use(authenticate, requireRole('admin'));

// GET /api/admin/stats - Institutional Overview KPI metrics
router.get('/stats', (req: AuthenticatedRequest, res: Response) => {
  try {
    const totalStudents = dbManager.queryOne("SELECT COUNT(*) as count FROM users WHERE role = 'student'")?.count || 0;
    const totalLecturers = dbManager.queryOne("SELECT COUNT(*) as count FROM users WHERE role = 'lecturer'")?.count || 0;
    const totalCourses = dbManager.queryOne("SELECT COUNT(*) as count FROM courses WHERE status = 'active'")?.count || 0;
    const totalSessionsHeld = dbManager.queryOne("SELECT COUNT(*) as count FROM attendance_sessions")?.count || 0;
    const totalRecords = dbManager.queryOne("SELECT COUNT(*) as count FROM attendance_records")?.count || 0;
    const presentCount = dbManager.queryOne("SELECT COUNT(*) as count FROM attendance_records WHERE status = 'Present'")?.count || 0;
    const lateCount = dbManager.queryOne("SELECT COUNT(*) as count FROM attendance_records WHERE status = 'Late'")?.count || 0;
    const absentCount = dbManager.queryOne("SELECT COUNT(*) as count FROM attendance_records WHERE status = 'Absent'")?.count || 0;
    const pendingCorrections = dbManager.queryOne("SELECT COUNT(*) as count FROM correction_requests WHERE status = 'pending'")?.count || 0;

    // Attendance calculation: present + (late * 0.5) / total
    const effectivePresent = presentCount + (lateCount * 0.5);
    const overallAttendanceRate = totalRecords > 0 ? Math.round((effectivePresent / totalRecords) * 1000) / 10 : 0;

    const activeSession = dbManager.queryOne("SELECT * FROM academic_sessions WHERE is_active = 1");

    res.json({
      totalStudents,
      totalLecturers,
      totalCourses,
      totalSessionsHeld,
      totalRecords,
      presentCount,
      lateCount,
      absentCount,
      overallAttendanceRate,
      pendingCorrections,
      activeSession
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch admin stats.' });
  }
});

// GET /api/admin/users
router.get('/users', (req: AuthenticatedRequest, res: Response) => {
  try {
    const role = req.query.role as string;
    const departmentId = req.query.department_id as string;
    const search = req.query.search as string;

    let sql = `
      SELECT u.id, u.email, u.full_name, u.role, u.identifier, u.department_id, u.level, u.phone, u.status,
             u.created_at, u.updated_at, d.name as department_name, d.code as department_code
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (role) {
      sql += ' AND u.role = ?';
      params.push(role);
    }
    if (departmentId) {
      sql += ' AND u.department_id = ?';
      params.push(Number(departmentId));
    }
    if (search) {
      sql += ' AND (LOWER(u.full_name) LIKE ? OR LOWER(u.email) LIKE ? OR LOWER(COALESCE(u.identifier, "")) LIKE ?)';
      params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`);
    }

    sql += ' ORDER BY u.created_at DESC';
    const users = dbManager.query(sql, params);
    res.json({ users });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/users - Create User
router.post('/users', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { email, password, full_name, role, identifier, department_id, level, phone, status } = req.body;
    if (!email || !password || !full_name || !role) {
      res.status(400).json({ error: 'Email, password, full name, and role are required.' });
      return;
    }

    const existingEmail = dbManager.queryOne('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email.trim()]);
    if (existingEmail) {
      res.status(409).json({ error: 'A user with this email already exists.' });
      return;
    }

    const hashed = hashPassword(password);
    const now = new Date().toISOString();

    const result = dbManager.run(`
      INSERT INTO users (email, password_hash, full_name, role, identifier, department_id, level, phone, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      email.trim().toLowerCase(),
      hashed,
      full_name.trim(),
      role,
      identifier ? identifier.trim() : null,
      department_id ? Number(department_id) : null,
      level || null,
      phone ? phone.trim() : null,
      status || 'active',
      now,
      now
    ]);

    logAudit(req, 'CREATE_USER', 'user', result.lastInsertRowid, `Created user ${email} with role ${role}`);
    res.status(201).json({ message: 'User created successfully.', userId: result.lastInsertRowid });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/users/:id - Update User
router.put('/users/:id', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = Number(req.params.id);
    const { full_name, role, identifier, department_id, level, phone, status, password } = req.body;

    const existing = dbManager.queryOne('SELECT * FROM users WHERE id = ?', [userId]);
    if (!existing) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const now = new Date().toISOString();
    let passwordHash = existing.password_hash;
    if (password && password.trim().length >= 6) {
      passwordHash = hashPassword(password.trim());
    }

    dbManager.run(`
      UPDATE users
      SET full_name = ?, role = ?, identifier = ?, department_id = ?, level = ?, phone = ?, status = ?, password_hash = ?, updated_at = ?
      WHERE id = ?
    `, [
      full_name || existing.full_name,
      role || existing.role,
      identifier !== undefined ? identifier : existing.identifier,
      department_id !== undefined ? (department_id ? Number(department_id) : null) : existing.department_id,
      level !== undefined ? level : existing.level,
      phone !== undefined ? phone : existing.phone,
      status || existing.status,
      passwordHash,
      now,
      userId
    ]);

    logAudit(req, 'UPDATE_USER', 'user', userId, `Updated user ${existing.email}`);
    res.json({ message: 'User updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/users/:id - Delete User
router.delete('/users/:id', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = Number(req.params.id);
    if (req.user?.id === userId) {
      res.status(400).json({ error: 'You cannot delete your own administrative account.' });
      return;
    }

    const user = dbManager.queryOne('SELECT email FROM users WHERE id = ?', [userId]);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    dbManager.run('DELETE FROM users WHERE id = ?', [userId]);
    logAudit(req, 'DELETE_USER', 'user', userId, `Deleted user ${user.email}`);
    res.json({ message: 'User deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/departments
router.get('/departments', (req: AuthenticatedRequest, res: Response) => {
  try {
    const departments = dbManager.query(`
      SELECT d.*,
             (SELECT COUNT(*) FROM users u WHERE u.department_id = d.id AND u.role = 'student') as student_count,
             (SELECT COUNT(*) FROM users u WHERE u.department_id = d.id AND u.role = 'lecturer') as lecturer_count,
             (SELECT COUNT(*) FROM courses c WHERE c.department_id = d.id) as course_count
      FROM departments d
      ORDER BY d.name ASC
    `);
    res.json({ departments });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/departments
router.post('/departments', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { code, name, college } = req.body;
    if (!code || !name || !college) {
      res.status(400).json({ error: 'Code, name, and college are required.' });
      return;
    }

    const existing = dbManager.queryOne('SELECT id FROM departments WHERE UPPER(code) = UPPER(?)', [code.trim()]);
    if (existing) {
      res.status(409).json({ error: `Department code "${code}" already exists.` });
      return;
    }

    const now = new Date().toISOString();
    const result = dbManager.run(
      'INSERT INTO departments (code, name, college, created_at) VALUES (?, ?, ?, ?)',
      [code.trim().toUpperCase(), name.trim(), college.trim(), now]
    );

    logAudit(req, 'CREATE_DEPARTMENT', 'department', result.lastInsertRowid, `Created department ${code}: ${name}`);
    res.status(201).json({ message: 'Department created successfully.', departmentId: result.lastInsertRowid });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/departments/:id
router.put('/departments/:id', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const deptId = Number(req.params.id);
    const { code, name, college } = req.body;
    dbManager.run(
      'UPDATE departments SET code = ?, name = ?, college = ? WHERE id = ?',
      [code.trim().toUpperCase(), name.trim(), college.trim(), deptId]
    );
    logAudit(req, 'UPDATE_DEPARTMENT', 'department', deptId, `Updated department ${code}`);
    res.json({ message: 'Department updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/sessions
router.get('/sessions', (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessions = dbManager.query('SELECT * FROM academic_sessions ORDER BY start_date DESC');
    res.json({ sessions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/sessions
router.post('/sessions', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { name, semester, is_active, start_date, end_date } = req.body;
    if (!name || !semester || !start_date || !end_date) {
      res.status(400).json({ error: 'Name, semester, start date, and end date are required.' });
      return;
    }

    const now = new Date().toISOString();
    dbManager.transaction(() => {
      if (is_active) {
        dbManager.run('UPDATE academic_sessions SET is_active = 0');
      }
      dbManager.run(`
        INSERT INTO academic_sessions (name, semester, is_active, start_date, end_date, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [name.trim(), semester.trim(), is_active ? 1 : 0, start_date, end_date, now]);
    });

    logAudit(req, 'CREATE_SESSION', 'session', name, `Created academic session ${name} - ${semester}`);
    res.status(201).json({ message: 'Academic session created successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/sessions/:id/set-active
router.post('/sessions/:id/set-active', (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessionId = Number(req.params.id);
    dbManager.transaction(() => {
      dbManager.run('UPDATE academic_sessions SET is_active = 0');
      dbManager.run('UPDATE academic_sessions SET is_active = 1 WHERE id = ?', [sessionId]);
    });
    logAudit(req, 'SET_ACTIVE_SESSION', 'session', sessionId, `Activated session ID ${sessionId}`);
    res.json({ message: 'Active academic session updated.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/courses
router.get('/courses', (req: AuthenticatedRequest, res: Response) => {
  try {
    const departmentId = req.query.department_id as string;
    let sql = `
      SELECT c.*, d.name as department_name, d.code as department_code,
             (SELECT COUNT(*) FROM student_enrollments se WHERE se.course_id = c.id) as enrolled_count,
             (SELECT u.full_name FROM course_assignments ca JOIN users u ON ca.lecturer_id = u.id WHERE ca.course_id = c.id LIMIT 1) as assigned_lecturer,
             (SELECT u.id FROM course_assignments ca JOIN users u ON ca.lecturer_id = u.id WHERE ca.course_id = c.id LIMIT 1) as assigned_lecturer_id
      FROM courses c
      JOIN departments d ON c.department_id = d.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (departmentId) {
      sql += ' AND c.department_id = ?';
      params.push(Number(departmentId));
    }
    sql += ' ORDER BY c.code ASC';

    const courses = dbManager.query(sql, params);
    res.json({ courses });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/courses
router.post('/courses', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { code, title, credit_units, department_id, level, semester } = req.body;
    if (!code || !title || !department_id || !level || !semester) {
      res.status(400).json({ error: 'Code, title, department, level, and semester are required.' });
      return;
    }

    const existing = dbManager.queryOne(
      'SELECT id FROM courses WHERE UPPER(code) = UPPER(?) AND department_id = ?',
      [code.trim(), Number(department_id)]
    );
    if (existing) {
      res.status(409).json({ error: `Course ${code} already exists in this department.` });
      return;
    }

    const now = new Date().toISOString();
    const result = dbManager.run(`
      INSERT INTO courses (code, title, credit_units, department_id, level, semester, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
    `, [
      code.trim().toUpperCase(),
      title.trim(),
      credit_units ? Number(credit_units) : 3,
      Number(department_id),
      level,
      semester,
      now
    ]);

    logAudit(req, 'CREATE_COURSE', 'course', result.lastInsertRowid, `Created course ${code}: ${title}`);
    res.status(201).json({ message: 'Course created successfully.', courseId: result.lastInsertRowid });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/assignments - Assign lecturer to course
router.post('/assignments', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { course_id, lecturer_id, session_id } = req.body;
    if (!course_id || !lecturer_id) {
      res.status(400).json({ error: 'Course ID and Lecturer ID are required.' });
      return;
    }

    let resolvedSessionId = session_id;
    if (!resolvedSessionId) {
      const activeSession = dbManager.queryOne('SELECT id FROM academic_sessions WHERE is_active = 1');
      if (!activeSession) {
        res.status(400).json({ error: 'No active academic session found.' });
        return;
      }
      resolvedSessionId = activeSession.id;
    }

    const now = new Date().toISOString();
    dbManager.run(`
      INSERT INTO course_assignments (course_id, lecturer_id, session_id, assigned_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(course_id, lecturer_id, session_id) DO NOTHING
    `, [Number(course_id), Number(lecturer_id), Number(resolvedSessionId), now]);

    logAudit(req, 'ASSIGN_LECTURER', 'course_assignment', course_id, `Assigned lecturer ${lecturer_id} to course ${course_id}`);
    res.json({ message: 'Lecturer assigned to course successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/audit-logs
router.get('/audit-logs', (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;
    const action = req.query.action as string;

    let sql = `
      SELECT a.*, u.full_name as user_name, u.email as user_email, u.role as user_role
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (action) {
      sql += ' AND a.action = ?';
      params.push(action);
    }
    sql += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const logs = dbManager.query(sql, params);
    const totalCount = dbManager.queryOne('SELECT COUNT(*) as count FROM audit_logs')?.count || 0;

    res.json({ logs, totalCount, limit, offset });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/settings
router.get('/settings', (req: AuthenticatedRequest, res: Response) => {
  try {
    const settings = dbManager.query('SELECT * FROM institutional_settings');
    const settingsMap: Record<string, string> = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }
    res.json({ settings, settingsMap });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/settings
router.put('/settings', (req: AuthenticatedRequest, res: Response) => {
  try {
    const updates = req.body;
    const now = new Date().toISOString();
    dbManager.transaction(() => {
      for (const [key, value] of Object.entries(updates)) {
        dbManager.run(`
          INSERT INTO institutional_settings (key, value, description, updated_at)
          VALUES (?, ?, '', ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        `, [key, String(value), now]);
      }
    });

    logAudit(req, 'UPDATE_SETTINGS', 'institutional_settings', 'all', 'Institutional settings updated');
    res.json({ message: 'Settings saved successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
