import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listOpenSessions } from '../services/firestoreService';
import { listOpenPretests } from '../services/pretestService';
import {
  loadStudentProfile,
  recordStudentCheckin,
  saveStudentProfile,
} from '../lib/studentProfile';

const STIU_LOGO_SRC =
  '/assets/aistudio/6d10c951-fc5f-4e1d-b919-a6f0372576d5_removalai_preview__1__22e3f2ea.png';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const existing = loadStudentProfile();

  const [fullName, setFullName] = useState(existing?.fullName ?? '');
  const [nim, setNim] = useState(existing?.nim ?? '');
  const [entering, setEntering] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleEnterApp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = fullName.trim();
    const cleanNim = nim.replace(/\s+/g, '').trim();

    if (cleanName.length < 2) {
      setErrorMsg('Masukkan nama lengkap Anda (minimal 2 karakter).');
      return;
    }
    if (cleanNim.length < 3) {
      setErrorMsg('Masukkan NIM yang valid (minimal 3 karakter).');
      return;
    }

    setErrorMsg(null);
    setEntering(true);
    saveStudentProfile({ fullName: cleanName, nim: cleanNim });

    try {
      const [openPretests, openSessions] = await Promise.all([
        listOpenPretests().catch(() => []),
        listOpenSessions().catch(() => []),
      ]);

      const hasLiveRoom = openPretests.length > 0 || openSessions.length > 0;
      const targetMode = hasLiveRoom ? 'SESI_KELAS' : 'KUIS_PG';

      await recordStudentCheckin({
        fullName: cleanName,
        nim: cleanNim,
        targetMode,
      });

      navigate(hasLiveRoom ? '/join' : '/kuis-pg');
    } finally {
      setEntering(false);
    }
  };

  return (
    <div
      className="min-h-[100dvh] text-[#0B2A4A] flex flex-col items-center justify-center relative px-4 pt-20 pb-8 sm:px-6 sm:pt-24 sm:pb-12 lg:px-10 overflow-x-hidden"
      style={{
        background:
          'radial-gradient(circle at 12% 18%, rgba(110, 231, 183, 0.55) 0%, transparent 45%), radial-gradient(circle at 88% 16%, rgba(125, 211, 252, 0.55) 0%, transparent 48%), radial-gradient(circle at 82% 86%, rgba(253, 224, 71, 0.35) 0%, transparent 44%), radial-gradient(circle at 18% 85%, rgba(196, 181, 253, 0.42) 0%, transparent 46%), linear-gradient(135deg, #E0F9F1 0%, #E6F0FF 52%, #FFF3E2 100%)',
      }}
    >
      {/* Tekstur titik halus khas editorial kampus */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(rgba(11, 42, 74, 0.06) 1px, transparent 1px)',
          backgroundSize: '26px 26px',
        }}
      />

      {/* Tombol Admin di Pojok Kanan Atas — responsif HP, iPad, & Laptop */}
      <Link
        to="/admin"
        className="absolute top-4 right-4 sm:top-6 sm:right-6 lg:top-7 lg:right-8 z-20 min-h-[44px] flex items-center justify-center bg-gradient-to-br from-[#0B2A4A] to-[#1B5E4B] text-white font-bold text-xs sm:text-sm px-5 sm:px-6 py-2.5 rounded-full shadow-[0_8px_20px_rgba(11,42,74,0.2)] border border-white/50 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(11,42,74,0.28)] transition-all whitespace-nowrap shrink-0"
      >
        Admin
      </Link>

      {/* Kartu Utama — menyesuaikan proporsi HP, iPad (tablet), dan Laptop */}
      <main className="w-full max-w-[380px] sm:max-w-[440px] md:max-w-[470px] lg:max-w-[490px] min-h-[440px] sm:min-h-[500px] lg:min-h-[530px] bg-white/60 backdrop-blur-2xl rounded-[28px] sm:rounded-[34px] px-5 pt-10 pb-14 sm:px-8 sm:pt-12 sm:pb-16 lg:px-10 lg:pt-14 lg:pb-16 flex flex-col justify-center items-center relative overflow-hidden z-[2] shadow-[0_24px_60px_rgba(11,42,74,0.12)] border-2 border-white">
        {/* Watermark Logo STIU Darul Hikmah memenuhi kotak background masuk */}
        <div
          aria-hidden="true"
          className="absolute inset-2 sm:inset-3 flex items-center justify-center pointer-events-none z-[1]"
        >
          {!logoError ? (
            <img
              src={STIU_LOGO_SRC}
              alt=""
              referrerPolicy="no-referrer"
              onError={() => setLogoError(true)}
              className="w-full h-full object-contain opacity-[0.4] mix-blend-multiply select-none"
            />
          ) : null}
        </div>

        {/* Form Login Mahasiswi */}
        <form
          onSubmit={handleEnterApp}
          className="w-full flex flex-col gap-4 sm:gap-5 relative z-[2]"
        >
          {errorMsg && (
            <div className="px-4 py-2.5 rounded-2xl bg-rose-50/95 border border-rose-200 text-xs font-semibold text-rose-800 text-center">
              {errorMsg}
            </div>
          )}

          <div className="w-full">
            <input
              type="text"
              name="nama_lengkap"
              aria-label="Nama Lengkap"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nama Lengkap"
              required
              minLength={2}
              maxLength={60}
              autoComplete="name"
              className="w-full min-h-[54px] px-5 py-3.5 sm:px-6 sm:py-[17px] rounded-[20px] sm:rounded-[22px] border border-white/30 bg-gradient-to-br from-[#0B2A4A]/95 via-[#0F4C5C]/95 to-[#1B5E4B]/95 text-white placeholder:text-white/80 text-base sm:text-[17px] font-bold shadow-[0_10px_22px_rgba(11,42,74,0.18)] outline-none focus:-translate-y-0.5 focus:ring-2 focus:ring-[#38BDF8] focus:shadow-[0_12px_26px_rgba(11,42,74,0.26)] transition-all"
            />
          </div>

          <div className="w-full">
            <input
              type="text"
              name="nim"
              aria-label="NIM"
              value={nim}
              onChange={(e) => setNim(e.target.value.replace(/[^0-9A-Za-z.-]/g, '').slice(0, 30))}
              placeholder="NIM"
              required
              minLength={3}
              maxLength={30}
              inputMode="numeric"
              className="w-full min-h-[54px] px-5 py-3.5 sm:px-6 sm:py-[17px] rounded-[20px] sm:rounded-[22px] border border-white/30 bg-gradient-to-br from-[#0B2A4A]/95 via-[#0F4C5C]/95 to-[#1B5E4B]/95 text-white placeholder:text-white/80 text-base sm:text-[17px] font-bold tabular-nums shadow-[0_10px_22px_rgba(11,42,74,0.18)] outline-none focus:-translate-y-0.5 focus:ring-2 focus:ring-[#38BDF8] focus:shadow-[0_12px_26px_rgba(11,42,74,0.26)] transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={entering}
            className="mt-1 sm:mt-2 w-full min-h-[52px] px-6 py-3.5 sm:py-4 rounded-[20px] sm:rounded-[22px] border border-amber-200/80 bg-gradient-to-br from-[#FDE047] via-[#FACC15] to-[#EAB308] text-[#0B2A4A] text-base sm:text-[17px] font-extrabold tracking-[0.4px] cursor-pointer shadow-[0_10px_24px_rgba(234,179,8,0.28)] hover:-translate-y-0.5 hover:brightness-[1.03] hover:shadow-[0_14px_28px_rgba(234,179,8,0.38)] active:translate-y-0 transition-all disabled:opacity-60"
          >
            {entering ? 'Memasuki Aplikasi...' : 'Masuk'}
          </button>
        </form>
      </main>
    </div>
  );
};
