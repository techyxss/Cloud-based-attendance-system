import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Header } from './components/Header.tsx';
import { LoginView } from './components/LoginView.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { LecturerDashboard } from './components/LecturerDashboard.tsx';
import { StudentDashboard } from './components/StudentDashboard.tsx';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-emerald-950 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-16 h-16 rounded-2xl bg-white shadow-2xl p-2 mb-4 ring-4 ring-emerald-500/30 flex items-center justify-center">
          <div className="w-full h-full rounded-xl bg-[#004d25] flex items-center justify-center font-black text-xl">
            KP
          </div>
        </div>
        <div className="w-8 h-8 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin mb-3"></div>
        <h2 className="text-base font-bold tracking-tight">KADUNA POLYTECHNIC</h2>
        <p className="text-xs text-emerald-300">Synchronizing cloud attendance database...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Header />
      <main className="flex-1">
        {user.role === 'admin' && <AdminDashboard />}
        {user.role === 'lecturer' && <LecturerDashboard />}
        {user.role === 'student' && <StudentDashboard />}
      </main>
      <footer className="bg-white border-t border-gray-200 py-4 px-4 text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-800">Kaduna Polytechnic</span>
            <span>•</span>
            <span>Directorate of Academic Planning & Quality Assurance</span>
          </div>
          <div className="font-mono text-[11px] text-gray-400">
            Cloud Attendance & Examination Clearance Engine v1.0.0
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
