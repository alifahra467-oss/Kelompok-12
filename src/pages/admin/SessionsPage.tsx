import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import {
  AlertCircle,
  BarChart3,
  ExternalLink,
  Monitor,
  Play,
  Plus,
  Trash2,
} from 'lucide-react';
import { AdminLayout } from '../../layouts/AdminLayout';
import { useAuth } from '../../context/AuthContext';
import { EmptyState, LoadingState } from '../../components/StatusViews';
import { db, handleFirestoreError } from '../../lib/firebase';
import { createSession, deleteSession } from '../../services/firestoreService';
import {
  DEFAULT_SCORING_CONFIG,
  OperationType,
  type BoardConfig,
  type BoardTile,
  type GameMode,
  type QuestionPrivate,
  type ScoringConfig,
  type Session,
  type SubmissionMode,
} from '../../types/arena';

const MODE_NAMES: Record<GameMode, string> = {
  CERDAS_CERMAT: 'Cerdas Cermat',
  PAPAN_TANTANGAN: 'Papan Tantangan',
  TANTANGAN_ANALISIS: 'Tantangan Analisis',
};

const STATUS_NAMES: Record<Session['status'], string> = {
  DRAFT: 'Draf',
  LOBBY: 'Lobi',
  ACTIVE: 'Berlangsung',
  PAUSED: 'Dijeda',
  REVIEWING: 'Peninjauan',
  FINISHED: 'Selesai',
};

export const SessionsPage: React.FC = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [questions, setQuestions] = useState<QuestionPrivate[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [meetingLabel, setMeetingLabel] = useState('Pertemuan 1');
  const [gameMode, setGameMode] = useState<GameMode>('CERDAS_CERMAT');
  const [submissionMode, setSubmissionMode] = useState<SubmissionMode>('CAPTAIN_ONLY');
  const [requireJoinApproval, setRequireJoinApproval] = useState(false);
  const [teamCount, setTeamCount] = useState(4);
  const [teamNames, setTeamNames] = useState<string[]>([
    'Tim Al-Muhajirin',
    'Tim Al-Anshar',
    'Tim Al-Fath',
    'Tim Al-Hijrah',
    'Tim Badar',
    'Tim Uhud',
  ]);
  const [scoringConfig, setScoringConfig] = useState<ScoringConfig>(DEFAULT_SCORING_CONFIG);

  // Papan Tantangan builder state
  const [boardCategories, setBoardCategories] = useState<string[]>([]);
  const [boardPointLevelsText, setBoardPointLevelsText] = useState('100, 200, 300, 400');
  const [tileMapping, setTileMapping] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null);

  const { user, isLecturer, authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !user || !isLecturer) return;
    const unsubS = onSnapshot(
      query(collection(db, 'sessions'), orderBy('createdAt', 'desc')),
      (snap) => {
        setSessions(snap.docs.map((d) => d.data() as Session));
        setLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'sessions')
    );

    const unsubQ = onSnapshot(
      collection(db, 'questions_private'),
      (snap) => {
        const active = snap.docs
          .map((d) => d.data() as QuestionPrivate)
          .filter((q) => q.isActive);
        setQuestions(active);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'questions_private')
    );

    return () => {
      unsubS();
      unsubQ();
    };
  }, [authLoading, user, isLecturer]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    questions.forEach((q) => {
      if (q.enabledModes.includes('PAPAN_TANTANGAN')) set.add(q.topicName);
    });
    return Array.from(set);
  }, [questions]);

  useEffect(() => {
    if (boardCategories.length === 0 && availableCategories.length > 0) {
      setBoardCategories(availableCategories.slice(0, 4));
    }
  }, [availableCategories, boardCategories.length]);

  const parsedPointLevels = useMemo(() => {
    const nums = boardPointLevelsText
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    return nums.length > 0 ? nums : [100, 200, 300, 400, 500];
  }, [boardPointLevelsText]);

  const autoFillBoardTiles = () => {
    const next: Record<string, string> = {};
    const usedIds = new Set<string>();
    boardCategories.forEach((cat, cIdx) => {
      const catQuestions = questions
        .filter((q) => q.topicName === cat && q.enabledModes.includes('PAPAN_TANTANGAN'))
        .sort((a, b) => a.points - b.points);
      parsedPointLevels.forEach((pts, rIdx) => {
        const key = `${cIdx}_${rIdx}`;
        const exact = catQuestions.find((q) => q.points === pts && !usedIds.has(q.questionId));
        const fallback = catQuestions.find((q) => !usedIds.has(q.questionId));
        const chosen = exact ?? fallback;
        if (chosen) {
          usedIds.add(chosen.questionId);
          next[key] = chosen.questionId;
        }
      });
    });
    setTileMapping(next);
  };

  useEffect(() => {
    if (gameMode === 'PAPAN_TANTANGAN' && boardCategories.length > 0) {
      autoFillBoardTiles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameMode, boardCategories.join('|'), parsedPointLevels.join(',')]);

  const insufficientCategories = useMemo(() => {
    if (gameMode !== 'PAPAN_TANTANGAN') return [];
    return boardCategories.filter((cat) => {
      const count = questions.filter(
        (q) => q.topicName === cat && q.enabledModes.includes('PAPAN_TANTANGAN')
      ).length;
      return count < parsedPointLevels.length;
    });
  }, [gameMode, boardCategories, questions, parsedPointLevels.length]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    try {
      let boardConfig: BoardConfig | undefined;
      if (gameMode === 'PAPAN_TANTANGAN') {
        const tiles: Record<string, BoardTile> = {};
        boardCategories.forEach((_, cIdx) => {
          parsedPointLevels.forEach((pts, rIdx) => {
            const tileKey = `${cIdx}_${rIdx}`;
            const qId = tileMapping[tileKey] ?? '';
            tiles[tileKey] = {
              tileKey,
              categoryIndex: cIdx,
              rowIndex: rIdx,
              questionId: qId,
              points: pts,
              completed: false,
              completedByTeamId: null,
              completedByTeamName: null,
            };
          });
        });
        boardConfig = {
          categories: boardCategories,
          pointLevels: parsedPointLevels,
          tiles,
        };
      }

      const id = await createSession({
        title: title.trim(),
        meetingLabel: meetingLabel.trim(),
        gameMode,
        submissionMode,
        requireJoinApproval,
        scoringConfig,
        teamNames: teamNames.slice(0, teamCount),
        boardConfig,
      });
      setShowCreate(false);
      navigate(`/admin/control/${id}`);
    } finally {
      setCreating(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteSession(deleteTarget.sessionId);
    setDeleteTarget(null);
  };

  return (
    <AdminLayout
      title="Sesi Kompetisi & Riwayat"
      subtitle="Buat sesi live baru, atur aturan skor, papan tantangan, atau buka riwayat sesi terdahulu"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-slate-600">
            Setiap sesi memiliki kode gabung unik, tim, dan rekap skor yang tersimpan permanen.
          </p>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-4 py-2.5 rounded-xl bg-[#2563EB] text-white text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            {showCreate ? 'Tutup Formulir' : 'Buat Sesi Kompetisi Baru'}
          </button>
        </div>

        {showCreate && (
          <form
            onSubmit={handleCreateSession}
            className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6"
          >
            <h2 className="text-base font-bold text-[#0E2142] border-b border-slate-100 pb-3">
              Konfigurasi Sesi Baru
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Judul Sesi Kompetisi
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Kuis Tengah Semester — Sirah Periode Madinah"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pertemuan / Kelas
                </label>
                <input
                  type="text"
                  value={meetingLabel}
                  onChange={(e) => setMeetingLabel(e.target.value)}
                  placeholder="Pertemuan 5 — Kelas A"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mode Permainan
                </label>
                <select
                  value={gameMode}
                  onChange={(e) => {
                    const nextMode = e.target.value as GameMode;
                    setGameMode(nextMode);
                    if (nextMode === 'TANTANGAN_ANALISIS') {
                      setSubmissionMode('CAPTAIN_ONLY');
                    }
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  <option value="CERDAS_CERMAT">Mode A: Cerdas Cermat (Wajib, Lemparan, Rebutan)</option>
                  <option value="PAPAN_TANTANGAN">Mode B: Papan Tantangan (Grid Kategori)</option>
                  <option value="TANTANGAN_ANALISIS">Mode C: Tantangan Analisis (Esai &amp; Rubrik)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Aturan Pengiriman Jawaban
                </label>
                <select
                  value={submissionMode}
                  onChange={(e) => setSubmissionMode(e.target.value as SubmissionMode)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  <option value="CAPTAIN_ONLY">Khusus Ketua Tim</option>
                  <option value="TEAM_CONSENSUS">Konsensus Tim (1 Jawaban Resmi/Tim)</option>
                  <option value="INDIVIDUAL">Individu (Semua Mahasiswa Menjawab)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Persetujuan Bergabung Mahasiswa
                </label>
                <select
                  value={requireJoinApproval ? 'APPROVAL' : 'AUTO'}
                  onChange={(e) => setRequireJoinApproval(e.target.value === 'APPROVAL')}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  <option value="AUTO">Otomatis Disetujui saat Kode Valid</option>
                  <option value="APPROVAL">Wajib Persetujuan Manual Admin</option>
                </select>
              </div>
            </div>

            {/* Teams setup */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#0E2142]">
                  Tim Peserta ({teamCount} Tim)
                </span>
                <select
                  value={teamCount}
                  onChange={(e) => setTeamCount(Number(e.target.value))}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                >
                  {[2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n} Tim
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {Array.from({ length: teamCount }).map((_, idx) => (
                  <input
                    key={idx}
                    type="text"
                    required
                    value={teamNames[idx] ?? `Tim ${idx + 1}`}
                    onChange={(e) => {
                      const next = [...teamNames];
                      next[idx] = e.target.value;
                      setTeamNames(next);
                    }}
                    className="px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                ))}
              </div>
            </div>

            {/* Scoring Rules */}
            {gameMode === 'CERDAS_CERMAT' && (
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="text-xs font-bold text-[#0E2142]">
                  Aturan Poin Cerdas Cermat (Dapat Diubah)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">Wajib Benar</label>
                    <input
                      type="number"
                      value={scoringConfig.wajibCorrect}
                      onChange={(e) =>
                        setScoringConfig({ ...scoringConfig, wajibCorrect: Number(e.target.value) })
                      }
                      className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">Wajib Salah</label>
                    <input
                      type="number"
                      value={scoringConfig.wajibWrong}
                      onChange={(e) =>
                        setScoringConfig({ ...scoringConfig, wajibWrong: Number(e.target.value) })
                      }
                      className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">Lemparan Benar</label>
                    <input
                      type="number"
                      value={scoringConfig.lemparanCorrect}
                      onChange={(e) =>
                        setScoringConfig({
                          ...scoringConfig,
                          lemparanCorrect: Number(e.target.value),
                        })
                      }
                      className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">Lemparan Salah</label>
                    <input
                      type="number"
                      value={scoringConfig.lemparanWrong}
                      onChange={(e) =>
                        setScoringConfig({ ...scoringConfig, lemparanWrong: Number(e.target.value) })
                      }
                      className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">Rebutan Benar</label>
                    <input
                      type="number"
                      value={scoringConfig.rebutanCorrect}
                      onChange={(e) =>
                        setScoringConfig({
                          ...scoringConfig,
                          rebutanCorrect: Number(e.target.value),
                        })
                      }
                      className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">Rebutan Salah</label>
                    <input
                      type="number"
                      value={scoringConfig.rebutanWrong}
                      onChange={(e) =>
                        setScoringConfig({ ...scoringConfig, rebutanWrong: Number(e.target.value) })
                      }
                      className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-sm tabular-nums"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Papan Tantangan Builder */}
            {gameMode === 'PAPAN_TANTANGAN' && (
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-[#0E2142]">
                      Konfigurasi Papan Tantangan (Kategori &amp; Level Poin)
                    </div>
                    <p className="text-xs text-slate-500">
                      Setiap kotak memetakan langsung ke soal nyata dari Bank Soal
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-600">Level Poin:</label>
                    <input
                      type="text"
                      value={boardPointLevelsText}
                      onChange={(e) => setBoardPointLevelsText(e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono w-56"
                    />
                  </div>
                </div>

                {insufficientCategories.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900">
                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      Kategori berikut memiliki jumlah soal Papan Tantangan lebih sedikit dari jumlah level poin ({parsedPointLevels.length}):{' '}
                      <strong>{insufficientCategories.join(', ')}</strong>. Beberapa kotak mungkin kosong atau perlu dipilih manual.
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {availableCategories.map((cat) => {
                    const checked = boardCategories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() =>
                          setBoardCategories(
                            checked
                              ? boardCategories.filter((c) => c !== cat)
                              : [...boardCategories, cat]
                          )
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                          checked
                            ? 'bg-[#0E2142] text-white border-[#0E2142]'
                            : 'bg-white text-slate-600 border-slate-300'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>

                {boardCategories.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr>
                          <th className="p-2 text-left text-slate-500 border-b border-slate-200">
                            Poin
                          </th>
                          {boardCategories.map((cat) => (
                            <th
                              key={cat}
                              className="p-2 text-left font-bold text-[#0E2142] border-b border-slate-200"
                            >
                              {cat}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsedPointLevels.map((pts, rIdx) => (
                          <tr key={rIdx} className="border-b border-slate-100">
                            <td className="p-2 font-mono font-bold text-[#2563EB] tabular-nums">
                              {pts}
                            </td>
                            {boardCategories.map((cat, cIdx) => {
                              const key = `${cIdx}_${rIdx}`;
                              const eligible = questions.filter((q) =>
                                q.enabledModes.includes('PAPAN_TANTANGAN')
                              );
                              return (
                                <td key={key} className="p-2">
                                  <select
                                    value={tileMapping[key] ?? ''}
                                    onChange={(e) =>
                                      setTileMapping({ ...tileMapping, [key]: e.target.value })
                                    }
                                    className="w-full max-w-[220px] px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                                  >
                                    <option value="">-- Pilih Soal ({cat}) --</option>
                                    {eligible.map((q) => (
                                      <option key={q.questionId} value={q.questionId}>
                                        [{q.topicName}] {q.questionText.slice(0, 48)}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-5 py-2.5 rounded-xl bg-[#2563EB] text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
              >
                {creating ? 'Membuat Sesi...' : 'Buat Sesi & Buka Konsol Kendali'}
              </button>
            </div>
          </form>
        )}

        {/* Sessions List */}
        {loading ? (
          <LoadingState label="Memuat daftar sesi..." />
        ) : sessions.length === 0 ? (
          <EmptyState
            title="Belum Ada Sesi Kompetisi"
            description="Buat sesi baru untuk memulai kuis Cerdas Cermat, Papan Tantangan, atau Tantangan Analisis di kelas."
            actionLabel="Buat Sesi Pertama"
            onAction={() => setShowCreate(true)}
          />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-200">
            {sessions.map((ses) => (
              <div
                key={ses.sessionId}
                className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-[#2563EB]">
                      {MODE_NAMES[ses.gameMode]}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold text-[#0E2142]">
                      Status: {STATUS_NAMES[ses.status]}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono font-bold text-[#0E2142] tabular-nums">
                      Kode {ses.joinCode}
                    </span>
                    {ses.meetingLabel && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{ses.meetingLabel}</span>
                      </>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-[#0E2142] truncate">{ses.title}</h3>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Link
                    to={`/admin/control/${ses.sessionId}`}
                    className="px-3.5 py-2 rounded-xl bg-[#2563EB] text-white text-xs font-semibold hover:bg-blue-700 flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Konsol Kendali
                  </Link>
                  <a
                    href={`/present/${ses.sessionId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-[#0E2142] text-white text-xs font-semibold hover:bg-[#16315E] flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    Proyektor
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <Link
                    to={`/results/${ses.sessionId}`}
                    className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    Hasil &amp; Laporan
                  </Link>
                  <button
                    onClick={() => setDeleteTarget(ses)}
                    className="p-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50"
                    title="Hapus Sesi"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-[#0E2142]">Hapus Sesi Kompetisi?</h3>
            <p className="text-sm text-slate-600">
              Sesi <strong>{deleteTarget.title}</strong> akan dihapus dari daftar sesi.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold"
              >
                Batal
              </button>
              <button
                onClick={() => void handleConfirmDelete()}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-semibold"
              >
                Hapus Sesi
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
