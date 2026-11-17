import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listOpenSessions } from '../services/firestoreService';
import { listOpenPretests } from '../services/pretestService';
import { loadStudentProfile, saveStudentProfile } from '../lib/studentProfile';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const existing = loadStudentProfile();

  const [fullName, setFullName] = useState(existing?.fullName ?? '');
  const [nim, setNim] = useState(existing?.nim ?? '');
  const [entering, setEntering] = useState(false);
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
      setErrorMsg('Masukkan NIM yang valid.');
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

      if (openPretests.length > 0 || openSessions.length > 0) {
        navigate('/join');
      } else {
        navigate('/kuis-pg');
      }
    } finally {
      setEntering(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1E3A2F] flex flex-col items-center justify-center relative p-5">
      {/* Tombol Admin di Pojok Kanan Atas */}
      <Link
        to="/admin"
        className="absolute top-6 right-6 bg-gradient-to-br from-[#2E7D67] to-[#1B5E4B] text-white font-bold text-sm px-6 py-2.5 rounded-full shadow-[0_6px_15px_rgba(27,94,75,0.25)] border border-white/30 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(27,94,75,0.35)] transition-all whitespace-nowrap shrink-0"
      >
        Admin
      </Link>

      {/* Kartu Utama */}
      <main className="w-full max-w-[400px] min-h-[460px] bg-[#E2EFEA] rounded-[32px] px-7 pt-10 pb-14 flex flex-col justify-center items-center relative overflow-hidden shadow-[0_15px_35px_rgba(46,125,103,0.12)] border-2 border-white">
        {/* Watermark Logo STIU Darul Hikmah di Latar Belakang Kartu */}
        <div
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1]"
        >
          <img
            src="/src/assets/images/stiu_emblem_notext_1794928187045.jpg"
            alt=""
            referrerPolicy="no-referrer"
            className="w-[88%] h-[88%] object-contain opacity-[0.22] mix-blend-multiply select-none"
          />
        </div>

        {/* Form Login Mahasiswi */}
        <form onSubmit={handleEnterApp} className="w-full flex flex-col gap-5 relative z-[2]">
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
              className="w-full px-[26px] py-[18px] rounded-[24px] border-0 bg-gradient-to-br from-[#2E7D67] to-[#1B5E4B] text-white placeholder:text-white/75 text-lg font-bold shadow-[0_8px_18px_rgba(27,94,75,0.25)] outline-none focus:-translate-y-0.5 focus:ring-2 focus:ring-[#D4AF37] focus:shadow-[0_10px_22px_rgba(27,94,75,0.38)] transition-all"
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
              className="w-full px-[26px] py-[18px] rounded-[24px] border-0 bg-gradient-to-br from-[#2E7D67] to-[#1B5E4B] text-white placeholder:text-white/75 text-lg font-bold tabular-nums shadow-[0_8px_18px_rgba(27,94,75,0.25)] outline-none focus:-translate-y-0.5 focus:ring-2 focus:ring-[#D4AF37] focus:shadow-[0_10px_22px_rgba(27,94,75,0.38)] transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={entering}
            className="mt-2 w-full px-[26px] py-4 rounded-[24px] border-0 bg-gradient-to-br from-[#DFBD69] to-[#C59B38] text-[#1E3A2F] text-[17px] font-extrabold tracking-[0.5px] cursor-pointer shadow-[0_8px_18px_rgba(197,155,56,0.3)] hover:-translate-y-0.5 hover:brightness-[1.04] hover:shadow-[0_10px_22px_rgba(197,155,56,0.4)] active:translate-y-0 transition-all disabled:opacity-60"
          >
            {entering ? 'Memasuki Aplikasi...' : 'Masuk'}
          </button>
        </form>

        <div className="absolute bottom-[18px] z-[2] text-[13px] font-extrabold tracking-[1.2px] text-[#1B5E4B] uppercase opacity-85">
          STIU Darul Hikmah
        </div>
      </main>

      <div className="mt-5 flex items-center gap-4 text-xs font-semibold text-[#1B5E4B]/80">
        <Link to="/join" className="hover:text-[#1B5E4B] hover:underline underline-offset-4">
          Masuk dengan Kode Sesi / Bel Rebutan
        </Link>
      </div>
    </div>
  );
};
