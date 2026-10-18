import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Course, CorrectionRequest } from '../types/index.ts';
import { api } from '../lib/api.ts';
import {
  GraduationCap,
  BookOpen,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Plus,
  Send,
  Calendar,
  Layers,
  ArrowRight,
  RefreshCw,
  FileText,
  HelpCircle
} from 'lucide-react';

export const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [correctionRequests, setCorrectionRequests] = useState<CorrectionRequest[]>([]);
  const [activeSession, setActiveSession] = useState<any>(null);

  // Selected course for viewing detailed lecture attendance history
  const [selectedCourseHistory, setSelectedCourseHistory] = useState<{
    course: Course;
    history: any[];
  } | null>(null);

  // Modals
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [selectedRecordForCorrection, setSelectedRecordForCorrection] = useState<any | null>(null);

  // Alert
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showAlert = (type: 'success' | 'error', message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const loadStudentData = async () => {
    setLoading(true);
    try {
      const res = await api.get<any>('/student/dashboard');
      setSummary(res.summary);
      setCourses(res.courses || []);
      setCorrectionRequests(res.correctionRequests || []);
      setActiveSession(res.activeSession);
    } catch (err: any) {
      showAlert('error', err.message || 'Failed to load student dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudentData();
  }, []);

  // View course detailed history
  const handleViewCourseHistory = async (courseId: number) => {
    try {
      const res = await api.get<any>(`/student/courses/${courseId}/history`);
      setSelectedCourseHistory(res);
    } catch (err: any) {
      showAlert('error', err.message || 'Failed to load course history.');
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
                STUDENT ACADEMIC PORTAL
              </span>
              <span className="text-emerald-300 text-xs font-mono">
                Matric: {user?.identifier || 'Not Assigned'}
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight mt-1">
              Welcome, {user?.full_name}
            </h2>
            <p className="text-xs text-emerald-200">
              Department of {user?.department_name || 'Science & Technology'} • Level: {user?.level || 'ND/HND'} • Session: {activeSession?.name || 'Current'}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowRegisterModal(true)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition"
            >
              <Plus className="w-4 h-4" />
              <span>Register New Course</span>
            </button>
            <button
              onClick={loadStudentData}
              disabled={loading}
              className="p-2 bg-emerald-800/80 hover:bg-emerald-700 text-emerald-100 rounded-xl transition"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* Alerts */}
        {alert && (
          <div
            className={`p-4 rounded-xl text-sm flex items-start gap-3 border shadow-sm ${
              alert.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {alert.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            )}
            <span className="font-medium">{alert.message}</span>
          </div>
        )}

        {/* 75% Examination Clearance Status Gauge Banner */}
        <div
          className={`p-6 rounded-2xl border shadow-sm transition ${
            summary?.isOverallEligible
              ? 'bg-gradient-to-r from-emerald-900 via-emerald-800 to-[#004d25] text-white border-emerald-700'
              : 'bg-gradient-to-r from-red-900 via-red-800 to-rose-900 text-white border-red-700'
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase tracking-wider bg-white/20 text-white">
                  Institutional Rule: 75% Attendance Required
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black tracking-tight">
                {summary?.isOverallEligible
                  ? 'CLEARED FOR SEMESTER EXAMINATIONS'
                  : 'DEFICIENT: BELOW 75% ATTENDANCE THRESHOLD'}
              </h3>
              <p className="text-xs text-white/80 max-w-2xl leading-relaxed">
                {summary?.isOverallEligible
                  ? 'Your aggregate attendance meets Kaduna Polytechnic examination clearance standards. Maintain regular lecture attendance until the end of the semester.'
                  : 'Warning: Your current attendance rate is below the 75% threshold mandated by the Academic Board. You are at risk of being barred from semester examinations. Review your lecture records or submit documented correction requests if you were marked in error.'}
              </p>
            </div>

            {/* Score Ring / Dial */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20 flex items-center gap-5 shrink-0">
              <div className="text-center">
                <div className="text-4xl font-black">{summary?.overallPercentage ?? 0}%</div>
                <div className="text-[10px] text-white/80 font-bold uppercase tracking-wider mt-0.5">
                  Aggregate Attendance
                </div>
              </div>

              <div className="h-12 w-px bg-white/20"></div>

              <div className="text-xs space-y-1">
                <div className="flex items-center justify-between gap-3 text-white/90">
                  <span>Delivered:</span>
                  <span className="font-bold">{summary?.totalClassesHeld ?? 0}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-emerald-200">
                  <span>Present:</span>
                  <span className="font-bold">{summary?.totalPresent ?? 0}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-amber-200">
                  <span>Late:</span>
                  <span className="font-bold">{summary?.totalLate ?? 0}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-rose-200">
                  <span>Absent:</span>
                  <span className="font-bold">{summary?.totalAbsent ?? 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Enrolled Courses Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-800">
                Registered Courses for {activeSession?.name || 'Current Session'} ({courses.length})
              </h3>
              <p className="text-xs text-gray-500">
                Live attendance percentages and examination clearance per course
              </p>
            </div>

            <button
              onClick={() => setShowRegisterModal(true)}
              className="px-3 py-1.5 bg-[#004d25] hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Course</span>
            </button>
          </div>

          {courses.length === 0 ? (
            <div className="p-10 bg-white rounded-2xl border border-gray-200 text-center">
              <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-gray-800">No Courses Registered Yet</h4>
              <p className="text-xs text-gray-500 max-w-md mx-auto mt-1 mb-4">
                You have not enrolled in any courses for the current academic session. Click below to register for your department's accredited courses.
              </p>
              <button
                onClick={() => setShowRegisterModal(true)}
                className="px-4 py-2 bg-[#004d25] hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow"
              >
                Register Courses Now
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {courses.map((c) => (
                <div
                  key={c.id}
                  className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="px-2 py-0.5 rounded font-mono text-xs font-bold bg-emerald-100 text-emerald-900">
                        {c.code}
                      </span>
                      {c.is_eligible ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          CLEARED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-300">
                          DEFICIENT (&lt;75%)
                        </span>
                      )}
                    </div>

                    <h4 className="font-bold text-gray-900 text-sm mt-2">{c.title}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Lecturer: {c.lecturer_name || 'Faculty Member'}
                    </p>

                    {/* Attendance Metric */}
                    <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-semibold text-gray-700">Course Attendance:</span>
                        <span className="font-black text-sm text-gray-900">{c.percentage}%</span>
                      </div>
                      <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            (c.percentage ?? 0) >= 75 ? 'bg-emerald-600' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(c.percentage ?? 0, 100)}%` }}
                        ></div>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-gray-500 mt-2">
                        <span>{c.total_sessions || 0} Lectures Held</span>
                        <span>{c.present_count || 0} Present • {c.absent_count || 0} Absent</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleViewCourseHistory(c.id)}
                    className="mt-4 w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-[#004d25] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
                  >
                    <span>View Lecture History & Logs</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detailed Lecture Attendance History for Selected Course */}
        {selectedCourseHistory && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
              <div>
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                  Detailed Course Attendance History
                </span>
                <h3 className="text-lg font-bold text-gray-900">
                  {selectedCourseHistory.course.code} — {selectedCourseHistory.course.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedCourseHistory(null)}
                className="text-xs text-gray-500 hover:text-gray-800 self-start"
              >
                ✕ Close History
              </button>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200 uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-4">Date & Time</th>
                    <th className="py-2.5 px-4">Topic / Lesson Covered</th>
                    <th className="py-2.5 px-3">Venue</th>
                    <th className="py-2.5 px-3 text-center">My Status</th>
                    <th className="py-2.5 px-4 text-right">Action / Correction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedCourseHistory.history.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500">
                        No lectures recorded for this course yet.
                      </td>
                    </tr>
                  ) : (
                    selectedCourseHistory.history.map((h) => (
                      <tr key={h.session_id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 font-mono text-[11px] text-gray-800">
                          <div>{h.date}</div>
                          <div className="text-[10px] text-gray-400">{h.start_time} - {h.end_time}</div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-gray-900">
                          {h.topic}
                        </td>
                        <td className="py-3 px-3 text-gray-600">{h.venue}</td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              h.status === 'Present'
                                ? 'bg-emerald-100 text-emerald-800'
                                : h.status === 'Late'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {h.status || 'Not Marked'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {h.record_id && (h.status === 'Absent' || h.status === 'Late') ? (
                            h.existing_request_id ? (
                              <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                                Correction {h.request_status}
                              </span>
                            ) : (
                              <button
                                onClick={() => {
                                  setSelectedRecordForCorrection({
                                    record_id: h.record_id,
                                    course_code: selectedCourseHistory.course.code,
                                    date: h.date,
                                    topic: h.topic,
                                    current_status: h.status,
                                  });
                                  setShowCorrectionModal(true);
                                }}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded text-xs font-semibold"
                              >
                                Request Correction
                              </button>
                            )
                          ) : (
                            <span className="text-gray-400 text-[11px]">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* My Correction Requests Tracker */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-800">
                My Attendance Correction Requests ({correctionRequests.length})
              </h3>
              <p className="text-xs text-gray-500">
                Track status and lecturer review decisions for requested attendance amendments
              </p>
            </div>
          </div>

          <div className="divide-y divide-gray-200 border border-gray-200 rounded-xl overflow-hidden">
            {correctionRequests.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-xs">
                No correction requests submitted. If you were marked absent in error, you can submit an appeal with documentation.
              </div>
            ) : (
              correctionRequests.map((req) => (
                <div key={req.id} className="p-4 hover:bg-gray-50 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded font-mono">
                        {req.course_code}
                      </span>
                      <span className="font-bold text-sm text-gray-900">
                        {req.course_title}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600">
                      Lecture Date: {req.lecture_date} • Reason: "{req.reason}"
                    </p>
                    {req.admin_or_lecturer_notes && (
                      <p className="text-[11px] text-gray-500 italic bg-gray-50 p-1.5 rounded">
                        Reviewer Note: {req.admin_or_lecturer_notes}
                      </p>
                    )}
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shrink-0 ${
                      req.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : req.status === 'rejected'
                        ? 'bg-red-100 text-red-800 border border-red-300'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}
                  >
                    {req.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* MODAL: REGISTER FOR A COURSE */}
      {showRegisterModal && (
        <CourseRegisterModal
          onClose={() => setShowRegisterModal(false)}
          onSuccess={(msg) => {
            setShowRegisterModal(false);
            showAlert('success', msg);
            loadStudentData();
          }}
        />
      )}

      {/* MODAL: SUBMIT CORRECTION REQUEST */}
      {showCorrectionModal && selectedRecordForCorrection && (
        <SubmitCorrectionModal
          record={selectedRecordForCorrection}
          onClose={() => {
            setShowCorrectionModal(false);
            setSelectedRecordForCorrection(null);
          }}
          onSuccess={(msg) => {
            setShowCorrectionModal(false);
            setSelectedRecordForCorrection(null);
            showAlert('success', msg);
            loadStudentData();
            if (selectedCourseHistory) {
              handleViewCourseHistory(selectedCourseHistory.course.id);
            }
          }}
        />
      )}
    </div>
  );
};

// Subcomponent Modal: Course Registration
const CourseRegisterModal: React.FC<{
  onClose: () => void;
  onSuccess: (msg: string) => void;
}> = ({ onClose, onSuccess }) => {
  const [availableCourses, setAvailableCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<number | null>(null);

  useEffect(() => {
    api.get<any>('/student/available-courses')
      .then((res) => {
        setAvailableCourses(res.available || []);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleRegister = async (courseId: number) => {
    setSubmittingId(courseId);
    try {
      const res = await api.post<any>('/student/register-course', { course_id: courseId });
      onSuccess(res.message);
    } catch (err: any) {
      alert(err.message || 'Failed to register course.');
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full overflow-hidden">
        <div className="bg-[#004d25] text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm">Course Registration</h3>
            <p className="text-xs text-emerald-200">Accredited courses for your department and level</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white">✕</button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-3">
          {loading ? (
            <div className="py-8 text-center text-xs text-gray-500">Loading courses...</div>
          ) : availableCourses.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-500">No available courses for registration.</div>
          ) : (
            availableCourses.map((c) => (
              <div
                key={c.id}
                className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded">
                      {c.code}
                    </span>
                    <span className="font-bold text-xs text-gray-900">{c.title}</span>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1">
                    {c.credit_units} Credit Units • Lecturer: {c.lecturer_name || 'Assigned Faculty'}
                  </div>
                </div>

                {c.is_enrolled ? (
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold">
                    Enrolled
                  </span>
                ) : (
                  <button
                    onClick={() => handleRegister(c.id)}
                    disabled={submittingId === c.id}
                    className="px-3.5 py-1.5 bg-[#004d25] hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow"
                  >
                    {submittingId === c.id ? 'Registering...' : 'Register Course'}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// Subcomponent Modal: Submit Correction Request
const SubmitCorrectionModal: React.FC<{
  record: any;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}> = ({ record, onClose, onSuccess }) => {
  const [requestedStatus, setRequestedStatus] = useState<'Present' | 'Late'>('Present');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 10) {
      setError('Please provide a detailed explanation of at least 10 characters.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.post<any>('/student/corrections', {
        attendance_record_id: record.record_id,
        requested_status: requestedStatus,
        reason,
      });
      onSuccess(res.message);
    } catch (err: any) {
      setError(err.message || 'Failed to submit correction request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        <div className="bg-[#004d25] text-white px-6 py-4 flex items-center justify-between">
          <h3 className="font-bold text-sm">Attendance Correction Request</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-lg">{error}</div>}

          <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-xs text-gray-700 space-y-1">
            <div className="font-bold text-gray-900">{record.course_code} - {record.topic}</div>
            <div>Lecture Date: <span className="font-medium">{record.date}</span></div>
            <div>Current Marked Status: <span className="font-bold text-red-600">{record.current_status}</span></div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Requested Status Correction
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRequestedStatus('Present')}
                className={`py-2 text-xs font-bold rounded-lg border ${
                  requestedStatus === 'Present'
                    ? 'bg-emerald-50 border-[#004d25] text-[#004d25]'
                    : 'border-gray-200 text-gray-600'
                }`}
              >
                Mark as Present
              </button>
              <button
                type="button"
                onClick={() => setRequestedStatus('Late')}
                className={`py-2 text-xs font-bold rounded-lg border ${
                  requestedStatus === 'Late'
                    ? 'bg-emerald-50 border-[#004d25] text-[#004d25]'
                    : 'border-gray-200 text-gray-600'
                }`}
              >
                Mark as Late
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Detailed Justification / Official Reason
            </label>
            <textarea
              required
              rows={4}
              placeholder="Explain why you were present or delayed (e.g. submitted medical slip, department representation, verification by class representative)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs"
            ></textarea>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-[#004d25] hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{loading ? 'Submitting...' : 'Submit to Lecturer'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
