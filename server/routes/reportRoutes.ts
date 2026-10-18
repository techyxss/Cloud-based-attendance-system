import { Router, Response } from 'express';
import { dbManager } from '../db.ts';
import { authenticate, AuthenticatedRequest } from '../auth.ts';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const router = Router();

// Protect all report routes
router.use(authenticate);

// Helper to gather course attendance data
function getCourseReportData(courseId: number) {
  const course = dbManager.queryOne(`
    SELECT c.*, d.name as department_name, d.college,
           u.full_name as lecturer_name, u.identifier as lecturer_id_no,
           s.name as session_name, s.semester as session_semester
    FROM courses c
    JOIN departments d ON c.department_id = d.id
    LEFT JOIN course_assignments ca ON ca.course_id = c.id
    LEFT JOIN users u ON ca.lecturer_id = u.id
    LEFT JOIN academic_sessions s ON ca.session_id = s.id
    WHERE c.id = ?
  `, [courseId]);

  if (!course) return null;

  const sessions = dbManager.query(`
    SELECT id, date, start_time, end_time, topic, venue
    FROM attendance_sessions
    WHERE course_id = ?
    ORDER BY date ASC, start_time ASC
  `, [courseId]);

  const students = dbManager.query(`
    SELECT u.id, u.full_name, u.identifier, u.level, u.email
    FROM users u
    JOIN student_enrollments se ON u.id = se.student_id
    WHERE se.course_id = ? AND se.status = 'enrolled'
    ORDER BY u.identifier ASC, u.full_name ASC
  `, [courseId]);

  const allRecords = dbManager.query(`
    SELECT ar.session_id, ar.student_id, ar.status
    FROM attendance_records ar
    WHERE ar.course_id = ?
  `, [courseId]);

  const recordMap = new Map<string, string>();
  for (const r of allRecords) {
    recordMap.set(`${r.session_id}_${r.student_id}`, r.status);
  }

  const totalSessions = sessions.length;

  const studentRows = students.map((st: any, idx: number) => {
    let present = 0;
    let late = 0;
    let absent = 0;

    const sessionStatuses: Record<number, string> = {};
    for (const sess of sessions) {
      const status = recordMap.get(`${sess.id}_${st.id}`) || 'Absent';
      sessionStatuses[sess.id] = status;
      if (status === 'Present') present++;
      else if (status === 'Late') late++;
      else absent++;
    }

    const effectivePresent = present + (late * 0.5);
    const percentage = totalSessions > 0 ? Math.round((effectivePresent / totalSessions) * 1000) / 10 : 0;
    const isEligible = percentage >= 75;

    return {
      sn: idx + 1,
      id: st.id,
      name: st.full_name,
      identifier: st.identifier || 'N/A',
      level: st.level || 'ND/HND',
      present,
      late,
      absent,
      percentage: `${percentage}%`,
      percentageNum: percentage,
      eligibility: isEligible ? 'ELIGIBLE' : 'DEFICIENT (<75%)',
      sessionStatuses
    };
  });

  return { course, sessions, students: studentRows, totalSessions };
}

// GET /api/reports/data
router.get('/data', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const courseId = Number(req.query.course_id);
    if (!courseId) {
      res.status(400).json({ error: 'Course ID is required.' });
      return;
    }

    const reportData = getCourseReportData(courseId);
    if (!reportData) {
      res.status(404).json({ error: 'Course not found.' });
      return;
    }

    res.json(reportData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/excel - Generate real Excel Spreadsheet
router.get('/excel', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const courseId = Number(req.query.course_id);
    if (!courseId) {
      res.status(400).json({ error: 'Course ID is required.' });
      return;
    }

    const data = getCourseReportData(courseId);
    if (!data) {
      res.status(404).json({ error: 'Course not found.' });
      return;
    }

    const { course, sessions, students, totalSessions } = data;

    // Build worksheet data rows
    const wsData: any[][] = [];
    wsData.push(['KADUNA POLYTECHNIC, KADUNA - NIGERIA']);
    wsData.push(['DIRECTORATE OF ACADEMIC PLANNING & ATTENDANCE AUDIT']);
    wsData.push([`COURSE ATTENDANCE REGISTER & EXAM CLEARANCE REPORT`]);
    wsData.push([]);
    wsData.push([`Course Code: ${course.code}`, `Title: ${course.title}`, `Credit Units: ${course.credit_units}`]);
    wsData.push([`Department: ${course.department_name}`, `College: ${course.college || 'N/A'}`]);
    wsData.push([`Lecturer: ${course.lecturer_name || 'Unassigned'}`, `Session: ${course.session_name || 'Current'} - ${course.session_semester || ''}`]);
    wsData.push([`Total Lectures Delivered: ${totalSessions}`, `Minimum Clearance Threshold: 75%`, `Report Date: ${new Date().toLocaleDateString()}`]);
    wsData.push([]);

    // Table Header
    const headerRow = ['S/N', 'Matriculation No', 'Student Full Name', 'Level'];
    sessions.forEach((s: any, idx: number) => {
      headerRow.push(`Lec ${idx + 1} (${s.date})`);
    });
    headerRow.push('Present', 'Late', 'Absent', 'Attendance %', 'Exam Eligibility');
    wsData.push(headerRow);

    // Student Data Rows
    students.forEach((st: any) => {
      const row = [st.sn, st.identifier, st.name, st.level];
      sessions.forEach((s: any) => {
        row.push(st.sessionStatuses[s.id] || '-');
      });
      row.push(st.present, st.late, st.absent, st.percentage, st.eligibility);
      wsData.push(row);
    });

    wsData.push([]);
    wsData.push(['OFFICIAL SUMMARY & SIGN-OFF']);
    const eligibleCount = students.filter((s: any) => s.percentageNum >= 75).length;
    const deficientCount = students.length - eligibleCount;
    wsData.push([`Total Enrolled: ${students.length}`, `Eligible to sit for Exam: ${eligibleCount}`, `Deficient (<75%): ${deficientCount}`]);
    wsData.push(['Lecturer Signature: _______________________', 'HOD Signature: _______________________', 'Date: ______________']);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    ws['!cols'] = [
      { wch: 6 },
      { wch: 22 },
      { wch: 28 },
      { wch: 10 },
      ...sessions.map(() => ({ wch: 14 })),
      { wch: 10 },
      { wch: 8 },
      { wch: 8 },
      { wch: 14 },
      { wch: 20 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Attendance_Register');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const filename = `${course.code.replace(/\s+/g, '_')}_Attendance_Register.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err: any) {
    console.error('Excel generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/pdf - Generate genuine PDF Document
router.get('/pdf', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const courseId = Number(req.query.course_id);
    if (!courseId) {
      res.status(400).json({ error: 'Course ID is required.' });
      return;
    }

    const data = getCourseReportData(courseId);
    if (!data) {
      res.status(404).json({ error: 'Course not found.' });
      return;
    }

    const { course, sessions, students, totalSessions } = data;

    // Create jsPDF instance in landscape for comprehensive attendance table
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    // Dark Green KadPoly institutional header
    doc.setFillColor(0, 77, 37); // #004d25
    doc.rect(0, 0, 297, 24, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('KADUNA POLYTECHNIC, KADUNA - NIGERIA', 148.5, 9, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('DIRECTORATE OF ACADEMIC PLANNING & STUDENT ATTENDANCE MONITORING', 148.5, 15, { align: 'center' });
    doc.text('OFFICIAL COURSE ATTENDANCE REGISTER & EXAMINATION CLEARANCE SHEET', 148.5, 20, { align: 'center' });

    // Course Meta Details
    doc.setTextColor(20, 20, 20);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');

    doc.text(`Course: ${course.code} - ${course.title} (${course.credit_units} CU)`, 14, 31);
    doc.text(`Department: ${course.department_name} | ${course.college || 'CST'}`, 14, 36);
    doc.text(`Lecturer: ${course.lecturer_name || 'Unassigned'}`, 14, 41);

    doc.text(`Academic Session: ${course.session_name || '2025/2026'} (${course.session_semester || 'First Semester'})`, 170, 31);
    doc.text(`Lectures Delivered: ${totalSessions} sessions | Min Pass: 75%`, 170, 36);
    doc.text(`Report Generated: ${new Date().toLocaleString()}`, 170, 41);

    // Build Table Columns and Rows
    const tableColumns = [
      { header: 'S/N', dataKey: 'sn' },
      { header: 'Matric No', dataKey: 'identifier' },
      { header: 'Student Name', dataKey: 'name' },
      { header: 'Level', dataKey: 'level' },
      { header: 'Pres.', dataKey: 'present' },
      { header: 'Late', dataKey: 'late' },
      { header: 'Abs.', dataKey: 'absent' },
      { header: 'Total %', dataKey: 'percentage' },
      { header: 'Exam Status', dataKey: 'eligibility' }
    ];

    const tableRows = students.map((s: any) => ({
      sn: s.sn,
      identifier: s.identifier,
      name: s.name,
      level: s.level,
      present: s.present,
      late: s.late,
      absent: s.absent,
      percentage: s.percentage,
      eligibility: s.eligibility
    }));

    autoTable(doc, {
      startY: 46,
      head: [tableColumns.map(c => c.header)],
      body: tableRows.map(r => [
        r.sn,
        r.identifier,
        r.name,
        r.level,
        r.present,
        r.late,
        r.absent,
        r.percentage,
        r.eligibility
      ]),
      theme: 'grid',
      headStyles: {
        fillColor: [0, 77, 37],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center'
      },
      styles: {
        fontSize: 8,
        cellPadding: 2,
        valign: 'middle'
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { cellWidth: 35 },
        2: { cellWidth: 55 },
        3: { halign: 'center', cellWidth: 18 },
        4: { halign: 'center', cellWidth: 16 },
        5: { halign: 'center', cellWidth: 16 },
        6: { halign: 'center', cellWidth: 16 },
        7: { halign: 'center', fontStyle: 'bold', cellWidth: 22 },
        8: { halign: 'center', fontStyle: 'bold', cellWidth: 38 }
      },
      didParseCell: (hookData) => {
        if (hookData.section === 'body' && hookData.column.index === 8) {
          const val = String(hookData.cell.raw);
          if (val.includes('DEFICIENT')) {
            hookData.cell.styles.textColor = [185, 28, 28]; // red
          } else {
            hookData.cell.styles.textColor = [4, 120, 87]; // green
          }
        }
      }
    });

    // Summary Footer
    const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 8 : 170;
    const eligibleCount = students.filter((s: any) => s.percentageNum >= 75).length;
    const deficientCount = students.length - eligibleCount;

    if (finalY < 185) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Class Summary: Total Enrolled: ${students.length} | Cleared for Exams: ${eligibleCount} | Barred (<75%): ${deficientCount}`, 14, finalY);

      doc.line(14, finalY + 12, 70, finalY + 12);
      doc.text('Course Lecturer Signature', 14, finalY + 16);

      doc.line(110, finalY + 12, 170, finalY + 12);
      doc.text('Head of Department (HOD)', 110, finalY + 16);

      doc.line(210, finalY + 12, 270, finalY + 12);
      doc.text('Academic Secretary / Stamp', 210, finalY + 16);
    }

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    const filename = `${course.code.replace(/\s+/g, '_')}_Attendance_Report.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err: any) {
    console.error('PDF generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Helper to escape CSV values
function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// GET /api/reports/csv - Export course attendance register to CSV format for offline record-keeping
router.get('/csv', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const courseId = Number(req.query.course_id);
    if (!courseId) {
      res.status(400).json({ error: 'Course ID is required.' });
      return;
    }

    const data = getCourseReportData(courseId);
    if (!data) {
      res.status(404).json({ error: 'Course not found.' });
      return;
    }

    const { course, sessions, students, totalSessions } = data;

    const lines: string[] = [];
    lines.push(`"KADUNA POLYTECHNIC - COURSE ATTENDANCE REGISTER"`);
    lines.push(`"Course Code:",${escapeCsv(course.code)},"Course Title:",${escapeCsv(course.title)}`);
    lines.push(`"Department:",${escapeCsv(course.department_name)},"Lecturer:",${escapeCsv(course.lecturer_name || 'Unassigned')}`);
    lines.push(`"Academic Session:",${escapeCsv(course.session_name || '2025/2026')},"Semester:",${escapeCsv(course.session_semester || 'First Semester')}`);
    lines.push(`"Total Lectures Delivered:",${totalSessions},"Minimum Clearance Threshold:","75%"`);
    lines.push(`"Report Generated:",${escapeCsv(new Date().toLocaleString())}`);
    lines.push('');

    // CSV Header
    const headers = ['S/N', 'Matriculation No', 'Student Full Name', 'Level'];
    sessions.forEach((s: any, idx: number) => {
      headers.push(`Lec ${idx + 1} (${s.date})`);
    });
    headers.push('Present Count', 'Late Count', 'Absent Count', 'Attendance Percentage', 'Exam Clearance Status');
    lines.push(headers.map(escapeCsv).join(','));

    // Student Data Rows
    students.forEach((st: any) => {
      const row: string[] = [
        String(st.sn),
        st.identifier,
        st.name,
        st.level
      ];
      sessions.forEach((s: any) => {
        row.push(st.sessionStatuses[s.id] || 'Absent');
      });
      row.push(
        String(st.present),
        String(st.late),
        String(st.absent),
        st.percentage,
        st.eligibility
      );
      lines.push(row.map(escapeCsv).join(','));
    });

    lines.push('');
    const eligibleCount = students.filter((s: any) => s.percentageNum >= 75).length;
    const deficientCount = students.length - eligibleCount;
    lines.push(`"SUMMARY:","Total Enrolled:",${students.length},"Cleared for Exam:",${eligibleCount},"Deficient (<75%):",${deficientCount}`);

    const csvContent = lines.join('\r\n');
    const filename = `${course.code.replace(/\s+/g, '_')}_Attendance_Register.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(csvContent, 'utf-8'));
  } catch (err: any) {
    console.error('CSV generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/institutional-csv - Institutional-wide Attendance Export for Admin
router.get('/institutional-csv', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const activeSession = dbManager.queryOne('SELECT * FROM academic_sessions WHERE is_active = 1');
    const courses = dbManager.query(`
      SELECT c.id, c.code, c.title, c.credit_units, d.name as department_name, d.code as department_code,
             u.full_name as lecturer_name
      FROM courses c
      JOIN departments d ON c.department_id = d.id
      LEFT JOIN course_assignments ca ON ca.course_id = c.id
      LEFT JOIN users u ON ca.lecturer_id = u.id
      ORDER BY d.name ASC, c.code ASC
    `);

    const lines: string[] = [];
    lines.push(`"KADUNA POLYTECHNIC - INSTITUTION-WIDE ATTENDANCE AUDIT REGISTER"`);
    lines.push(`"Academic Session:",${escapeCsv(activeSession ? `${activeSession.name} (${activeSession.semester})` : 'All Sessions')}`);
    lines.push(`"Export Timestamp:",${escapeCsv(new Date().toLocaleString())}`);
    lines.push('');

    lines.push([
      'Department',
      'Course Code',
      'Course Title',
      'Lecturer',
      'Matriculation No',
      'Student Name',
      'Level',
      'Lectures Delivered',
      'Present',
      'Late',
      'Absent',
      'Attendance %',
      'Exam Clearance Status'
    ].map(escapeCsv).join(','));

    for (const c of courses) {
      const data = getCourseReportData(c.id);
      if (data && data.students.length > 0) {
        for (const st of data.students) {
          lines.push([
            c.department_name,
            c.code,
            c.title,
            c.lecturer_name || 'Unassigned',
            st.identifier,
            st.name,
            st.level,
            String(data.totalSessions),
            String(st.present),
            String(st.late),
            String(st.absent),
            st.percentage,
            st.eligibility
          ].map(escapeCsv).join(','));
        }
      }
    }

    const csvContent = lines.join('\r\n');
    const filename = `KadPoly_Institutional_Attendance_Audit_${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(csvContent, 'utf-8'));
  } catch (err: any) {
    console.error('Institutional CSV generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
