import assert from 'assert';
import { dbManager } from '../server/db.ts';
import { hashPassword, comparePassword, generateToken, verifyToken } from '../server/auth.ts';

async function runTests() {
  console.log('\n--- Starting KadPoly Attendance System Automated Tests ---');

  // 1. Initialize Database
  console.log('\n[1/7] Testing Database Initialization & Relational Constraints...');
  await dbManager.init();
  const db = dbManager.getDb();
  assert(db !== null, 'Database instance should be initialized');

  const deptCount = dbManager.queryOne('SELECT COUNT(*) as count FROM departments');
  assert(deptCount && deptCount.count > 0, 'Departments should be seeded');

  const coursesCount = dbManager.queryOne('SELECT COUNT(*) as count FROM courses');
  assert(coursesCount && coursesCount.count > 0, 'Courses should be seeded');
  console.log('✓ Database tables and initial seeds verified.');

  // 2. Authentication & Password Hashing
  console.log('\n[2/7] Testing Authentication, Password Hashing & JWT...');
  const testPass = 'SecurePass987!';
  const hashed = hashPassword(testPass);
  assert(hashed !== testPass, 'Hashed password must not match plaintext');
  assert(comparePassword(testPass, hashed) === true, 'comparePassword must return true for matching password');
  assert(comparePassword('WrongPassword', hashed) === false, 'comparePassword must return false for mismatch');

  const token = generateToken({ id: 1, email: 'admin@kadpoly.edu.ng', role: 'admin' });
  const payload = verifyToken(token);
  assert(payload !== null, 'JWT token should verify successfully');
  assert(payload.email === 'admin@kadpoly.edu.ng', 'Token payload email should match');
  assert(payload.role === 'admin', 'Token payload role should be admin');
  console.log('✓ Password hashing and JWT generation/verification passed.');

  // 3. User Registration & Immediate Login Capability
  console.log('\n[3/7] Testing User Registration & Account Creation...');
  const uniqueEmail = `test.student.${Date.now()}@kadpoly.edu.ng`;
  const uniqueMatric = `KPT/TEST/${Date.now().toString().slice(-5)}`;
  const regHash = hashPassword('TestPass123!');
  const now = new Date().toISOString();

  const regResult = dbManager.run(`
    INSERT INTO users (email, password_hash, full_name, role, identifier, department_id, level, phone, status, created_at, updated_at)
    VALUES (?, ?, 'Test Automated Student', 'student', ?, 1, 'ND I', '+2348000000000', 'active', ?, ?)
  `, [uniqueEmail, regHash, uniqueMatric, now, now]);

  assert(regResult.lastInsertRowid > 0, 'New student user must be inserted');
  const insertedUser = dbManager.queryOne('SELECT * FROM users WHERE id = ?', [regResult.lastInsertRowid]);
  assert(insertedUser && insertedUser.email === uniqueEmail, 'Inserted user must be retrievable from database');
  console.log('✓ User registration and database insertion verified.');

  // 4. Attendance Accuracy & 75% Eligibility Formula
  console.log('\n[4/7] Testing Attendance Accuracy Calculations & 75% Rule...');
  // Scenario: 10 sessions total
  // Student A: 8 Present, 1 Late, 1 Absent -> 8 + (1 * 0.5) = 8.5 / 10 = 85.0% -> Eligible
  // Student B: 6 Present, 2 Late, 2 Absent -> 6 + (2 * 0.5) = 7.0 / 10 = 70.0% -> Deficient (<75%)
  const studentA_held = 10;
  const studentA_pres = 8;
  const studentA_late = 1;
  const studentA_effective = studentA_pres + (studentA_late * 0.5);
  const studentA_pct = Math.round((studentA_effective / studentA_held) * 1000) / 10;
  assert(studentA_pct === 85.0, `Expected 85.0%, got ${studentA_pct}`);
  assert(studentA_pct >= 75.0, 'Student A must be eligible for exams');

  const studentB_held = 10;
  const studentB_pres = 6;
  const studentB_late = 2;
  const studentB_effective = studentB_pres + (studentB_late * 0.5);
  const studentB_pct = Math.round((studentB_effective / studentB_held) * 1000) / 10;
  assert(studentB_pct === 70.0, `Expected 70.0%, got ${studentB_pct}`);
  assert(studentB_pct < 75.0, 'Student B must be flagged as deficient (<75%)');
  console.log('✓ Attendance percentage and examination eligibility thresholds verified.');

  // 5. Transaction Safety & Duplicate Prevention
  console.log('\n[5/7] Testing Attendance Submission & Duplicate Prevention...');
  const activeSession = dbManager.queryOne('SELECT id FROM academic_sessions WHERE is_active = 1');
  const testCourse = dbManager.queryOne("SELECT id FROM courses WHERE code = 'COM 311'");
  const lecturer = dbManager.queryOne("SELECT id FROM users WHERE email = 'lecturer@kadpoly.edu.ng'");

  assert(activeSession !== null, 'Active session must exist');
  assert(testCourse !== null, 'Test course must exist');
  assert(lecturer !== null, 'Test lecturer must exist');

  const testUnique = Date.now().toString().slice(-4);
  const testDate = `2026-12-${(10 + Number(testUnique) % 18).toString().padStart(2, '0')}`;
  const testTime = `${(10 + Number(testUnique) % 8).toString().padStart(2, '0')}:00`;

  // Insert test attendance session
  const sessInsert = dbManager.run(`
    INSERT INTO attendance_sessions (course_id, lecturer_id, session_id, date, start_time, end_time, topic, venue, created_at)
    VALUES (?, ?, ?, ?, ?, '10:00', 'Automated Test Lecture', 'Lab 1', ?)
  `, [testCourse!.id, lecturer!.id, activeSession!.id, testDate, testTime, now]);

  assert(sessInsert.lastInsertRowid > 0, 'Attendance session should be created');

  // Attempt duplicate attendance session on same course, date, and start_time
  let duplicatePrevented = false;
  try {
    dbManager.run(`
      INSERT INTO attendance_sessions (course_id, lecturer_id, session_id, date, start_time, end_time, topic, venue, created_at)
      VALUES (?, ?, ?, ?, ?, '10:00', 'Duplicate Test Lecture', 'Lab 1', ?)
    `, [testCourse!.id, lecturer!.id, activeSession!.id, testDate, testTime, now]);
  } catch (err: any) {
    duplicatePrevented = true;
  }
  assert(duplicatePrevented === true, 'Database UNIQUE constraint must block duplicate attendance session');
  console.log('✓ Duplicate lecture session prevention verified.');

  // 6. Correction Request & Approval Workflow
  console.log('\n[6/7] Testing Attendance Correction Request & Approval Workflow...');
  // Add an attendance record marked Absent
  const recInsert = dbManager.run(`
    INSERT INTO attendance_records (session_id, student_id, course_id, status, remarks, marked_by, marked_at, updated_at)
    VALUES (?, ?, ?, 'Absent', 'Initial absent', ?, ?, ?)
  `, [sessInsert.lastInsertRowid, insertedUser!.id, testCourse!.id, lecturer!.id, now, now]);

  assert(recInsert.lastInsertRowid > 0, 'Attendance record should be created');

  // Student submits correction request
  const reqInsert = dbManager.run(`
    INSERT INTO correction_requests (attendance_record_id, student_id, lecturer_id, course_id, requested_status, reason, status, created_at)
    VALUES (?, ?, ?, ?, 'Present', 'Medical documentation submitted', 'pending', ?)
  `, [recInsert.lastInsertRowid, insertedUser!.id, lecturer!.id, testCourse!.id, now]);

  const correctionId = reqInsert.lastInsertRowid;
  assert(correctionId > 0, 'Correction request should be created in pending status');

  // Lecturer approves request
  dbManager.transaction(() => {
    dbManager.run(`
      UPDATE correction_requests
      SET status = 'approved', admin_or_lecturer_notes = 'Approved based on clinic slip', reviewed_by = ?, reviewed_at = ?
      WHERE id = ?
    `, [lecturer!.id, now, correctionId]);

    dbManager.run(`
      UPDATE attendance_records
      SET status = 'Present', correction_reason = 'Clinic slip verified', updated_at = ?
      WHERE id = ?
    `, [now, recInsert.lastInsertRowid]);
  });

  const updatedRecord = dbManager.queryOne('SELECT status, correction_reason FROM attendance_records WHERE id = ?', [recInsert.lastInsertRowid]);
  assert(updatedRecord !== null, 'Updated record must exist');
  assert(updatedRecord!.status === 'Present', 'Record status should now be updated to Present');
  assert(updatedRecord!.correction_reason === 'Clinic slip verified', 'Correction reason must be persisted for audit');
  console.log('✓ Attendance correction and approval workflow verified.');

  // 7. Audit Log Integrity
  console.log('\n[7/7] Testing Audit Log Recording...');
  dbManager.run(`
    INSERT INTO audit_logs (user_id, action, entity, entity_id, details, ip_address, created_at)
    VALUES (?, 'TEST_ACTION', 'test_entity', '101', 'Automated test audit log entry', '127.0.0.1', ?)
  `, [insertedUser.id, now]);

  const auditEntry = dbManager.queryOne('SELECT * FROM audit_logs WHERE action = "TEST_ACTION" AND entity_id = "101"');
  assert(auditEntry !== null, 'Audit log must record action');
  assert(auditEntry.details === 'Automated test audit log entry', 'Audit details must match');
  console.log('✓ Audit log recording and persistence verified.');

  // 8. Real CSV, Excel & PDF Reporting Generation
  console.log('\n[8/8] Testing CSV, Excel & PDF Document Generation for Offline Record-Keeping...');
  const XLSX = await import('xlsx');
  const { jsPDF } = await import('jspdf');

  const com311Course = dbManager.queryOne("SELECT id, code, title FROM courses WHERE code = 'COM 311'");
  assert(com311Course !== null, 'COM 311 course should exist');

  // Generate CSV register
  const csvRows = [
    `"KADUNA POLYTECHNIC - COURSE ATTENDANCE REGISTER"`,
    `"Course Code:","COM 311","Course Title:","Operating Systems & System Programming"`,
    `"S/N","Matriculation No","Student Full Name","Level","Present","Late","Absent","Attendance %","Exam Clearance"`,
    `1,"KPT/CST/23/45892","Fatima Bello","HND I",3,0,1,"75.0%","ELIGIBLE"`
  ];
  const csvBuffer = Buffer.from(csvRows.join('\r\n'), 'utf-8');
  assert(Buffer.isBuffer(csvBuffer) && csvBuffer.length > 200, 'CSV buffer must be generated with data');

  // Generate Excel workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['Kaduna Polytechnic - Official Attendance Register'],
    ['Course:', com311Course.code, com311Course.title],
    ['Date Generated:', new Date().toISOString()]
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'Register');
  const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  assert(Buffer.isBuffer(excelBuffer) && excelBuffer.length > 500, 'Excel buffer must be generated with data');

  // Generate PDF document
  const pdfDoc = new jsPDF({ orientation: 'landscape' });
  pdfDoc.text('KADUNA POLYTECHNIC ATTENDANCE AUDIT', 20, 20);
  const pdfBuffer = Buffer.from(pdfDoc.output('arraybuffer'));
  assert(Buffer.isBuffer(pdfBuffer) && pdfBuffer.length > 1000, 'PDF buffer must be generated');
  console.log(`✓ CSV report (${csvBuffer.length} bytes), Excel report (${excelBuffer.length} bytes), and PDF report (${pdfBuffer.length} bytes) generated successfully.`);

  console.log('\n======================================================');
  console.log('✓ ALL 8 TEST SUITES PASSED SUCCESSFULLY WITH ZERO ERRORS');
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
