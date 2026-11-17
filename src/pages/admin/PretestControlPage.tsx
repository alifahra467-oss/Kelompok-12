import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import Papa from 'papaparse';
import { QRCodeSVG } from 'qrcode.react';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BarChart3,
  CheckCircle2,
  Copy,
  Crown,
  Download,
  ExternalLink,
  FastForward,
  Lock,
  Monitor,
  Pause,
  Play,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  StopCircle,
  Trash2,
  Unlock,
  Users,
} from 'lucide-react';
import { ArabicText } from '../../components/ArabicText';
import { ConfettiBurst, SmartSpinnerWheel } from '../../components/SmartSpinnerWheel';
import { LoadingState } from '../../components/StatusViews';
import { AdminLayout } from '../../layouts/AdminLayout';
import { useAuth } from '../../context/AuthContext';
import { db, handleFirestoreError } from '../../lib/firebase';
import { formatSeconds, syncServerTime, useServerCountdown } from '../../lib/serverTime';
import {
  evaluatePretestResults,
  getDefaultTeamNames,
  proposeTeamCaptains,
} from '../../lib/teamBalancer';
import {
  completeCurrentSpinReveal,
  deletePretestQuestion,
  evaluateAndSavePretestResults,
  finishAndRevealAllPretestAnswers,
  finishPretest,
  generateAndSaveBalancedAllocation,
  importBankQuestionsToPretest,
  importUlumulQuranQuestionsToPretest,
  launchGameSessionFromPretest,
  moveStudentAndRecompute,
  pausePretest,
  pauseSpinnerPresentation,
  releaseSinglePretestQuestion,
  resetSpinnerPresentation,
  resumePretest,
  revealAllRemainingSpinner,
  revealPretestQuestionAnswer,
  savePretestQuestion,
  saveProposedCaptains,
  startAllPretestQuestions,
  startNextSpinnerSpin,
  updatePretestFields,
} from '../../services/pretestService';
import {
  OperationType,
  type GameMode,
  type QuestionPrivate,
  type SubmissionMode,
} from '../../types/arena';

const GAME_MODE_LABELS: Record<GameMode, string> = {
  CERDAS_CERMAT: 'Cerdas Cermat',
  PAPAN_TANTANGAN: 'Papan Tantangan',
  TANTANGAN_ANALISIS: 'Tantangan Analisis',
};
import type {
  Pretest,
  PretestAdminSummary,
  PretestParticipant,
  PretestQuestionPrivate,
  PretestResult,
  PretestSubmission,
  ProposedCaptain,
} from '../../types/pretest';

type AdminTab = 'SOAL' | 'MONITOR' | 'KETUA' | 'SPINNER';

export const PretestControlPage: React.FC = () => {
  const { id: pretestId = '' } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [pretest, setPretest] = useState<Pretest | null>(null);
  const [questions, setQuestions] = useState<PretestQuestionPrivate[]>([]);
  const [bankQuestions, setBankQuestions] = useState<QuestionPrivate[]>([]);
  const [participants, setParticipants] = useState<PretestParticipant[]>([]);
  const [submissions, setSubmissions] = useState<PretestSubmission[]>([]);
  const [results, setResults] = useState<PretestResult[]>([]);
  const [summary, setSummary] = useState<PretestAdminSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const initialTabParam = searchParams.get('tab');
  const validTabs: AdminTab[] = ['SOAL', 'MONITOR', 'KETUA', 'SPINNER'];
  const [activeTab, setActiveTab] = useState<AdminTab>(
    initialTabParam && validTabs.includes(initialTabParam as AdminTab)
      ? (initialTabParam as AdminTab)
      : 'SOAL'
  );
  const [busyMsg, setBusyMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);

  // Question editor state
  const [editingQId, setEditingQId] = useState<string | undefined>(undefined);
  const [qText, setQText] = useState('');
  const [qOptions, setQOptions] = useState<string[]>(['', '', '', '']);
  const [qCorrectIdx, setQCorrectIdx] = useState(0);
  const [qExplanation, setQExplanation] = useState('');
  const [qTimeLimit, setQTimeLimit] = useState(30);
  const [qOrderIndex, setQOrderIndex] = useState(1);
  const [qPoints, setQPoints] = useState(10);
  const [qIsTieBreak, setQIsTieBreak] = useState(false);
  const [showBankPicker, setShowBankPicker] = useState(false);

  // Captain & team naming state
  const [draftTeamCount, setDraftTeamCount] = useState(4);
  const [draftTeamNames, setDraftTeamNames] = useState<string[]>(getDefaultTeamNames(4));
  const [draftCaptains, setDraftCaptains] = useState<ProposedCaptain[]>([]);

  // Handover to main game state
  const [launchTitle, setLaunchTitle] = useState('');
  const [launchMode, setLaunchMode] = useState<GameMode>('CERDAS_CERMAT');
  const [launchSubmissionMode, setLaunchSubmissionMode] = useState<SubmissionMode>('CAPTAIN_ONLY');
  const [launchRequireApproval, setLaunchRequireApproval] = useState(false);

  useEffect(() => {
    void syncServerTime();
  }, []);

  const { user, isLecturer, authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !user || !isLecturer || !pretestId) return;

    const unsubPre = onSnapshot(
      doc(db, 'pretests', pretestId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Pretest;
          setPretest(data);
          setDraftTeamCount(data.teamCount || 4);
          setLaunchTitle((prev) => prev || `Kompetisi: ${data.title}`);
        } else {
          setPretest(null);
        }
        setLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, `pretests/${pretestId}`);
        setLoading(false);
      }
    );

    const unsubQ = onSnapshot(
      query(
        collection(db, 'pretests', pretestId, 'questions_private'),
        orderBy('orderIndex', 'asc')
      ),
      (snap) => setQuestions(snap.docs.map((d) => d.data() as PretestQuestionPrivate)),
      (err) =>
        handleFirestoreError(err, OperationType.LIST, `pretests/${pretestId}/questions_private`)
    );

    const unsubPart = onSnapshot(
      query(collection(db, 'pretests', pretestId, 'participants'), orderBy('joinedAt', 'asc')),
      (snap) => setParticipants(snap.docs.map((d) => d.data() as PretestParticipant)),
      (err) =>
        handleFirestoreError(err, OperationType.LIST, `pretests/${pretestId}/participants`)
    );

    const unsubSub = onSnapshot(
      collection(db, 'pretests', pretestId, 'submissions'),
      (snap) => setSubmissions(snap.docs.map((d) => d.data() as PretestSubmission)),
      (err) =>
        handleFirestoreError(err, OperationType.LIST, `pretests/${pretestId}/submissions`)
    );

    const unsubRes = onSnapshot(
      query(collection(db, 'pretests', pretestId, 'results'), orderBy('rank', 'asc')),
      (snap) => setResults(snap.docs.map((d) => d.data() as PretestResult)),
      (err) => handleFirestoreError(err, OperationType.LIST, `pretests/${pretestId}/results`)
    );

    const unsubSum = onSnapshot(
      doc(db, 'pretests', pretestId, 'admin_state', 'summary'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as PretestAdminSummary;
          setSummary(data);
          if (data.proposedCaptains?.length) {
            setDraftCaptains(data.proposedCaptains);
          }
        }
      },
      (err) =>
        handleFirestoreError(err, OperationType.GET, `pretests/${pretestId}/admin_state/summary`)
    );

    const unsubBank = onSnapshot(
      collection(db, 'questions_private'),
      (snap) => setBankQuestions(snap.docs.map((d) => d.data() as QuestionPrivate)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'questions_private')
    );

    return () => {
      unsubPre();
      unsubQ();
      unsubPart();
      unsubSub();
      unsubRes();
      unsubSum();
      unsubBank();
    };
  }, [authLoading, user, isLecturer, pretestId]);

  // Selesaikan otomatis animasi spinner setelah 3.7 detik agar sinkron dan tahan refresh
  useEffect(() => {
    if (!pretest?.allocation || pretest.allocation.spinnerStatus !== 'SPINNING') return;
    const t = window.setTimeout(() => {
      void completeCurrentSpinReveal(pretest);
    }, 3700);
    return () => window.clearTimeout(t);
  }, [pretest?.allocation?.spinnerStatus, pretest?.allocation?.spinNonce, pretest]);

  useEffect(() => {
    const names = getDefaultTeamNames(draftTeamCount);
    setDraftTeamNames((prev) =>
      names.map((def, i) => (prev[i] && prev[i].trim() ? prev[i] : def))
    );
  }, [draftTeamCount]);

  const countdownSec = useServerCountdown(
    pretest?.timerRunning ?? false,
    pretest?.timerEndTimeMs,
    pretest?.timerRemainingSec ?? 0
  );

  const joinUrl =
    typeof window !== 'undefined' && pretest
      ? `${window.location.origin}/join?code=${pretest.joinCode}`
      : '';

  const activeParticipants = useMemo(
    () => participants.filter((p) => p.status !== 'REMOVED'),
    [participants]
  );

  const subCountByParticipant = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const s of submissions) {
      const set = map.get(s.participantId) ?? new Set<string>();
      set.add(s.questionId);
      map.set(s.participantId, set);
    }
    return map;
  }, [submissions]);

  const liveResults = useMemo(() => {
    if (results.length > 0 && submissions.length === 0) return results;
    if (activeParticipants.length === 0 || questions.length === 0) return results;
    return evaluatePretestResults({
      participants: activeParticipants,
      questions,
      submissions,
      useWeightedPoints: Boolean(pretest?.useWeightedPoints),
    });
  }, [results, activeParticipants, questions, submissions, pretest?.useWeightedPoints]);

  const clearFeedback = () => {
    setErrorMsg(null);
    setNoticeMsg(null);
  };

  const resetQuestionForm = () => {
    setEditingQId(undefined);
    setQText('');
    setQOptions(['', '', '', '']);
    setQCorrectIdx(0);
    setQExplanation('');
    setQTimeLimit(30);
    setQOrderIndex(questions.length + 1);
    setQPoints(10);
    setQIsTieBreak(false);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();
    const cleaned = qOptions.map((o) => o.trim()).filter(Boolean);
    if (cleaned.length < 4) {
      setErrorMsg('Minimal 4 pilihan jawaban harus diisi.');
      return;
    }
    const correctAnswer = cleaned[qCorrectIdx] ?? cleaned[0];
    setBusyMsg('Menyimpan soal pre-test...');
    try {
      await savePretestQuestion(pretestId, {
        questionId: editingQId,
        questionText: qText,
        options: cleaned,
        correctAnswer,
        explanation: qExplanation,
        timeLimitSec: qTimeLimit,
        orderIndex: qOrderIndex,
        points: qPoints,
        isTieBreak: qIsTieBreak,
        releasedToProjector: false,
      });
      resetQuestionForm();
      setNoticeMsg('Soal pre-test berhasil disimpan.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan soal.');
    } finally {
      setBusyMsg(null);
    }
  };

  const handleEditQuestion = (q: PretestQuestionPrivate) => {
    setEditingQId(q.questionId);
    setQText(q.questionText);
    const padded = [...q.options];
    while (padded.length < 4) padded.push('');
    setQOptions(padded);
    const idx = padded.findIndex((o) => o === q.correctAnswer);
    setQCorrectIdx(idx >= 0 ? idx : 0);
    setQExplanation(q.explanation || '');
    setQTimeLimit(q.timeLimitSec);
    setQOrderIndex(q.orderIndex);
    setQPoints(q.points);
    setQIsTieBreak(q.isTieBreak);
  };

  const handleCopyFromBank = async (selectedIds: string[]) => {
    clearFeedback();
    const picked = bankQuestions.filter((b) => selectedIds.includes(b.questionId));
    if (picked.length === 0) return;
    setBusyMsg('Menyalin soal dari Bank Soal...');
    try {
      const added = await importBankQuestionsToPretest(pretestId, picked, questions.length + 1);
      setShowBankPicker(false);
      setNoticeMsg(`${added} soal pilihan ganda berhasil disalin ke pre-test.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyalin soal.');
    } finally {
      setBusyMsg(null);
    }
  };

  const handleLoadUlumulQuran15 = async () => {
    clearFeedback();
    setBusyMsg('Memuat 15 soal pilihan ganda ‘Ulûmul Qur’ân (4 Bab)...');
    try {
      const added = await importUlumulQuranQuestionsToPretest(pretestId, questions.length + 1);
      setNoticeMsg(`${added} soal pilihan ganda ‘Ulûmul Qur’ân berhasil ditambahkan.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat 15 soal Ulumul Qur’an.');
    } finally {
      setBusyMsg(null);
    }
  };

  const handleEvaluateScores = async () => {
    if (!pretest) return;
    clearFeedback();
    setBusyMsg('Menghitung skor dan peringkat mahasiswa...');
    try {
      const { proposedCaptains } = await evaluateAndSavePretestResults({
        pretest,
        participants,
        questions,
        submissions,
        existingSummary: summary,
      });
      if (!pretest.captainsLocked) {
        setDraftCaptains(proposedCaptains);
      }
      setNoticeMsg('Hasil pre-test dan peringkat berhasil diperbarui.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mengevaluasi hasil pre-test.');
    } finally {
      setBusyMsg(null);
    }
  };

  const handleRecomputeProposal = async () => {
    if (!pretest) return;
    clearFeedback();
    setBusyMsg('Menyusun usulan ketua tim...');
    try {
      await updatePretestFields(pretestId, {
        teamCount: draftTeamCount,
        captainsLocked: false,
      });
      const proposed = proposeTeamCaptains({
        results,
        participants,
        teamCount: draftTeamCount,
        useWeightedPoints: pretest.useWeightedPoints,
        teamNames: draftTeamNames,
      });
      setDraftCaptains(proposed);
      await saveProposedCaptains(pretestId, summary, proposed, false);
      setNoticeMsg('Usulan ketua tim otomatis diperbarui sesuai peringkat tertinggi.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mengusulkan ketua.');
    } finally {
      setBusyMsg(null);
    }
  };

  const handleCaptainReplace = (teamIdx: number, newParticipantId: string) => {
    const chosenPart = activeParticipants.find((p) => p.participantId === newParticipantId);
    if (!chosenPart) return;

    const chosenRes = results.find((r) => r.participantId === newParticipantId);
    const chosenScore = chosenRes
      ? pretest?.useWeightedPoints
        ? chosenRes.weightedScore
        : chosenRes.totalCorrect
      : 0;

    setDraftCaptains((prev) => {
      const copy = [...prev];
      const existingOwnerIdx = copy.findIndex(
        (c, idx) => idx !== teamIdx && c.participantId === newParticipantId
      );
      const displaced = copy[teamIdx];

      if (existingOwnerIdx >= 0 && displaced) {
        // Tukar agar tidak ada dua tim memiliki ketua yang sama
        copy[existingOwnerIdx] = {
          ...copy[existingOwnerIdx],
          participantId: displaced.participantId,
          displayName: displaced.displayName,
          score: displaced.score,
          rank: displaced.rank,
          isTiedAtCutoff: false,
        };
      }

      copy[teamIdx] = {
        teamId: `team_${teamIdx + 1}`,
        teamName: draftTeamNames[teamIdx] || `Kelompok ${teamIdx + 1}`,
        participantId: chosenPart.participantId,
        displayName: chosenPart.displayName,
        score: chosenScore,
        rank: chosenRes?.rank ?? activeParticipants.length,
        isTiedAtCutoff: false,
      };
      return copy;
    });
  };

  const handleLockCaptainsAndAllocate = async () => {
    if (!pretest) return;
    clearFeedback();
    setBusyMsg('Mengunci ketua & menjalankan algoritma pemerataan tim...');
    try {
      // Pastikan hasil terbaru terevaluasi terlebih dahulu
      const { results: freshResults } = await evaluateAndSavePretestResults({
        pretest,
        participants,
        questions,
        submissions,
        existingSummary: summary,
      });

      const captainsToUse =
        draftCaptains.length > 0
          ? draftCaptains.map((c, idx) => ({
              ...c,
              teamName: draftTeamNames[idx] || c.teamName,
            }))
          : proposeTeamCaptains({
              results: freshResults,
              participants,
              teamCount: draftTeamCount,
              useWeightedPoints: pretest.useWeightedPoints,
              teamNames: draftTeamNames,
            });

      await updatePretestFields(pretestId, { teamCount: draftTeamCount });
      await generateAndSaveBalancedAllocation({
        pretest: { ...pretest, teamCount: draftTeamCount },
        participants,
        results: freshResults,
        captains: captainsToUse,
        teamNames: draftTeamNames,
      });

      setActiveTab('SPINNER');
      setNoticeMsg('Ketua terkunci & alokasi tim seimbang berhasil disimpan! Siap memutar Smart Spinner.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal membentuk tim seimbang.');
    } finally {
      setBusyMsg(null);
    }
  };

  const handleExportTeamsCsv = () => {
    if (!pretest?.allocation) return;
    const rows = pretest.allocation.teams.flatMap((t) =>
      t.members.map((m, idx) => ({
        Kelompok: t.name,
        Nomor_Urut: idx + 1,
        Nama_Mahasiswa: m.displayName,
        Peran: m.isCaptain ? 'Ketua Tim' : 'Anggota',
      }))
    );
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tim_seimbang_${pretest.joinCode}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLaunchMainGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pretest) return;
    clearFeedback();
    setBusyMsg('Membuat sesi kompetisi utama & memindahkan tim beserta peserta...');
    try {
      const sessionId = await launchGameSessionFromPretest({
        pretest,
        title: launchTitle.trim() || `Kompetisi: ${pretest.title}`,
        meetingLabel: pretest.meetingLabel,
        gameMode: launchMode,
        submissionMode: launchSubmissionMode,
        requireJoinApproval: launchRequireApproval,
      });
      navigate(`/admin/control/${sessionId}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal meluncurkan sesi kompetisi.');
    } finally {
      setBusyMsg(null);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Memuat Konsol Pre-Test...">
        <LoadingState label="Memuat data pre-test..." />
      </AdminLayout>
    );
  }

  if (!pretest) {
    return (
      <AdminLayout title="Pre-Test Tidak Ditemukan">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4">
          <p className="text-sm text-slate-600">Data pre-test tidak ditemukan atau sudah dihapus.</p>
          <Link
            to="/admin/pretest"
            className="inline-flex px-4 py-2.5 rounded-xl bg-[#2563EB] text-white text-sm font-semibold"
          >
            Kembali ke Daftar Pre-Test
          </Link>
        </div>
      </AdminLayout>
    );
  }

  const mcBankQuestions = bankQuestions.filter(
    (b) => (b.type === 'MULTIPLE_CHOICE' || b.type === 'TRUE_FALSE') && (b.options?.length ?? 0) >= 4
  );
  const alloc = pretest.allocation;
  const balanceReport = summary?.balanceReport ?? null;
  const hasAnyTie = results.some((r) => r.isTied);

  return (
    <AdminLayout
      title={pretest.title}
      subtitle={`Pre-Test & Smart Team Spinner · Kode Gabung: ${pretest.joinCode}`}
    >
      <ConfettiBurst active={alloc?.spinnerStatus === 'COMPLETED'} />

      {/* Header Action Bar */}
      <div className="bg-[#0E2142] text-white rounded-2xl p-5 mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden">
        <div className="flex flex-wrap items-center gap-4">
          <div className="bg-white p-1.5 rounded-xl shrink-0">
            <QRCodeSVG value={joinUrl} size={64} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#F1C56C] font-bold">
              <span>KODE GABUNG MAHASISWA</span>
              <span>·</span>
              <span>{activeParticipants.length} Mahasiswa Hadir</span>
              <span>·</span>
              <span>{questions.length} Soal</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="font-mono text-3xl font-extrabold tracking-widest tabular-nums">
                {pretest.joinCode}
              </span>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(joinUrl);
                  setNoticeMsg('Tautan gabung mahasiswa disalin.');
                }}
                className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold flex items-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Salin Tautan</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {pretest.timerRunning && (
            <div className="px-3.5 py-2 rounded-xl bg-white/10 font-mono text-sm font-bold text-[#F1C56C] tabular-nums">
              Sisa Waktu: {formatSeconds(countdownSec)}
            </div>
          )}

          {pretest.status === 'LOBBY' || pretest.status === 'DRAFT' ? (
            <button
              type="button"
              onClick={() => void startAllPretestQuestions(pretest, questions)}
              disabled={questions.length === 0}
              className="px-4 py-2.5 rounded-xl bg-[#2563EB] text-white text-xs font-bold hover:bg-blue-600 disabled:opacity-40 flex items-center gap-1.5"
            >
              <Play className="w-4 h-4" />
              <span>Mulai Pre-Test Sekarang</span>
            </button>
          ) : pretest.status === 'ACTIVE' ? (
            <>
              <button
                type="button"
                onClick={() => void pausePretest(pretest)}
                className="px-3.5 py-2.5 rounded-xl bg-amber-500 text-[#0E2142] text-xs font-bold hover:bg-amber-400 flex items-center gap-1.5"
              >
                <Pause className="w-4 h-4" />
                <span>Jeda</span>
              </button>
              <button
                type="button"
                onClick={() => void finishPretest(pretestId)}
                className="px-3.5 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 flex items-center gap-1.5"
              >
                <StopCircle className="w-4 h-4" />
                <span>Tutup Pre-Test</span>
              </button>
              <button
                type="button"
                onClick={() => void finishAndRevealAllPretestAnswers(pretestId, questions)}
                disabled={questions.length === 0}
                className="px-3.5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-40 flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Selesai &amp; Buka Kunci di Akhir</span>
              </button>
            </>
          ) : pretest.status === 'PAUSED' ? (
            <>
              <button
                type="button"
                onClick={() => void resumePretest(pretest)}
                className="px-3.5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 flex items-center gap-1.5"
              >
                <Play className="w-4 h-4" />
                <span>Lanjutkan</span>
              </button>
              <button
                type="button"
                onClick={() => void finishPretest(pretestId)}
                className="px-3.5 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 flex items-center gap-1.5"
              >
                <StopCircle className="w-4 h-4" />
                <span>Tutup Pre-Test</span>
              </button>
              <button
                type="button"
                onClick={() => void finishAndRevealAllPretestAnswers(pretestId, questions)}
                disabled={questions.length === 0}
                className="px-3.5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-40 flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Selesai &amp; Buka Kunci di Akhir</span>
              </button>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3.5 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs font-bold">
                Pre-Test Selesai
              </span>
              {questions.length > 0 && (
                <button
                  type="button"
                  onClick={() => void finishAndRevealAllPretestAnswers(pretestId, questions)}
                  className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold"
                >
                  Tampilkan Semua Kunci Akhir
                </button>
              )}
            </div>
          )}

          <Link
            to={`/pretest/present/${pretestId}`}
            target="_blank"
            className="px-4 py-2.5 rounded-xl bg-[#F1C56C] text-[#0E2142] text-xs font-extrabold hover:bg-amber-300 flex items-center gap-1.5"
          >
            <Monitor className="w-4 h-4" />
            <span>Proyektor 16:9</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Feedback Alerts */}
      {(busyMsg || errorMsg || noticeMsg) && (
        <div className="mb-5 space-y-2 print:hidden">
          {busyMsg && (
            <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-800">
              {busyMsg}
            </div>
          )}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800">
              {errorMsg}
            </div>
          )}
          {noticeMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
              {noticeMsg}
            </div>
          )}
        </div>
      )}

      {/* Step Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 print:hidden">
        {(
          [
            { id: 'SOAL', label: '1. Soal & Kunci Jawaban', icon: Sparkles },
            { id: 'MONITOR', label: '2. Nilai Pilihan Ganda & Peringkat', icon: BarChart3 },
            { id: 'KETUA', label: '3. Penentuan Ketua Tim', icon: Crown },
            { id: 'SPINNER', label: '4. Smart Spinner & Tim Seimbang', icon: Users },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors ${
                active
                  ? 'bg-[#0E2142] text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: SOAL PRE-TEST */}
      {activeTab === 'SOAL' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 h-fit">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="text-base font-bold text-[#0E2142]">
                {editingQId ? 'Ubah Soal Pre-Test' : 'Tambah Soal Pilihan Ganda'}
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleLoadUlumulQuran15()}
                  className="text-xs font-bold text-[#0E2142] hover:text-[#2563EB] underline underline-offset-2"
                >
                  + Muat 15 Soal ‘Ulûmul Qur’ân
                </button>
                {mcBankQuestions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowBankPicker((v) => !v)}
                    className="text-xs font-semibold text-[#2563EB] hover:underline"
                  >
                    Salin dari Bank Soal ({mcBankQuestions.length})
                  </button>
                )}
              </div>
            </div>

            {showBankPicker && (
              <BankQuestionPicker
                questions={mcBankQuestions}
                onImport={handleCopyFromBank}
                onClose={() => setShowBankPicker(false)}
              />
            )}

            <form onSubmit={handleSaveQuestion} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#0E2142] mb-1">
                  Pertanyaan Pre-Test (Manual)
                </label>
                <textarea
                  required
                  rows={3}
                  value={qText}
                  onChange={(e) => setQText(e.target.value)}
                  placeholder="Tulis pertanyaan pilihan ganda..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#0E2142]">
                    Pilihan Jawaban (Minimal 4) &amp; Kunci Benar
                  </label>
                  {qOptions.length < 6 && (
                    <button
                      type="button"
                      onClick={() => setQOptions((prev) => [...prev, ''])}
                      className="text-xs font-semibold text-[#2563EB]"
                    >
                      + Tambah Opsi
                    </button>
                  )}
                </div>

                {qOptions.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="qCorrect"
                      checked={qCorrectIdx === idx}
                      onChange={() => setQCorrectIdx(idx)}
                      title="Tandai sebagai jawaban benar"
                      className="text-[#2563EB]"
                    />
                    <input
                      type="text"
                      required={idx < 4}
                      value={opt}
                      onChange={(e) =>
                        setQOptions((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))
                      }
                      placeholder={`Pilihan ${String.fromCharCode(65 + idx)}`}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#0E2142] mb-1">Urutan</label>
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    value={qOrderIndex}
                    onChange={(e) => setQOrderIndex(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#0E2142] mb-1">Waktu (dtk)</label>
                  <input
                    type="number"
                    min={5}
                    max={3600}
                    value={qTimeLimit}
                    onChange={(e) => setQTimeLimit(Number(e.target.value) || 30)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#0E2142] mb-1">Poin</label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={qPoints}
                    onChange={(e) => setQPoints(Number(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0E2142] mb-1">
                  Penjelasan (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={qExplanation}
                  onChange={(e) => setQExplanation(e.target.value)}
                  placeholder="Penjelasan singkat jawaban..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-[#0E2142] cursor-pointer">
                <input
                  type="checkbox"
                  checked={qIsTieBreak}
                  onChange={(e) => setQIsTieBreak(e.target.checked)}
                />
                <span>Tandai sebagai Soal Tie-Break (Penentu Seri)</span>
              </label>

              <div className="flex gap-2">
                {editingQId && (
                  <button
                    type="button"
                    onClick={resetQuestionForm}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700"
                  >
                    Batal
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#2563EB] text-white text-sm font-bold hover:bg-blue-700 flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>{editingQId ? 'Simpan Perubahan' : 'Tambahkan Soal'}</span>
                </button>
              </div>
            </form>
          </div>

          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-base font-bold text-[#0E2142]">
                    Daftar Soal Pre-Test ({questions.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Anda dapat merilis semua soal sekaligus atau satu per satu termasuk soal Tie-Break.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void startAllPretestQuestions(pretest, questions)}
                    disabled={questions.length === 0}
                    className="px-3.5 py-2 rounded-xl bg-[#0E2142] text-white text-xs font-bold hover:bg-[#16315E] disabled:opacity-40"
                  >
                    Rilis Semua Soal Biasa
                  </button>
                </div>
              </div>

              {questions.length === 0 ? (
                <p className="text-sm text-slate-500 py-8 text-center">
                  Belum ada soal pre-test. Tambahkan soal di formulir sebelah kiri.
                </p>
              ) : (
                <div className="space-y-3">
                  {questions.map((q, idx) => (
                    <div
                      key={q.questionId}
                      className={`p-4 rounded-2xl border ${
                        pretest.activeQuestionId === q.questionId
                          ? 'border-[#2563EB] bg-blue-50/40'
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="font-bold text-[#0E2142]">Soal #{idx + 1}</span>
                            <span>·</span>
                            <span className="tabular-nums">{q.points} Poin</span>
                            <span>·</span>
                            <span className="tabular-nums">{q.timeLimitSec} Detik</span>
                            {q.isTieBreak && (
                              <>
                                <span>·</span>
                                <span className="font-bold text-amber-700">Soal Tie-Break</span>
                              </>
                            )}
                          </div>
                          <ArabicText text={q.questionText} className="text-sm font-semibold text-[#0E2142]" />
                          <div className="text-xs text-emerald-700 font-semibold">
                            Kunci: {q.correctAnswer}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => void releaseSinglePretestQuestion(pretest, q)}
                            className="px-2.5 py-1.5 rounded-lg bg-[#2563EB] text-white text-xs font-semibold hover:bg-blue-700"
                          >
                            Rilis Soal Ini
                          </button>
                          <button
                            type="button"
                            onClick={() => void revealPretestQuestionAnswer(pretestId, q)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-[#0E2142] hover:bg-slate-50"
                          >
                            Buka Kunci
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditQuestion(q)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
                          >
                            Ubah
                          </button>
                          <button
                            type="button"
                            onClick={() => void deletePretestQuestion(pretestId, q.questionId)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-rose-700"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MONITOR & HASIL */}
      {activeTab === 'MONITOR' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-[#0E2142]">
                Pantau Kehadiran &amp; Hitung Skor Pre-Test
              </h2>
              <p className="text-xs text-slate-500">
                Peringkat dihitung berdasarkan {pretest.useWeightedPoints ? 'Skor Tertimbang' : 'Total Jawaban Benar'} (tanpa dipengaruhi kecepatan internet).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() =>
                  void updatePretestFields(pretestId, {
                    showResultsToStudents: !pretest.showResultsToStudents,
                  })
                }
                className={`px-3.5 py-2 rounded-xl border text-xs font-semibold ${
                  pretest.showResultsToStudents
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : 'border-slate-300 text-slate-700'
                }`}
              >
                {pretest.showResultsToStudents
                  ? 'Status Penyelesaian Diumumkan'
                  : 'Umumkan Status Penyelesaian'}
              </button>
              <button
                type="button"
                onClick={() => void handleEvaluateScores()}
                className="px-4 py-2.5 rounded-xl bg-[#2563EB] text-white text-xs font-bold hover:bg-blue-700 flex items-center gap-1.5"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Hitung &amp; Perbarui Peringkat</span>
              </button>
            </div>
          </div>

          {hasAnyTie && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-amber-900">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <span className="font-bold block">Terdapat Nilai Seri (Tie) pada Peringkat</span>
                  Anda dapat merilis soal Tie-Break pada tab Soal Pre-Test atau menentukan langsung siapa yang menjadi ketua pada langkah Penentuan Ketua Tim.
                </div>
              </div>
              {questions.some((q) => q.isTieBreak) && (
                <button
                  type="button"
                  onClick={() => {
                    const tb = questions.find((q) => q.isTieBreak);
                    if (tb) void releaseSinglePretestQuestion(pretest, tb);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold shrink-0"
                >
                  Rilis Soal Tie-Break Sekarang
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Progres Peserta Live */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="text-sm font-bold text-[#0E2142] mb-3">
                Kehadiran &amp; Progres Pengerjaan ({activeParticipants.length} Mahasiswa)
              </h3>
              {activeParticipants.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">
                  Menunggu mahasiswa masuk menggunakan kode {pretest.joinCode}.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                  {activeParticipants.map((p) => {
                    const answered = subCountByParticipant.get(p.participantId)?.size ?? 0;
                    const standardTotal =
                      questions.filter((q) => !q.isTieBreak).length || questions.length;
                    return (
                      <div key={p.participantId} className="py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#0E2142] truncate">
                            {p.displayName}
                          </div>
                          <div className="text-xs text-slate-500">
                            {p.isConnected ? 'Terhubung' : 'Terputus sementara'}
                          </div>
                        </div>
                        <div className="text-xs font-bold tabular-nums text-[#2563EB] shrink-0">
                          {answered} / {standardTotal} Dijawab
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Peringkat Privat Admin */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-[#0E2142]">
                  Nilai Pilihan Ganda &amp; Peringkat (Khusus Admin)
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('KETUA')}
                  className="text-xs font-bold text-[#2563EB] hover:underline flex items-center gap-1"
                >
                  <span>Lanjut ke Ketua Tim</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              {liveResults.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">
                  Nilai pilihan ganda mahasiswa akan tampil otomatis saat peserta masuk dan mulai menjawab.
                </p>
              ) : (
                <div className="overflow-x-auto max-h-[420px]">
                  <table className="w-full text-xs">
                    <thead className="text-left text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-2 pr-2">#</th>
                        <th className="py-2 pr-2">Mahasiswa</th>
                        <th className="py-2 pr-2 text-right">Benar</th>
                        <th className="py-2 pr-2 text-right">Skor</th>
                        <th className="py-2 text-right">%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {liveResults.map((r) => (
                        <tr key={r.participantId}>
                          <td className="py-2 pr-2 font-bold tabular-nums">
                            {r.rank}
                            {r.isTied && <span className="ml-1 text-amber-600">(Seri)</span>}
                          </td>
                          <td className="py-2 pr-2 font-semibold text-[#0E2142]">{r.displayName}</td>
                          <td className="py-2 pr-2 text-right tabular-nums">
                            {r.totalCorrect}/{r.totalQuestions}
                          </td>
                          <td className="py-2 pr-2 text-right font-bold tabular-nums">
                            {r.weightedScore}
                          </td>
                          <td className="py-2 text-right tabular-nums">{r.percentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PENENTUAN KETUA TIM */}
      {activeTab === 'KETUA' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-slate-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#0E2142] mb-1">
                    Jumlah Tim Kompetisi
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={12}
                    value={draftTeamCount}
                    onChange={(e) =>
                      setDraftTeamCount(Math.max(2, Math.min(12, Number(e.target.value) || 4)))
                    }
                    className="w-36 px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold tabular-nums"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => void handleRecomputeProposal()}
                    className="px-4 py-2.5 rounded-xl border border-[#2563EB] text-[#2563EB] text-xs font-bold hover:bg-blue-50 flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Usulkan Ketua Teratas Otomatis</span>
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void handleLockCaptainsAndAllocate()}
                disabled={activeParticipants.length === 0}
                className="px-5 py-3 rounded-xl bg-[#2563EB] text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-40 flex items-center gap-2"
              >
                <Lock className="w-4 h-4" />
                <span>Kunci Ketua &amp; Hitung Tim Seimbang</span>
              </button>
            </div>

            {draftCaptains.some((c) => c.isTiedAtCutoff) && (
              <div className="mt-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                Terdeteksi skor seri tepat di batas pemilihan ketua tim. Anda dapat mengganti ketua di bawah secara manual atau menjalankan soal Tie-Break terlebih dahulu.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
              {Array.from({ length: draftTeamCount }, (_, idx) => {
                const cap = draftCaptains[idx];
                return (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={draftTeamNames[idx] ?? `Kelompok ${String.fromCharCode(65 + idx)}`}
                        onChange={(e) =>
                          setDraftTeamNames((prev) =>
                            prev.map((v, i) => (i === idx ? e.target.value : v))
                          )
                        }
                        className="font-bold text-sm text-[#0E2142] bg-white px-3 py-1.5 rounded-lg border border-slate-300 w-44"
                      />
                      {cap && (
                        <span className="text-xs font-semibold text-slate-500 tabular-nums">
                          Peringkat #{cap.rank} · Skor {cap.score}
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Ketua Tim (Terkunci 1 Per Tim)
                      </label>
                      <select
                        value={cap?.participantId ?? ''}
                        onChange={(e) => handleCaptainReplace(idx, e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-[#0E2142]"
                      >
                        <option value="" disabled>
                          Pilih Ketua Tim...
                        </option>
                        {activeParticipants.map((p) => {
                          const r = results.find((res) => res.participantId === p.participantId);
                          return (
                            <option key={p.participantId} value={p.participantId}>
                              {p.displayName} {r ? `(Peringkat #${r.rank} · Skor ${pretest.useWeightedPoints ? r.weightedScore : r.totalCorrect})` : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SMART SPINNER & TIM SEIMBANG */}
      {activeTab === 'SPINNER' && (
        <div className="space-y-6">
          {!alloc ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4">
              <p className="text-sm text-slate-600">
                Susunan tim seimbang belum dihitung. Kunci ketua tim terlebih dahulu agar sistem membagi kandidat lainnya secara merata sebelum spinner diputar.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('KETUA')}
                className="px-4 py-2.5 rounded-xl bg-[#2563EB] text-white text-sm font-bold"
              >
                Buka Langkah Penentuan Ketua Tim
              </button>
            </div>
          ) : (
            <>
              {/* Spinner Stage & Controls */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 print:hidden">
                <div className="xl:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 flex flex-col items-center gap-5">
                  <SmartSpinnerWheel
                    allocation={alloc}
                    size={330}
                    muted={muted}
                    onToggleMute={() => setMuted((m) => !m)}
                  />

                  <div className="w-full max-w-md grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => void startNextSpinnerSpin(pretest)}
                      disabled={
                        alloc.spinnerStatus === 'SPINNING' ||
                        alloc.revealIndex >= alloc.revealQueue.length
                      }
                      className="col-span-2 py-3 px-4 rounded-xl bg-[#2563EB] text-white text-sm font-extrabold hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                      <Play className="w-4 h-4" />
                      <span>
                        {alloc.spinnerStatus === 'SPINNING'
                          ? 'Sedang Memutar...'
                          : alloc.revealIndex >= alloc.revealQueue.length
                          ? 'Semua Mahasiswa Sudah Terungkap'
                          : 'Putar Roda Berikutnya'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void completeCurrentSpinReveal(pretest)}
                      disabled={alloc.revealIndex >= alloc.revealQueue.length}
                      className="py-2.5 px-3 rounded-xl border border-slate-300 text-xs font-bold text-[#0E2142] hover:bg-slate-50 disabled:opacity-40 flex items-center justify-center gap-1.5"
                    >
                      <FastForward className="w-3.5 h-3.5" />
                      <span>Lewati Animasi</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void pauseSpinnerPresentation(pretest)}
                      disabled={alloc.spinnerStatus === 'COMPLETED'}
                      className="py-2.5 px-3 rounded-xl border border-slate-300 text-xs font-bold text-[#0E2142] hover:bg-slate-50 disabled:opacity-40 flex items-center justify-center gap-1.5"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      <span>Jeda Spinner</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void revealAllRemainingSpinner(pretest)}
                      disabled={alloc.spinnerStatus === 'COMPLETED'}
                      className="py-2.5 px-3 rounded-xl bg-[#0E2142] text-white text-xs font-bold hover:bg-[#16315E] disabled:opacity-40 flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Tampilkan Semua</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void resetSpinnerPresentation(pretest)}
                      className="py-2.5 px-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Ulangi Presentasi</span>
                    </button>
                  </div>
                </div>

                {/* Team Cards + Manual Swap */}
                <div className="xl:col-span-7 space-y-4">
                  <div className="bg-white rounded-2xl border border-slate-200 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <div>
                        <h2 className="text-base font-bold text-[#0E2142]">
                          Komposisi Tim Terbentuk
                        </h2>
                        <p className="text-xs text-slate-500">
                          Pindahkan anggota jika diperlukan; laporan keseimbangan otomatis diperbarui.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleLockCaptainsAndAllocate}
                          disabled={pretest.teamsLocked}
                          className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-[#0E2142] disabled:opacity-40"
                        >
                          Hitung Ulang Seimbang
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void updatePretestFields(pretestId, {
                              teamsLocked: !pretest.teamsLocked,
                              teamsPublished: true,
                            })
                          }
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                            pretest.teamsLocked
                              ? 'bg-emerald-600 text-white'
                              : 'bg-[#0E2142] text-white'
                          }`}
                        >
                          {pretest.teamsLocked ? (
                            <>
                              <Unlock className="w-3.5 h-3.5" />
                              <span>Tim Terkunci (Buka)</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3.5 h-3.5" />
                              <span>Kunci &amp; Publikasikan Tim Final</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {alloc.teams.map((team) => (
                        <div
                          key={team.teamId}
                          className="rounded-2xl border border-slate-200 p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-3.5 h-3.5 rounded-full shrink-0"
                                style={{ backgroundColor: team.color }}
                              />
                              <h3 className="text-sm font-extrabold text-[#0E2142]">{team.name}</h3>
                            </div>
                            <span className="text-xs font-semibold text-slate-500 tabular-nums">
                              {team.members.length} Anggota
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            {team.members.map((m) => {
                              const revealed = alloc.revealedParticipantIds.includes(
                                m.participantId
                              );
                              const score = summary?.memberScores?.[m.participantId] ?? 0;
                              return (
                                <div
                                  key={m.participantId}
                                  className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2"
                                >
                                  <div className="min-w-0 flex items-center gap-2">
                                    {m.isCaptain && (
                                      <Crown className="w-3.5 h-3.5 text-[#B7872D] shrink-0" />
                                    )}
                                    <span className="text-xs font-semibold text-[#0E2142] truncate">
                                      {m.displayName}
                                    </span>
                                    {!revealed && (
                                      <span className="text-[10px] text-slate-400">(Belum diputar)</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-[11px] font-bold text-slate-500 tabular-nums">
                                      {score}
                                    </span>
                                    {!m.isCaptain && !pretest.teamsLocked && summary && (
                                      <select
                                        value={team.teamId}
                                        onChange={(e) =>
                                          void moveStudentAndRecompute({
                                            pretest,
                                            summary,
                                            participantId: m.participantId,
                                            targetTeamId: e.target.value,
                                          })
                                        }
                                        className="text-[11px] border border-slate-300 rounded-lg px-1.5 py-1 bg-white"
                                        title="Pindahkan ke tim lain"
                                      >
                                        {alloc.teams.map((optTeam) => (
                                          <option key={optTeam.teamId} value={optTeam.teamId}>
                                            {optTeam.name}
                                          </option>
                                        ))}
                                      </select>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mt-5 pt-4 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={handleExportTeamsCsv}
                        className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-[#0E2142] hover:bg-slate-50 flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Ekspor CSV Daftar Tim</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-[#0E2142] hover:bg-slate-50 flex items-center gap-1.5"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Cetak Daftar Tim</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Private Admin Balance Report */}
              {balanceReport && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 print:hidden">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                      <h2 className="text-base font-bold text-[#0E2142]">
                        Laporan Keseimbangan Tim (Khusus Admin)
                      </h2>
                      <p className="text-xs text-slate-500">
                        Diagnostik ini bersifat privat dan tidak pernah ditampilkan kepada mahasiswa atau layar proyektor.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <ShieldCheck
                        className={`w-4 h-4 ${
                          balanceReport.invariantsVerified ? 'text-emerald-600' : 'text-amber-600'
                        }`}
                      />
                      <span
                        className={
                          balanceReport.invariantsVerified ? 'text-emerald-700' : 'text-amber-700'
                        }
                      >
                        {balanceReport.invariantsVerified
                          ? 'Semua Invarian Terpenuhi'
                          : 'Perlu Tinjauan Manual'}
                      </span>
                    </div>
                  </div>

                  {balanceReport.warnings.length > 0 && (
                    <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                      {balanceReport.warnings.map((w, i) => (
                        <div key={i}>• {w}</div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-[11px] font-semibold text-slate-500">Rata-Rata Global</div>
                      <div className="text-xl font-extrabold text-[#0E2142] tabular-nums">
                        {balanceReport.globalAvgScore}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-[11px] font-semibold text-slate-500">
                        Selisih Rata-Rata Maks
                      </div>
                      <div className="text-xl font-extrabold text-[#2563EB] tabular-nums">
                        {balanceReport.maxAvgDifference}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-[11px] font-semibold text-slate-500">Simpangan Baku</div>
                      <div className="text-xl font-extrabold text-[#0E2142] tabular-nums">
                        {balanceReport.scoreStdDev}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-[11px] font-semibold text-slate-500">
                        Selisih Ukuran Tim
                      </div>
                      <div className="text-xl font-extrabold text-[#0E2142] tabular-nums">
                        {balanceReport.maxSizeDifference}
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-left text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="py-2 pr-3">Tim</th>
                          <th className="py-2 pr-3">Ketua</th>
                          <th className="py-2 pr-3 text-right">Anggota</th>
                          <th className="py-2 pr-3 text-right">Total Skor</th>
                          <th className="py-2 pr-3 text-right">Rata-Rata</th>
                          <th className="py-2 pr-3 text-right">Min–Maks</th>
                          <th className="py-2 text-right">Pita Skor (T/M/D)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {balanceReport.teamStats.map((st) => (
                          <tr key={st.teamId}>
                            <td className="py-2.5 pr-3 font-bold text-[#0E2142]">{st.teamName}</td>
                            <td className="py-2.5 pr-3">{st.captainName}</td>
                            <td className="py-2.5 pr-3 text-right tabular-nums">{st.memberCount}</td>
                            <td className="py-2.5 pr-3 text-right tabular-nums">{st.totalScore}</td>
                            <td className="py-2.5 pr-3 text-right font-bold text-[#2563EB] tabular-nums">
                              {st.avgScore}
                            </td>
                            <td className="py-2.5 pr-3 text-right tabular-nums">
                              {st.minScore}–{st.maxScore}
                            </td>
                            <td className="py-2.5 text-right font-mono tabular-nums">
                              {st.bandCounts.join(' / ')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Handover ke Mode Game Utama */}
              <div className="bg-[#0E2142] text-white rounded-2xl p-6 print:hidden">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="space-y-1 max-w-xl">
                    <div className="text-xs font-bold uppercase tracking-wider text-[#F1C56C]">
                      Tahap Selanjutnya: Kompetisi Utama
                    </div>
                    <h2 className="text-lg font-extrabold">
                      Luncurkan Permainan dengan Tim Seimbang Ini
                    </h2>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Seluruh tim, ketua, dan mahasiswa yang sudah bergabung otomatis dipindahkan ke sesi kompetisi baru tanpa perlu memindai ulang kode QR.
                    </p>
                  </div>

                  {pretest.linkedSessionId ? (
                    <Link
                      to={`/admin/control/${pretest.linkedSessionId}`}
                      className="px-5 py-3.5 rounded-xl bg-[#F1C56C] text-[#0E2142] text-sm font-extrabold hover:bg-amber-300 flex items-center gap-2 shrink-0"
                    >
                      <span>Buka Konsol Sesi Kompetisi</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  ) : (
                    <form
                      onSubmit={handleLaunchMainGame}
                      className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 max-w-2xl"
                    >
                      <input
                        type="text"
                        required
                        value={launchTitle}
                        onChange={(e) => setLaunchTitle(e.target.value)}
                        placeholder="Judul Sesi Kompetisi"
                        className="px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-sm text-white placeholder:text-slate-400"
                      />
                      <select
                        value={launchMode}
                        onChange={(e) => setLaunchMode(e.target.value as GameMode)}
                        className="px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-sm text-white"
                      >
                        {(Object.keys(GAME_MODE_LABELS) as GameMode[]).map((mode) => (
                          <option key={mode} value={mode} className="text-[#0E2142]">
                            {GAME_MODE_LABELS[mode]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="px-4 py-2.5 rounded-xl bg-[#F1C56C] text-[#0E2142] text-sm font-extrabold hover:bg-amber-300 flex items-center justify-center gap-1.5"
                      >
                        <Award className="w-4 h-4" />
                        <span>Mulai Kompetisi</span>
                      </button>
                      <div className="sm:col-span-3 flex flex-wrap items-center gap-4 text-xs text-slate-300">
                        <label className="flex items-center gap-2">
                          <span>Mode Jawaban:</span>
                          <select
                            value={launchSubmissionMode}
                            onChange={(e) =>
                              setLaunchSubmissionMode(e.target.value as SubmissionMode)
                            }
                            className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/20 text-white"
                          >
                            <option value="CAPTAIN_ONLY" className="text-[#0E2142]">
                              Ketua Tim Saja
                            </option>
                            <option value="INDIVIDUAL" className="text-[#0E2142]">
                              Semua Anggota (Individu)
                            </option>
                            <option value="TEAM_CONSENSUS" className="text-[#0E2142]">
                              Konsensus Tim
                            </option>
                          </select>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={launchRequireApproval}
                            onChange={(e) => setLaunchRequireApproval(e.target.checked)}
                          />
                          <span>Wajib persetujuan untuk peserta susulan</span>
                        </label>
                      </div>
                    </form>
                  )}
                </div>
              </div>

              {/* Clean Print Roster */}
              <div className="hidden print:block p-6">
                <h1 className="text-xl font-bold mb-1">Daftar Pembagian Tim — {pretest.title}</h1>
                <p className="text-xs text-slate-600 mb-6">Kode Sesi: {pretest.joinCode}</p>
                <div className="grid grid-cols-2 gap-6">
                  {alloc.teams.map((team) => (
                    <div key={team.teamId} className="border border-slate-300 rounded-xl p-4">
                      <h2 className="font-bold text-base mb-2">{team.name}</h2>
                      <ol className="list-decimal list-inside text-sm space-y-1">
                        {team.members.map((m) => (
                          <li key={m.participantId}>
                            {m.displayName} {m.isCaptain ? '(Ketua Tim)' : ''}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </AdminLayout>
  );
};

const BankQuestionPicker: React.FC<{
  questions: QuestionPrivate[];
  onImport: (ids: string[]) => void;
  onClose: () => void;
}> = ({ questions, onImport, onClose }) => {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="mb-4 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
      <div className="text-xs font-bold text-[#0E2142]">
        Pilih Soal Pilihan Ganda dari Bank Soal Mata Kuliah
      </div>
      <div className="max-h-48 overflow-y-auto space-y-1.5">
        {questions.map((q) => (
          <label
            key={q.questionId}
            className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer p-1.5 rounded-lg hover:bg-white"
          >
            <input
              type="checkbox"
              checked={selected.includes(q.questionId)}
              onChange={() => toggle(q.questionId)}
              className="mt-0.5"
            />
            <span className="line-clamp-2">{q.questionText}</span>
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold"
        >
          Tutup
        </button>
        <button
          type="button"
          onClick={() => onImport(selected)}
          disabled={selected.length === 0}
          className="px-3 py-1.5 rounded-lg bg-[#2563EB] text-white text-xs font-bold disabled:opacity-40"
        >
          Salin ({selected.length})
        </button>
      </div>
    </div>
  );
};
