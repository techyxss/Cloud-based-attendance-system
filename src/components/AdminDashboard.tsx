import React, { useState, useEffect } from 'react';
import { User, Department, AcademicSession, Course, AuditLog } from '../types/index.ts';
import { api } from '../lib/api.ts';
import { ReportModal } from './ReportModal.tsx';
import {
  Users,
  Building,
  Calendar,
  BookOpen,
  ClipboardList,
  Sliders,
  FileSpreadsheet,
  FileText,
  Download,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  UserX,
  Edit2,
  Trash2,
  Clock,
  ExternalLink
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'departments' | 'sessions' | 'courses' | 'audit' | 'settings'>('overview');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  // Data states
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});

  // Filters & Search
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userDeptFilter, setUserDeptFilter] = useState('');

  // Modals & Forms
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showAddDeptModal, setShowAddDeptModal] = useState(false);
  const [showAddSessionModal, setShowAddSessionModal] = useState(false);
  const [showAddCourseModal, setShowAddCourseModal] = useState(false);
  const [showAssignLecturerModal, setShowAssignLecturerModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedCourseForAssign, setSelectedCourseForAssign] = useState<Course | null>(null);

  // Notification / Alert message
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showAlert = (type: 'success' | 'error', message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, deptsRes, sessionsRes, coursesRes, auditRes, settingsRes] = await Promise.all([
        api.get<any>('/admin/stats'),
        api.get<{ users: User[] }>('/admin/users'),
        api.get<{ departments: Department[] }>('/admin/departments'),
        api.get<{ sessions: AcademicSession[] }>('/admin/sessions'),
        api.get<{ courses: Course[] }>('/admin/courses'),
        api.get<{ logs: AuditLog[] }>('/admin/audit-logs?limit=50'),
        api.get<{ settingsMap: Record<string, string> }>('/admin/settings'),
      ]);

      setStats(statsRes);
      setUsers(usersRes.users || []);
      setDepartments(deptsRes.departments || []);
      setSessions(sessionsRes.sessions || []);
      setCourses(coursesRes.courses || []);
      setAuditLogs(auditRes.logs || []);
      setSettings(settingsRes.settingsMap || {});
    } catch (err: any) {
      showAlert('error', err.message || 'Failed to load administrative data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.identifier && u.identifier.toLowerCase().includes(userSearch.toLowerCase()));
    const matchesRole = !userRoleFilter || u.role === userRoleFilter;
    const matchesDept = !userDeptFilter || String(u.department_id) === userDeptFilter;
    return matchesSearch && matchesRole && matchesDept;
  });

  // Handle setting active session
  const handleSetActiveSession = async (sessionId: number) => {
    try {
      await api.post(`/admin/sessions/${sessionId}/set-active`);
      showAlert('success', 'Active academic session successfully updated.');
      loadAllData();
    } catch (err: any) {
      showAlert('error', err.message);
    }
  };

  // Handle toggle user status
  const handleToggleUserStatus = async (user: User) => {
    try {
      const newStatus = user.status === 'active' ? 'inactive' : 'active';
      await api.put(`/admin/users/${user.id}`, { status: newStatus });
      showAlert('success', `User ${user.email} marked as ${newStatus}.`);
      loadAllData();
    } catch (err: any) {
      showAlert('error', err.message);
    }
  };

  // Export helper for individual course attendance
  const handleDownloadCourseRecord = async (courseId: number, format: 'csv' | 'pdf') => {
    try {
      showAlert('success', `Generating ${format.toUpperCase()} attendance register for offline record-keeping...`);
      await api.downloadReport(format, courseId);
      showAlert('success', `${format.toUpperCase()} attendance register downloaded successfully.`);
    } catch (err: any) {
      showAlert('error', err.message || `Failed to download ${format.toUpperCase()} register.`);
    }
  };

  // Export helper for institutional wide attendance CSV
  const handleDownloadInstitutionalCsv = async () => {
    try {
      showAlert('success', 'Generating institutional-wide attendance CSV for offline record-keeping...');
      await api.downloadInstitutionalCsv();
      showAlert('success', 'Institutional attendance CSV register downloaded successfully.');
    } catch (err: any) {
      showAlert('error', err.message || 'Failed to download institutional CSV.');
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
                DIRECTORATE OF ACADEMIC PLANNING
              </span>
              <span className="text-emerald-300 text-xs font-mono">
                {stats?.activeSession ? `${stats.activeSession.name} (${stats.activeSession.semester})` : 'No Active Session'}
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight mt-1">Administrator Control Center</h2>
            <p className="text-xs text-emerald-200">
              Institution-wide governance: departments, user roles, curriculum, attendance integrity, audit logging, and offline CSV/PDF exports.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownloadInstitutionalCsv}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow transition"
              title="Download full institutional attendance records in CSV format"
            >
              <FileText className="w-4 h-4 text-emerald-300" />
              <span>Export Institutional CSV</span>
            </button>
            <button
              onClick={() => setShowReportModal(true)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow transition"
              title="Export Course Attendance Register to CSV, PDF or Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
              <span>Export Course Register (CSV/PDF)</span>
            </button>
            <button
              onClick={loadAllData}
              disabled={loading}
              className="p-2 bg-emerald-800/80 hover:bg-emerald-700 text-emerald-100 rounded-xl transition"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
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

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 bg-white rounded-t-xl px-2 shadow-sm overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview Metrics', icon: TrendingUp },
            { id: 'users', label: `Users (${users.length})`, icon: Users },
            { id: 'departments', label: `Departments (${departments.length})`, icon: Building },
            { id: 'sessions', label: `Academic Sessions (${sessions.length})`, icon: Calendar },
            { id: 'courses', label: `Courses (${courses.length})`, icon: BookOpen },
            { id: 'audit', label: 'Institutional Audit Log', icon: ClipboardList },
            { id: 'settings', label: 'Settings & Thresholds', icon: Sliders },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3.5 px-4 text-xs font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
                  isActive
                    ? 'border-[#004d25] text-[#004d25] bg-emerald-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#004d25]' : 'text-gray-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Panes */}
        <div className="bg-white rounded-b-xl shadow-sm border border-t-0 border-gray-200 p-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-100">
                  <div className="flex items-center justify-between text-emerald-800 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider">Overall Attendance Rate</span>
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-3xl font-black text-emerald-950">
                    {stats?.overallAttendanceRate ?? 0}%
                  </div>
                  <div className="text-[11px] text-emerald-700 mt-1">
                    Pass Cutoff: {settings.attendance_minimum_percentage || '75'}% exam threshold
                  </div>
                </div>

                <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-100">
                  <div className="flex items-center justify-between text-blue-800 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider">Total Enrolled Students</span>
                    <Users className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-3xl font-black text-blue-950">{stats?.totalStudents ?? 0}</div>
                  <div className="text-[11px] text-blue-700 mt-1">Across all departments</div>
                </div>

                <div className="p-4 bg-purple-50/60 rounded-xl border border-purple-100">
                  <div className="flex items-center justify-between text-purple-800 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider">Academic Lecturers</span>
                    <BookOpen className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="text-3xl font-black text-purple-950">{stats?.totalLecturers ?? 0}</div>
                  <div className="text-[11px] text-purple-700 mt-1">{stats?.totalCourses ?? 0} active courses</div>
                </div>

                <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-100">
                  <div className="flex items-center justify-between text-amber-800 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider">Lectures Delivered</span>
                    <Calendar className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="text-3xl font-black text-amber-950">{stats?.totalSessionsHeld ?? 0}</div>
                  <div className="text-[11px] text-amber-700 mt-1">{stats?.totalRecords ?? 0} student attendance records</div>
                </div>
              </div>

              {/* Status Breakdown Bar */}
              <div className="p-5 bg-gray-50 rounded-xl border border-gray-200">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-3">
                  Institutional Attendance Distribution
                </h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-sm">
                    <div className="text-xs font-semibold text-emerald-800">Present Marks</div>
                    <div className="text-xl font-bold text-emerald-700 mt-0.5">{stats?.presentCount ?? 0}</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-amber-100 shadow-sm">
                    <div className="text-xs font-semibold text-amber-800">Late Marks</div>
                    <div className="text-xl font-bold text-amber-700 mt-0.5">{stats?.lateCount ?? 0}</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-red-100 shadow-sm">
                    <div className="text-xs font-semibold text-red-800">Absent Marks</div>
                    <div className="text-xl font-bold text-red-700 mt-0.5">{stats?.absentCount ?? 0}</div>
                  </div>
                </div>
              </div>

              {/* Recent Audit Actions Preview */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                    Recent Institutional Operations
                  </h4>
                  <button
                    onClick={() => setActiveTab('audit')}
                    className="text-xs font-semibold text-[#004d25] hover:underline"
                  >
                    View Full Audit Trail →
                  </button>
                </div>
                <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                  {auditLogs.slice(0, 5).map((log) => (
                    <div key={log.id} className="p-3 text-xs flex items-center justify-between hover:bg-gray-50">
                      <div>
                        <span className="font-bold text-gray-800 mr-2">{log.action}</span>
                        <span className="text-gray-600">{log.details}</span>
                      </div>
                      <div className="text-[11px] text-gray-400 shrink-0 ml-4">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: USERS MANAGEMENT */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              {/* Filter and Add Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  <div className="relative min-w-[200px]">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search by name, email, matric/staff ID..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs text-gray-900 focus:bg-white focus:outline-none"
                    />
                  </div>

                  <select
                    value={userRoleFilter}
                    onChange={(e) => setUserRoleFilter(e.target.value)}
                    className="py-1.5 px-2.5 bg-gray-50 border border-gray-300 rounded-lg text-xs text-gray-700 focus:outline-none"
                  >
                    <option value="">All Roles</option>
                    <option value="student">Students</option>
                    <option value="lecturer">Lecturers</option>
                    <option value="admin">Administrators</option>
                  </select>

                  <select
                    value={userDeptFilter}
                    onChange={(e) => setUserDeptFilter(e.target.value)}
                    className="py-1.5 px-2.5 bg-gray-50 border border-gray-300 rounded-lg text-xs text-gray-700 focus:outline-none"
                  >
                    <option value="">All Departments</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code} - {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => setShowAddUserModal(true)}
                  className="px-3.5 py-2 bg-[#004d25] hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create User</span>
                </button>
              </div>

              {/* Users Table */}
              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">User Details</th>
                      <th className="py-3 px-3">Role</th>
                      <th className="py-3 px-3">Identifier / ID</th>
                      <th className="py-3 px-3">Department & Level</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-gray-500">
                          No users match the search criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-gray-50/80">
                          <td className="py-3 px-4">
                            <div className="font-bold text-gray-900">{u.full_name}</div>
                            <div className="text-[11px] text-gray-500">{u.email}</div>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                u.role === 'admin'
                                  ? 'bg-purple-100 text-purple-800'
                                  : u.role === 'lecturer'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-gray-700">
                            {u.identifier || '-'}
                          </td>
                          <td className="py-3 px-3 text-gray-700">
                            <div>{u.department_name || '-'}</div>
                            {u.level && <div className="text-[10px] text-gray-500 font-medium">{u.level}</div>}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                u.status === 'active'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-200 text-gray-700'
                              }`}
                            >
                              {u.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleToggleUserStatus(u)}
                              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                                u.status === 'active'
                                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              }`}
                            >
                              {u.status === 'active' ? 'Deactivate' : 'Activate'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: DEPARTMENTS */}
          {activeTab === 'departments' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-gray-800">Academic Departments & Colleges</h3>
                  <p className="text-xs text-gray-500">Departments configured in Kaduna Polytechnic</p>
                </div>
                <button
                  onClick={() => setShowAddDeptModal(true)}
                  className="px-3.5 py-2 bg-[#004d25] hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Department</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {departments.map((dept) => (
                  <div
                    key={dept.id}
                    className="p-4 bg-white rounded-xl border border-gray-200 hover:border-emerald-500/50 shadow-sm transition"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-xs font-bold font-mono">
                          {dept.code}
                        </span>
                        <h4 className="font-bold text-gray-900 text-sm mt-1">{dept.name}</h4>
                        <p className="text-xs text-gray-500">{dept.college}</p>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100 grid grid-cols-3 text-center text-xs">
                      <div>
                        <div className="text-gray-400 text-[10px] font-semibold uppercase">Students</div>
                        <div className="font-bold text-gray-800">{dept.student_count || 0}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-[10px] font-semibold uppercase">Lecturers</div>
                        <div className="font-bold text-gray-800">{dept.lecturer_count || 0}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-[10px] font-semibold uppercase">Courses</div>
                        <div className="font-bold text-gray-800">{dept.course_count || 0}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: ACADEMIC SESSIONS */}
          {activeTab === 'sessions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-gray-800">Academic Sessions & Semesters</h3>
                  <p className="text-xs text-gray-500">Only one academic session is marked active at a time</p>
                </div>
                <button
                  onClick={() => setShowAddSessionModal(true)}
                  className="px-3.5 py-2 bg-[#004d25] hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Session</span>
                </button>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Academic Session</th>
                      <th className="py-3 px-3">Semester</th>
                      <th className="py-3 px-3">Date Range</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sessions.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 font-bold text-gray-900">{s.name}</td>
                        <td className="py-3 px-3 text-gray-700">{s.semester}</td>
                        <td className="py-3 px-3 text-gray-500 font-mono text-[11px]">
                          {s.start_date} to {s.end_date}
                        </td>
                        <td className="py-3 px-3">
                          {s.is_active === 1 ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1 w-max">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping"></span>
                              Active Session
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {s.is_active !== 1 && (
                            <button
                              onClick={() => handleSetActiveSession(s.id)}
                              className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-xs font-semibold"
                            >
                              Make Active
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: COURSES & ASSIGNMENTS */}
          {activeTab === 'courses' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-gray-800">Curriculum Courses & Lecturer Assignments</h3>
                  <p className="text-xs text-gray-500">Manage courses and assign teaching faculty</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAddCourseModal(true)}
                    className="px-3.5 py-2 bg-[#004d25] hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add New Course</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Course Code & Title</th>
                      <th className="py-3 px-3">Department</th>
                      <th className="py-3 px-3">Units & Level</th>
                      <th className="py-3 px-3">Assigned Lecturer</th>
                      <th className="py-3 px-3">Enrolled</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {courses.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-emerald-900 bg-emerald-50 px-1.5 py-0.5 rounded mr-2">
                            {c.code}
                          </span>
                          <span className="font-semibold text-gray-900">{c.title}</span>
                        </td>
                        <td className="py-3 px-3 text-gray-700">{c.department_name}</td>
                        <td className="py-3 px-3 text-gray-600">
                          {c.credit_units} CU • {c.level}
                        </td>
                        <td className="py-3 px-3 font-medium text-gray-800">
                          {c.assigned_lecturer ? (
                            <span className="text-emerald-800 font-semibold">{c.assigned_lecturer}</span>
                          ) : (
                            <span className="text-amber-600 italic">Not Assigned</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-gray-700 font-bold">{c.enrolled_count || 0}</td>
                        <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => handleDownloadCourseRecord(c.id, 'csv')}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded text-xs font-semibold inline-flex items-center gap-1 border border-emerald-200 transition"
                            title="Export course attendance as CSV"
                          >
                            <FileText className="w-3 h-3 text-emerald-700" />
                            <span>CSV</span>
                          </button>
                          <button
                            onClick={() => handleDownloadCourseRecord(c.id, 'pdf')}
                            className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-800 rounded text-xs font-semibold inline-flex items-center gap-1 border border-red-200 transition"
                            title="Export course attendance as PDF"
                          >
                            <FileText className="w-3 h-3 text-red-600" />
                            <span>PDF</span>
                          </button>
                          <button
                            onClick={() => {
                              setSelectedCourseForAssign(c);
                              setShowAssignLecturerModal(true);
                            }}
                            className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-semibold"
                          >
                            Assign Lecturer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: AUDIT LOGS */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-sm text-gray-800">Institutional Audit Log Trail</h3>
                <p className="text-xs text-gray-500">
                  Tamper-evident record of all system operations, security authentications, attendance markings, and corrections.
                </p>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-3">Action</th>
                      <th className="py-3 px-3">Entity</th>
                      <th className="py-3 px-3">User</th>
                      <th className="py-3 px-4">Details</th>
                      <th className="py-3 px-3">IP Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-mono text-[11px]">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="py-2.5 px-4 text-gray-500 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-slate-100 text-slate-800">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-gray-600">{log.entity}</td>
                        <td className="py-2.5 px-3 font-sans font-medium text-gray-800">
                          {log.user_name || log.user_email || 'System'}
                        </td>
                        <td className="py-2.5 px-4 font-sans text-gray-700">{log.details}</td>
                        <td className="py-2.5 px-3 text-gray-400">{log.ip_address || '127.0.0.1'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 7: SETTINGS */}
          {activeTab === 'settings' && (
            <AdminSettingsForm
              settings={settings}
              onSaved={(newSettings) => {
                setSettings(newSettings);
                showAlert('success', 'Institutional settings updated successfully.');
              }}
            />
          )}
        </div>
      </div>

      {/* MODALS */}
      {showAddUserModal && (
        <AddUserModal
          departments={departments}
          onClose={() => setShowAddUserModal(false)}
          onSuccess={() => {
            setShowAddUserModal(false);
            showAlert('success', 'New user account created successfully.');
            loadAllData();
          }}
        />
      )}

      {showAddDeptModal && (
        <AddDepartmentModal
          onClose={() => setShowAddDeptModal(false)}
          onSuccess={() => {
            setShowAddDeptModal(false);
            showAlert('success', 'Department created successfully.');
            loadAllData();
          }}
        />
      )}

      {showAddSessionModal && (
        <AddSessionModal
          onClose={() => setShowAddSessionModal(false)}
          onSuccess={() => {
            setShowAddSessionModal(false);
            showAlert('success', 'Academic session created successfully.');
            loadAllData();
          }}
        />
      )}

      {showAddCourseModal && (
        <AddCourseModal
          departments={departments}
          onClose={() => setShowAddCourseModal(false)}
          onSuccess={() => {
            setShowAddCourseModal(false);
            showAlert('success', 'Course created successfully.');
            loadAllData();
          }}
        />
      )}

      {showAssignLecturerModal && selectedCourseForAssign && (
        <AssignLecturerModal
          course={selectedCourseForAssign}
          lecturers={users.filter((u) => u.role === 'lecturer')}
          onClose={() => {
            setShowAssignLecturerModal(false);
            setSelectedCourseForAssign(null);
          }}
          onSuccess={() => {
            setShowAssignLecturerModal(false);
            setSelectedCourseForAssign(null);
            showAlert('success', 'Lecturer assigned to course successfully.');
            loadAllData();
          }}
        />
      )}

      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        courses={courses}
      />
    </div>
  );
};

// Subcomponent: Settings Form
const AdminSettingsForm: React.FC<{
  settings: Record<string, string>;
  onSaved: (newSettings: Record<string, string>) => void;
}> = ({ settings: initialSettings, onSaved }) => {
  const [formData, setFormData] = useState({
    institution_name: initialSettings.institution_name || 'Kaduna Polytechnic',
    institution_short: initialSettings.institution_short || 'KadPoly',
    attendance_minimum_percentage: initialSettings.attendance_minimum_percentage || '75',
    late_arrival_weight: initialSettings.late_arrival_weight || '0.5',
    allow_student_self_registration: initialSettings.allow_student_self_registration || 'true',
    allow_correction_requests: initialSettings.allow_correction_requests || 'true',
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put('/admin/settings', formData);
      onSaved(formData);
      setMsg('Settings updated successfully.');
    } catch (err: any) {
      alert(err.message || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
      <div>
        <h3 className="font-bold text-sm text-gray-800">Institutional Governance & Examination Rules</h3>
        <p className="text-xs text-gray-500">Configure attendance policies and exam clearance thresholds</p>
      </div>

      {msg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold">
          {msg}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
            Institution Legal Name
          </label>
          <input
            type="text"
            value={formData.institution_name}
            onChange={(e) => setFormData({ ...formData, institution_name: e.target.value })}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
            Acronym / Short Code
          </label>
          <input
            type="text"
            value={formData.institution_short}
            onChange={(e) => setFormData({ ...formData, institution_short: e.target.value })}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
            Minimum Exam Clearance Attendance (%)
          </label>
          <input
            type="number"
            min="50"
            max="100"
            value={formData.attendance_minimum_percentage}
            onChange={(e) => setFormData({ ...formData, attendance_minimum_percentage: e.target.value })}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs font-bold text-emerald-900"
          />
          <p className="text-[10px] text-gray-500 mt-1">Standard Nigerian Polytechnic benchmark is 75%</p>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
            Late Arrival Weight (0.0 - 1.0)
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="1"
            value={formData.late_arrival_weight}
            onChange={(e) => setFormData({ ...formData, late_arrival_weight: e.target.value })}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs"
          />
          <p className="text-[10px] text-gray-500 mt-1">0.5 means a late mark is counted as half attendance</p>
        </div>
      </div>

      <div className="pt-3">
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 bg-[#004d25] hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow"
        >
          {loading ? 'Saving Changes...' : 'Save Settings'}
        </button>
      </div>
    </form>
  );
};

// Modal: Add User
const AddUserModal: React.FC<{
  departments: Department[];
  onClose: () => void;
  onSuccess: () => void;
}> = ({ departments, onClose, onSuccess }) => {
  const [role, setRole] = useState<'student' | 'lecturer' | 'admin'>('student');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('KadPolyPass123!');
  const [identifier, setIdentifier] = useState('');
  const [deptId, setDeptId] = useState<number | ''>(departments.length > 0 ? departments[0].id : '');
  const [level, setLevel] = useState('ND I');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post('/admin/users', {
        email,
        password,
        full_name: fullName,
        role,
        identifier,
        department_id: deptId ? Number(deptId) : undefined,
        level: role === 'student' ? level : undefined,
        phone,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden">
        <div className="bg-[#004d25] text-white px-6 py-4 flex items-center justify-between">
          <h3 className="font-bold text-sm">Add New Institutional User</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg">{error}</div>}

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Role</label>
            <div className="grid grid-cols-3 gap-2">
              {(['student', 'lecturer', 'admin'] as const).map((r) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => setRole(r)}
                  className={`py-2 text-xs font-bold rounded-lg border capitalize ${
                    role === r ? 'bg-emerald-50 border-[#004d25] text-[#004d25]' : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                {role === 'student' ? 'Matriculation No' : 'Staff ID'}
              </label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Initial Password</label>
              <input
                type="text"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Department</label>
              <select
                value={deptId}
                onChange={(e) => setDeptId(Number(e.target.value))}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.code} - {d.name}</option>
                ))}
              </select>
            </div>

            {role === 'student' ? (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Level</label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs"
                >
                  <option value="ND I">ND I</option>
                  <option value="ND II">ND II</option>
                  <option value="HND I">HND I</option>
                  <option value="HND II">HND II</option>
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+234..."
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
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
              className="px-4 py-2 bg-[#004d25] text-white rounded-lg text-xs font-bold shadow"
            >
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Modal: Add Department
const AddDepartmentModal: React.FC<{ onClose: () => void; onSuccess: () => void }> = ({ onClose, onSuccess }) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [college, setCollege] = useState('College of Science & Technology');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/admin/departments', { code, name, college });
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        <div className="bg-[#004d25] text-white px-6 py-4 flex items-center justify-between">
          <h3 className="font-bold text-sm">Add Academic Department</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-3">
          {error && <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-lg">{error}</div>}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Code (e.g. COM, EET)</label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 bg-gray-50 border rounded-lg text-xs uppercase"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Department Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border rounded-lg text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">College</label>
            <select
              value={college}
              onChange={(e) => setCollege(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border rounded-lg text-xs"
            >
              <option value="College of Science & Technology">College of Science & Technology (CST)</option>
              <option value="College of Engineering">College of Engineering (COE)</option>
              <option value="College of Business & Management Studies">College of Business & Management Studies (CBMS)</option>
              <option value="College of Environmental Studies">College of Environmental Studies (CES)</option>
              <option value="College of Administrative Studies">College of Administrative Studies (CAS)</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs border rounded-lg">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-1.5 text-xs font-bold bg-[#004d25] text-white rounded-lg">
              {loading ? 'Adding...' : 'Save Department'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Modal: Add Session
const AddSessionModal: React.FC<{ onClose: () => void; onSuccess: () => void }> = ({ onClose, onSuccess }) => {
  const [name, setName] = useState('2026/2027');
  const [semester, setSemester] = useState('First Semester');
  const [startDate, setStartDate] = useState('2026-10-01');
  const [endDate, setEndDate] = useState('2027-03-31');
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/admin/sessions', {
        name,
        semester,
        start_date: startDate,
        end_date: endDate,
        is_active: isActive,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        <div className="bg-[#004d25] text-white px-6 py-4 flex items-center justify-between">
          <h3 className="font-bold text-sm">Create Academic Session</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-3">
          {error && <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-lg">{error}</div>}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Session (e.g. 2026/2027)</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border rounded-lg text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Semester</label>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border rounded-lg text-xs"
            >
              <option value="First Semester">First Semester</option>
              <option value="Second Semester">Second Semester</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border rounded-lg text-xs"
              />
            </div>
          </div>
          <div className="pt-1 flex items-center gap-2">
            <input
              type="checkbox"
              id="isActiveCheck"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded text-emerald-600"
            />
            <label htmlFor="isActiveCheck" className="text-xs font-medium text-gray-700">
              Set as the current Active Session immediately
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs border rounded-lg">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-1.5 text-xs font-bold bg-[#004d25] text-white rounded-lg">
              {loading ? 'Creating...' : 'Create Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Modal: Add Course
const AddCourseModal: React.FC<{
  departments: Department[];
  onClose: () => void;
  onSuccess: () => void;
}> = ({ departments, onClose, onSuccess }) => {
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [creditUnits, setCreditUnits] = useState(3);
  const [deptId, setDeptId] = useState<number>(departments.length > 0 ? departments[0].id : 1);
  const [level, setLevel] = useState('ND I');
  const [semester, setSemester] = useState('First Semester');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/admin/courses', {
        code,
        title,
        credit_units: creditUnits,
        department_id: deptId,
        level,
        semester,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        <div className="bg-[#004d25] text-white px-6 py-4 flex items-center justify-between">
          <h3 className="font-bold text-sm">Add New Curriculum Course</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-3">
          {error && <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-lg">{error}</div>}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <label className="block text-xs font-bold text-gray-700 mb-1">Code</label>
              <input
                type="text"
                required
                placeholder="COM 211"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 bg-gray-50 border rounded-lg text-xs uppercase"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-700 mb-1">Course Title</label>
              <input
                type="text"
                required
                placeholder="Database Systems"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border rounded-lg text-xs"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Credit Units</label>
              <input
                type="number"
                min="1"
                max="6"
                value={creditUnits}
                onChange={(e) => setCreditUnits(Number(e.target.value))}
                className="w-full px-3 py-2 bg-gray-50 border rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Department</label>
              <select
                value={deptId}
                onChange={(e) => setDeptId(Number(e.target.value))}
                className="w-full px-3 py-2 bg-gray-50 border rounded-lg text-xs"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.code} - {d.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Level</label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border rounded-lg text-xs"
              >
                <option value="ND I">ND I</option>
                <option value="ND II">ND II</option>
                <option value="HND I">HND I</option>
                <option value="HND II">HND II</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Semester</label>
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border rounded-lg text-xs"
              >
                <option value="First Semester">First Semester</option>
                <option value="Second Semester">Second Semester</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs border rounded-lg">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-1.5 text-xs font-bold bg-[#004d25] text-white rounded-lg">
              {loading ? 'Creating...' : 'Save Course'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Modal: Assign Lecturer
const AssignLecturerModal: React.FC<{
  course: Course;
  lecturers: User[];
  onClose: () => void;
  onSuccess: () => void;
}> = ({ course, lecturers, onClose, onSuccess }) => {
  const [selectedLecturerId, setSelectedLecturerId] = useState<number>(
    lecturers.length > 0 ? lecturers[0].id : 0
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLecturerId) {
      setError('Please select a lecturer.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/admin/assignments', {
        course_id: course.id,
        lecturer_id: selectedLecturerId,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        <div className="bg-[#004d25] text-white px-6 py-4 flex items-center justify-between">
          <h3 className="font-bold text-sm">Assign Lecturer to {course.code}</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-lg">{error}</div>}
          <div className="bg-emerald-50 p-3 rounded-lg text-xs text-emerald-900 border border-emerald-100">
            <span className="font-bold">{course.code}:</span> {course.title} ({course.department_name})
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Select Lecturer</label>
            <select
              value={selectedLecturerId}
              onChange={(e) => setSelectedLecturerId(Number(e.target.value))}
              className="w-full px-3 py-2 bg-gray-50 border rounded-lg text-xs font-medium"
            >
              {lecturers.map((lec) => (
                <option key={lec.id} value={lec.id}>
                  {lec.full_name} ({lec.email}) - {lec.department_name || 'Faculty'}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs border rounded-lg">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-1.5 text-xs font-bold bg-[#004d25] text-white rounded-lg">
              {loading ? 'Assigning...' : 'Confirm Assignment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
