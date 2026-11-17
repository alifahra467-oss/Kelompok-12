import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { RefreshCw, Search, Trash2, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError } from '../lib/firebase';
import {
  deleteStudentCheckin,
  type StudentCheckinRecord,
  type StudentTargetMode,
} from '../lib/studentProfile';
import { OperationType } from '../types/arena';

interface ServerCheckinItem {
  checkinId: string;
  fullName: string;
  nim: string;
  targetMode: StudentTargetMode;
  checkedInAtMs: number;
}

export interface QuizAttemptSummary {
  attemptId: string;
  studentName: string;
  studentNim?: string;
  totalCorrect: number;
  totalQuestions: number;
  percentage: number;
  submittedAtMs: number;
}

interface AdminStudentCheckinsPanelProps {
  quizAttempts?: QuizAttemptSummary[];
  compact?: boolean;
}

export const AdminStudentCheckinsPanel: React.FC<AdminStudentCheckinsPanelProps> = ({
  quizAttempts = [],
  compact = false,
}) => {
  const { user, isLecturer, authLoading } = useAuth();
  const [firestoreCheckins, setFirestoreCheckins] = useState<StudentCheckinRecord[]>([]);
  const [serverCheckins, setServerCheckins] = useState<StudentCheckinRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchServerCheckins = useCallback(async () => {
    const token = sessionStorage.getItem('arena_admin_unlock_token');
    if (!token) return;
    setRefreshing(true);
    try {
      const res = await fetch('/api/admin/student-checkins', {
        headers: { 'x-admin-unlock-token': token },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { checkins?: ServerCheckinItem[] };
      setServerCheckins(
        (data.checkins ?? []).map((item) => ({
          checkinId: item.checkinId,
          fullName: item.fullName,
          nim: item.nim,
          targetMode: item.targetMode === 'SESI_KELAS' ? 'SESI_KELAS' : 'KUIS_PG',
          checkedInAtMs: item.checkedInAtMs || Date.now(),
          source: 'server',
        }))
      );
    } catch {
      // Non-blocking fallback
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user || !isLecturer) return;

    void fetchServerCheckins();

    const unsub = onSnapshot(
      query(collection(db, 'student_checkins'), orderBy('checkedInAt', 'desc')),
      (snap) => {
        const list: StudentCheckinRecord[] = snap.docs.map((d) => {
          const data = d.data() as {
            checkinId?: string;
            fullName?: string;
            nim?: string;
            targetMode?: StudentTargetMode;
            checkedInAt?: { toMillis?: () => number } | null;
          };
          return {
            checkinId: data.checkinId || d.id,
            fullName: data.fullName || '-',
            nim: data.nim || '-',
            targetMode: data.targetMode === 'SESI_KELAS' ? 'SESI_KELAS' : 'KUIS_PG',
            checkedInAtMs: data.checkedInAt?.toMillis ? data.checkedInAt.toMillis() : Date.now(),
            source: 'firestore',
          };
        });
        setFirestoreCheckins(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'student_checkins')
    );

    return () => unsub();
  }, [authLoading, user, isLecturer, fetchServerCheckins]);

  const mergedCheckins = useMemo(() => {
    const byId = new Map<string, StudentCheckinRecord>();
    for (const item of serverCheckins) {
      byId.set(item.checkinId, item);
    }
    for (const item of firestoreCheckins) {
      const existing = byId.get(item.checkinId);
      if (existing) {
        byId.set(item.checkinId, {
          ...item,
          source: 'both',
          checkedInAtMs: item.checkedInAtMs || existing.checkedInAtMs,
        });
      } else {
        byId.set(item.checkinId, item);
      }
    }
    return Array.from(byId.values()).sort((a, b) => b.checkedInAtMs - a.checkedInAtMs);
  }, [firestoreCheckins, serverCheckins]);

  const uniqueStudentsCount = useMemo(() => {
    const set = new Set<string>();
    for (const c of mergedCheckins) {
      set.add(`${c.nim.toLowerCase()}::${c.fullName.toLowerCase()}`);
    }
    return set.size;
  }, [mergedCheckins]);

  const filteredCheckins = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return mergedCheckins;
    return mergedCheckins.filter(
      (item) =>
        item.fullName.toLowerCase().includes(q) ||
        item.nim.toLowerCase().includes(q)
    );
  }, [mergedCheckins, searchQuery]);

  const findAttemptForStudent = (fullName: string, nim: string): QuizAttemptSummary | undefined => {
    const cleanNim = nim.trim().toLowerCase();
    const cleanName = fullName.trim().toLowerCase();
    return quizAttempts.find((a) => {
      if (cleanNim && a.studentNim && a.studentNim.trim().toLowerCase() === cleanNim) {
        return true;
      }
      return a.studentName.trim().toLowerCase() === cleanName;
    });
  };

  const handleDelete = async (checkinId: string) => {
    setServerCheckins((prev) => prev.filter((item) => item.checkinId !== checkinId));
    setFirestoreCheckins((prev) => prev.filter((item) => item.checkinId !== checkinId));
    await deleteStudentCheckin(checkinId);
  };

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-base font-bold text-[#0E2142] flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-[#2563EB]" />
            <span>Daftar Mahasiswi yang Masuk (Nama &amp; NIM)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Catatan nama lengkap dan NIM mahasiswi yang masuk ke aplikasi — hanya dapat dilihat oleh Admin
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="text-xs font-semibold text-slate-600 tabular-nums">
            <span className="font-bold text-[#0E2142]">{uniqueStudentsCount}</span> Mahasiswi
            <span className="mx-1.5 text-slate-300">·</span>
            <span className="font-bold text-[#2563EB]">{mergedCheckins.length}</span> Riwayat Masuk
          </div>
          <button
            type="button"
            onClick={() => void fetchServerCheckins()}
            disabled={refreshing}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari nama mahasiswi atau NIM..."
          className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
        />
      </div>

      {filteredCheckins.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          {mergedCheckins.length === 0
            ? 'Belum ada mahasiswi yang masuk melalui halaman awal.'
            : 'Tidak ada data nama atau NIM yang sesuai dengan pencarian.'}
        </div>
      ) : (
        <div className={`overflow-x-auto ${compact ? 'max-h-64' : 'max-h-80'}`}>
          <table className="w-full text-xs">
            <thead className="text-left text-slate-500 border-b border-slate-200 sticky top-0 bg-white">
              <tr>
                <th className="py-2.5 pr-3 w-10">No</th>
                <th className="py-2.5 pr-3">Nama Lengkap</th>
                <th className="py-2.5 pr-3">NIM</th>
                <th className="py-2.5 pr-3">Tujuan Masuk</th>
                {!compact && <th className="py-2.5 pr-3">Status Kuis PG</th>}
                <th className="py-2.5 pr-3 text-right">Waktu Masuk</th>
                <th className="py-2.5 text-right w-12">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCheckins.map((item, idx) => {
                const attempt = findAttemptForStudent(item.fullName, item.nim);
                return (
                  <tr key={item.checkinId} className="hover:bg-slate-50/70">
                    <td className="py-2.5 pr-3 font-mono text-slate-500 tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 pr-3 font-semibold text-[#0E2142]">
                      {item.fullName}
                    </td>
                    <td className="py-2.5 pr-3 font-mono font-semibold text-slate-700 tabular-nums">
                      {item.nim}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-600">
                      {item.targetMode === 'SESI_KELAS' ? 'Sesi Kelas / Bel' : 'Kuis Pilihan Ganda'}
                    </td>
                    {!compact && (
                      <td className="py-2.5 pr-3 tabular-nums">
                        {attempt ? (
                          <span className="font-semibold text-emerald-700">
                            Selesai ({attempt.percentage}% · {attempt.totalCorrect}/{attempt.totalQuestions})
                          </span>
                        ) : (
                          <span className="text-slate-400">Belum selesai</span>
                        )}
                      </td>
                    )}
                    <td className="py-2.5 pr-3 text-right text-slate-500 tabular-nums whitespace-nowrap">
                      {new Date(item.checkedInAtMs).toLocaleString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => void handleDelete(item.checkinId)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Hapus catatan masuk"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
