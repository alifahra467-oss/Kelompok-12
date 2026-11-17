import React, { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  FileQuestion,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  PlayCircle,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { LoadingState } from '../components/StatusViews';

const NAV_ITEMS = [
  { to: '/admin', label: 'Pembelajaran & Ringkasan', icon: LayoutDashboard, end: true },
  { to: '/admin/questions', label: 'Bank Soal & Kunci', icon: FileQuestion, end: false },
  { to: '/admin/pretest', label: 'Nilai PG & Spinner', icon: ListChecks, end: false },
  { to: '/admin/teams', label: 'Tim & Mahasiswa', icon: Users, end: false },
  { to: '/admin/sessions', label: 'Sesi Cerdas Cermat', icon: PlayCircle, end: false },
];

export const RequireAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    user,
    isLecturer,
    isAdminPasswordUnlocked,
    authLoading,
    authError,
    loginWithGoogle,
    verifyAdminPassword,
    logout,
  } = useAuth();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FAFBFD] flex items-center justify-center">
        <LoadingState label="Memeriksa sesi admin..." />
      </div>
    );
  }

  if (!user || !isAdminPasswordUnlocked) {
    const handleAdminSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLocalError(null);
      if (!password.trim()) {
        setLocalError('Masukkan kata sandi admin terlebih dahulu.');
        return;
      }
      setSubmitting(true);
      try {
        const ok = await verifyAdminPassword(password);
        if (!ok) {
          return;
        }
        if (!user) {
          await loginWithGoogle();
        }
      } finally {
        setSubmitting(false);
      }
    };

    const displayedError = localError || authError;

    return (
      <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-[#FAF8F5] text-[#1E3A2F]">
        {/* Left Emerald Column */}
        <aside className="lg:col-span-5 bg-gradient-to-br from-[#2E7D67] to-[#1B5E4B] text-white p-8 sm:p-12 lg:p-14 flex flex-col justify-between">
          <div className="space-y-8">
            <Link to="/" className="inline-flex items-center gap-3 whitespace-nowrap shrink-0">
              <img
                src="/assets/aistudio/6d10c951-fc5f-4e1d-b919-a6f0372576d5_removalai_preview__1__22e3f2ea.png"
                alt="Logo STIU Darul Hikmah"
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded-xl object-contain bg-white p-1 border border-white/40 shrink-0"
              />
              <span className="font-display text-lg font-extrabold tracking-tight">
                STIU Darul Hikmah
              </span>
            </Link>

            <div className="space-y-3 pt-4">
              <p className="text-sm font-semibold text-[#DFBD69]">
                Gerbang Administrasi
              </p>
              <h1 className="font-display text-3xl font-extrabold leading-tight" style={{ textWrap: 'balance' }}>
                Kendali Sesi, Bank Soal &amp; Tim Kelas.
              </h1>
              <p className="text-sm text-white/85 leading-relaxed max-w-md">
                Masuk dengan kata sandi admin dan akun Google yang terdaftar untuk mengelola soal pilihan ganda, Smart Team Spinner, dan jalannya sesi.
              </p>
            </div>
          </div>

          <div className="pt-10 border-t border-white/15 flex items-center justify-between text-xs text-white/80">
            <Link to="/kuis-pg" className="hover:text-white hover:underline underline-offset-4">
              Kuis Pilihan Ganda
            </Link>
            <Link to="/" className="hover:text-white hover:underline underline-offset-4">
              Kembali ke Halaman Masuk
            </Link>
          </div>
        </aside>

        {/* Right Clean Ivory Auth Workspace */}
        <main className="lg:col-span-7 flex items-center justify-center p-6 sm:p-12 lg:p-16 bg-[#FAF8F5]">
          <div className="max-w-md w-full bg-[#E2EFEA] rounded-[32px] border-2 border-white shadow-[0_15px_35px_rgba(46,125,103,0.12)] p-8 space-y-6">
            <div className="space-y-1.5">
              <h2 className="font-display text-2xl font-extrabold text-[#1B5E4B]">
                Masuk sebagai Admin
              </h2>
              <p className="text-sm text-[#1E3A2F]/80">
                {user
                  ? 'Masukkan kata sandi admin untuk membuka konsol pada sesi peramban ini.'
                  : 'Masukkan kata sandi admin lalu lanjutkan dengan akun Google Admin.'}
              </p>
            </div>

            {user && (
              <div className="p-4 rounded-2xl bg-white border border-[#1B5E4B]/15 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-slate-500">Akun Google aktif</div>
                  <div className="text-sm font-semibold text-[#1E3A2F] truncate">{user.email}</div>
                </div>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="text-xs font-semibold text-slate-600 hover:text-rose-700 hover:underline shrink-0"
                >
                  Ganti Akun
                </button>
              </div>
            )}

            {displayedError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800">
                {displayedError}
              </div>
            )}

            <form onSubmit={handleAdminSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="admin-password"
                  className="block text-sm font-bold text-[#1E3A2F] mb-1.5"
                >
                  Kata Sandi Admin
                </label>
                <div className="relative">
                  <input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi admin"
                    className="w-full min-h-[48px] pl-4 pr-11 py-3 rounded-[20px] border border-[#1B5E4B]/20 bg-white text-sm text-[#1E3A2F] focus:outline-none focus:ring-2 focus:ring-[#2E7D67]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-[#1B5E4B]"
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[48px] py-3.5 px-5 rounded-[24px] bg-gradient-to-br from-[#DFBD69] to-[#C59B38] text-[#1E3A2F] text-sm font-extrabold shadow-[0_8px_18px_rgba(197,155,56,0.28)] hover:brightness-105 transition-all disabled:opacity-50"
              >
                {submitting
                  ? 'Memverifikasi...'
                  : user
                  ? 'Buka Konsol Admin'
                  : 'Verifikasi Sandi & Masuk Google'}
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  if (!isLecturer) {
    return (
      <div className="min-h-screen bg-[#FAFBFD] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-xl border border-slate-200 p-8 space-y-5">
          <div className="flex items-center gap-3 text-rose-700">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <h2 className="text-lg font-bold">Akses Admin Ditolak</h2>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Akun Google <span className="font-semibold text-[#0E2142]">{user.email}</span> belum terdaftar sebagai admin yang disetujui untuk mengelola sistem ini.
          </p>
          <p className="text-xs text-slate-500">
            Silakan masuk menggunakan akun admin utama atau minta admin utama menambahkan email Anda pada menu Pengaturan Admin.
          </p>
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => void logout()}
              className="flex-1 py-2.5 px-4 rounded-lg bg-[#0E2142] text-white text-sm font-semibold hover:bg-[#16315E] transition-colors"
            >
              Keluar &amp; Ganti Akun
            </button>
            <Link
              to="/join"
              className="py-2.5 px-4 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              Portal Mahasiswa
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export const AdminLayout: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({
  title,
  subtitle,
  children,
}) => {
  const { user, isLecturer, isAdminPasswordUnlocked, authLoading, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  if (authLoading || !user || !isLecturer || !isAdminPasswordUnlocked) {
    return <RequireAdmin>{children}</RequireAdmin>;
  }

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-[#0E2142] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-[#0E2142] text-white border-r border-slate-800">
        <div className="h-16 px-5 flex items-center gap-3 border-b border-white/10">
          <img
            src="/src/assets/images/course_emblem_sirah_1794722950872.jpg"
            alt="Arena Kelas"
            className="w-8 h-8 rounded-lg object-cover border border-white/20"
          />
          <span className="font-display font-bold tracking-tight text-base whitespace-nowrap">
            ARENA KELAS 2.0
          </span>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-[#2563EB] text-white'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="text-xs text-slate-300 truncate">
            <div className="font-semibold text-white truncate">{user.displayName || 'Admin'}</div>
            <div className="text-slate-400 truncate">{user.email}</div>
          </div>
          <button
            onClick={() => void logout()}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-white/15 text-xs font-semibold text-slate-200 hover:bg-white/10 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Keluar
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-full bg-[#0E2142] text-white flex flex-col h-full z-10">
            <div className="h-16 px-5 flex items-center justify-between border-b border-white/10">
              <span className="font-display font-bold text-base">ARENA KELAS 2.0</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg text-slate-300 hover:bg-white/10"
                aria-label="Tutup menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-4 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium ${
                        isActive ? 'bg-[#2563EB] text-white' : 'text-slate-300 hover:bg-white/10'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
            <div className="p-4 border-t border-white/10">
              <button
                onClick={() => void logout()}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-white/15 text-xs font-semibold text-slate-200"
              >
                <LogOut className="w-3.5 h-3.5" />
                Keluar ({user.email})
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-6 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Buka menu navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-[#0E2142] truncate">{title}</h1>
              {subtitle && <p className="text-xs text-slate-500 truncate hidden sm:block">{subtitle}</p>}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {location.pathname !== '/admin/sessions' && (
              <Link
                to="/admin/sessions"
                className="px-4 py-2 rounded-xl bg-[#2563EB] text-white text-xs sm:text-sm font-semibold hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
              >
                Kelola Sesi Langsung
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
};
