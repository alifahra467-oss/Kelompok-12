import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import {
  ArrowRight,
  ExternalLink,
  ListChecks,
  Monitor,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { AdminLayout } from '../../layouts/AdminLayout';
import { useAuth } from '../../context/AuthContext';
import { EmptyState, LoadingState } from '../../components/StatusViews';
import { db, handleFirestoreError } from '../../lib/firebase';
import {
  createPretest,
  deletePretest,
  importUlumulQuranQuestionsToPretest,
} from '../../services/pretestService';
import { OperationType } from '../../types/arena';
import type { Pretest } from '../../types/pretest';

const PRETEST_STATUS_LABELS: Record<Pretest['status'], string> = {
  DRAFT: 'Draf',
  LOBBY: 'Lobi Terbuka',
  ACTIVE: 'Pre-Test Berlangsung',
  PAUSED: 'Dijeda',
  FINISHED: 'Selesai',
};

export const PretestsPage: React.FC = () => {
  const navigate = useNavigate();
  const [pretests, setPretests] = useState<Pretest[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [title, setTitle] = useState('Pre-Test Seleksi Tim Pekan Ini');
  const [meetingLabel, setMeetingLabel] = useState('Pertemuan Kelas');
  const [teamCount, setTeamCount] = useState(4);
  const [useWeightedPoints, setUseWeightedPoints] = useState(false);
  const [releaseAllQuestions, setReleaseAllQuestions] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { user, isLecturer, authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !user || !isLecturer) return;
    const unsub = onSnapshot(
      query(collection(db, 'pretests'), orderBy('createdAt', 'desc')),
      (snap) => {
        setPretests(snap.docs.map((d) => d.data() as Pretest));
        setLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'pretests');
        setLoading(false);
      }
    );
    return () => unsub();
  }, [authLoading, user, isLecturer]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setErrorMsg(null);
    try {
      const id = await createPretest({
        title: title.trim(),
        meetingLabel: meetingLabel.trim(),
        teamCount,
        useWeightedPoints,
        releaseAllQuestions,
      });
      navigate(`/admin/pretest/${id}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal membuat pre-test baru.');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateUlumulQuranPretest = async () => {
    setCreating(true);
    setErrorMsg(null);
    try {
      const id = await createPretest({
        title: 'Kuis Pilihan Ganda ‘Ulûmul Qur’ân (4 Bab · 15 Soal)',
        meetingLabel: 'Asbabun Nuzul · Turunnya · Pengumpulan · Tujuh Huruf',
        teamCount,
        useWeightedPoints: false,
        releaseAllQuestions: true,
      });
      await importUlumulQuranQuestionsToPretest(id, 1);
      navigate(`/admin/pretest/${id}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal membuat sesi Ulumul Qur’an.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    setErrorMsg(null);
    try {
      await deletePretest(id);
    } catch (err) {
      setErrorMsg(`Gagal menghapus "${name}": ${err instanceof Error ? err.message : ''}`);
    }
  };

  return (
    <AdminLayout
      title="Pre-Test &amp; Smart Team Spinner"
      subtitle="Buat pre-test diagnostik, pilih ketua otomatis, bentuk tim seimbang, dan tayangkan roda pemilih tim"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Buat Pre-Test */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6 h-fit">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-xl bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0E2142]">Buat Pre-Test Baru</h2>
              <p className="text-xs text-slate-500">Langkah awal sebelum kompetisi tim</p>
            </div>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#0E2142] mb-1">
                Judul Pre-Test
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={160}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0E2142] mb-1">
                Label Pertemuan
              </label>
              <input
                type="text"
                maxLength={120}
                value={meetingLabel}
                onChange={(e) => setMeetingLabel(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0E2142] mb-1">
                Target Jumlah Tim
              </label>
              <input
                type="number"
                min={2}
                max={12}
                value={teamCount}
                onChange={(e) => setTeamCount(Math.max(2, Math.min(12, Number(e.target.value) || 4)))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Otomatis menamai Kelompok A sampai Kelompok {String.fromCharCode(64 + teamCount)}
              </p>
            </div>

            <div className="space-y-2.5 pt-1">
              <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={releaseAllQuestions}
                  onChange={(e) => setReleaseAllQuestions(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-[#2563EB]"
                />
                <span>
                  <span className="font-bold text-[#0E2142] block">Rilis Semua Soal Sekaligus</span>
                  Mahasiswa mengerjakan seluruh soal pilihan ganda secara mandiri dengan batas waktu total.
                </span>
              </label>

              <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useWeightedPoints}
                  onChange={(e) => setUseWeightedPoints(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-[#2563EB]"
                />
                <span>
                  <span className="font-bold text-[#0E2142] block">Gunakan Bobot Nilai Per Soal</span>
                  Jika nonaktif, peringkat utama menggunakan total jawaban benar.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={creating}
              className="w-full py-3 px-4 rounded-xl bg-[#2563EB] text-white text-sm font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{creating ? 'Membuat Pre-Test...' : 'Buat &amp; Kelola Pre-Test'}</span>
            </button>

            <button
              type="button"
              disabled={creating}
              onClick={() => void handleCreateUlumulQuranPretest()}
              className="w-full py-2.5 px-4 rounded-xl bg-[#0E2142] text-[#F1C56C] text-xs font-bold hover:bg-[#16315E] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <ListChecks className="w-4 h-4" />
              <span>Buat Sesi PG ‘Ulûmul Qur’ân (15 Soal Siap Pakai)</span>
            </button>
          </form>
        </section>

        {/* Daftar Pre-Test */}
        <section className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-base font-bold text-[#0E2142] mb-4">Daftar Sesi Pre-Test</h2>

            {loading ? (
              <LoadingState label="Memuat daftar pre-test..." />
            ) : pretests.length === 0 ? (
              <EmptyState
                title="Belum Ada Sesi Pre-Test"
                description="Buat pre-test di panel sebelah kiri untuk menilai kemampuan awal mahasiswa dan membentuk tim seimbang dengan Smart Spinner."
              />
            ) : (
              <div className="space-y-3">
                {pretests.map((item) => (
                  <div
                    key={item.pretestId}
                    className="p-4 rounded-2xl border border-slate-200 hover:border-slate-300 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-bold text-[#2563EB]">
                          {PRETEST_STATUS_LABELS[item.status]}
                        </span>
                        <span>·</span>
                        <span className="font-mono font-bold text-[#0E2142] tabular-nums">
                          Kode: {item.joinCode}
                        </span>
                        <span>·</span>
                        <span className="tabular-nums">{item.teamCount} Tim</span>
                        {item.teamsLocked && (
                          <>
                            <span>·</span>
                            <span className="font-semibold text-emerald-700">Tim Terkunci</span>
                          </>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-[#0E2142] truncate">{item.title}</h3>
                      {item.meetingLabel && (
                        <p className="text-xs text-slate-500 truncate">{item.meetingLabel}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <Link
                        to={`/pretest/present/${item.pretestId}`}
                        target="_blank"
                        className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-[#0E2142] hover:bg-slate-50 flex items-center gap-1.5"
                      >
                        <Monitor className="w-3.5 h-3.5" />
                        <span>Proyektor</span>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </Link>

                      {item.linkedSessionId && (
                        <Link
                          to={`/admin/control/${item.linkedSessionId}`}
                          className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 flex items-center gap-1.5"
                        >
                          <span>Sesi Game</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      )}

                      <Link
                        to={`/admin/pretest/${item.pretestId}`}
                        className="px-3.5 py-2 rounded-xl bg-[#0E2142] text-white text-xs font-semibold hover:bg-[#16315E] flex items-center gap-1.5"
                      >
                        <span>Kelola</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>

                      <button
                        type="button"
                        onClick={() => void handleDelete(item.pretestId, item.title)}
                        className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-rose-700 hover:border-rose-200 transition-colors"
                        title="Hapus Pre-Test"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </AdminLayout>
  );
};
