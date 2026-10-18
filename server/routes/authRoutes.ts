import { Router, Request, Response } from 'express';
import { dbManager } from '../db.ts';
import { hashPassword, comparePassword, generateToken, authenticate, AuthenticatedRequest } from '../auth.ts';
import { logAudit } from '../audit.ts';

const router = Router();

// GET /api/auth/test-accounts
router.get('/test-accounts', (req: Request, res: Response) => {
  res.json({
    accounts: [
      {
        role: 'admin',
        roleLabel: 'Institutional Administrator',
        email: 'admin@kadpoly.edu.ng',
        password: 'AdminPass123!',
        name: 'Engr. Dr. Suleiman Aliyu',
        title: 'Director of Academic Planning & Quality Assurance',
        description: 'Full institutional governance: manage departments, sessions, courses, user accounts, audit logs, and institutional settings.'
      },
      {
        role: 'lecturer',
        roleLabel: 'Departmental Lecturer',
        email: 'lecturer@kadpoly.edu.ng',
        password: 'LecturerPass123!',
        name: 'Mal. Ibrahim Mohammed',
        title: 'Senior Lecturer, Computer Science Dept.',
        description: 'Course management: mark lecture attendance, review student correction requests, edit records with audit trails, and export reports.'
      },
      {
        role: 'student',
        roleLabel: 'Enrolled Student',
        email: 'student@kadpoly.edu.ng',
        password: 'StudentPass123!',
        name: 'Fatima Bello',
        title: 'HND I Computer Science (Matric: KPT/CST/23/45892)',
        description: 'Student portal: view registered courses, live attendance percentage, 75% exam clearance gauge, and submit correction requests.'
      }
    ]
  });
});

// POST /api/auth/register
router.post('/register', (req: Request, res: Response): void => {
  try {
    const { email, password, full_name, role, identifier, department_id, level, phone } = req.body;

    if (!email || !password || !full_name || !role) {
      res.status(400).json({ error: 'Please provide email, password, full name, and role.' });
      return;
    }

    if (!['admin', 'lecturer', 'student'].includes(role)) {
      res.status(400).json({ error: 'Role must be admin, lecturer, or student.' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      return;
    }

    // Check if email already exists
    const existingEmail = dbManager.queryOne('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email.trim()]);
    if (existingEmail) {
      res.status(409).json({ error: 'An account with this email address already exists.' });
      return;
    }

    // Check identifier uniqueness if provided
    const cleanIdentifier = identifier ? identifier.trim() : null;
    if (cleanIdentifier) {
      const existingId = dbManager.queryOne('SELECT id FROM users WHERE UPPER(identifier) = UPPER(?)', [cleanIdentifier]);
      if (existingId) {
        res.status(409).json({ error: `The identifier/matriculation number "${cleanIdentifier}" is already registered.` });
        return;
      }
    }

    const hashed = hashPassword(password);
    const now = new Date().toISOString();

    const insertResult = dbManager.run(`
      INSERT INTO users (email, password_hash, full_name, role, identifier, department_id, level, phone, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `, [
      email.trim().toLowerCase(),
      hashed,
      full_name.trim(),
      role,
      cleanIdentifier,
      department_id ? Number(department_id) : null,
      level || (role === 'student' ? 'ND I' : null),
      phone ? phone.trim() : null,
      now,
      now
    ]);

    const newUserId = insertResult.lastInsertRowid;

    // Auto-enroll new student in courses for their department and level
    if (role === 'student' && department_id) {
      const activeSession = dbManager.queryOne('SELECT id FROM academic_sessions WHERE is_active = 1');
      if (activeSession) {
        const studentLevel = level || 'ND I';
        const matchingCourses = dbManager.query(
          'SELECT id FROM courses WHERE department_id = ? AND level = ?',
          [department_id, studentLevel]
        );
        for (const c of matchingCourses) {
          try {
            dbManager.run(`
              INSERT OR IGNORE INTO student_enrollments (course_id, student_id, session_id, enrolled_at, status)
              VALUES (?, ?, ?, ?, 'enrolled')
            `, [c.id, newUserId, activeSession.id, now]);
          } catch (e) {
            // Ignore duplicate
          }
        }
      }
    }

    logAudit(req, 'USER_REGISTER', 'user', newUserId, `User registered with role ${role}: ${email.toLowerCase()}`, newUserId);

    // Auto login: issue token
    const token = generateToken({ id: newUserId, email: email.toLowerCase(), role });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    const user = dbManager.queryOne(`
      SELECT u.id, u.email, u.full_name, u.role, u.identifier, u.department_id, u.level, u.phone, u.status,
             d.name as department_name, d.code as department_code
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = ?
    `, [newUserId]);

    res.status(201).json({
      message: 'Account created successfully! You are now logged in.',
      token,
      user
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(500).json({ error: err.message || 'Failed to register account.' });
  }
});

// POST /api/auth/login
router.post('/login', (req: Request, res: Response): void => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Please enter both email and password.' });
      return;
    }

    const user = dbManager.queryOne(`
      SELECT u.*, d.name as department_name, d.code as department_code
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE LOWER(u.email) = LOWER(?)
    `, [email.trim()]);

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials. No user found with this email.' });
      return;
    }

    if (user.status !== 'active') {
      res.status(403).json({ error: `Account is ${user.status}. Please contact the system administrator.` });
      return;
    }

    const isValid = comparePassword(password, user.password_hash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid credentials. Incorrect password.' });
      return;
    }

    const token = generateToken({ id: user.id, email: user.email, role: user.role });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    logAudit(req, 'LOGIN', 'user', user.id, `User logged in: ${user.email} (${user.role})`, user.id);

    const { password_hash, ...safeUser } = user;
    res.json({
      message: 'Login successful.',
      token,
      user: safeUser
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'An unexpected error occurred during login.' });
  }
});

// POST /api/auth/quick-login (One-click login for test accounts)
router.post('/quick-login', (req: Request, res: Response): void => {
  try {
    const { role } = req.body;
    if (!['admin', 'lecturer', 'student'].includes(role)) {
      res.status(400).json({ error: 'Invalid quick login role requested.' });
      return;
    }

    const emailMap: Record<string, string> = {
      admin: 'admin@kadpoly.edu.ng',
      lecturer: 'lecturer@kadpoly.edu.ng',
      student: 'student@kadpoly.edu.ng'
    };

    const targetEmail = emailMap[role];
    const user = dbManager.queryOne(`
      SELECT u.*, d.name as department_name, d.code as department_code
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE LOWER(u.email) = LOWER(?)
    `, [targetEmail]);

    if (!user) {
      res.status(404).json({ error: `Default test account for ${role} not found in database.` });
      return;
    }

    const token = generateToken({ id: user.id, email: user.email, role: user.role });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    logAudit(req, 'QUICK_LOGIN', 'user', user.id, `Quick test login for ${role}: ${user.email}`, user.id);

    const { password_hash, ...safeUser } = user;
    res.json({
      message: `Quick login successful as ${role.toUpperCase()}.`,
      token,
      user: safeUser
    });
  } catch (err: any) {
    console.error('Quick login error:', err);
    res.status(500).json({ error: 'Failed to execute quick login.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, (req: AuthenticatedRequest, res: Response): void => {
  res.json({ user: req.user });
});

// POST /api/auth/logout
router.post('/logout', authenticate, (req: AuthenticatedRequest, res: Response): void => {
  if (req.user) {
    logAudit(req, 'LOGOUT', 'user', req.user.id, `User logged out: ${req.user.email}`);
  }
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully.' });
});

// POST /api/auth/reset-password
router.post('/reset-password', (req: Request, res: Response): void => {
  try {
    const { email, new_password, security_code } = req.body;
    if (!email || !new_password) {
      res.status(400).json({ error: 'Please specify email and new password.' });
      return;
    }

    if (new_password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      return;
    }

    const user = dbManager.queryOne('SELECT id, email FROM users WHERE LOWER(email) = LOWER(?)', [email.trim()]);
    if (!user) {
      res.status(404).json({ error: 'No account found with this email address.' });
      return;
    }

    const newHash = hashPassword(new_password);
    const now = new Date().toISOString();
    dbManager.run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [newHash, now, user.id]);

    logAudit(req, 'PASSWORD_RESET', 'user', user.id, `Password reset for user ${user.email}`, user.id);
    res.json({ message: 'Password has been reset successfully. You can now log in.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to reset password.' });
  }
});

export default router;
