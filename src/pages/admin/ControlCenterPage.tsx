import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import {
  ArrowRightLeft,
  Award,
  BarChart2,
  Bell,
  BellOff,
  CheckCircle2,
  ChevronRight,
  Edit3,
  ExternalLink,
  Eye,
  Flag,
  Lock,
  Monitor,
  Pause,
  Play,
  QrCode,
  RotateCcw,
  Send,
  Undo2,
  Unlock,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { AdminLayout } from '../../layouts/AdminLayout';
import { useAuth } from '../../context/AuthContext';
import { ArabicText } from '../../components/ArabicText';
import { DisconnectedBanner, EmptyState, LoadingState } from '../../components/StatusViews';
import { db, handleFirestoreError } from '../../lib/firebase';
import { formatSeconds, syncServerTime, useServerCountdown } from '../../lib/serverTime';
import {
  applyScoreTransaction,
  getQuestionRoundKey,
  lockBuzzerAndSyncWinner,
  markBoardTileCompleted,
  openBuzzer,
  openQuestionOnStage,
  passQuestionToTeam,
  pauseSessionTimer,
  publishAnonymousResponseToProjector,
  rejectAndReopenBuzzer,
  resetSessionTimer,
  revealAnswerOrExplanation,
  startSessionTimer,
  undoLastScoreEvent,
  updateParticipantStatus,
  updateSessionFields,
} from '../../services/firestoreService';
import {
  DEFAULT_SCORING_CONFIG,
  OperationType,
  type BuzzerClaim,
  type CerdasCermatRound,
  type Participant,
  type QuestionPrivate,
  type QuestionStats,
  type RubricScores,
  type RubricWeights,
  type ScoreEvent,
  type Session,
  type Submission,
  type Team,
} from '../../types/arena';

export const ControlCenterPage: React.FC = () => {
  const { id: sessionId = '' } = useParams<{ id: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [questions, setQuestions] = useState<QuestionPrivate[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [scoreEvents, setScoreEvents] = useState<ScoreEvent[]>([]);
  const [activeClaim, setActiveClaim] = useState<BuzzerClaim | null>(null);

  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [showQrModal, setShowQrModal] = useState(false);

  // Question selection & round controls
  const [selectedQuestionId, setSelectedQuestionId] = useState('');
  const [selectedTileKey, setSelectedTileKey] = useState<string | null>(null);
  const [passTargetTeamId, setPassTargetTeamId] = useState('');

  // Manual point editor
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [manualDelta, setManualDelta] = useState(100);
  const [manualReason, setManualReason] = useState('Penyesuaian poin admin');

  // Partial grade modal
  const [partialSub, setPartialSub] = useState<Submission | null>(null);
  const [partialPoints, setPartialPoints] = useState(50);
  const [partialFeedback, setPartialFeedback] = useState('');

  // Rubric grading modal for Tantangan Analisis
  const [rubricSub, setRubricSub] = useState<Submission | null>(null);
  const [rubricWeights, setRubricWeights] = useState<RubricWeights>(
    DEFAULT_SCORING_CONFIG.rubricWeights
  );
  const [rubricScores, setRubricScores] = useState<RubricScores>({
    contentAccuracy: 80,
    reasoning: 80,
    sources: 80,
    clarity: 80,
  });
  const [rubricFeedback, setRubricFeedback] = useState('');

  // Confirmation modal before projecting student's full written response
  const [projectorConfirmSub, setProjectorConfirmSub] = useState<Submission | null>(null);
  const [anonymousLabelInput, setAnonymousLabelInput] = useState('Respons Anonim');

  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    void syncServerTime();
    const onUp = () => setIsOnline(true);
    const onDown = () => setIsOnline(false);
    window.addEventListener('online', onUp);
    window.addEventListener('offline', onDown);
    return () => {
      window.removeEventListener('online', onUp);
      window.removeEventListener('offline', onDown);
    };
  }, []);

  const { user, isLecturer, authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !user || !isLecturer || !sessionId) return;

    const unsubSession = onSnapshot(
      doc(db, 'sessions', sessionId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Session;
          setSession(data);
          if (data.scoringConfig?.rubricWeights) {
            setRubricWeights(data.scoringConfig.rubricWeights);
          }
        } else {
          setSession(null);
        }
        setLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.GET, `sessions/${sessionId}`)
    );

    const unsubTeams = onSnapshot(
      query(collection(db, 'sessions', sessionId, 'teams'), orderBy('orderIndex', 'asc')),
      (snap) => setTeams(snap.docs.map((d) => d.data() as Team)),
      (err) => handleFirestoreError(err, OperationType.LIST, `sessions/${sessionId}/teams`)
    );

    const unsubParts = onSnapshot(
      collection(db, 'sessions', sessionId, 'participants'),
      (snap) => setParticipants(snap.docs.map((d) => d.data() as Participant)),
      (err) => handleFirestoreError(err, OperationType.LIST, `sessions/${sessionId}/participants`)
    );

    const unsubQuestions = onSnapshot(
      collection(db, 'questions_private'),
      (snap) =>
        setQuestions(
          snap.docs
            .map((d) => d.data() as QuestionPrivate)
            .filter((q) => q.isActive)
        ),
      (err) => handleFirestoreError(err, OperationType.LIST, 'questions_private')
    );

    const unsubSubs = onSnapshot(
      collection(db, 'sessions', sessionId, 'submissions'),
      (snap) => setSubmissions(snap.docs.map((d) => d.data() as Submission)),
      (err) => handleFirestoreError(err, OperationType.LIST, `sessions/${sessionId}/submissions`)
    );

    const unsubScoreEvents = onSnapshot(
      query(collection(db, 'sessions', sessionId, 'score_events'), orderBy('createdAt', 'desc')),
      (snap) => setScoreEvents(snap.docs.map((d) => d.data() as ScoreEvent)),
      (err) => handleFirestoreError(err, OperationType.LIST, `sessions/${sessionId}/score_events`)
    );

    return () => {
      unsubSession();
      unsubTeams();
      unsubParts();
      unsubQuestions();
      unsubSubs();
      unsubScoreEvents();
    };
  }, [authLoading, user, isLecturer, sessionId]);

  // Listen to atomic buzzer_claim for the current question & attempt
  useEffect(() => {
    if (!session || !session.activeQuestionId) {
      setActiveClaim(null);
      return;
    }
    const claimId = `${session.activeQuestionId}_a${session.buzzerAttempt}`;
    const unsub = onSnapshot(
      doc(db, 'sessions', session.sessionId, 'buzzer_claims', claimId),
      (snap) => {
        if (snap.exists()) {
          const claim = snap.data() as BuzzerClaim;
          setActiveClaim(claim);
          // Automatically lock buzzer and assign winner if buzzer was open
          if (session.buzzerOpen && session.buzzerWinnerTeamId !== claim.teamId) {
            void lockBuzzerAndSyncWinner(session, claim);
          }
        } else {
          setActiveClaim(null);
        }
      },
      (err) =>
        handleFirestoreError(
          err,
          OperationType.GET,
          `sessions/${session.sessionId}/buzzer_claims/${claimId}`
        )
    );
    return () => unsub();
  }, [session]);

  const secondsLeft = useServerCountdown(
    Boolean(session?.timerRunning),
    session?.timerEndTimeMs,
    session?.timerRemainingSec
  );

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3500);
  };

  const activeQuestion = useMemo(
    () => questions.find((q) => q.questionId === session?.activeQuestionId) ?? null,
    [questions, session?.activeQuestionId]
  );

  const modeFilteredQuestions = useMemo(() => {
    if (!session) return questions;
    return questions.filter((q) => q.enabledModes.includes(session.gameMode));
  }, [questions, session]);

  const currentRoundKey = useMemo(() => {
    if (!session || !session.activeQuestionId) return '';
    return getQuestionRoundKey(session, session.activeQuestionId);
  }, [session]);

  const activeSubmissions = useMemo(() => {
    if (!currentRoundKey) return [];
    return submissions.filter((s) => s.questionRoundKey === currentRoundKey);
  }, [submissions, currentRoundKey]);

  const approvedParticipants = useMemo(
    () => participants.filter((p) => p.status === 'APPROVED'),
    [participants]
  );

  const pendingParticipants = useMemo(
    () => participants.filter((p) => p.status === 'PENDING'),
    [participants]
  );

  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => b.score - a.score),
    [teams]
  );

  const scoring = session?.scoringConfig ?? DEFAULT_SCORING_CONFIG;

  const computeQuickPoints = (isCorrect: boolean): number => {
    if (!session) return 0;
    if (session.gameMode === 'CERDAS_CERMAT') {
      const round = session.cerdasCermatRound ?? 'WAJIB';
      if (round === 'WAJIB') return isCorrect ? scoring.wajibCorrect : scoring.wajibWrong;
      if (round === 'LEMPARAN') return isCorrect ? scoring.lemparanCorrect : scoring.lemparanWrong;
      return isCorrect ? scoring.rebutanCorrect : scoring.rebutanWrong;
    }
    if (session.gameMode === 'PAPAN_TANTANGAN') {
      const tile = selectedTileKey ? session.boardConfig?.tiles[selectedTileKey] : null;
      const pts = tile?.points ?? activeQuestion?.points ?? 100;
      return isCorrect ? pts : 0;
    }
    return isCorrect ? activeQuestion?.points ?? 100 : 0;
  };

  const handleOpenSelectedQuestion = async (qId?: string, tileKey?: string) => {
    if (!session) return;
    const targetId = qId || selectedQuestionId;
    const q = questions.find((item) => item.questionId === targetId);
    if (!q) {
      showToast('Pilih soal terlebih dahulu.');
      return;
    }
    if (tileKey) setSelectedTileKey(tileKey);

    const round = session.cerdasCermatRound ?? 'WAJIB';
    const needsAuthTeam =
      session.gameMode === 'CERDAS_CERMAT' && (round === 'WAJIB' || round === 'LEMPARAN');
    const authTeam = needsAuthTeam
      ? session.activeTeamId ?? teams[0]?.teamId ?? null
      : session.gameMode === 'PAPAN_TANTANGAN'
      ? session.activeTeamId ?? teams[0]?.teamId ?? null
      : null;

    await openQuestionOnStage(session, q, {
      authorizedTeamId: authTeam,
      round,
      autoOpenSubmissions: round !== 'REBUTAN',
      autoStartTimer: false,
    });
    showToast('Soal ditampilkan di proyektor dan perangkat mahasiswa.');
  };

  const handleNextQuestion = async () => {
    if (!session || modeFilteredQuestions.length === 0) return;
    const currentIdx = modeFilteredQuestions.findIndex(
      (q) => q.questionId === session.activeQuestionId
    );
    const nextQ = modeFilteredQuestions[(currentIdx + 1) % modeFilteredQuestions.length];
    setSelectedQuestionId(nextQ.questionId);
    await handleOpenSelectedQuestion(nextQ.questionId);
  };

  const handleReleaseStats = async () => {
    if (!session || !activeQuestion) return;
    const optionCounts: Record<string, number> = {};
    (activeQuestion.options ?? []).forEach((opt) => {
      optionCounts[opt] = 0;
    });
    activeSubmissions.forEach((s) => {
      const key = s.selectedOption || s.answerText || 'Lainnya';
      optionCounts[key] = (optionCounts[key] ?? 0) + 1;
    });
    const stats: QuestionStats = {
      totalSubmissions: activeSubmissions.length,
      optionCounts,
    };
    await revealAnswerOrExplanation(session.sessionId, activeQuestion, { stats });
    showToast('Statistik jawaban dirilis ke layar proyektor.');
  };

  const handleQuickGrade = async (sub: Submission, isCorrect: boolean) => {
    if (!session) return;
    const pts = computeQuickPoints(isCorrect);
    await applyScoreTransaction({
      sessionId: session.sessionId,
      teamId: sub.teamId,
      delta: pts,
      reason: isCorrect
        ? `Jawaban Benar (${session.gameMode})`
        : `Jawaban Salah (${session.gameMode})`,
      type: pts >= 0 ? 'AWARD' : 'PENALTY',
      questionId: sub.questionId,
      submissionId: sub.submissionId,
      isCorrect,
      lecturerFeedback: isCorrect ? 'Jawaban tepat.' : 'Jawaban kurang tepat.',
    });
    if (session.gameMode === 'PAPAN_TANTANGAN' && selectedTileKey && isCorrect) {
      await markBoardTileCompleted(session, selectedTileKey, sub.teamId, sub.teamName);
    }
    showToast(`${sub.teamName} dinilai (${pts >= 0 ? `+${pts}` : pts} poin).`);
  };

  const handleSubmitPartial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !partialSub) return;
    await applyScoreTransaction({
      sessionId: session.sessionId,
      teamId: partialSub.teamId,
      delta: partialPoints,
      reason: 'Nilai Parsial Admin',
      type: 'AWARD',
      questionId: partialSub.questionId,
      submissionId: partialSub.submissionId,
      isCorrect: partialPoints > 0,
      lecturerFeedback: partialFeedback,
    });
    setPartialSub(null);
    showToast(`Nilai parsial (${partialPoints} poin) disimpan.`);
  };

  const computedRubricWeightedPercent = useMemo(() => {
    const totalWeight =
      rubricWeights.contentAccuracy +
      rubricWeights.reasoning +
      rubricWeights.sources +
      rubricWeights.clarity;
    if (totalWeight <= 0) return 0;
    const weightedSum =
      rubricScores.contentAccuracy * rubricWeights.contentAccuracy +
      rubricScores.reasoning * rubricWeights.reasoning +
      rubricScores.sources * rubricWeights.sources +
      rubricScores.clarity * rubricWeights.clarity;
    return Math.round((weightedSum / totalWeight) * 100) / 100;
  }, [rubricScores, rubricWeights]);

  const computedRubricPoints = useMemo(() => {
    const maxPts = activeQuestion?.points ?? 500;
    return Math.round((computedRubricWeightedPercent / 100) * maxPts);
  }, [computedRubricWeightedPercent, activeQuestion?.points]);

  const handleSubmitRubricGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !rubricSub) return;
    await updateSessionFields(session.sessionId, {
      scoringConfig: {
        ...scoring,
        rubricWeights,
      },
    });
    await applyScoreTransaction({
      sessionId: session.sessionId,
      teamId: rubricSub.teamId,
      delta: computedRubricPoints,
      reason: `Penilaian Rubrik (${computedRubricWeightedPercent}%)`,
      type: 'RUBRIC_GRADE',
      questionId: rubricSub.questionId,
      submissionId: rubricSub.submissionId,
      isCorrect: computedRubricPoints > 0,
      rubricScores: {
        ...rubricScores,
        weightedPercent: computedRubricWeightedPercent,
      },
      lecturerFeedback: rubricFeedback,
    });
    setRubricSub(null);
    showToast(`Nilai rubrik ${computedRubricPoints} poin berhasil diterapkan.`);
  };

  const handleConfirmPublishToProjector = async () => {
    if (!session || !projectorConfirmSub) return;
    await publishAnonymousResponseToProjector(
      session.sessionId,
      projectorConfirmSub,
      anonymousLabelInput.trim() || 'Respons Anonim'
    );
    setProjectorConfirmSub(null);
    showToast('Respons anonim ditampilkan ke proyektor.');
  };

  const handleManualScoreSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !editingTeam) return;
    await applyScoreTransaction({
      sessionId: session.sessionId,
      teamId: editingTeam.teamId,
      delta: manualDelta,
      reason: manualReason,
      type: 'MANUAL_ADJUST',
      questionId: session.activeQuestionId ?? null,
    });
    setEditingTeam(null);
    showToast(`Skor ${editingTeam.name} disesuaikan (${manualDelta >= 0 ? `+${manualDelta}` : manualDelta}).`);
  };

  const handleUndoLast = async () => {
    if (!session) return;
    const ok = await undoLastScoreEvent(session.sessionId);
    showToast(ok ? 'Operasi penilaian terakhir dibatalkan.' : 'Tidak ada penilaian untuk dibatalkan.');
  };

  const joinUrl = session ? `${window.location.origin}/join?code=${session.joinCode}` : '';

  return (
    <AdminLayout
      title={session ? `Konsol Kendali: ${session.title}` : 'Konsol Kendali Admin'}
      subtitle={session ? `Kode Gabung: ${session.joinCode} · Mode: ${session.gameMode}` : undefined}
    >
      {loading ? (
        <LoadingState label="Menghubungkan ke sesi langsung..." />
      ) : !session ? (
        <EmptyState
          title="Sesi Tidak Ditemukan"
          description="Sesi yang diminta tidak tersedia atau telah dihapus."
        />
      ) : (
        <div className="space-y-5">
          {!isOnline && <DisconnectedBanner onRetry={() => void syncServerTime()} />}

          {toast && (
            <div className="bg-[#0E2142] text-white rounded-xl px-4 py-3 text-sm font-medium flex items-center justify-between">
              <span>{toast}</span>
              <button onClick={() => setToast(null)} className="text-slate-300 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Top Live Status & Lifecycle Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm">
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Status Sesi:</span>
                <span className="font-bold text-[#0E2142]">{session.status}</span>
              </div>
              <span aria-hidden="true" className="text-slate-300">|</span>
              <div className="flex items-center gap-1.5 tabular-nums">
                <Users className="w-4 h-4 text-[#2563EB]" />
                <span className="font-bold text-[#0E2142]">{approvedParticipants.length}</span>
                <span className="text-slate-500">mahasiswa terhubung</span>
              </div>
              <span aria-hidden="true" className="text-slate-300">|</span>
              <button
                onClick={() => setShowQrModal(true)}
                className="flex items-center gap-1.5 font-mono font-bold text-[#0E2142] hover:text-[#2563EB] tabular-nums"
              >
                <QrCode className="w-4 h-4" />
                Kode {session.joinCode}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {session.status === 'DRAFT' && (
                <button
                  onClick={() => void updateSessionFields(session.sessionId, { status: 'LOBBY' })}
                  className="px-3.5 py-2 rounded-xl bg-[#2563EB] text-white text-xs font-semibold"
                >
                  Buka Lobi
                </button>
              )}
              {(session.status === 'LOBBY' || session.status === 'PAUSED') && (
                <button
                  onClick={() => void updateSessionFields(session.sessionId, { status: 'ACTIVE' })}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" />
                  {session.status === 'PAUSED' ? 'Lanjutkan Sesi' : 'Mulai Sesi'}
                </button>
              )}
              {session.status === 'ACTIVE' && (
                <button
                  onClick={() =>
                    void updateSessionFields(session.sessionId, {
                      status: 'PAUSED',
                      timerRunning: false,
                      timerRemainingSec: secondsLeft,
                    })
                  }
                  className="px-3.5 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Pause className="w-3.5 h-3.5" />
                  Jeda Sesi
                </button>
              )}
              {session.status !== 'FINISHED' && (
                <button
                  onClick={() =>
                    void updateSessionFields(session.sessionId, {
                      status: 'FINISHED',
                      timerRunning: false,
                      submissionsOpen: false,
                      buzzerOpen: false,
                    })
                  }
                  className="px-3.5 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Flag className="w-3.5 h-3.5" />
                  Akhiri Sesi
                </button>
              )}
              <a
                href={`/present/${session.sessionId}`}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 rounded-xl bg-[#0E2142] text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Monitor className="w-3.5 h-3.5" />
                Buka Proyektor
                <ExternalLink className="w-3 h-3" />
              </a>
              <Link
                to={`/results/${session.sessionId}`}
                className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold"
              >
                Laporan
              </Link>
            </div>
          </div>

          {/* Pending Approvals Quick Bar */}
          {pendingParticipants.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-bold text-amber-950">
                {pendingParticipants.length} mahasiswa menunggu persetujuan masuk:
              </div>
              <div className="flex flex-wrap gap-2">
                {pendingParticipants.map((p) => (
                  <div
                    key={p.participantId}
                    className="bg-white border border-amber-200 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs"
                  >
                    <span className="font-semibold text-[#0E2142]">{p.displayName}</span>
                    <button
                      onClick={() =>
                        void updateParticipantStatus(session.sessionId, p.participantId, 'APPROVED')
                      }
                      className="text-emerald-700 font-bold hover:underline"
                    >
                      Terima
                    </button>
                    <button
                      onClick={() =>
                        void updateParticipantStatus(session.sessionId, p.participantId, 'REJECTED')
                      }
                      className="text-rose-700 font-bold hover:underline"
                    >
                      Tolak
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main 3-Column Console */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            {/* Left/Center: Stage & Game Mode Controls */}
            <div className="xl:col-span-8 space-y-5">
              {/* Mode-Specific Question / Board Picker */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                {session.gameMode === 'CERDAS_CERMAT' && (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <div className="text-xs font-bold text-[#0E2142]">Babak Cerdas Cermat</div>
                      <div className="text-xs text-slate-500">
                        Pilih babak Wajib, Lemparan, atau Rebutan (Buzzer)
                      </div>
                    </div>
                    <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                      {(['WAJIB', 'LEMPARAN', 'REBUTAN'] as CerdasCermatRound[]).map((r) => (
                        <button
                          key={r}
                          onClick={() =>
                            void updateSessionFields(session.sessionId, {
                              cerdasCermatRound: r,
                              authorizedTeamId:
                                r === 'REBUTAN' ? null : session.activeTeamId ?? teams[0]?.teamId ?? null,
                              buzzerOpen: false,
                            })
                          }
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                            session.cerdasCermatRound === r
                              ? 'bg-[#0E2142] text-white'
                              : 'text-slate-600 hover:text-[#0E2142]'
                          }`}
                        >
                          {r === 'WAJIB'
                            ? 'Babak 1: Wajib'
                            : r === 'LEMPARAN'
                            ? 'Babak 2: Lemparan'
                            : 'Babak 3: Rebutan'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {session.gameMode === 'PAPAN_TANTANGAN' && session.boardConfig ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm font-bold text-[#0E2142]">
                        Papan Tantangan (Klik Kotak untuk Membuka Soal)
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Giliran Tim:</span>
                        <select
                          value={session.activeTeamId ?? ''}
                          onChange={(e) =>
                            void updateSessionFields(session.sessionId, {
                              activeTeamId: e.target.value || null,
                              authorizedTeamId: e.target.value || null,
                            })
                          }
                          className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
                        >
                          <option value="">-- Pilih Tim Aktif --</option>
                          {teams.map((t) => (
                            <option key={t.teamId} value={t.teamId}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <div
                        className="grid gap-2 min-w-[540px]"
                        style={{
                          gridTemplateColumns: `repeat(${session.boardConfig.categories.length}, minmax(0, 1fr))`,
                        }}
                      >
                        {session.boardConfig.categories.map((cat, cIdx) => (
                          <div
                            key={cIdx}
                            className="p-2.5 rounded-xl bg-[#0E2142] text-[#F1C56C] text-xs font-bold text-center truncate"
                          >
                            {cat}
                          </div>
                        ))}
                        {session.boardConfig.pointLevels.map((pts, rIdx) =>
                          session.boardConfig!.categories.map((_, cIdx) => {
                            const key = `${cIdx}_${rIdx}`;
                            const tile = session.boardConfig!.tiles[key];
                            const isDone = tile?.completed;
                            const hasQ = Boolean(tile?.questionId);
                            const isSelected = selectedTileKey === key;
                            return (
                              <button
                                key={key}
                                disabled={isDone || !hasQ}
                                onClick={() =>
                                  tile?.questionId &&
                                  void handleOpenSelectedQuestion(tile.questionId, key)
                                }
                                className={`py-3 px-2 rounded-xl font-mono font-bold text-sm tabular-nums border transition-colors ${
                                  isDone
                                    ? 'bg-slate-100 text-slate-400 border-slate-200 line-through cursor-not-allowed'
                                    : !hasQ
                                    ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                                    : isSelected
                                    ? 'bg-[#2563EB] text-white border-[#2563EB]'
                                    : 'bg-[#13294E] text-[#F1C56C] border-[#0E2142] hover:bg-[#1E3B6E]'
                                }`}
                              >
                                {isDone ? 'Selesai' : hasQ ? pts : 'Kosong'}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {selectedTileKey && !session.boardConfig.tiles[selectedTileKey]?.completed && (
                      <div className="flex justify-end">
                        <button
                          onClick={() =>
                            void markBoardTileCompleted(
                              session,
                              selectedTileKey,
                              session.activeTeamId,
                              teams.find((t) => t.teamId === session.activeTeamId)?.name
                            )
                          }
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold"
                        >
                          Tandai Kotak Saat Ini Selesai &amp; Kunci
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Pilih Soal dari Bank Soal ({modeFilteredQuestions.length} tersedia)
                        </label>
                        <select
                          value={selectedQuestionId}
                          onChange={(e) => setSelectedQuestionId(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                        >
                          <option value="">-- Pilih Pertanyaan --</option>
                          {modeFilteredQuestions.map((q) => (
                            <option key={q.questionId} value={q.questionId}>
                              [{q.topicName} · {q.points}p] {q.questionText.slice(0, 80)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Tim Pemegang Giliran
                        </label>
                        <select
                          value={session.activeTeamId ?? ''}
                          onChange={(e) =>
                            void updateSessionFields(session.sessionId, {
                              activeTeamId: e.target.value || null,
                              authorizedTeamId:
                                session.cerdasCermatRound === 'REBUTAN'
                                  ? session.authorizedTeamId
                                  : e.target.value || null,
                            })
                          }
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                        >
                          <option value="">Semua Tim / Bebas</option>
                          {teams.map((t) => (
                            <option key={t.teamId} value={t.teamId}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        onClick={() => void handleOpenSelectedQuestion()}
                        className="px-4 py-2.5 rounded-xl bg-[#2563EB] text-white text-sm font-semibold hover:bg-blue-700 flex items-center gap-2"
                      >
                        <Send className="w-4 h-4" />
                        Tampilkan Soal ke Proyektor &amp; HP
                      </button>

                      <button
                        onClick={() => void handleNextQuestion()}
                        className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 flex items-center gap-1.5"
                      >
                        Soal Berikutnya
                        <ChevronRight className="w-4 h-4" />
                      </button>

                      {session.gameMode === 'CERDAS_CERMAT' && (
                        <div className="flex items-center gap-1.5 ml-auto">
                          <select
                            value={passTargetTeamId}
                            onChange={(e) => setPassTargetTeamId(e.target.value)}
                            className="px-2.5 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                          >
                            <option value="">Lempar ke tim...</option>
                            {teams.map((t) => (
                              <option key={t.teamId} value={t.teamId}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                          <button
                            disabled={!passTargetTeamId}
                            onClick={() => {
                              if (passTargetTeamId) {
                                void passQuestionToTeam(session.sessionId, passTargetTeamId);
                                showToast('Soal dilempar ke tim penerima.');
                              }
                            }}
                            className="px-3 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold disabled:opacity-40 flex items-center gap-1"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                            Lempar Soal
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Active Stage Monitor: Question + Timer + Buzzer + Reveal Controls */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <div className="text-xs font-semibold text-slate-500">
                      Soal Aktif di Panggung
                    </div>
                    <div className="text-sm font-bold text-[#0E2142]">
                      {activeQuestion
                        ? `${activeQuestion.topicName} · ${activeQuestion.points} Poin`
                        : 'Belum ada soal dibuka'}
                    </div>
                  </div>

                  {/* Timer Bar */}
                  <div className="flex items-center gap-2">
                    <div className="px-4 py-2 rounded-xl bg-[#0E2142] text-[#F1C56C] font-mono text-xl font-bold tabular-nums">
                      {formatSeconds(secondsLeft)}
                    </div>
                    {!session.timerRunning ? (
                      <button
                        onClick={() =>
                          void startSessionTimer(
                            session,
                            secondsLeft > 0 ? secondsLeft : activeQuestion?.timeLimitSec ?? 30
                          )
                        }
                        className="p-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                        title="Mulai Timer"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => void pauseSessionTimer(session, secondsLeft)}
                        className="p-2.5 rounded-xl bg-amber-600 text-white hover:bg-amber-700"
                        title="Jeda Timer"
                      >
                        <Pause className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() =>
                        void resetSessionTimer(session, activeQuestion?.timeLimitSec ?? 30)
                      }
                      className="p-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50"
                      title="Reset Timer"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {activeQuestion ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="text-base font-bold text-[#0E2142] leading-relaxed">
                        <ArabicText text={activeQuestion.questionText} />
                      </div>
                      <div className="text-xs text-emerald-800 font-semibold pt-2 border-t border-slate-200">
                        Kunci Jawaban Admin (Privat): <ArabicText text={activeQuestion.correctAnswer} />
                      </div>
                    </div>

                    {/* Buzzer & Submission Toggles */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        onClick={() =>
                          void updateSessionFields(session.sessionId, {
                            submissionsOpen: !session.submissionsOpen,
                          })
                        }
                        className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border ${
                          session.submissionsOpen
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {session.submissionsOpen ? (
                          <Unlock className="w-3.5 h-3.5" />
                        ) : (
                          <Lock className="w-3.5 h-3.5" />
                        )}
                        {session.submissionsOpen ? 'Jawaban Terbuka (Klik untuk Tutup)' : 'Jawaban Ditutup (Klik untuk Buka)'}
                      </button>

                      {session.gameMode === 'CERDAS_CERMAT' && (
                        <>
                          {!session.buzzerOpen ? (
                            <button
                              onClick={() => void openBuzzer(session)}
                              className="px-3.5 py-2 rounded-xl bg-[#F1C56C] text-[#0E2142] text-xs font-bold flex items-center gap-1.5"
                            >
                              <Bell className="w-3.5 h-3.5" />
                              Buka Buzzer Rebutan
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                void updateSessionFields(session.sessionId, { buzzerOpen: false })
                              }
                              className="px-3.5 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold flex items-center gap-1.5"
                            >
                              <BellOff className="w-3.5 h-3.5" />
                              Kunci Buzzer
                            </button>
                          )}

                          {(session.buzzerWinnerTeamId || activeClaim) && (
                            <button
                              onClick={() => void rejectAndReopenBuzzer(session)}
                              className="px-3.5 py-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-xs font-semibold"
                            >
                              Tolak &amp; Buka Ulang Buzzer
                            </button>
                          )}
                        </>
                      )}

                      <select
                        value={session.submissionMode}
                        onChange={(e) =>
                          void updateSessionFields(session.sessionId, {
                            submissionMode: e.target.value as Session['submissionMode'],
                          })
                        }
                        className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
                      >
                        <option value="CAPTAIN_ONLY">Pengirim: Ketua Tim</option>
                        <option value="TEAM_CONSENSUS">Pengirim: Konsensus Tim</option>
                        <option value="INDIVIDUAL">Pengirim: Individu</option>
                      </select>
                    </div>

                    {/* Buzzer Winner Banner */}
                    {(session.buzzerWinnerTeamName || activeClaim) && (
                      <div className="p-4 rounded-xl bg-[#0E2142] text-white flex items-center justify-between gap-4">
                        <div>
                          <div className="text-xs text-[#F1C56C] font-semibold">
                            Pemenang Buzzer Terverifikasi Server
                          </div>
                          <div className="text-lg font-bold">
                            {session.buzzerWinnerTeamName || activeClaim?.teamName} —{' '}
                            {session.buzzerWinnerParticipantName || activeClaim?.participantName}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              const tId = session.buzzerWinnerTeamId || activeClaim?.teamId;
                              if (tId && activeQuestion) {
                                void applyScoreTransaction({
                                  sessionId: session.sessionId,
                                  teamId: tId,
                                  delta: scoring.rebutanCorrect,
                                  reason: 'Buzzer Rebutan Benar',
                                  type: 'AWARD',
                                  questionId: activeQuestion.questionId,
                                });
                              }
                            }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold"
                          >
                            Benar (+{scoring.rebutanCorrect})
                          </button>
                          <button
                            onClick={() => {
                              const tId = session.buzzerWinnerTeamId || activeClaim?.teamId;
                              if (tId && activeQuestion) {
                                void applyScoreTransaction({
                                  sessionId: session.sessionId,
                                  teamId: tId,
                                  delta: scoring.rebutanWrong,
                                  reason: 'Buzzer Rebutan Salah',
                                  type: 'PENALTY',
                                  questionId: activeQuestion.questionId,
                                });
                              }
                            }}
                            className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold"
                          >
                            Salah ({scoring.rebutanWrong})
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Reveal Controls */}
                    <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2.5">
                      <button
                        onClick={() => void handleReleaseStats()}
                        className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5"
                      >
                        <BarChart2 className="w-3.5 h-3.5" />
                        {session.statsReleased ? 'Perbarui Statistik di Proyektor' : 'Rilis Statistik Jawaban'}
                      </button>

                      <button
                        onClick={() =>
                          void revealAnswerOrExplanation(session.sessionId, activeQuestion, {
                            revealAnswer: true,
                          })
                        }
                        className="px-3.5 py-2 rounded-xl bg-[#0E2142] text-white text-xs font-semibold flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {session.answerRevealed ? 'Jawaban Sudah Dibuka' : 'Tampilkan Jawaban Benar'}
                      </button>

                      <button
                        onClick={() =>
                          void revealAnswerOrExplanation(session.sessionId, activeQuestion, {
                            revealExplanation: true,
                          })
                        }
                        className="px-3.5 py-2 rounded-xl bg-[#2563EB] text-white text-xs font-semibold flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {session.explanationRevealed
                          ? 'Pembahasan Sudah Dibuka'
                          : 'Tampilkan Pembahasan'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 py-6 text-center">
                    Pilih soal di atas untuk memulai putaran pertanyaan.
                  </p>
                )}
              </div>

              {/* Submissions Review Queue */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-base font-bold text-[#0E2142]">
                      Antrean Jawaban Masuk ({activeSubmissions.length})
                    </h2>
                    <p className="text-xs text-slate-500">
                      Admin berwenang penuh menilai benar, salah, parsial, atau rubrik analitis
                    </p>
                  </div>
                </div>

                {activeSubmissions.length === 0 ? (
                  <p className="text-sm text-slate-400 py-6 text-center">
                    Belum ada jawaban yang masuk untuk pertanyaan aktif ini.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {activeSubmissions.map((sub) => (
                      <div key={sub.submissionId} className="py-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-xs">
                            <span className="font-bold text-[#0E2142] text-sm">
                              {sub.teamName}
                            </span>
                            <span className="text-slate-500"> · Pengirim: {sub.participantName}</span>
                            {sub.isGraded && (
                              <span className="font-bold text-[#2563EB] tabular-nums">
                                {' '}
                                · Dinilai: {sub.awardedPoints >= 0 ? `+${sub.awardedPoints}` : sub.awardedPoints} poin
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            {activeQuestion?.type === 'ESSAY_CASE' ||
                            session.gameMode === 'TANTANGAN_ANALISIS' ? (
                              <>
                                <button
                                  onClick={() => {
                                    setRubricSub(sub);
                                    setRubricScores(
                                      sub.rubricScores ?? {
                                        contentAccuracy: 80,
                                        reasoning: 80,
                                        sources: 80,
                                        clarity: 80,
                                      }
                                    );
                                    setRubricFeedback(sub.lecturerFeedback ?? '');
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-[#2563EB] text-white text-xs font-semibold"
                                >
                                  Nilai dengan Rubrik
                                </button>
                                <button
                                  onClick={() => {
                                    setProjectorConfirmSub(sub);
                                    setAnonymousLabelInput(`Respons Anonim — ${sub.teamName.slice(0, 3)}***`);
                                  }}
                                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                                >
                                  {sub.approvedForProjector
                                    ? 'Sudah di Proyektor'
                                    : 'Tampilkan di Proyektor'}
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => void handleQuickGrade(sub, true)}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Benar ({computeQuickPoints(true) >= 0 ? `+${computeQuickPoints(true)}` : computeQuickPoints(true)})
                                </button>
                                <button
                                  onClick={() => void handleQuickGrade(sub, false)}
                                  className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold flex items-center gap-1"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  Salah ({computeQuickPoints(false)})
                                </button>
                                <button
                                  onClick={() => {
                                    setPartialSub(sub);
                                    setPartialPoints(Math.round((activeQuestion?.points ?? 100) / 2));
                                    setPartialFeedback(sub.lecturerFeedback ?? '');
                                  }}
                                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold"
                                >
                                  Nilai Parsial
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-[#0E2142] space-y-1.5">
                          {sub.selectedOption && (
                            <div>
                              <span className="text-xs font-semibold text-slate-500">Pilihan: </span>
                              <ArabicText text={sub.selectedOption} />
                            </div>
                          )}
                          {sub.answerText && (
                            <div>
                              <span className="text-xs font-semibold text-slate-500">
                                Jawaban Utama:{' '}
                              </span>
                              <ArabicText text={sub.answerText} />
                            </div>
                          )}
                          {sub.argumentText && (
                            <div>
                              <span className="text-xs font-semibold text-slate-500">
                                Argumentasi:{' '}
                              </span>
                              <ArabicText text={sub.argumentText} />
                            </div>
                          )}
                          {sub.referenceText && (
                            <div className="text-xs text-slate-600">
                              <span className="font-semibold">Referensi: </span>
                              {sub.referenceText}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Live Standings + Undo + Score History */}
            <div className="xl:col-span-4 space-y-5">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-[#F1C56C]" />
                    <h2 className="text-base font-bold text-[#0E2142]">Klasemen Sementara</h2>
                  </div>
                  <button
                    onClick={() => void handleUndoLast()}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1"
                    title="Batalkan operasi skor terakhir"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    Undo
                  </button>
                </div>

                <div className="space-y-2.5">
                  {sortedTeams.map((team, idx) => {
                    const memberCount = approvedParticipants.filter(
                      (p) => p.teamId === team.teamId
                    ).length;
                    return (
                      <div
                        key={team.teamId}
                        className="p-3.5 rounded-xl border border-slate-200 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-8 h-8 rounded-lg text-white font-mono font-bold text-xs flex items-center justify-center shrink-0"
                            style={{ backgroundColor: team.color }}
                          >
                            {idx + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-[#0E2142] truncate">
                              {team.name}
                            </div>
                            <div className="text-xs text-slate-500">
                              {memberCount} anggota · Ketua: {team.captainName || 'Belum dipilih'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-lg font-mono font-bold text-[#0E2142] tabular-nums">
                            {team.score}
                          </div>
                          <button
                            onClick={() => {
                              setEditingTeam(team);
                              setManualDelta(100);
                              setManualReason('Koreksi poin manual admin');
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                            title="Edit poin tim secara manual"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent Score Events */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                <h3 className="text-sm font-bold text-[#0E2142] border-b border-slate-100 pb-2.5">
                  Riwayat Perubahan Poin
                </h3>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {scoreEvents.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">
                      Belum ada riwayat perubahan skor.
                    </p>
                  ) : (
                    scoreEvents.slice(0, 20).map((ev) => (
                      <div
                        key={ev.eventId}
                        className={`text-xs p-2.5 rounded-xl border ${
                          ev.undone
                            ? 'bg-slate-50 border-slate-200 text-slate-400 line-through'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between font-semibold">
                          <span>{ev.teamName}</span>
                          <span
                            className={`font-mono tabular-nums ${
                              ev.delta >= 0 ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {ev.delta >= 0 ? `+${ev.delta}` : ev.delta}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{ev.reason}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQrModal && session && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#0E2142]">Kode Gabung Mahasiswa</h3>
              <button onClick={() => setShowQrModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex justify-center p-4 bg-slate-50 rounded-2xl">
              <QRCodeSVG value={joinUrl} size={200} />
            </div>
            <div className="text-3xl font-mono font-bold text-[#0E2142] tracking-widest tabular-nums">
              {session.joinCode}
            </div>
            <div className="text-xs text-slate-500 break-all">{joinUrl}</div>
          </div>
        </div>
      )}

      {/* Manual Score Edit Modal */}
      {editingTeam && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleManualScoreSave}
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4"
          >
            <h3 className="text-lg font-bold text-[#0E2142]">
              Koreksi Poin: {editingTeam.name}
            </h3>
            <div className="text-xs text-slate-500">
              Skor saat ini: <strong className="tabular-nums">{editingTeam.score}</strong>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Perubahan Poin (gunakan minus untuk pengurangan, misal -50)
              </label>
              <input
                type="number"
                required
                value={manualDelta}
                onChange={(e) => setManualDelta(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Alasan</label>
              <input
                type="text"
                required
                value={manualReason}
                onChange={(e) => setManualReason(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingTeam(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#2563EB] text-white text-sm font-semibold"
              >
                Simpan Perubahan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Partial Grade Modal */}
      {partialSub && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitPartial}
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4"
          >
            <h3 className="text-lg font-bold text-[#0E2142]">
              Nilai Parsial — {partialSub.teamName}
            </h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Poin Diberikan
              </label>
              <input
                type="number"
                required
                value={partialPoints}
                onChange={(e) => setPartialPoints(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Catatan Umpan Balik Admin (Opsional)
              </label>
              <textarea
                rows={3}
                value={partialFeedback}
                onChange={(e) => setPartialFeedback(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPartialSub(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#2563EB] text-white text-sm font-semibold"
              >
                Simpan Nilai
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rubric Grading Modal (Tantangan Analisis) */}
      {rubricSub && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSubmitRubricGrade}
            className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 my-8"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-[#0E2142]">
                Penilaian Rubrik Analitis — {rubricSub.teamName}
              </h3>
              <button
                type="button"
                onClick={() => setRubricSub(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5 max-h-44 overflow-y-auto">
              <div>
                <strong>Jawaban Utama:</strong> {rubricSub.answerText}
              </div>
              <div>
                <strong>Argumentasi:</strong> {rubricSub.argumentText}
              </div>
              <div>
                <strong>Referensi:</strong> {rubricSub.referenceText}
              </div>
            </div>

            <div className="space-y-3">
              {[
                { key: 'contentAccuracy' as const, label: 'Ketepatan Konten' },
                { key: 'reasoning' as const, label: 'Penalaran & Argumentasi' },
                { key: 'sources' as const, label: 'Penggunaan Sumber / Referensi' },
                { key: 'clarity' as const, label: 'Kejelasan & Struktur Bahasa' },
              ].map((crit) => (
                <div
                  key={crit.key}
                  className="grid grid-cols-12 items-center gap-3 p-3 rounded-xl border border-slate-200"
                >
                  <div className="col-span-5 text-xs font-semibold text-[#0E2142]">
                    {crit.label}
                  </div>
                  <div className="col-span-3 flex items-center gap-1">
                    <span className="text-[11px] text-slate-500">Bobot %:</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={rubricWeights[crit.key]}
                      onChange={(e) =>
                        setRubricWeights({
                          ...rubricWeights,
                          [crit.key]: Number(e.target.value),
                        })
                      }
                      className="w-16 px-2 py-1 rounded-lg border border-slate-300 text-xs font-mono tabular-nums"
                    />
                  </div>
                  <div className="col-span-4 flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={rubricScores[crit.key]}
                      onChange={(e) =>
                        setRubricScores({
                          ...rubricScores,
                          [crit.key]: Number(e.target.value),
                        })
                      }
                      className="flex-1"
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={rubricScores[crit.key]}
                      onChange={(e) =>
                        setRubricScores({
                          ...rubricScores,
                          [crit.key]: Math.max(0, Math.min(100, Number(e.target.value))),
                        })
                      }
                      className="w-14 px-2 py-1 rounded-lg border border-slate-300 text-xs font-mono tabular-nums text-right"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-[#0E2142] text-white flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-300">
                  Skor Tertimbang: <strong className="tabular-nums">{computedRubricWeightedPercent}%</strong>
                </div>
                <div className="text-xs text-slate-400">
                  Skala Maksimum Soal: {activeQuestion?.points ?? 500} poin
                </div>
              </div>
              <div className="text-2xl font-mono font-bold text-[#F1C56C] tabular-nums">
                +{computedRubricPoints} Poin
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Umpan Balik Admin untuk Tim/Mahasiswa
              </label>
              <textarea
                rows={2}
                value={rubricFeedback}
                onChange={(e) => setRubricFeedback(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRubricSub(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#2563EB] text-white text-sm font-semibold"
              >
                Simpan Nilai Rubrik
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Explicit Confirmation Modal before showing written response on Projector */}
      {projectorConfirmSub && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-[#0E2142]">
              Konfirmasi Tampilkan ke Proyektor
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menayangkan jawaban tertulis lengkap milik{' '}
              <strong>{projectorConfirmSub.teamName}</strong> ke layar proyektor kelas? Identitas mahasiswa akan disamarkan sesuai label anonim di bawah.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Label Anonim di Proyektor
              </label>
              <input
                type="text"
                value={anonymousLabelInput}
                onChange={(e) => setAnonymousLabelInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setProjectorConfirmSub(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold"
              >
                Batal
              </button>
              <button
                onClick={() => void handleConfirmPublishToProjector()}
                className="px-4 py-2 rounded-xl bg-[#0E2142] text-white text-sm font-semibold"
              >
                Ya, Tayangkan Anonim
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
