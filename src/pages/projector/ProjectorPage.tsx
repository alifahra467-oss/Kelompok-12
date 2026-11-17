import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { Award, Bell, CheckCircle2, Clock, Maximize2, Trophy, Users } from 'lucide-react';
import { ArabicText } from '../../components/ArabicText';
import { LoadingState } from '../../components/StatusViews';
import { db, handleFirestoreError } from '../../lib/firebase';
import { formatSeconds, syncServerTime, useServerCountdown } from '../../lib/serverTime';
import { getQuestionRoundKey } from '../../services/firestoreService';
import {
  OperationType,
  type BuzzerClaim,
  type Course,
  type Participant,
  type PublicQuestion,
  type PublicResponse,
  type Session,
  type SubmissionReceipt,
  type Team,
} from '../../types/arena';

export const ProjectorPage: React.FC = () => {
  const { id: sessionId = '' } = useParams<{ id: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [publicQuestion, setPublicQuestion] = useState<PublicQuestion | null>(null);
  const [receipts, setReceipts] = useState<SubmissionReceipt[]>([]);
  const [publicResponses, setPublicResponses] = useState<PublicResponse[]>([]);
  const [buzzerClaim, setBuzzerClaim] = useState<BuzzerClaim | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void syncServerTime();
  }, []);

  useEffect(() => {
    const unsubCourse = onSnapshot(
      doc(db, 'course', 'main'),
      (snap) => {
        if (snap.exists()) setCourse(snap.data() as Course);
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'course/main')
    );

    if (!sessionId) return () => unsubCourse();

    const unsubSes = onSnapshot(
      doc(db, 'sessions', sessionId),
      (snap) => {
        setSession(snap.exists() ? (snap.data() as Session) : null);
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

    const unsubReceipts = onSnapshot(
      collection(db, 'sessions', sessionId, 'submission_receipts'),
      (snap) => setReceipts(snap.docs.map((d) => d.data() as SubmissionReceipt)),
      (err) =>
        handleFirestoreError(
          err,
          OperationType.LIST,
          `sessions/${sessionId}/submission_receipts`
        )
    );

    const unsubResp = onSnapshot(
      collection(db, 'sessions', sessionId, 'public_responses'),
      (snap) => setPublicResponses(snap.docs.map((d) => d.data() as PublicResponse)),
      (err) =>
        handleFirestoreError(err, OperationType.LIST, `sessions/${sessionId}/public_responses`)
    );

    return () => {
      unsubCourse();
      unsubSes();
      unsubTeams();
      unsubParts();
      unsubReceipts();
      unsubResp();
    };
  }, [sessionId]);

  // Listen to sanitized public_questions/{activeQuestionId} ONLY
  useEffect(() => {
    if (!sessionId || !session?.activeQuestionId) {
      setPublicQuestion(null);
      return;
    }
    const qId = session.activeQuestionId;
    const unsub = onSnapshot(
      doc(db, 'sessions', sessionId, 'public_questions', qId),
      (snap) => {
        setPublicQuestion(snap.exists() ? (snap.data() as PublicQuestion) : null);
      },
      (err) =>
        handleFirestoreError(err, OperationType.GET, `sessions/${sessionId}/public_questions/${qId}`)
    );
    return () => unsub();
  }, [sessionId, session?.activeQuestionId]);

  useEffect(() => {
    if (!sessionId || !session?.activeQuestionId) {
      setBuzzerClaim(null);
      return;
    }
    const claimId = `${session.activeQuestionId}_a${session.buzzerAttempt}`;
    const unsub = onSnapshot(
      doc(db, 'sessions', sessionId, 'buzzer_claims', claimId),
      (snap) => setBuzzerClaim(snap.exists() ? (snap.data() as BuzzerClaim) : null),
      (err) =>
        handleFirestoreError(err, OperationType.GET, `sessions/${sessionId}/buzzer_claims/${claimId}`)
    );
    return () => unsub();
  }, [sessionId, session?.activeQuestionId, session?.buzzerAttempt]);

  const secondsLeft = useServerCountdown(
    Boolean(session?.timerRunning),
    session?.timerEndTimeMs,
    session?.timerRemainingSec
  );

  const sortedTeams = useMemo(() => [...teams].sort((a, b) => b.score - a.score), [teams]);
  const approvedParticipants = useMemo(
    () => participants.filter((p) => p.status === 'APPROVED'),
    [participants]
  );

  const activeRoundKey = useMemo(() => {
    if (!session || !session.activeQuestionId) return '';
    return getQuestionRoundKey(session, session.activeQuestionId);
  }, [session]);

  const currentReceipts = useMemo(
    () => receipts.filter((r) => r.questionRoundKey === activeRoundKey),
    [receipts, activeRoundKey]
  );

  const currentPublicResponses = useMemo(
    () => publicResponses.filter((r) => r.questionRoundKey === activeRoundKey),
    [publicResponses, activeRoundKey]
  );

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen().catch(() => {});
    } else {
      void document.exitFullscreen().catch(() => {});
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0E2142] flex items-center justify-center">
        <LoadingState dark label="Menyiapkan layar proyektor..." />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#0E2142] text-white flex items-center justify-center p-8 text-center">
        <div>
          <h1 className="text-3xl font-bold text-[#F1C56C] mb-2">Sesi Tidak Ditemukan</h1>
          <p className="text-slate-300">Periksa kembali tautan proyektor dari konsol admin.</p>
        </div>
      </div>
    );
  }

  const joinUrl = `${window.location.origin}/join?code=${session.joinCode}`;
  const authorizedTeam = teams.find((t) => t.teamId === session.authorizedTeamId) ?? null;
  const buzzerWinnerName = session.buzzerWinnerTeamName || buzzerClaim?.teamName || null;

  return (
    <div className="min-h-screen bg-[#08142A] text-white relative overflow-hidden flex flex-col">
      {/* Stage Backdrop Image with contrast scrim */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-35 pointer-events-none"
        style={{
          backgroundImage: `url(/src/assets/images/projector_stage_backdrop_1794722952391.jpg)`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0E2142]/80 via-[#08142A]/85 to-[#08142A]/95 pointer-events-none" />

      {/* Top Broadcast Header */}
      <header className="relative z-10 px-8 py-4 border-b border-white/10 flex items-center justify-between gap-6">
        <div className="flex items-center gap-4 min-w-0">
          <img
            src={course?.logoUrl || '/src/assets/images/course_emblem_sirah_1794722950872.jpg'}
            alt="Logo Mata Kuliah"
            className="w-11 h-11 rounded-xl object-cover border border-[#F1C56C]/40 shrink-0"
          />
          <div className="min-w-0">
            <div className="text-xs font-semibold text-[#F1C56C] tracking-wide truncate">
              {course?.title || 'ARENA KELAS 2.0'}
            </div>
            <h1 className="text-xl font-bold text-white truncate">{session.title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-5 shrink-0">
          <div className="text-right">
            <div className="text-[11px] text-slate-400">Kode Gabung</div>
            <div className="font-mono text-2xl font-bold text-[#F1C56C] tabular-nums tracking-widest">
              {session.joinCode}
            </div>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Layar Penuh"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main 16:9 Stage */}
      <main className="relative z-10 flex-1 p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-[1600px] w-full mx-auto">
        {/* Left / Center Primary Stage */}
        <div className="lg:col-span-9 flex flex-col justify-center">
          {/* 1. FINISHED / WINNER SCREEN */}
          {session.status === 'FINISHED' ? (
            <div className="bg-[#0E2142]/90 border border-[#F1C56C]/40 rounded-3xl p-8 lg:p-10 text-center space-y-8">
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 rounded-2xl bg-[#F1C56C]/20 border border-[#F1C56C] flex items-center justify-center text-[#F1C56C] mb-4">
                  <Trophy className="w-10 h-10" />
                </div>
                <div className="text-sm font-semibold text-[#F1C56C]">Kompetisi Selesai</div>
                <h2 className="text-4xl lg:text-5xl font-extrabold text-white mt-1">
                  Pemenang: {sortedTeams[0]?.name || '-'}
                </h2>
                <div className="text-2xl font-mono font-bold text-[#F1C56C] tabular-nums mt-2">
                  {sortedTeams[0]?.score ?? 0} Poin
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
                {sortedTeams.slice(0, 3).map((team, idx) => (
                  <div
                    key={team.teamId}
                    className={`p-6 rounded-2xl border ${
                      idx === 0
                        ? 'bg-[#F1C56C]/15 border-[#F1C56C]'
                        : 'bg-white/5 border-white/15'
                    }`}
                  >
                    <div className="text-xs font-bold text-[#F1C56C] mb-1">
                      Peringkat #{idx + 1}
                    </div>
                    <div className="text-xl font-bold text-white">{team.name}</div>
                    <div className="text-3xl font-mono font-bold text-white tabular-nums mt-2">
                      {team.score}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <Link
                  to={`/results/${session.sessionId}`}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#2563EB] text-white text-sm font-bold"
                >
                  Buka Laporan Lengkap Sesi
                </Link>
              </div>
            </div>
          ) : session.status === 'LOBBY' || (!publicQuestion && session.gameMode !== 'PAPAN_TANTANGAN') ? (
            /* 2. LOBBY VIEW */
            <div className="bg-[#0E2142]/90 border border-white/15 rounded-3xl p-8 lg:p-10 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
              <div className="md:col-span-7 space-y-6">
                <div>
                  <div className="text-sm font-semibold text-[#F1C56C] mb-1">
                    Pindai QR atau Masukkan Kode di Ponsel Anda
                  </div>
                  <h2 className="text-3xl lg:text-5xl font-extrabold text-white leading-tight">
                    Bergabung ke Arena Kompetisi
                  </h2>
                </div>

                <div className="p-6 rounded-2xl bg-[#08142A] border border-white/15 inline-block">
                  <div className="text-xs text-slate-400 mb-1">Kode Sesi 6 Digit</div>
                  <div className="text-5xl lg:text-6xl font-mono font-extrabold text-[#F1C56C] tracking-[0.2em] tabular-nums">
                    {session.joinCode}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-base text-slate-200">
                  <Users className="w-5 h-5 text-[#F1C56C]" />
                  <span className="tabular-nums font-bold">{approvedParticipants.length}</span>
                  <span>mahasiswa telah bergabung dan siap bertanding</span>
                </div>
              </div>

              <div className="md:col-span-5 flex flex-col items-center justify-center bg-white rounded-3xl p-6 text-[#0E2142]">
                <QRCodeSVG value={joinUrl} size={230} />
                <div className="mt-4 text-xs font-bold text-slate-600 text-center break-all">
                  {joinUrl}
                </div>
              </div>
            </div>
          ) : session.gameMode === 'PAPAN_TANTANGAN' && !publicQuestion && session.boardConfig ? (
            /* 3. PAPAN TANTANGAN FULLSCREEN BOARD */
            <div className="bg-[#0E2142]/90 border border-white/15 rounded-3xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-extrabold text-[#F1C56C]">Papan Tantangan</h2>
                {session.activeTeamId && (
                  <div className="text-sm font-semibold text-white">
                    Giliran Memilih:{' '}
                    <span className="text-[#F1C56C]">
                      {teams.find((t) => t.teamId === session.activeTeamId)?.name}
                    </span>
                  </div>
                )}
              </div>

              <div
                className="grid gap-3"
                style={{
                  gridTemplateColumns: `repeat(${session.boardConfig.categories.length}, minmax(0, 1fr))`,
                }}
              >
                {session.boardConfig.categories.map((cat, cIdx) => (
                  <div
                    key={cIdx}
                    className="p-4 rounded-2xl bg-[#2563EB] text-white text-center font-bold text-base lg:text-lg flex items-center justify-center min-h-[72px]"
                  >
                    {cat}
                  </div>
                ))}

                {session.boardConfig.pointLevels.map((pts, rIdx) =>
                  session.boardConfig!.categories.map((_, cIdx) => {
                    const key = `${cIdx}_${rIdx}`;
                    const tile = session.boardConfig!.tiles[key];
                    const isDone = tile?.completed;
                    return (
                      <div
                        key={key}
                        className={`min-h-[88px] rounded-2xl border flex flex-col items-center justify-center p-3 ${
                          isDone
                            ? 'bg-white/5 border-white/10 text-slate-500'
                            : 'bg-[#08142A] border-[#F1C56C]/40 text-[#F1C56C]'
                        }`}
                      >
                        <span className="font-mono text-3xl font-extrabold tabular-nums">
                          {isDone ? '—' : pts}
                        </span>
                        {isDone && tile.completedByTeamName && (
                          <span className="text-[11px] text-slate-400 mt-1 truncate max-w-full">
                            {tile.completedByTeamName}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : publicQuestion ? (
            /* 4. ACTIVE QUESTION STAGE */
            <div className="bg-[#0E2142]/95 border border-white/15 rounded-3xl p-8 lg:p-10 space-y-6">
              {/* Question Header Metadata + Countdown */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-[#F1C56C]">
                    {publicQuestion.topicName}
                    {publicQuestion.subtopic ? ` · ${publicQuestion.subtopic}` : ''} ·{' '}
                    {publicQuestion.points} Poin
                  </div>
                  <div className="text-xs text-slate-300">
                    {session.gameMode === 'CERDAS_CERMAT' &&
                      `Babak ${session.cerdasCermatRound || 'WAJIB'}`}
                    {authorizedTeam && ` · Giliran: ${authorizedTeam.name}`}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {session.status === 'PAUSED' && (
                    <span className="text-sm font-bold text-amber-300">SESI DIJEDA</span>
                  )}
                  <div
                    className={`px-5 py-2.5 rounded-2xl font-mono text-4xl font-extrabold tabular-nums flex items-center gap-2.5 border ${
                      secondsLeft <= 5 && session.timerRunning
                        ? 'bg-rose-600/30 border-rose-400 text-rose-200'
                        : 'bg-[#08142A] border-[#F1C56C]/50 text-[#F1C56C]'
                    }`}
                  >
                    <Clock className="w-7 h-7" />
                    {formatSeconds(secondsLeft)}
                  </div>
                </div>
              </div>

              {/* Buzzer Winner Spotlight */}
              {(session.buzzerOpen || buzzerWinnerName) && (
                <div
                  className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
                    buzzerWinnerName
                      ? 'bg-[#F1C56C] text-[#0E2142] border-[#F1C56C]'
                      : 'bg-[#2563EB]/25 text-white border-[#2563EB]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Bell className="w-6 h-6 shrink-0" />
                    <div className="text-lg lg:text-2xl font-extrabold">
                      {buzzerWinnerName
                        ? `BUZZER DIKLAIM: ${buzzerWinnerName} (${
                            session.buzzerWinnerParticipantName || buzzerClaim?.participantName
                          })`
                        : 'BUZZER TERBUKA — Tekan Buzzer di Ponsel Sekarang!'}
                    </div>
                  </div>
                </div>
              )}

              {/* Question Body */}
              <div className="text-2xl lg:text-4xl font-bold text-white leading-snug">
                <ArabicText text={publicQuestion.questionText} />
              </div>

              {publicQuestion.imageUrl && (
                <div className="flex justify-center">
                  <img
                    src={publicQuestion.imageUrl}
                    alt="Visual Pertanyaan"
                    referrerPolicy="no-referrer"
                    className="max-h-64 rounded-2xl object-contain border border-white/15"
                  />
                </div>
              )}

              {publicQuestion.referenceRequirement && (
                <div className="p-4 rounded-2xl bg-white/5 border border-white/15 text-sm text-[#F1C56C]">
                  Ketentuan Rujukan: {publicQuestion.referenceRequirement}
                </div>
              )}

              {/* Options */}
              {publicQuestion.options && publicQuestion.options.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {publicQuestion.options.map((opt, idx) => {
                    const isWinnerOpt =
                      session.answerRevealed && session.revealedAnswer === opt;
                    const statCount =
                      session.statsReleased && session.questionStats?.optionCounts
                        ? session.questionStats.optionCounts[opt] ?? 0
                        : null;
                    return (
                      <div
                        key={idx}
                        className={`p-5 rounded-2xl border text-lg lg:text-xl font-semibold flex items-center justify-between gap-4 transition-colors ${
                          isWinnerOpt
                            ? 'bg-emerald-600/30 border-emerald-400 text-white'
                            : 'bg-[#08142A]/90 border-white/15 text-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-9 h-9 rounded-xl bg-white/10 text-[#F1C56C] font-mono font-bold flex items-center justify-center shrink-0">
                            {String.fromCharCode(65 + idx)}
                          </span>
                          <span className="break-words">
                            <ArabicText text={opt} />
                          </span>
                        </div>
                        {statCount !== null && (
                          <span className="font-mono text-base font-bold text-[#F1C56C] tabular-nums shrink-0">
                            {statCount} tim
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Submission Progress Bar */}
              <div className="flex items-center justify-between text-sm text-slate-300 pt-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#F1C56C]" />
                  <span>
                    Progres Pengumpulan:{' '}
                    <strong className="text-white tabular-nums">{currentReceipts.length}</strong>{' '}
                    jawaban masuk
                  </span>
                </div>
                {session.statsReleased && session.questionStats && (
                  <span className="text-[#F1C56C] font-semibold">
                    Statistik Jawaban Dirilis ({session.questionStats.totalSubmissions} total)
                  </span>
                )}
              </div>

              {/* Approved Anonymous Responses (Mode C) */}
              {currentPublicResponses.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-white/10">
                  <div className="text-sm font-bold text-[#F1C56C]">
                    Respons Terpilih (Anonim)
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentPublicResponses.map((resp) => (
                      <div
                        key={resp.responseId}
                        className="p-4 rounded-2xl bg-[#08142A] border border-white/15 space-y-2 text-sm"
                      >
                        <div className="flex items-center justify-between text-xs text-[#F1C56C] font-bold">
                          <span>{resp.anonymousLabel}</span>
                          <span className="tabular-nums">{resp.awardedPoints} poin</span>
                        </div>
                        <p className="text-white leading-relaxed">
                          <ArabicText text={resp.answerText} />
                        </p>
                        {resp.argumentText && (
                          <p className="text-slate-300 text-xs leading-relaxed">
                            Argumentasi: <ArabicText text={resp.argumentText} />
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Revealed Answer & Explanation */}
              {(session.answerRevealed || session.explanationRevealed) && (
                <div className="p-6 rounded-2xl bg-emerald-950/70 border border-emerald-400/50 space-y-3">
                  {session.answerRevealed && session.revealedAnswer && (
                    <div>
                      <div className="text-xs font-bold text-emerald-300">Jawaban Benar</div>
                      <div className="text-xl font-bold text-white mt-0.5">
                        <ArabicText text={session.revealedAnswer} />
                      </div>
                    </div>
                  )}
                  {session.explanationRevealed && session.revealedExplanation && (
                    <div className="pt-2 border-t border-emerald-400/20">
                      <div className="text-xs font-bold text-[#F1C56C]">Pembahasan Akademik</div>
                      <div className="text-base text-slate-100 mt-1 leading-relaxed">
                        <ArabicText text={session.revealedExplanation} />
                      </div>
                      {session.revealedReference && (
                        <div className="text-xs text-slate-300 mt-2">
                          Rujukan: {session.revealedReference}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Right Column: Live Team Standings */}
        <aside className="lg:col-span-3 bg-[#0E2142]/90 border border-white/15 rounded-3xl p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 border-b border-white/10 pb-4">
              <Award className="w-6 h-6 text-[#F1C56C]" />
              <h2 className="text-lg font-extrabold text-white">Klasemen Tim</h2>
            </div>

            <div className="space-y-3">
              {sortedTeams.map((team, idx) => {
                const count = approvedParticipants.filter((p) => p.teamId === team.teamId).length;
                const isAuthorized = session.authorizedTeamId === team.teamId;
                return (
                  <div
                    key={team.teamId}
                    className={`p-4 rounded-2xl border transition-colors ${
                      isAuthorized
                        ? 'bg-[#2563EB]/25 border-[#F1C56C]'
                        : 'bg-[#08142A]/80 border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-7 h-7 rounded-lg font-mono text-xs font-bold flex items-center justify-center text-white shrink-0"
                          style={{ backgroundColor: team.color }}
                        >
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-white truncate">{team.name}</div>
                          <div className="text-[11px] text-slate-400">
                            {count} peserta{isAuthorized ? ' · Giliran Aktif' : ''}
                          </div>
                        </div>
                      </div>
                      <div className="font-mono text-2xl font-extrabold text-[#F1C56C] tabular-nums shrink-0">
                        {team.score}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-6 border-t border-white/10 text-xs text-slate-400">
            <div>Admin: {course?.lecturerName || 'Pengelola Pembelajaran'}</div>
            <div>{course?.semester || ''}</div>
          </div>
        </aside>
      </main>
    </div>
  );
};
