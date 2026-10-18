import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { UserRole } from '../types/index.ts';
import {
  GraduationCap,
  ShieldCheck,
  BookOpen,
  User as UserIcon,
  LogOut,
  ChevronDown,
  Layers,
  Sparkles,
  Menu,
  X
} from 'lucide-react';

interface HeaderProps {
  onOpenReportModal?: () => void;
}

export const Header: React.FC<HeaderProps> = () => {
  const { user, logout, quickLogin, testAccounts } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  const handleQuickSwitch = async (role: UserRole) => {
    try {
      setIsSwitching(true);
      await quickLogin(role);
      setDropdownOpen(false);
      setMobileMenuOpen(false);
    } catch (err) {
      console.error('Failed to quick switch:', err);
    } finally {
      setIsSwitching(false);
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-200 border border-emerald-600/40">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            ADMINISTRATOR
          </span>
        );
      case 'lecturer':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-200 border border-emerald-600/40">
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
            LECTURER
          </span>
        );
      case 'student':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-200 border border-emerald-600/40">
            <GraduationCap className="w-3.5 h-3.5 text-emerald-400" />
            STUDENT
          </span>
        );
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#004d25] text-white shadow-md border-b border-emerald-800">
      {/* Test Account Quick Switcher Banner */}
      <div className="bg-[#00381b] border-b border-emerald-900/60 px-4 py-1.5 text-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-emerald-200 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>Test Role Switcher:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {testAccounts.map((acc) => {
              const isCurrent = user?.role === acc.role;
              return (
                <button
                  key={acc.role}
                  disabled={isSwitching}
                  onClick={() => handleQuickSwitch(acc.role)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                    isCurrent
                      ? 'bg-emerald-500 text-white font-semibold ring-2 ring-white/30'
                      : 'bg-emerald-900/70 text-emerald-200 hover:bg-emerald-800 hover:text-white border border-emerald-700/50'
                  }`}
                  title={`Switch to ${acc.roleLabel}: ${acc.name}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300"></span>
                  {acc.role.toUpperCase()}
                  <span className="opacity-70 text-[10px] hidden sm:inline">({acc.name.split(' ')[0]})</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* KadPoly Crest & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center p-1 shadow-inner">
              <div className="w-full h-full rounded bg-emerald-600 flex items-center justify-center text-white font-black text-lg tracking-tighter">
                KP
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base sm:text-lg tracking-tight text-white leading-tight">
                  KADUNA POLYTECHNIC
                </h1>
                <span className="bg-emerald-500/30 text-emerald-300 text-[10px] px-1.5 py-0.5 rounded font-mono font-medium border border-emerald-400/20">
                  EST. 1956
                </span>
              </div>
              <p className="text-xs text-emerald-200/90 leading-tight">
                Cloud Attendance Management & Examination Clearance System
              </p>
            </div>
          </div>

          {/* Desktop User Section */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-emerald-900/60 hover:bg-emerald-900 border border-emerald-700/50 text-left transition"
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-700 border border-emerald-500/50 flex items-center justify-center text-emerald-100 font-semibold text-sm">
                    {user.full_name.charAt(0)}
                  </div>
                  <div className="leading-tight">
                    <div className="font-semibold text-sm text-white flex items-center gap-2">
                      {user.full_name}
                      {getRoleBadge(user.role)}
                    </div>
                    <div className="text-xs text-emerald-200/80">
                      {user.identifier || user.email}
                      {user.department_name && ` • ${user.department_name}`}
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-emerald-300 ml-1" />
                </button>

                {/* Dropdown Menu */}
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-white text-gray-800 rounded-lg shadow-xl border border-gray-200 py-2 z-50 animate-in fade-in slide-in-from-top-1">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Signed in as</p>
                      <p className="text-sm font-bold text-gray-900">{user.full_name}</p>
                      <p className="text-xs text-gray-600 truncate">{user.email}</p>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-medium">
                          ID: {user.identifier || 'Staff/Student'}
                        </span>
                        {user.level && (
                          <span className="text-[11px] bg-blue-50 text-blue-800 px-2 py-0.5 rounded font-medium">
                            {user.level}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="px-2 py-1">
                      <div className="text-[11px] text-gray-400 px-2 py-1 uppercase tracking-wider font-semibold">
                        Switch Test Role
                      </div>
                      {testAccounts.map((acc) => (
                        <button
                          key={acc.role}
                          onClick={() => handleQuickSwitch(acc.role)}
                          className={`w-full text-left px-3 py-1.5 rounded text-xs flex items-center justify-between ${
                            user.role === acc.role
                              ? 'bg-emerald-50 text-emerald-800 font-semibold'
                              : 'hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          <span>{acc.roleLabel}</span>
                          {user.role === acc.role && (
                            <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                          )}
                        </button>
                      ))}
                    </div>

                    <div className="border-t border-gray-100 mt-1 pt-1 px-2">
                      <button
                        onClick={() => logout()}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded transition"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out of System
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md text-emerald-200 hover:text-white hover:bg-emerald-800"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && user && (
        <div className="md:hidden bg-emerald-950 border-t border-emerald-800 px-4 py-4 space-y-3">
          <div className="pb-3 border-b border-emerald-800">
            <p className="text-sm font-bold text-white">{user.full_name}</p>
            <p className="text-xs text-emerald-300">{user.email}</p>
            <div className="mt-2 flex items-center gap-2">
              {getRoleBadge(user.role)}
              <span className="text-xs text-emerald-300 font-mono">{user.identifier}</span>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Switch Test Account</p>
            {testAccounts.map((acc) => (
              <button
                key={acc.role}
                onClick={() => handleQuickSwitch(acc.role)}
                className={`w-full text-left px-3 py-2 rounded text-xs flex items-center justify-between ${
                  user.role === acc.role
                    ? 'bg-emerald-800 text-white font-semibold'
                    : 'text-emerald-200 hover:bg-emerald-900'
                }`}
              >
                <span>{acc.roleLabel} ({acc.name})</span>
              </button>
            ))}
          </div>

          <div className="pt-2 border-t border-emerald-800">
            <button
              onClick={() => logout()}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-950/40 rounded"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
