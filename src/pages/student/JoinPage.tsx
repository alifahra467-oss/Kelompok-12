import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { ArrowRight, CheckCircle2, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { db, handleFirestoreError } from '../../lib/firebase';
import {
  findOpenSessionByJoinCode,
  joinSessionAsStudent,
  listOpenSessions,
  loadStudentIdentity,
  verifyStoredStudentIdentity,
} from '../../services/firestoreService';
import {
  findOpenPretestByJoinCode,
  joinPretestAsStudent,
  listOpenPretests,
  loadPretestStudentIdentity,
  verifyStoredPretestIdentity,
} from '../../services/pretestService';
import {
  formatStudentDisplayName,
  loadStudentProfile,
  saveStudentProfile,
} from '../../lib/studentProfile';
import { OperationType, type Session, type Team } from '../../types/arena';
import type { Pretest } from '../../types/pretest';

export const JoinPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const savedProfile = loadStudentProfile();
  const [joinCode, setJoinCode] = useState(searchParams.get('code') || '');
  const [session, setSession] = useState<Session | null>(null);
  const [pretest, setPretest] = useState<Pretest | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [displayName, setDisplayName] = useState(savedProfile?.fullName ?? '');
  const [studentNim, setStudentNim] = useState(savedProfile?.nim ?? '');

  const [openPretests, setOpenPretests] = useState<Pretest[]>([]);
  const [openSessions, setOpenSessions] = useState<Session[]>([]);
  const [discovering, setDiscovering] = useState(false);

  const [lookupLoading, setLookupLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectPretestRoom = async (target: Pretest) => {
    setErrorMsg(null);
    const existingPre = loadPretestStudentIdentity(target.pretestId);
    if (existingPre) {
      const validPre = await verifyStoredPretestIdentity(existingPre);
      if (validPre) {
        navigate(`/pretest/play/${target.pretestId}`);
        return;
      }
    }
    setSession(null);
    setPretest(target);
  };

  const selectSessionRoom = async (target: Session) => {
    setErrorMsg(null);
    if (target.isJoinLocked) {
      setErrorMsg('Pendaftaran peserta pada sesi ini sedang dikunci oleh admin.');
      return;
    }
    const existing = loadStudentIdentity(target.sessionId);
    if (existing) {
      const valid = await verifyStoredStudentIdentity(existing);
      if (valid) {
        navigate(`/play/${target.sessionId}`);
        return;
      }
    }
    setPretest(null);
    setSelectedTeamId('');
    setSession(target);
  };

  const discoverOpenRooms = async (autoSelectSingle: boolean) => {
    setDiscovering(true);
    try {
      const [pts, sess] = await Promise.all([listOpenPretests(), listOpenSessions()]);
      setOpenPretests(pts);
      setOpenSessions(sess);

      if (autoSelectSingle) {
        const total = pts.length + sess.length;
        if (total === 1) {
          if (pts.length === 1) {
            await selectPretestRoom(pts[0]);
          } else if (sess.length === 1) {
            await selectSessionRoom(sess[0]);
          }
        }
      }
    } catch {
      // Non-blocking: manual 6-digit code entry remains available
    } finally {
      setDiscovering(false);
    }
  };

  const handleLookupCode = async (codeOverride?: string) => {
    const code = (codeOverride ?? joinCode).replace(/\D/g, '').slice(0, 6);
    if (code.length !== 6) {
      setErrorMsg('Masukkan 6 digit kode sesi yang valid.');
      return;
    }
    setLookupLoading(true);
    setErrorMsg(null);
    try {
      const foundSession = await findOpenSessionByJoinCode(code);
      if (foundSession) {
        if (foundSession.isJoinLocked) {
          setErrorMsg('Pendaftaran peserta pada sesi ini sedang dikunci oleh admin.');
          setSession(null);
          setPretest(null);
          return;
        }
        await selectSessionRoom(foundSession);
        return;
      }

      const foundPretest = await findOpenPretestByJoinCode(code);
      if (foundPretest) {
        await selectPretestRoom(foundPretest);
        return;
      }

      setErrorMsg('Sesi tidak ditemukan atau sudah ditutup oleh admin.');
      setSession(null);
      setPretest(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memeriksa kode sesi.');
    } finally {
      setLookupLoading(false);
    }
  };

  useEffect(() => {
    const codeParam = searchParams.get('code');
    if (codeParam && /^\d{6}$/.test(codeParam)) {
      setJoinCode(codeParam);
      void handleLookupCode(codeParam);
    } else {
      void discoverOpenRooms(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (!session) return;
    const unsub = onSnapshot(
      query(collection(db, 'sessions', session.sessionId, 'teams'), orderBy('orderIndex', 'asc')),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Team);
        setTeams(list);
        if (list.length > 0 && !selectedTeamId) {
          setSelectedTeamId(list[0].teamId);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `sessions/${session.sessionId}/teams`)
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.sessionId]);

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formattedName = formatStudentDisplayName(displayName, studentNim);
    if (pretest) {
      if (displayName.trim().length < 2) return;
      saveStudentProfile({ fullName: displayName.trim(), nim: studentNim.trim() });
      setJoining(true);
      setErrorMsg(null);
      try {
        await joinPretestAsStudent({
          pretest,
          displayName: formattedName,
        });
        navigate(`/pretest/play/${pretest.pretestId}`);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Gagal bergabung ke sesi.');
      } finally {
        setJoining(false);
      }
      return;
    }

    if (!session || !selectedTeamId || displayName.trim().length < 2) return;
    saveStudentProfile({ fullName: displayName.trim(), nim: studentNim.trim() });
    setJoining(true);
    setErrorMsg(null);
    try {
      await joinSessionAsStudent({
        session,
        displayName: formattedName,
        teamId: selectedTeamId,
      });
      navigate(`/play/${session.sessionId}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal bergabung ke sesi.');
    } finally {
      setJoining(false);
    }
  };

  const totalOpenRooms = openPretests.length + openSessions.length;

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1E3A2F] flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-[#1B5E4B]/15 bg-white">
        <div className="max-w-6xl mx-auto px-5 sm:px-10 h-16 flex items-center justify-between gap-6">
          <Link to="/" className="flex items-center gap-3 min-w-0 whitespace-nowrap shrink-0">
            <img
              src="/src/assets/images/stiu_emblem_notext_1794928187045.jpg"
              alt="Logo STIU Darul Hikmah"
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-xl object-cover border border-[#1B5E4B]/20 bg-[#E2EFEA] shrink-0"
            />
            <span className="font-display text-base font-extrabold tracking-tight text-[#1B5E4B] truncate">
              STIU Darul Hikmah
            </span>
          </Link>

          <nav className="flex items-center gap-6 text-sm font-semibold">
            <Link
              to="/"
              className="text-slate-600 hover:text-[#1B5E4B] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Masuk Awal
            </Link>
            <Link
              to="/admin"
              className="bg-gradient-to-br from-[#2E7D67] to-[#1B5E4B] text-white px-4 py-2 rounded-full text-xs font-bold hover:brightness-105 transition-all whitespace-nowrap shrink-0"
            >
              Admin
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Responsive Split Workspace */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 items-stretch">
        {/* Left: Primary Direct Student Entry */}
        <section className="lg:col-span-7 flex items-center justify-center px-5 sm:px-10 lg:px-16 py-10 lg:py-16">
          <div className="max-w-lg w-full space-y-6">
            <div className="space-y-2">
              <p className="text-sm font-bold text-[#2E7D67]">Portal Mahasiswi · STIU Darul Hikmah</p>
              <h1
                className="font-display text-2xl sm:text-3xl font-extrabold text-[#1B5E4B] tracking-tight"
                style={{ textWrap: 'balance' }}
              >
                {pretest
                  ? pretest.title
                  : session
                  ? session.title
                  : 'Masuk Langsung ke Kuis Kelas'}
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                {pretest
                  ? 'Periksa Nama Lengkap dan NIM Anda untuk langsung mengerjakan soal pilihan ganda.'
                  : session
                  ? 'Periksa Nama Lengkap dan NIM Anda untuk langsung masuk ke sesi pilihan ganda dan bel rebutan.'
                  : 'Pilih kuis pilihan ganda atau ruang sesi kelas yang sedang dibuka Admin.'}
              </p>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800">
                {errorMsg}
              </div>
            )}

            {!session && !pretest ? (
              <div className="space-y-5">
                {/* Direct 15-Question Ulumul Qur'an MCQ Quiz */}
                <div className="bg-[#E2EFEA] text-[#1E3A2F] rounded-[28px] border-2 border-white p-6 space-y-3 shadow-[0_12px_28px_rgba(46,125,103,0.1)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-xs font-extrabold text-[#1B5E4B]">
                        Kuis Pilihan Ganda · 15 Pertanyaan
                      </div>
                      <h2 className="text-base font-extrabold leading-snug text-[#1E3A2F]">
                        ‘Ulûmul Qur’ân (4 Bab Kajian)
                      </h2>
                      <p className="text-xs text-[#1E3A2F]/80 leading-relaxed">
                        Bab Asbabun Nuzul, Turunnya Al-Qur’an, Pengumpulan &amp; Penyusunan Al-Qur’an, serta Tujuh Huruf. Kunci jawaban ditampilkan di akhir setelah ke-15 soal diselesaikan.
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/kuis-pg"
                    className="w-full min-h-[46px] px-4 py-3 rounded-[20px] bg-gradient-to-br from-[#DFBD69] to-[#C59B38] text-[#1E3A2F] text-xs font-extrabold hover:brightness-105 transition-all flex items-center justify-center gap-2 shadow-[0_6px_16px_rgba(197,155,56,0.28)]"
                  >
                    <span>Mulai Kuis 15 Soal Pilihan Ganda</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>

                {/* Active Open Rooms for 1-Click Direct Entry */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-bold text-[#0E2142]">
                      Ruang Kuis Terbuka Saat Ini ({totalOpenRooms})
                    </h2>
                    <button
                      type="button"
                      onClick={() => void discoverOpenRooms(false)}
                      disabled={discovering}
                      className="text-xs font-semibold text-[#2563EB] hover:underline flex items-center gap-1 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${discovering ? 'animate-spin' : ''}`} />
                      <span>Muat Ulang</span>
                    </button>
                  </div>

                  {discovering && totalOpenRooms === 0 ? (
                    <p className="text-xs text-slate-500 py-3">Mencari ruang kuis aktif...</p>
                  ) : totalOpenRooms === 0 ? (
                    <p className="text-xs text-slate-500 py-2">
                      Belum ada sesi terbuka otomatis. Tunggu Admin membuka sesi atau masukkan kode 6 digit di bawah.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {openPretests.map((item) => (
                        <button
                          key={item.pretestId}
                          type="button"
                          onClick={() => void selectPretestRoom(item)}
                          className="w-full p-4 rounded-lg border border-slate-200 hover:border-[#2563EB] hover:bg-blue-50/40 text-left flex items-center justify-between gap-3 transition-colors"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-[#2563EB]">
                              Pilihan Ganda · Kode {item.joinCode}
                            </div>
                            <div className="text-sm font-bold text-[#0E2142] truncate">
                              {item.title}
                            </div>
                          </div>
                          <span className="px-3.5 py-2 rounded-lg bg-[#2563EB] text-white text-xs font-bold whitespace-nowrap shrink-0 flex items-center gap-1">
                            <span>Langsung Masuk</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </span>
                        </button>
                      ))}

                      {openSessions.map((item) => (
                        <button
                          key={item.sessionId}
                          type="button"
                          onClick={() => void selectSessionRoom(item)}
                          className="w-full p-4 rounded-lg border border-slate-200 hover:border-[#2563EB] hover:bg-blue-50/40 text-left flex items-center justify-between gap-3 transition-colors"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-[#2563EB]">
                              Pilihan Ganda &amp; Bel Rebutan · Kode {item.joinCode}
                            </div>
                            <div className="text-sm font-bold text-[#0E2142] truncate">
                              {item.title}
                            </div>
                          </div>
                          <span className="px-3.5 py-2 rounded-lg bg-[#0E2142] text-white text-xs font-bold whitespace-nowrap shrink-0 flex items-center gap-1">
                            <span>Langsung Masuk</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Manual 6-digit fallback */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleLookupCode();
                  }}
                  className="bg-white rounded-xl border border-slate-200 p-5 space-y-4"
                >
                  <div>
                    <label
                      htmlFor="join-code-input"
                      className="block text-sm font-bold text-[#0E2142] mb-2"
                    >
                      Atau Masukkan Kode 6 Digit
                    </label>
                    <input
                      id="join-code-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      required
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="w-full min-h-[52px] text-center font-mono text-2xl font-extrabold tracking-[0.25em] py-3 px-4 rounded-lg border border-slate-300 text-[#0E2142] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent tabular-nums"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={lookupLoading || joinCode.length !== 6}
                    className="w-full min-h-[46px] py-2.5 px-5 rounded-lg bg-[#2563EB] text-white text-sm font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <span>{lookupLoading ? 'Memeriksa Kode...' : 'Buka Sesi dengan Kode'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              </div>
            ) : pretest ? (
              <form
                onSubmit={handleJoinSubmit}
                className="bg-white rounded-xl border border-slate-200 p-6 space-y-5"
              >
                <div className="flex items-center justify-between text-xs text-slate-500 border-b border-slate-100 pb-3">
                  <span>Kuis Pilihan Ganda</span>
                  <span className="font-mono font-bold text-[#0E2142] tabular-nums">
                    Kode {pretest.joinCode}
                  </span>
                </div>

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="pretest-student-name"
                      className="block text-sm font-bold text-[#1E3A2F] mb-1.5"
                    >
                      Nama Lengkap Mahasiswi
                    </label>
                    <input
                      id="pretest-student-name"
                      type="text"
                      required
                      minLength={2}
                      maxLength={60}
                      autoFocus
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Nama Lengkap"
                      className="w-full min-h-[48px] px-4 py-3 rounded-2xl border border-[#1B5E4B]/25 text-base text-[#1E3A2F] focus:outline-none focus:ring-2 focus:ring-[#2E7D67]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="pretest-student-nim"
                      className="block text-sm font-bold text-[#1E3A2F] mb-1.5"
                    >
                      NIM
                    </label>
                    <input
                      id="pretest-student-nim"
                      type="text"
                      inputMode="numeric"
                      maxLength={30}
                      value={studentNim}
                      onChange={(e) =>
                        setStudentNim(e.target.value.replace(/[^0-9A-Za-z.-]/g, '').slice(0, 30))
                      }
                      placeholder="NIM"
                      className="w-full min-h-[48px] px-4 py-3 rounded-2xl border border-[#1B5E4B]/25 text-base text-[#1E3A2F] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#2E7D67]"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPretest(null);
                      setErrorMsg(null);
                      void discoverOpenRooms(false);
                    }}
                    className="min-h-[48px] px-5 py-3 rounded-2xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    Pilih Sesi Lain
                  </button>
                  <button
                    type="submit"
                    disabled={joining || displayName.trim().length < 2}
                    className="flex-1 min-h-[48px] py-3 px-5 rounded-2xl bg-gradient-to-br from-[#2E7D67] to-[#1B5E4B] text-white text-sm font-bold hover:brightness-105 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Users className="w-4 h-4" />
                    <span>{joining ? 'Masuk...' : 'Langsung Masuk'}</span>
                  </button>
                </div>
              </form>
            ) : (
              <form
                onSubmit={handleJoinSubmit}
                className="bg-white rounded-2xl border border-[#1B5E4B]/15 p-6 space-y-5"
              >
                <div className="flex items-center justify-between text-xs text-slate-500 border-b border-slate-100 pb-3">
                  <span>Sesi Pilihan Ganda &amp; Bel Rebutan</span>
                  <span className="font-mono font-bold text-[#1B5E4B] tabular-nums">
                    Kode {session?.joinCode}
                  </span>
                </div>

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="session-student-name"
                      className="block text-sm font-bold text-[#1E3A2F] mb-1.5"
                    >
                      Nama Lengkap Mahasiswi
                    </label>
                    <input
                      id="session-student-name"
                      type="text"
                      required
                      minLength={2}
                      maxLength={60}
                      autoFocus
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Nama Lengkap"
                      className="w-full min-h-[48px] px-4 py-3 rounded-2xl border border-[#1B5E4B]/25 text-base text-[#1E3A2F] focus:outline-none focus:ring-2 focus:ring-[#2E7D67]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="session-student-nim"
                      className="block text-sm font-bold text-[#1E3A2F] mb-1.5"
                    >
                      NIM
                    </label>
                    <input
                      id="session-student-nim"
                      type="text"
                      inputMode="numeric"
                      maxLength={30}
                      value={studentNim}
                      onChange={(e) =>
                        setStudentNim(e.target.value.replace(/[^0-9A-Za-z.-]/g, '').slice(0, 30))
                      }
                      placeholder="NIM"
                      className="w-full min-h-[48px] px-4 py-3 rounded-2xl border border-[#1B5E4B]/25 text-base text-[#1E3A2F] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#2E7D67]"
                    />
                  </div>
                </div>

                {teams.length > 0 && (
                  <div>
                    <label className="block text-sm font-bold text-[#0E2142] mb-2">
                      Pilih Kelompok
                    </label>
                    <div className="grid grid-cols-1 gap-2.5">
                      {teams.map((team) => {
                        const selected = selectedTeamId === team.teamId;
                        return (
                          <button
                            key={team.teamId}
                            type="button"
                            onClick={() => setSelectedTeamId(team.teamId)}
                            className={`min-h-[48px] p-3.5 rounded-lg border text-left flex items-center justify-between transition-colors ${
                              selected
                                ? 'bg-[#0E2142] text-white border-[#0E2142]'
                                : 'bg-white text-[#0E2142] border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className="w-3.5 h-3.5 rounded-full shrink-0"
                                style={{ backgroundColor: team.color }}
                              />
                              <span className="font-bold text-sm">{team.name}</span>
                            </div>
                            {selected && <CheckCircle2 className="w-5 h-5 text-[#F1C56C]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSession(null);
                      setErrorMsg(null);
                      void discoverOpenRooms(false);
                    }}
                    className="min-h-[48px] px-5 py-3 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    Pilih Sesi Lain
                  </button>
                  <button
                    type="submit"
                    disabled={joining || !selectedTeamId || displayName.trim().length < 2}
                    className="flex-1 min-h-[48px] py-3 px-5 rounded-lg bg-[#2563EB] text-white text-sm font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Users className="w-4 h-4" />
                    <span>{joining ? 'Masuk...' : 'Langsung Masuk'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>

        {/* Right: Structured Classroom Guidance Column */}
        <aside className="hidden lg:flex lg:col-span-5 bg-gradient-to-br from-[#2E7D67] to-[#1B5E4B] text-white flex-col justify-between p-12 border-l border-[#1B5E4B]">
          <div className="space-y-6">
            <p className="text-sm font-semibold text-[#DFBD69]">Panduan Singkat Mahasiswi</p>
            <h2 className="font-display text-2xl font-bold leading-snug" style={{ textWrap: 'balance' }}>
              STIU Darul Hikmah
            </h2>
            <ol className="divide-y divide-white/15 border-t border-b border-white/15 text-sm">
              <li className="py-4 space-y-1">
                <div className="font-semibold text-white">01. Nama Lengkap &amp; NIM</div>
                <p className="text-xs text-white/80">
                  Isi Nama Lengkap dan NIM lalu pilih kuis pilihan ganda atau ruang sesi kelas.
                </p>
              </li>
              <li className="py-4 space-y-1">
                <div className="font-semibold text-white">02. Jawab Pilihan Ganda</div>
                <p className="text-xs text-white/80">
                  Ketuk pilihan jawaban A, B, C, atau D. Kunci jawaban dibuka di akhir setelah semua soal selesai.
                </p>
              </li>
              <li className="py-4 space-y-1">
                <div className="font-semibold text-white">03. Gunakan Bel Rebutan</div>
                <p className="text-xs text-white/80">
                  Pada babak Cerdas Cermat, tekan tombol Bel Rebutan saat dibuka oleh Admin.
                </p>
              </li>
            </ol>
          </div>

          <div className="flex items-center gap-2 text-xs text-white/85">
            <ShieldCheck className="w-4 h-4 text-[#DFBD69] shrink-0" />
            <span>Identitas perangkat tersimpan otomatis untuk pemulihan koneksi.</span>
          </div>
        </aside>
      </main>
    </div>
  );
};
