import React, { useState, useEffect } from 'react';
import { Course, AttendanceSession, CorrectionRequest } from '../types/index.ts';
import { api } from '../lib/api.ts';
import { ReportModal } from './ReportModal.tsx';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  FileSpreadsheet,
  FileText,
  Download,
  Users,
  Send,
  Sparkles,
  ArrowLeft,
  Edit3,
  Check,
  X,
  MessageSquare
} from 'lucide-react';

export const LecturerDashboard: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [activeTab, setActiveTab] = useState<'mark' | 'students' | 'history' | 'corrections'>('mark');
  const [loading, setLoading] = useState(true);

  // Mark Attendance Form State
  const [lectureDate, setLectureDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('11:00');
  const [lectureTopic, setLectureTopic] = useState('');
  const [venue, setVenue] = useState('ETF Lecture Theatre 1');
  const [studentRecords, setStudentRecords] = useState<Array<{
    student_id: number;
    full_name: string;
    identifier: string;
    status: 'Present' | 'Absent' | 'Late';
    remarks: string;
  }>>([]);
  const [submittingAttendance, setSubmittingAttendance] = useState(false);

  // Enrolled Students & Past Sessions Data
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [pastSessions, setPastSessions] = useState<AttendanceSession[]>([]);
  const [correctionRequests, setCorrectionRequests] = useState<CorrectionRequest[]>([]);

  // Modals & Correction Action State
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [editStatus, setEditStatus] = useState<'Present' | 'Absent' | 'Late'>('Present');
  const [editReason, setEditReason] = useState('');
  const [reviewingRequest, setReviewingRequest] = useState<CorrectionRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);

  // Alerts
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showAlert = (type: 'success' | 'error', message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  // Load lecturer courses
  const loadCourses = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ courses: Course[] }>('/lecturer/courses');
      setCourses(res.courses || []);
      if (res.courses && res.courses.length > 0 && !selectedCourse) {
        selectCourse(res.courses[0]);
      }
    } catch (err: any) {
      showAlert('error', err.message || 'Failed to load assigned courses.');
    } finally {
      setLoading(false);
    }
  };

  // Select a course and load its students, sessions, corrections
  const selectCourse = async (course: Course) => {
    setSelectedCourse(course);
    setLoading(true);
    try {
      const [studentsRes, sessionsRes, correctionsRes] = await Promise.all([
        api.get<any>(`/lecturer/courses/${course.id}/students`),
        api.get<{ sessions: AttendanceSession[] }>(`/lecturer/attendance/sessions?course_id=${course.id}`),
        api.get<{ requests: CorrectionRequest[] }>('/lecturer/corrections'),
      ]);

      const stList = studentsRes.students || [];
      setEnrolledStudents(stList);
      setPastSessions(sessionsRes.sessions || []);

      // Filter corrections for this course
      const filteredCorrections = (correctionsRes.requests || []).filter(
        (r) => r.course_id === course.id
      );
      setCorrectionRequests(filteredCorrections);

      // Initialize attendance marking state
      setStudentRecords(
        stList.map((s: any) => ({
          student_id: s.id,
          full_name: s.full_name,
          identifier: s.identifier || 'N/A',
          status: 'Present',
          remarks: '',
        }))
      );
    } catch (err: any) {
      showAlert('error', err.message || 'Failed to load course details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  // Quick mark all helpers
  const setAllStatus = (status: 'Present' | 'Absent' | 'Late') => {
    setStudentRecords((prev) =>
      prev.map((r) => ({
        ...r,
        status,
      }))
    );
  };

  const updateIndividualStatus = (studentId: number, status: 'Present' | 'Absent' | 'Late') => {
    setStudentRecords((prev) =>
      prev.map((r) => (r.student_id === studentId ? { ...r, status } : r))
    );
  };

  const updateRemarks = (studentId: number, remarks: string) => {
    setStudentRecords((prev) =>
      prev.map((r) => (r.student_id === studentId ? { ...r, remarks } : r))
    );
  };

  // Submit attendance
  const handleSubmitAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;
    if (!lectureTopic.trim()) {
      showAlert('error', 'Please provide the topic or syllabus coverage for this lecture.');
      return;
    }

    setSubmittingAttendance(true);
    try {
      const res = await api.post<any>('/lecturer/attendance', {
        course_id: selectedCourse.id,
        date: lectureDate,
        start_time: startTime,
        end_time: endTime,
        topic: lectureTopic,
        venue,
        records: studentRecords,
      });

      showAlert(
        'success',
        `Attendance recorded! Present: ${res.presentCount}, Late: ${res.lateCount}, Absent: ${res.absentCount}.`
      );
      setLectureTopic('');
      // Reload course data to reflect updated statistics
      selectCourse(selectedCourse);
      setActiveTab('students');
    } catch (err: any) {
      showAlert('error', err.message || 'Failed to submit attendance.');
    } finally {
      setSubmittingAttendance(false);
    }
  };

  // Review Correction Request (Approve or Reject)
  const handleReviewCorrection = async (action: 'approve' | 'reject') => {
    if (!reviewingRequest) return;
    try {
      await api.post(`/lecturer/corrections/${reviewingRequest.id}/review`, {
        action,
        notes: reviewNotes,
      });
      showAlert('success', `Correction request has been ${action === 'approve' ? 'approved' : 'rejected'}.`);
      setReviewingRequest(null);
      setReviewNotes('');
      if (selectedCourse) selectCourse(selectedCourse);
    } catch (err: any) {
      showAlert('error', err.message);
    }
  };

  // Quick export handler for CSV or PDF offline record-keeping
  const handleQuickExport = async (format: 'csv' | 'pdf') => {
    if (!selectedCourse) return;
    try {
      showAlert('success', `Generating ${format.toUpperCase()} attendance register for offline record-keeping...`);
      await api.downloadReport(format, selectedCourse.id);
      showAlert('success', `${format.toUpperCase()} attendance register downloaded successfully.`);
    } catch (err: any) {
      showAlert('error', err.message || `Failed to download ${format.toUpperCase()} register.`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Top Banner */}
      <div className="bg-[#004d25] text-white py-6 border-b border-emerald-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-white/20 text-emerald-100">
                LECTURER PORTAL
              </span>
              <span className="text-emerald-300 text-xs font-mono">
                {courses.length} Assigned Courses
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight mt-1">Course Attendance & Clearance Desk</h2>
            <p className="text-xs text-emerald-200">
              Deliver lecture attendance, review student correction justifications, and export records to CSV or PDF for offline keeping.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectedCourse && (
              <>
                <button
                  onClick={() => handleQuickExport('csv')}
                  className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow transition"
                  title="Export Course Attendance as CSV Spreadsheet for offline analysis"
                >
                  <FileText className="w-4 h-4 text-emerald-300" />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={() => handleQuickExport('pdf')}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow transition"
                  title="Export Course Attendance as PDF Document with KadPoly signatures"
                >
                  <FileText className="w-4 h-4 text-red-300" />
                  <span>Export PDF</span>
                </button>
                <button
                  onClick={() => setShowReportModal(true)}
                  className="px-3 py-2 bg-emerald-800/80 hover:bg-emerald-700 text-emerald-100 rounded-xl text-xs font-medium flex items-center gap-1 transition"
                  title="All Export Options"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Options...</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* Alerts */}
        {alert && (
          <div
            className={`mb-6 p-4 rounded-xl text-sm flex items-start gap-3 border shadow-sm ${
              alert.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {alert.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            )}
            <span className="font-medium">{alert.message}</span>
          </div>
        )}

        {/* Course Selector Tabs / Badges */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600">
              Assigned Courses for Active Session
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {courses.map((c) => {
              const isSelected = selectedCourse?.id === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => selectCourse(c)}
                  className={`p-4 rounded-xl text-left border transition flex flex-col justify-between ${
                    isSelected
                      ? 'bg-white border-[#004d25] ring-2 ring-[#004d25] shadow-md'
                      : 'bg-white border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/30'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="px-2 py-0.5 rounded font-mono text-xs font-bold bg-emerald-100 text-emerald-900">
                        {c.code}
                      </span>
                      <h4 className="font-bold text-gray-900 text-sm mt-1">{c.title}</h4>
                      <p className="text-xs text-gray-500 mt-0.5">{c.department_name}</p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
                    <span>{c.credit_units} Credit Units</span>
                    <span className="font-semibold text-emerald-800">
                      {c.sessions_held || 0} Lectures Held
                    </span>
                    <span className="font-semibold text-blue-800">
                      {c.enrolled_count || 0} Students
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Course Work Area */}
        {selectedCourse && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Header of Active Course */}
            <div className="p-5 bg-gradient-to-r from-emerald-50 via-white to-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                    Active Course Workspace
                  </span>
                  <span className="text-xs text-gray-400">•</span>
                  <span className="text-xs font-medium text-gray-600">{selectedCourse.level}</span>
                </div>
                <h3 className="text-lg font-extrabold text-gray-900 mt-0.5">
                  {selectedCourse.code} — {selectedCourse.title}
                </h3>
              </div>

              {/* Action Tabs */}
              <div className="flex items-center bg-gray-100 p-1 rounded-xl">
                <button
                  onClick={() => setActiveTab('mark')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    activeTab === 'mark'
                      ? 'bg-white text-[#004d25] shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Mark Attendance</span>
                </button>

                <button
                  onClick={() => setActiveTab('students')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    activeTab === 'students'
                      ? 'bg-white text-[#004d25] shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Enrolled & History ({enrolledStudents.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('history')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    activeTab === 'history'
                      ? 'bg-white text-[#004d25] shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Lectures Held ({pastSessions.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('corrections')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    activeTab === 'corrections'
                      ? 'bg-white text-[#004d25] shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Correction Requests</span>
                  {correctionRequests.filter((r) => r.status === 'pending').length > 0 && (
                    <span className="w-4 h-4 bg-amber-500 text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                      {correctionRequests.filter((r) => r.status === 'pending').length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* TAB 1: MARK ATTENDANCE */}
              {activeTab === 'mark' && (
                <form onSubmit={handleSubmitAttendance} className="space-y-6">
                  {/* Session Metadata Form */}
                  <div className="p-5 bg-gray-50/80 rounded-xl border border-gray-200">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-3 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-emerald-700" />
                      <span>Lecture Session Details</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Lecture Date
                        </label>
                        <input
                          type="date"
                          required
                          value={lectureDate}
                          onChange={(e) => setLectureDate(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-medium"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Start Time
                          </label>
                          <input
                            type="time"
                            required
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            End Time
                          </label>
                          <input
                            type="time"
                            required
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs"
                          />
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Lecture Venue / Hall
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. ETF Lecture Hall 2"
                          value={venue}
                          onChange={(e) => setVenue(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs"
                        />
                      </div>

                      <div className="sm:col-span-4">
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Topic / Lesson Coverage (Required for Academic Audit)
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Memory Management: Virtual Memory, Paging & Page Replacement"
                          value={lectureTopic}
                          onChange={(e) => setLectureTopic(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-xs font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Student Marking List */}
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                          Enrolled Student Attendance List ({studentRecords.length})
                        </h4>
                        <p className="text-[11px] text-gray-500">
                          Quick mark all or adjust individual student attendance status
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setAllStatus('Present')}
                          className="px-2.5 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg text-xs font-bold flex items-center gap-1 transition"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Mark All Present</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setAllStatus('Absent')}
                          className="px-2.5 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-xs font-bold flex items-center gap-1 transition"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Mark All Absent</span>
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto border border-gray-200 rounded-xl">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200 uppercase text-[11px]">
                          <tr>
                            <th className="py-2.5 px-4 w-12 text-center">S/N</th>
                            <th className="py-2.5 px-4">Student Details</th>
                            <th className="py-2.5 px-4">Matriculation No</th>
                            <th className="py-2.5 px-4 text-center">Attendance Status</th>
                            <th className="py-2.5 px-4">Remarks / Note</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {studentRecords.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-gray-500">
                                No students are enrolled in this course yet.
                              </td>
                            </tr>
                          ) : (
                            studentRecords.map((rec, idx) => (
                              <tr key={rec.student_id} className="hover:bg-gray-50/70">
                                <td className="py-2.5 px-4 text-center text-gray-400 font-mono">
                                  {idx + 1}
                                </td>
                                <td className="py-2.5 px-4 font-bold text-gray-900">
                                  {rec.full_name}
                                </td>
                                <td className="py-2.5 px-4 font-mono text-[11px] text-gray-700">
                                  {rec.identifier}
                                </td>
                                <td className="py-2.5 px-4">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => updateIndividualStatus(rec.student_id, 'Present')}
                                      className={`px-3 py-1 rounded-md font-bold text-xs transition ${
                                        rec.status === 'Present'
                                          ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400'
                                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                      }`}
                                    >
                                      Present
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => updateIndividualStatus(rec.student_id, 'Late')}
                                      className={`px-3 py-1 rounded-md font-bold text-xs transition ${
                                        rec.status === 'Late'
                                          ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-300'
                                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                      }`}
                                    >
                                      Late
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => updateIndividualStatus(rec.student_id, 'Absent')}
                                      className={`px-3 py-1 rounded-md font-bold text-xs transition ${
                                        rec.status === 'Absent'
                                          ? 'bg-red-600 text-white shadow-sm ring-2 ring-red-400'
                                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                      }`}
                                    >
                                      Absent
                                    </button>
                                  </div>
                                </td>
                                <td className="py-2.5 px-4">
                                  <input
                                    type="text"
                                    placeholder="Optional note..."
                                    value={rec.remarks}
                                    onChange={(e) => updateRemarks(rec.student_id, e.target.value)}
                                    className="w-full px-2.5 py-1 text-xs bg-gray-50 border border-gray-200 rounded focus:bg-white"
                                  />
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Submission Action */}
                  <div className="pt-2 flex items-center justify-between border-t border-gray-100">
                    <div className="text-xs text-gray-500">
                      Duplicate prevention active: cannot mark multiple sessions at identical time on same date.
                    </div>
                    <button
                      type="submit"
                      disabled={submittingAttendance || studentRecords.length === 0}
                      className="px-6 py-2.5 bg-[#004d25] hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-2 transition"
                    >
                      {submittingAttendance ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          <span>Recording in Cloud Database...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Submit & Lock Lecture Attendance</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 2: ENROLLED STUDENTS & EXAM CLEARANCE BREAKDOWN */}
              {activeTab === 'students' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                        Student Exam Clearance & Attendance Breakdown
                      </h4>
                      <p className="text-xs text-gray-500">
                        Institutional Rule: Students with &lt;75% attendance are automatically barred from examinations.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-start">
                      <button
                        onClick={() => handleQuickExport('csv')}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#004d25] border border-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                        title="Download CSV for offline spreadsheet storage"
                      >
                        <FileText className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Export CSV</span>
                      </button>

                      <button
                        onClick={() => handleQuickExport('pdf')}
                        className="px-3 py-1.5 bg-[#004d25] hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                        title="Download Official PDF Clearance Register"
                      >
                        <FileText className="w-3.5 h-3.5 text-red-200" />
                        <span>Export PDF</span>
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-gray-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200 uppercase text-[11px]">
                        <tr>
                          <th className="py-3 px-4">Student Name</th>
                          <th className="py-3 px-3">Matriculation No</th>
                          <th className="py-3 px-3 text-center">Present</th>
                          <th className="py-3 px-3 text-center">Late</th>
                          <th className="py-3 px-3 text-center">Absent</th>
                          <th className="py-3 px-3 text-center">Attendance %</th>
                          <th className="py-3 px-4 text-center">Exam Clearance Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {enrolledStudents.map((st) => (
                          <tr key={st.id} className="hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <div className="font-bold text-gray-900">{st.full_name}</div>
                              <div className="text-[11px] text-gray-500">{st.email}</div>
                            </td>
                            <td className="py-3 px-3 font-mono text-[11px] text-gray-700">
                              {st.identifier}
                            </td>
                            <td className="py-3 px-3 text-center font-semibold text-emerald-800">
                              {st.present_count}
                            </td>
                            <td className="py-3 px-3 text-center font-semibold text-amber-800">
                              {st.late_count}
                            </td>
                            <td className="py-3 px-3 text-center font-semibold text-red-800">
                              {st.absent_count}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <div className="font-extrabold text-sm text-gray-900">{st.percentage}%</div>
                              <div className="w-16 bg-gray-200 h-1.5 rounded-full mx-auto mt-1 overflow-hidden">
                                <div
                                  className={`h-full ${
                                    st.percentage >= 75 ? 'bg-emerald-600' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${Math.min(st.percentage, 100)}%` }}
                                ></div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              {st.is_eligible ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  CLEARED (PASS)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-300">
                                  <XCircle className="w-3.5 h-3.5" />
                                  DEFICIENT (&lt;75%)
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: PAST LECTURE SESSIONS */}
              {activeTab === 'history' && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                    Delivered Lecture History
                  </h4>

                  <div className="divide-y divide-gray-200 border border-gray-200 rounded-xl overflow-hidden">
                    {pastSessions.length === 0 ? (
                      <div className="p-8 text-center text-gray-500 text-xs">
                        No lectures delivered for this course yet. Use the "Mark Attendance" tab to record your first lecture!
                      </div>
                    ) : (
                      pastSessions.map((sess) => (
                        <div key={sess.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-gray-900">{sess.topic}</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-gray-100 text-gray-700">
                                {sess.venue}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1 flex items-center gap-3">
                              <span>Date: {sess.date}</span>
                              <span>•</span>
                              <span>Time: {sess.start_time} - {sess.end_time}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-xs font-semibold">
                            <span className="text-emerald-700">{sess.present_count ?? 0} Present</span>
                            <span className="text-amber-700">{sess.late_count ?? 0} Late</span>
                            <span className="text-red-700">{sess.absent_count ?? 0} Absent</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: STUDENT CORRECTION REQUESTS */}
              {activeTab === 'corrections' && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                    Pending Student Attendance Corrections
                  </h4>

                  <div className="divide-y divide-gray-200 border border-gray-200 rounded-xl overflow-hidden">
                    {correctionRequests.length === 0 ? (
                      <div className="p-8 text-center text-gray-500 text-xs">
                        No pending correction requests from students for this course.
                      </div>
                    ) : (
                      correctionRequests.map((req) => (
                        <div key={req.id} className="p-4 hover:bg-gray-50 space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-bold text-sm text-gray-900 flex items-center gap-2">
                                {req.student_name}
                                <span className="text-xs text-gray-500 font-normal">
                                  ({req.student_identifier})
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    req.status === 'pending'
                                      ? 'bg-amber-100 text-amber-800'
                                      : req.status === 'approved'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}
                                >
                                  {req.status}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                Lecture Date: {req.lecture_date} • Topic: "{req.lecture_topic}"
                              </div>
                            </div>

                            <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-1 rounded">
                              Requesting: {req.requested_status}
                            </span>
                          </div>

                          <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-700 border border-gray-200">
                            <span className="font-semibold text-gray-900">Student Explanation: </span>
                            "{req.reason}"
                          </div>

                          {req.status === 'pending' && (
                            <div className="flex items-center justify-end gap-2 pt-2">
                              <button
                                onClick={() => {
                                  setReviewingRequest(req);
                                  handleReviewCorrection('reject');
                                }}
                                className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-xs font-bold"
                              >
                                Reject Request
                              </button>
                              <button
                                onClick={() => {
                                  setReviewingRequest(req);
                                  handleReviewCorrection('approve');
                                }}
                                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow"
                              >
                                Approve & Update Attendance
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Export Report Modal */}
      {selectedCourse && (
        <ReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          courses={courses}
          initialCourseId={selectedCourse.id}
        />
      )}
    </div>
  );
};
