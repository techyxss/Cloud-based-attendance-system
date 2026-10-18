import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { UserRole, Department, TestAccount } from '../types/index.ts';
import { api } from '../lib/api.ts';
import {
  ShieldCheck,
  BookOpen,
  GraduationCap,
  Lock,
  Mail,
  User,
  Phone,
  Building,
  KeyRound,
  ArrowRight,
  Sparkles,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login, register, quickLogin, testAccounts } = useAuth();

  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'reset'>('login');
  const [departments, setDepartments] = useState<Department[]>([]);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Register form state
  const [regRole, setRegRole] = useState<UserRole>('student');
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regIdentifier, setRegIdentifier] = useState('');
  const [regDeptId, setRegDeptId] = useState<number | ''>('');
  const [regLevel, setRegLevel] = useState('ND I');
  const [regPhone, setRegPhone] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  // Password reset state
  const [resetEmail, setResetEmail] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  // Fetch departments for registration dropdown
  useEffect(() => {
    fetch('/api/admin/departments')
      .then(res => res.json())
      .then(data => {
        if (data.departments) {
          setDepartments(data.departments);
          if (data.departments.length > 0 && regDeptId === '') {
            setRegDeptId(data.departments[0].id);
          }
        }
      })
      .catch(() => {
        // Will fallback to default if not logged in or admin
      });
  }, [regDeptId]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    try {
      await login(loginEmail, loginPassword);
    } catch (err: any) {
      setLoginError(err.message || 'Invalid email or password.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setRegLoading(true);

    try {
      await register({
        email: regEmail,
        password: regPassword,
        full_name: regFullName,
        role: regRole,
        identifier: regIdentifier,
        department_id: regDeptId ? Number(regDeptId) : undefined,
        level: regRole === 'student' ? regLevel : undefined,
        phone: regPhone,
      });
    } catch (err: any) {
      setRegError(err.message || 'Failed to create account.');
    } finally {
      setRegLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetSuccess(null);
    setResetLoading(true);

    try {
      const res = await api.post<{ message: string }>('/auth/reset-password', {
        email: resetEmail,
        new_password: resetPassword,
      });
      setResetSuccess(res.message);
      setResetEmail('');
      setResetPassword('');
    } catch (err: any) {
      setResetError(err.message || 'Failed to reset password.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleQuickLoginClick = async (role: UserRole) => {
    setLoginError(null);
    setLoginLoading(true);
    try {
      await quickLogin(role);
    } catch (err: any) {
      setLoginError(err.message || 'Quick login failed.');
    } finally {
      setLoginLoading(false);
    }
  };

  const fillFormWithTestAccount = (acc: TestAccount) => {
    setActiveTab('login');
    setLoginEmail(acc.email);
    setLoginPassword(acc.password);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 via-emerald-900 to-slate-900 py-10 px-4 sm:px-6 lg:px-8 flex flex-col justify-center items-center">
      <div className="max-w-4xl w-full">
        {/* Institutional Crest & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white shadow-2xl p-2 mb-4 ring-4 ring-emerald-500/30">
            <div className="w-full h-full rounded-xl bg-[#004d25] flex flex-col items-center justify-center text-white">
              <span className="font-black text-2xl tracking-tighter">KP</span>
              <span className="text-[8px] font-bold tracking-widest text-emerald-300">EST. 1956</span>
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            KADUNA POLYTECHNIC
          </h1>
          <p className="mt-2 text-base text-emerald-200 max-w-xl mx-auto">
            Centralized Cloud Attendance Management & Examination Clearance System
          </p>
        </div>

        {/* 1-Click Test Account Cards for Immediate Evaluation */}
        <div className="mb-8 bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-5 shadow-2xl">
          <div className="flex items-center gap-2 mb-3 text-emerald-300 font-semibold text-sm">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Instant Test Accounts (Click to test each role immediately):</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {testAccounts.map((acc) => (
              <div
                key={acc.role}
                className="bg-white/95 rounded-xl p-4 text-gray-800 shadow-md hover:shadow-lg transition-all border border-emerald-100 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        acc.role === 'admin'
                          ? 'bg-purple-100 text-purple-800'
                          : acc.role === 'lecturer'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {acc.role}
                    </span>
                    <button
                      onClick={() => fillFormWithTestAccount(acc)}
                      className="text-[11px] text-emerald-700 hover:text-emerald-900 underline font-medium"
                    >
                      Fill Form
                    </button>
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm leading-tight">{acc.name}</h3>
                  <p className="text-xs text-gray-600 mt-0.5 line-clamp-1">{acc.title}</p>
                  <p className="text-[11px] font-mono text-gray-500 mt-2 bg-gray-50 p-1.5 rounded border border-gray-100">
                    {acc.email}
                  </p>
                </div>

                <button
                  onClick={() => handleQuickLoginClick(acc.role)}
                  disabled={loginLoading}
                  className="mt-3 w-full py-2 px-3 bg-[#004d25] hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow transition"
                >
                  <span>1-Click Login as {acc.role.toUpperCase()}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Auth Box Container */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 bg-gray-50/80">
            <button
              onClick={() => {
                setActiveTab('login');
                setLoginError(null);
              }}
              className={`flex-1 py-4 text-center text-sm font-bold transition-colors border-b-2 flex items-center justify-center gap-2 ${
                activeTab === 'login'
                  ? 'border-[#004d25] text-[#004d25] bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <Lock className="w-4 h-4" />
              Sign In to Account
            </button>
            <button
              onClick={() => {
                setActiveTab('register');
                setRegError(null);
              }}
              className={`flex-1 py-4 text-center text-sm font-bold transition-colors border-b-2 flex items-center justify-center gap-2 ${
                activeTab === 'register'
                  ? 'border-[#004d25] text-[#004d25] bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <User className="w-4 h-4" />
              Create New Account
            </button>
            <button
              onClick={() => {
                setActiveTab('reset');
                setResetError(null);
                setResetSuccess(null);
              }}
              className={`py-4 px-4 text-center text-sm font-medium transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
                activeTab === 'reset'
                  ? 'border-[#004d25] text-[#004d25] bg-white font-bold'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <KeyRound className="w-4 h-4" />
              <span className="hidden sm:inline">Password Reset</span>
            </button>
          </div>

          <div className="p-6 sm:p-8">
            {/* TAB 1: LOGIN */}
            {activeTab === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-4 max-w-md mx-auto">
                {loginError && (
                  <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <span>{loginError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Institutional Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="e.g. yourname@kadpoly.edu.ng"
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#004d25] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                    <input
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#004d25] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
                  <span>Protected by JWT & Argon/Bcrypt</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('reset')}
                    className="text-[#004d25] hover:underline font-semibold"
                  >
                    Forgot Password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full py-3 px-4 bg-[#004d25] hover:bg-emerald-800 text-white font-bold rounded-xl text-sm shadow-md hover:shadow-lg transition flex items-center justify-center gap-2"
                >
                  {loginLoading ? (
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <span>Sign In to KadPoly Portal</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* TAB 2: REGISTER */}
            {activeTab === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                {regError && (
                  <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <span>{regError}</span>
                  </div>
                )}

                {/* Account Type Selection */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Select Your Account Type
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setRegRole('student')}
                      className={`p-3 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1.5 ${
                        regRole === 'student'
                          ? 'bg-emerald-50 border-[#004d25] text-[#004d25] font-bold shadow-sm ring-1 ring-[#004d25]'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <GraduationCap className="w-5 h-5 text-emerald-700" />
                      <span className="text-xs">Student</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRegRole('lecturer')}
                      className={`p-3 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1.5 ${
                        regRole === 'lecturer'
                          ? 'bg-emerald-50 border-[#004d25] text-[#004d25] font-bold shadow-sm ring-1 ring-[#004d25]'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <BookOpen className="w-5 h-5 text-emerald-700" />
                      <span className="text-xs">Lecturer</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRegRole('admin')}
                      className={`p-3 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1.5 ${
                        regRole === 'admin'
                          ? 'bg-emerald-50 border-[#004d25] text-[#004d25] font-bold shadow-sm ring-1 ring-[#004d25]'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <ShieldCheck className="w-5 h-5 text-emerald-700" />
                      <span className="text-xs">Administrator</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Full Legal Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        required
                        value={regFullName}
                        onChange={(e) => setRegFullName(e.target.value)}
                        placeholder="e.g. Amina Mohammed"
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#004d25] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="e.g. amina@kadpoly.edu.ng"
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#004d25] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      {regRole === 'student' ? 'Matriculation Number' : 'Staff Identification ID'}
                    </label>
                    <input
                      type="text"
                      required
                      value={regIdentifier}
                      onChange={(e) => setRegIdentifier(e.target.value)}
                      placeholder={
                        regRole === 'student' ? 'e.g. KPT/CST/24/98711' : 'e.g. KPT/STAFF/189'
                      }
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#004d25] focus:outline-none uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Password (min. 6 characters)
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#004d25] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Department */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Department
                    </label>
                    <div className="relative">
                      <Building className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                      <select
                        value={regDeptId}
                        onChange={(e) => setRegDeptId(Number(e.target.value))}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#004d25] focus:outline-none"
                      >
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.code} - {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Level (for students) or Phone */}
                  {regRole === 'student' ? (
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Academic Level
                      </label>
                      <select
                        value={regLevel}
                        onChange={(e) => setRegLevel(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#004d25] focus:outline-none"
                      >
                        <option value="ND I">ND I (National Diploma 1)</option>
                        <option value="ND II">ND II (National Diploma 2)</option>
                        <option value="HND I">HND I (Higher National Diploma 1)</option>
                        <option value="HND II">HND II (Higher National Diploma 2)</option>
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Phone Number
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                        <input
                          type="tel"
                          value={regPhone}
                          onChange={(e) => setRegPhone(e.target.value)}
                          placeholder="+234 803 000 0000"
                          className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#004d25] focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs text-emerald-800">
                  <span className="font-semibold">Note:</span> After creating your account, you will be logged in immediately to your dashboard!
                </div>

                <button
                  type="submit"
                  disabled={regLoading}
                  className="w-full py-3 px-4 bg-[#004d25] hover:bg-emerald-800 text-white font-bold rounded-xl text-sm shadow-md hover:shadow-lg transition flex items-center justify-center gap-2"
                >
                  {regLoading ? (
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <span>Complete Registration & Enter Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* TAB 3: PASSWORD RESET */}
            {activeTab === 'reset' && (
              <form onSubmit={handleResetSubmit} className="space-y-4 max-w-md mx-auto">
                {resetSuccess && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex items-start gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{resetSuccess}</span>
                  </div>
                )}
                {resetError && (
                  <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <span>{resetError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Your Registered Email
                  </label>
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="e.g. student@kadpoly.edu.ng"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#004d25] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    New Secure Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#004d25] focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full py-3 px-4 bg-[#004d25] hover:bg-emerald-800 text-white font-bold rounded-xl text-sm shadow-md transition flex items-center justify-center gap-2"
                >
                  {resetLoading ? 'Resetting...' : 'Update Password & Return to Login'}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('login')}
                    className="text-xs text-emerald-700 hover:underline font-semibold"
                  >
                    Back to Sign In
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center text-xs text-emerald-300/70">
          <p>© {new Date().getFullYear()} Kaduna Polytechnic. All rights reserved.</p>
          <p className="mt-1">Directorate of Information and Communication Technology (DICT)</p>
        </div>
      </div>
    </div>
  );
};
