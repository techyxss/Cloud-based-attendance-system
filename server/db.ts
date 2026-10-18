import fs from 'fs';
import path from 'path';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import bcrypt from 'bcryptjs';

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'kadpoly.sqlite');

export interface QueryResult {
  [key: string]: any;
}

class DatabaseManager {
  private db: SqlJsDatabase | null = null;
  private isInitialized = false;

  public async init(): Promise<SqlJsDatabase> {
    if (this.isInitialized && this.db) {
      return this.db;
    }

    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }

    const SQL = await initSqlJs();
    if (fs.existsSync(DB_FILE)) {
      const fileBuffer = fs.readFileSync(DB_FILE);
      this.db = new SQL.Database(fileBuffer);
    } else {
      this.db = new SQL.Database();
    }

    this.isInitialized = true;
    this.runMigrations();
    this.seedInitialData();
    this.persist();

    return this.db;
  }

  public getDb(): SqlJsDatabase {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
    return this.db;
  }

  public persist(): void {
    if (!this.db) return;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(DB_FILE, buffer);
    } catch (err) {
      console.error('Failed to persist SQLite database:', err);
    }
  }

  public query(sql: string, params: any[] = []): QueryResult[] {
    const db = this.getDb();
    const stmt = db.prepare(sql);
    try {
      stmt.bind(params);
      const results: QueryResult[] = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      return results;
    } finally {
      stmt.free();
    }
  }

  public queryOne(sql: string, params: any[] = []): QueryResult | null {
    const results = this.query(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  private inTransaction = false;

  public run(sql: string, params: any[] = []): { changes: number; lastInsertRowid: number } {
    const db = this.getDb();
    const stmt = db.prepare(sql);
    try {
      stmt.bind(params);
      stmt.step();
      const lastIdResult = db.exec('SELECT last_insert_rowid() as id');
      const lastInsertRowid = lastIdResult[0]?.values[0]?.[0] as number || 0;
      const changesResult = db.exec('SELECT changes() as changes');
      const changes = changesResult[0]?.values[0]?.[0] as number || 0;
      if (!this.inTransaction) {
        this.persist();
      }
      return { changes, lastInsertRowid };
    } finally {
      stmt.free();
    }
  }

  public transaction<T>(callback: () => T): T {
    const db = this.getDb();
    db.exec('SAVEPOINT sp_tx');
    this.inTransaction = true;
    try {
      const result = callback();
      db.exec('RELEASE SAVEPOINT sp_tx');
      this.inTransaction = false;
      this.persist();
      return result;
    } catch (err) {
      try {
        db.exec('ROLLBACK TO SAVEPOINT sp_tx');
      } catch (rbErr) {
        // savepoint might not exist
      }
      this.inTransaction = false;
      throw err;
    }
  }

  private runMigrations(): void {
    const db = this.getDb();
    db.exec(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        college TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'lecturer', 'student')),
        identifier TEXT UNIQUE,
        department_id INTEGER,
        level TEXT,
        phone TEXT,
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'suspended')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS academic_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        semester TEXT NOT NULL,
        is_active INTEGER DEFAULT 0,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(name, semester)
      );

      CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL,
        title TEXT NOT NULL,
        credit_units INTEGER NOT NULL DEFAULT 3,
        department_id INTEGER NOT NULL,
        level TEXT NOT NULL,
        semester TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        created_at TEXT NOT NULL,
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
        UNIQUE(code, department_id)
      );

      CREATE TABLE IF NOT EXISTS course_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id INTEGER NOT NULL,
        lecturer_id INTEGER NOT NULL,
        session_id INTEGER NOT NULL,
        assigned_at TEXT NOT NULL,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
        FOREIGN KEY (lecturer_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (session_id) REFERENCES academic_sessions(id) ON DELETE CASCADE,
        UNIQUE(course_id, lecturer_id, session_id)
      );

      CREATE TABLE IF NOT EXISTS student_enrollments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id INTEGER NOT NULL,
        student_id INTEGER NOT NULL,
        session_id INTEGER NOT NULL,
        enrolled_at TEXT NOT NULL,
        status TEXT DEFAULT 'enrolled' CHECK(status IN ('enrolled', 'dropped')),
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (session_id) REFERENCES academic_sessions(id) ON DELETE CASCADE,
        UNIQUE(course_id, student_id, session_id)
      );

      CREATE TABLE IF NOT EXISTS attendance_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id INTEGER NOT NULL,
        lecturer_id INTEGER NOT NULL,
        session_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        topic TEXT NOT NULL,
        venue TEXT DEFAULT 'Lecture Hall 1',
        created_at TEXT NOT NULL,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
        FOREIGN KEY (lecturer_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (session_id) REFERENCES academic_sessions(id) ON DELETE CASCADE,
        UNIQUE(course_id, date, start_time)
      );

      CREATE TABLE IF NOT EXISTS attendance_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        student_id INTEGER NOT NULL,
        course_id INTEGER NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('Present', 'Absent', 'Late')),
        remarks TEXT,
        marked_by INTEGER,
        marked_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        correction_reason TEXT,
        FOREIGN KEY (session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
        FOREIGN KEY (marked_by) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE(session_id, student_id)
      );

      CREATE TABLE IF NOT EXISTS correction_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        attendance_record_id INTEGER NOT NULL,
        student_id INTEGER NOT NULL,
        lecturer_id INTEGER NOT NULL,
        course_id INTEGER NOT NULL,
        requested_status TEXT NOT NULL CHECK(requested_status IN ('Present', 'Late')),
        reason TEXT NOT NULL,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
        admin_or_lecturer_notes TEXT,
        reviewed_by INTEGER,
        reviewed_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (attendance_record_id) REFERENCES attendance_records(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (lecturer_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        entity TEXT NOT NULL,
        entity_id TEXT,
        details TEXT NOT NULL,
        ip_address TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS institutional_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT,
        updated_at TEXT NOT NULL
      );
    `);
  }

  private seedInitialData(): void {
    const db = this.getDb();
    const now = new Date().toISOString();

    // 1. Institutional Settings
    const settingsCount = this.queryOne('SELECT COUNT(*) as count FROM institutional_settings');
    if (settingsCount?.count === 0) {
      const defaultSettings = [
        ['institution_name', 'Kaduna Polytechnic', 'Name of educational institution'],
        ['institution_short', 'KadPoly', 'Acronym of institution'],
        ['attendance_minimum_percentage', '75', 'Minimum percentage required to sit for semester examinations'],
        ['late_arrival_weight', '0.5', 'Attendance weight given for late status (e.g. 0.5 or 1.0)'],
        ['allow_student_self_registration', 'true', 'Whether students can self-register courses'],
        ['allow_correction_requests', 'true', 'Enable student attendance correction requests workflow']
      ];
      for (const [key, val, desc] of defaultSettings) {
        db.run('INSERT INTO institutional_settings (key, value, description, updated_at) VALUES (?, ?, ?, ?)', [key, val, desc, now]);
      }
    }

    // 2. Departments
    const deptCount = this.queryOne('SELECT COUNT(*) as count FROM departments');
    if (deptCount?.count === 0) {
      const depts = [
        ['COM', 'Computer Science', 'College of Science & Technology'],
        ['EET', 'Electrical & Electronics Engineering', 'College of Engineering'],
        ['ACC', 'Accountancy', 'College of Business & Management Studies'],
        ['CVE', 'Civil Engineering', 'College of Engineering'],
        ['MAC', 'Mass Communication', 'College of Administrative Studies'],
        ['SLT', 'Science Laboratory Technology', 'College of Science & Technology']
      ];
      for (const [code, name, college] of depts) {
        db.run('INSERT INTO departments (code, name, college, created_at) VALUES (?, ?, ?, ?)', [code, name, college, now]);
      }
    }

    // 3. Academic Sessions
    const sessionCount = this.queryOne('SELECT COUNT(*) as count FROM academic_sessions');
    if (sessionCount?.count === 0) {
      db.run(`
        INSERT INTO academic_sessions (name, semester, is_active, start_date, end_date, created_at)
        VALUES ('2025/2026', 'First Semester', 1, '2025-10-01', '2026-03-31', ?)
      `, [now]);
      db.run(`
        INSERT INTO academic_sessions (name, semester, is_active, start_date, end_date, created_at)
        VALUES ('2025/2026', 'Second Semester', 0, '2026-04-15', '2026-09-30', ?)
      `, [now]);
    }

    // 4. Default Test Accounts
    const userCount = this.queryOne('SELECT COUNT(*) as count FROM users');
    if (userCount?.count === 0) {
      const adminPass = bcrypt.hashSync('AdminPass123!', 10);
      const lecturerPass = bcrypt.hashSync('LecturerPass123!', 10);
      const studentPass = bcrypt.hashSync('StudentPass123!', 10);

      // Admin
      db.run(`
        INSERT INTO users (email, password_hash, full_name, role, identifier, department_id, level, phone, status, created_at, updated_at)
        VALUES ('admin@kadpoly.edu.ng', ?, 'Engr. Dr. Suleiman Aliyu', 'admin', 'KPT/STAFF/ADM/001', 1, NULL, '+2348031234567', 'active', ?, ?)
      `, [adminPass, now, now]);

      // Lecturer
      db.run(`
        INSERT INTO users (email, password_hash, full_name, role, identifier, department_id, level, phone, status, created_at, updated_at)
        VALUES ('lecturer@kadpoly.edu.ng', ?, 'Mal. Ibrahim Mohammed', 'lecturer', 'KPT/STAFF/CST/104', 1, NULL, '+2348029876543', 'active', ?, ?)
      `, [lecturerPass, now, now]);

      // Additional Lecturers for variety
      db.run(`
        INSERT INTO users (email, password_hash, full_name, role, identifier, department_id, level, phone, status, created_at, updated_at)
        VALUES ('dr.aminu@kadpoly.edu.ng', ?, 'Dr. Aminu Danjuma', 'lecturer', 'KPT/STAFF/CST/112', 1, NULL, '+2348035551234', 'active', ?, ?)
      `, [lecturerPass, now, now]);

      // Primary Student test account
      db.run(`
        INSERT INTO users (email, password_hash, full_name, role, identifier, department_id, level, phone, status, created_at, updated_at)
        VALUES ('student@kadpoly.edu.ng', ?, 'Fatima Bello', 'student', 'KPT/CST/23/45892', 1, 'HND I', '+2348141122334', 'active', ?, ?)
      `, [studentPass, now, now]);

      // Classmates for realistic group attendance
      const classmates = [
        ['usman.aliyu@kadpoly.edu.ng', 'Usman Aliyu', 'KPT/CST/23/45893', 'HND I', '+2348149988771'],
        ['chidinma.okafor@kadpoly.edu.ng', 'Chidinma Okafor', 'KPT/CST/23/45894', 'HND I', '+2348149988772'],
        ['abubakar.sadiq@kadpoly.edu.ng', 'Abubakar Sadiq', 'KPT/CST/23/45895', 'HND I', '+2348149988773'],
        ['zainab.mustapha@kadpoly.edu.ng', 'Zainab Mustapha', 'KPT/CST/23/45896', 'HND I', '+2348149988774']
      ];

      for (const [cEmail, cName, cId, cLevel, cPhone] of classmates) {
        db.run(`
          INSERT INTO users (email, password_hash, full_name, role, identifier, department_id, level, phone, status, created_at, updated_at)
          VALUES (?, ?, ?, 'student', ?, 1, ?, ?, 'active', ?, ?)
        `, [cEmail, studentPass, cName, cId, cLevel, cPhone, now, now]);
      }
    }

    // 5. Courses
    const courseCount = this.queryOne('SELECT COUNT(*) as count FROM courses');
    if (courseCount?.count === 0) {
      const courses = [
        ['COM 311', 'Operating Systems & System Programming', 3, 1, 'HND I', 'First Semester'],
        ['COM 312', 'Database Design & Management II', 3, 1, 'HND I', 'First Semester'],
        ['COM 313', 'Computer Architecture & Assembly Language', 2, 1, 'HND I', 'First Semester'],
        ['COM 314', 'Software Engineering Methodologies', 3, 1, 'HND I', 'First Semester'],
        ['COM 315', 'Data Communication & Networks', 3, 1, 'HND I', 'First Semester'],
        ['GNS 301', 'Use of English & Communication III', 2, 1, 'HND I', 'First Semester'],
        ['EET 311', 'Microprocessor Systems', 3, 2, 'HND I', 'First Semester']
      ];
      for (const [code, title, cu, deptId, level, sem] of courses) {
        db.run(`
          INSERT INTO courses (code, title, credit_units, department_id, level, semester, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
        `, [code, title, cu, deptId, level, sem, now]);
      }
    }

    // 6. Course Assignments (Assign Mal. Ibrahim to COM 311 and COM 312)
    const assignCount = this.queryOne('SELECT COUNT(*) as count FROM course_assignments');
    if (assignCount?.count === 0) {
      const lecturer = this.queryOne("SELECT id FROM users WHERE email = 'lecturer@kadpoly.edu.ng'");
      const com311 = this.queryOne("SELECT id FROM courses WHERE code = 'COM 311'");
      const com312 = this.queryOne("SELECT id FROM courses WHERE code = 'COM 312'");
      const session = this.queryOne("SELECT id FROM academic_sessions WHERE is_active = 1");

      if (lecturer && session) {
        if (com311) {
          db.run(`
            INSERT INTO course_assignments (course_id, lecturer_id, session_id, assigned_at)
            VALUES (?, ?, ?, ?)
          `, [com311.id, lecturer.id, session.id, now]);
        }
        if (com312) {
          db.run(`
            INSERT INTO course_assignments (course_id, lecturer_id, session_id, assigned_at)
            VALUES (?, ?, ?, ?)
          `, [com312.id, lecturer.id, session.id, now]);
        }
      }
    }

    // 7. Student Enrollments
    const enrollCount = this.queryOne('SELECT COUNT(*) as count FROM student_enrollments');
    if (enrollCount?.count === 0) {
      const session = this.queryOne("SELECT id FROM academic_sessions WHERE is_active = 1");
      const students = this.query("SELECT id FROM users WHERE role = 'student'");
      const courses = this.query("SELECT id FROM courses WHERE department_id = 1 AND level = 'HND I'");

      if (session) {
        for (const st of students) {
          for (const c of courses) {
            db.run(`
              INSERT INTO student_enrollments (course_id, student_id, session_id, enrolled_at, status)
              VALUES (?, ?, ?, ?, 'enrolled')
            `, [c.id, st.id, session.id, now]);
          }
        }
      }
    }

    // 8. Seed genuine baseline attendance sessions and records so reports, metrics & corrections can be tested
    const attSessionCount = this.queryOne('SELECT COUNT(*) as count FROM attendance_sessions');
    if (attSessionCount?.count === 0) {
      const lecturer = this.queryOne("SELECT id FROM users WHERE email = 'lecturer@kadpoly.edu.ng'");
      const com311 = this.queryOne("SELECT id FROM courses WHERE code = 'COM 311'");
      const session = this.queryOne("SELECT id FROM academic_sessions WHERE is_active = 1");
      const students = this.query("SELECT id, email FROM users WHERE role = 'student'");

      if (lecturer && com311 && session && students.length > 0) {
        const sessionsData = [
          { date: '2026-10-05', start: '09:00', end: '11:00', topic: 'Course Overview, OS Architecture & Kernel Space', venue: 'ETF Hall 2' },
          { date: '2026-10-08', start: '10:00', end: '12:00', topic: 'Process States, PCB & Process Creation in Unix', venue: 'ETF Hall 2' },
          { date: '2026-10-12', start: '09:00', end: '11:00', topic: 'CPU Scheduling Algorithms: FCFS, SJF & Round Robin', venue: 'ETF Hall 2' },
          { date: '2026-10-15', start: '10:00', end: '12:00', topic: 'Process Synchronization, Race Conditions & Semaphores', venue: 'ETF Hall 2' }
        ];

        for (const s of sessionsData) {
          db.run(`
            INSERT INTO attendance_sessions (course_id, lecturer_id, session_id, date, start_time, end_time, topic, venue, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [com311.id, lecturer.id, session.id, s.date, s.start, s.end, s.topic, s.venue, now]);

          const createdSession = this.queryOne(`
            SELECT id FROM attendance_sessions
            WHERE course_id = ? AND date = ? AND start_time = ?
          `, [com311.id, s.date, s.start]);

          if (createdSession) {
            for (const st of students) {
              // Fatima Bello (student@kadpoly.edu.ng) attends 3 present, 1 absent (on Oct 12, ready for correction request)
              let status = 'Present';
              let remark = 'Punctual';
              if (st.email === 'student@kadpoly.edu.ng' && s.date === '2026-10-12') {
                status = 'Absent';
                remark = 'Unexcused';
              } else if (st.email === 'usman.aliyu@kadpoly.edu.ng' && s.date === '2026-10-08') {
                status = 'Late';
                remark = 'Arrived 25 mins after start';
              } else if (st.email === 'zainab.mustapha@kadpoly.edu.ng' && s.date === '2026-10-15') {
                status = 'Absent';
                remark = 'Sick';
              }

              db.run(`
                INSERT INTO attendance_records (session_id, student_id, course_id, status, remarks, marked_by, marked_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              `, [createdSession.id, st.id, com311.id, status, remark, lecturer.id, now, now]);
            }
          }
        }

        // Add 1 pending correction request from Fatima for the Oct 12 session
        const fatima = this.queryOne("SELECT id FROM users WHERE email = 'student@kadpoly.edu.ng'");
        const oct12Session = this.queryOne("SELECT id FROM attendance_sessions WHERE date = '2026-10-12' AND course_id = ?", [com311.id]);
        if (fatima && oct12Session) {
          const fatimaRecord = this.queryOne(`
            SELECT id FROM attendance_records WHERE session_id = ? AND student_id = ?
          `, [oct12Session.id, fatima.id]);

          if (fatimaRecord) {
            db.run(`
              INSERT INTO correction_requests (attendance_record_id, student_id, lecturer_id, course_id, requested_status, reason, status, created_at)
              VALUES (?, ?, ?, ?, 'Present', 'I attended the class but had to submit medical slip to clinic at lecture start. Class rep can confirm presence.', 'pending', ?)
            `, [fatimaRecord.id, fatima.id, lecturer.id, com311.id, now]);
          }
        }
      }
    }

    // 9. Initial Audit Log
    const auditCount = this.queryOne('SELECT COUNT(*) as count FROM audit_logs');
    if (auditCount?.count === 0) {
      db.run(`
        INSERT INTO audit_logs (user_id, action, entity, entity_id, details, ip_address, created_at)
        VALUES (1, 'SYSTEM_INIT', 'system', '0', 'KadPoly Attendance Management System initialized with default departments, session, courses, and security policies', '127.0.0.1', ?)
      `, [now]);
    }
  }
}

export const dbManager = new DatabaseManager();
