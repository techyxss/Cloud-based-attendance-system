export type UserRole = 'admin' | 'lecturer' | 'student';
export type AttendanceStatus = 'Present' | 'Absent' | 'Late';
export type CorrectionStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  identifier?: string;
  department_id?: number;
  department_name?: string;
  department_code?: string;
  level?: string;
  phone?: string;
  status: 'active' | 'inactive' | 'suspended';
  created_at?: string;
  updated_at?: string;
}

export interface Department {
  id: number;
  code: string;
  name: string;
  college: string;
  student_count?: number;
  lecturer_count?: number;
  course_count?: number;
  created_at?: string;
}

export interface AcademicSession {
  id: number;
  name: string;
  semester: string;
  is_active: number;
  start_date: string;
  end_date: string;
  created_at?: string;
}

export interface Course {
  id: number;
  code: string;
  title: string;
  credit_units: number;
  department_id: number;
  department_name?: string;
  department_code?: string;
  level: string;
  semester: string;
  status: string;
  enrolled_count?: number;
  assigned_lecturer?: string;
  assigned_lecturer_id?: number;
  lecturer_name?: string;
  lecturer_email?: string;
  sessions_held?: number;
  total_sessions?: number;
  present_count?: number;
  late_count?: number;
  absent_count?: number;
  percentage?: number;
  is_eligible?: boolean;
}

export interface AttendanceRecord {
  id: number;
  session_id: number;
  student_id: number;
  course_id: number;
  status: AttendanceStatus;
  remarks?: string;
  marked_by?: number;
  marked_at: string;
  updated_at: string;
  correction_reason?: string;
  student_name?: string;
  student_identifier?: string;
  student_email?: string;
}

export interface AttendanceSession {
  id: number;
  course_id: number;
  lecturer_id: number;
  session_id: number;
  date: string;
  start_time: string;
  end_time: string;
  topic: string;
  venue: string;
  created_at: string;
  course_code?: string;
  course_title?: string;
  lecturer_name?: string;
  present_count?: number;
  late_count?: number;
  absent_count?: number;
  total_students?: number;
}

export interface CorrectionRequest {
  id: number;
  attendance_record_id: number;
  student_id: number;
  lecturer_id: number;
  course_id: number;
  requested_status: AttendanceStatus;
  reason: string;
  status: CorrectionStatus;
  admin_or_lecturer_notes?: string;
  reviewed_by?: number;
  reviewed_at?: string;
  created_at: string;
  student_name?: string;
  student_identifier?: string;
  student_email?: string;
  course_code?: string;
  course_title?: string;
  lecture_date?: string;
  lecture_topic?: string;
  current_status?: AttendanceStatus;
}

export interface AuditLog {
  id: number;
  user_id?: number;
  user_name?: string;
  user_email?: string;
  user_role?: string;
  action: string;
  entity: string;
  entity_id: string;
  details: string;
  ip_address?: string;
  created_at: string;
}

export interface TestAccount {
  role: UserRole;
  roleLabel: string;
  email: string;
  password: string;
  name: string;
  title: string;
  description: string;
}
