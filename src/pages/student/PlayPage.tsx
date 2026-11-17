import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import {
  Bell,
  CheckCircle2,
  Clock,
  Lock,
  PauseCircle,
  Send,
  ShieldAlert,
} from 'lucide-react';
import { ArabicText } from '../../components/ArabicText';
import { DisconnectedBanner, LoadingState } from '../../components/StatusViews';
import { db, handleFirestoreError } from '../../lib/firebase';
import { formatSeconds, syncServerTime, useServerCountdown } from '../../lib/serverTime';
import {
  claimStudentBuzzer,
  getQuestionRoundKey,
  loadStudentIdentity,
  sendStudentHeartbeat,
  submitStudentAnswer,
  verifyStoredStudentIdentity,
} from '../../services/firestoreService';
import {
  OperationType,
  type BuzzerClaim,
  type Participant,
  type PublicQuestion,
  type Session,
  type StudentIdentity,
  type SubmissionReceipt,
  type Team,
} from '../../types/arena';

export const PlayPage: React.FC = () => {
  const { id: sessionId = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [identity, setIdentity] = useState<StudentIdentity | null>(null);
  const [identityChecked, setIdentityChecked] = useState(false);

  const [session, setSession] = useState<Session | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [publicQuestion, setPublicQuestion] = useState<PublicQuestion | null>(null);
  const [receipt, setReceipt] = useState<SubmissionReceipt | null>(null);
  const [buzzerClaim, setBuzzerClaim] = useState<BuzzerClaim | null>(null);

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [buzzing, setBuzzing] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    void syncServerTime();
    const onUp = () => {
      setIsOnline(true);
      void syncServerTime();
    };
    const onDown = () => setIsOnline(false);
    window.addEventListener('online', onUp);
    window.addEventListener('offline', onDown);
    return () => {
      window.removeEventListener('online', onUp);
      window.removeEventListener('offline', onDown);
    };
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    const stored = loadStudentIdentity(sessionId);
    if (!stored) {
      setIdentityChecked(true);
      return;
    }
    void verifyStoredStudentIdentity(stored).then((valid) => {
      setIdentity(valid ? stored : null);
      setIdentityChecked(true);
    });
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !identity) return;

    const unsubSes = onSnapshot(
      doc(db, 'sessions', sessionId),
      (snap) => setSession(snap.exists() ? (snap.data() as Session) : null),
      (err) => handleFirestoreError(err, OperationType.GET, `sessions/${sessionId}`)
    );

    const unsubPart = onSnapshot(
      doc(db, 'sessions', sessionId, 'participants', identity.participantId),
      (snap) => setParticipant(snap.exists() ? (snap.data() as Participant) : null),
      (err) =>
        handleFirestoreError(
          err,
          OperationType.GET,
          `sessions/${sessionId}/participants/${identity.participantId}`
        )
    );

    const unsubTeams = onSnapshot(
      query(collection(db, 'sessions', sessionId, 'teams'), orderBy('orderIndex', 'asc')),
      (snap) => setTeams(snap.docs.map((d) => d.data() as Team)),
      (err) => handleFirestoreError(err, OperationType.LIST, `sessions/${sessionId}/teams`)
    );

    void sendStudentHeartbeat(sessionId, identity.participantId, true);
    const hb = window.setInterval(() => {
      void sendStudentHeartbeat(sessionId, identity.participantId, true);
    }, 20000);

    return () => {
      unsubSes();
      unsubPart();
      unsubTeams();
      window.clearInterval(hb);
    };
  }, [sessionId, identity]);

  useEffect(() => {
    if (!sessionId || !session?.activeQuestionId) {
      setPublicQuestion(null);
      return;
    }
    const qId = session.activeQuestionId;
    setSelectedOption(null);
    setFeedbackBanner(null);

    const unsub = onSnapshot(
      doc(db, 'sessions', sessionId, 'public_questions', qId),
      (snap) => setPublicQuestion(snap.exists() ? (snap.data() as PublicQuestion) : null),
      (err) =>
        handleFirestoreError(err, OperationType.GET, `sessions/${sessionId}/public_questions/${qId}`)
    );
    return () => unsub();
  }, [sessionId, session?.activeQuestionId, session?.activeQuestionNumber]);

  const currentTeam = useMemo(
    () => teams.find((t) => t.teamId === participant?.teamId) ?? null,
    [teams, participant?.teamId]
  );

  useEffect(() => {
    if (!sessionId || !session || !session.activeQuestionId || !participant || !currentTeam) {
      setReceipt(null);
      return;
    }
    const roundKey = getQuestionRoundKey(session, session.activeQuestionId);
    const subId =
      session.submissionMode === 'INDIVIDUAL'
        ? `${roundKey}_${participant.participantId}`
        : `${roundKey}_${currentTeam.teamId}`;

    const unsub = onSnapshot(
      doc(db, 'sessions', sessionId, 'submission_receipts', subId),
      (snap) => setReceipt(snap.exists() ? (snap.data() as SubmissionReceipt) : null),
      (err) =>
        handleFirestoreError(
          err,
          OperationType.GET,
          `sessions/${sessionId}/submission_receipts/${subId}`
        )
    );
    return () => unsub();
  }, [sessionId, session, participant, currentTeam]);

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

  if (!identityChecked) {
    return (
      <div className="min-h-screen bg-[#0E2142] flex items-center justify-center">
        <LoadingState dark label="Memulihkan sesi Anda..." />
      </div>
    );
  }

  if (!identity) {
    return (
      <div className="min-h-screen bg-[#0E2142] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white text-[#0E2142] rounded-2xl p-7 text-center space-y-4">
          <ShieldAlert className="w-10 h-10 text-amber-600 mx-auto" />
          <h1 className="text-xl font-bold">Identitas Sesi Tidak Ditemukan</h1>
          <p className="text-sm text-slate-600">
            Silakan masuk kembali melalui halaman Portal Mahasiswa.
          </p>
          <button
            onClick={() => navigate('/join')}
            className="w-full min-h-[48px] py-3 rounded-xl bg-[#2563EB] text-white font-bold"
          >
            Ke Halaman Masuk
          </button>
        </div>
      </div>
    );
  }

  if (!session || !participant) {
    return (
      <div className="min-h-screen bg-[#0E2142] flex items-center justify-center">
        <LoadingState dark label="Menghubungkan ke sesi..." />
      </div>
    );
  }

  if (participant.status === 'REMOVED' || participant.status === 'REJECTED') {
    return (
      <div className="min-h-screen bg-[#0E2142] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white text-[#0E2142] rounded-2xl p-7 text-center space-y-4">
          <h1 className="text-xl font-bold text-rose-700">Akses Peserta Dihentikan</h1>
          <p className="text-sm text-slate-600">
            Admin tidak menyetujui atau telah mengeluarkan peserta dari sesi ini.
          </p>
          <Link
            to="/join"
            className="block w-full py-3 rounded-xl bg-[#0E2142] text-white font-bold text-sm"
          >
            Kembali ke Halaman Masuk
          </Link>
        </div>
      </div>
    );
  }

  const isTeamAuthorized =
    !session.authorizedTeamId || session.authorizedTeamId === participant.teamId;
  const isRoleAuthorized =
    session.submissionMode !== 'CAPTAIN_ONLY' || participant.isCaptain;
  const hasMultipleChoiceOptions =
    Boolean(publicQuestion?.options && publicQuestion.options.length > 0);
  const canSubmitNow =
    session.status === 'ACTIVE' &&
    session.submissionsOpen &&
    Boolean(publicQuestion) &&
    hasMultipleChoiceOptions &&
    isTeamAuthorized &&
    isRoleAuthorized &&
    !receipt;

  const showBuzzerPanel =
    session.gameMode === 'CERDAS_CERMAT' &&
    (session.cerdasCermatRound === 'REBUTAN' ||
      session.buzzerOpen ||
      Boolean(session.buzzerWinnerTeamName) ||
      Boolean(buzzerClaim));

  const handleBuzz = async () => {
    if (!currentTeam || buzzing) return;
    setBuzzing(true);
    setFeedbackBanner(null);
    try {
      const res = await claimStudentBuzzer({
        session,
        identity,
        participant,
        team: currentTeam,
      });
      setFeedbackBanner(res.message);
    } finally {
      setBuzzing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicQuestion || !currentTeam || !canSubmitNow || submitting) return;
    if (!selectedOption) {
      setFeedbackBanner('Pilih salah satu jawaban terlebih dahulu.');
      return;
    }

    setSubmitting(true);
    setFeedbackBanner(null);
    try {
      await submitStudentAnswer({
        session,
        question: publicQuestion,
        identity,
        participant,
        team: currentTeam,
        selectedOption,
      });
      setFeedbackBanner('Jawaban pilihan ganda berhasil dikirim.');
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      if (raw.includes('permission-denied') || raw.includes('PERMISSION_DENIED')) {
        setFeedbackBanner(
          'Pengiriman ditolak server (batas waktu habis atau jawaban sudah terkirim).'
        );
      } else {
        setFeedbackBanner('Gagal mengirim jawaban. Periksa koneksi Anda.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-[#0E2142] flex flex-col">
      {/* Compact Sticky Top Bar (No Scores Shown) */}
      <header className="sticky top-0 z-30 h-14 bg-[#0E2142] text-white px-4 flex items-center justify-between gap-3 border-b border-white/10">
        <div className="min-w-0">
          <div className="text-xs font-bold text-[#F1C56C] truncate">
            {currentTeam?.name || 'Mahasiswa'}
          </div>
          <div className="text-xs text-slate-300 truncate">{participant.displayName}</div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {session.status === 'ACTIVE' && publicQuestion && (
            <div className="px-2.5 py-1 rounded-lg bg-white/10 font-mono text-sm font-bold text-[#F1C56C] tabular-nums flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatSeconds(secondsLeft)}
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 p-4 max-w-2xl w-full mx-auto space-y-4 pb-10">
        {!isOnline && <DisconnectedBanner onRetry={() => void syncServerTime()} />}

        {feedbackBanner && (
          <div className="p-3.5 rounded-xl bg-[#0E2142] text-white text-xs sm:text-sm font-medium">
            {feedbackBanner}
          </div>
        )}

        {/* Pending Approval */}
        {participant.status === 'PENDING' ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-7 text-center space-y-3 mt-6">
            <Clock className="w-10 h-10 text-amber-600 mx-auto" />
            <h2 className="text-lg font-bold text-[#0E2142]">Menunggu Persetujuan Admin</h2>
            <p className="text-sm text-slate-600">
              Permintaan bergabung telah dikirim. Halaman ini otomatis aktif setelah disetujui Admin.
            </p>
          </div>
        ) : session.status === 'FINISHED' ? (
          /* Finished (No scores or rankings shown to students) */
          <div className="bg-white rounded-2xl border border-slate-200 p-7 text-center space-y-3 mt-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <h2 className="text-xl font-extrabold text-[#0E2142]">Sesi Kuis Selesai</h2>
            <p className="text-sm text-slate-600">
              Terima kasih telah berpartisipasi. Silakan ikuti arahan Admin di kelas.
            </p>
          </div>
        ) : session.status === 'LOBBY' || !publicQuestion ? (
          /* Waiting in Lobby */
          <div className="bg-white rounded-2xl border border-slate-200 p-7 text-center space-y-3 mt-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <h2 className="text-lg font-bold text-[#0E2142]">Anda Siap Mengikuti Kuis</h2>
            <p className="text-sm text-slate-600">
              Menunggu Admin membuka soal pilihan ganda atau bel rebutan. Jangan tutup halaman ini.
            </p>
          </div>
        ) : session.status === 'PAUSED' ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-7 text-center space-y-2 mt-6">
            <PauseCircle className="w-10 h-10 text-amber-700 mx-auto" />
            <h2 className="text-lg font-bold text-amber-950">Sesi Dijeda Sementara</h2>
            <p className="text-sm text-amber-800">Tunggu Admin melanjutkan jalannya kuis.</p>
          </div>
        ) : (
          /* Active Question View: ONLY Bel Rebutan & Pilihan Ganda */
          <div className="space-y-4">
            {/* Bel Rebutan Panel */}
            {showBuzzerPanel && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                {session.buzzerWinnerTeamName || buzzerClaim ? (
                  <div className="p-4 rounded-xl bg-[#0E2142] text-white text-center space-y-1">
                    <div className="text-xs font-semibold text-[#F1C56C]">
                      {(session.buzzerWinnerTeamId || buzzerClaim?.teamId) === participant.teamId
                        ? 'TIM ANDA MEMENANGKAN BEL REBUTAN!'
                        : 'BEL REBUTAN DIKLAIM TIM LAIN'}
                    </div>
                    <div className="text-base font-bold">
                      {session.buzzerWinnerTeamName || buzzerClaim?.teamName} (
                      {session.buzzerWinnerParticipantName || buzzerClaim?.participantName})
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={!session.buzzerOpen || buzzing}
                    onClick={() => void handleBuzz()}
                    className={`w-full min-h-[84px] rounded-xl font-display text-2xl font-extrabold tracking-wide flex items-center justify-center gap-3 transition-transform active:scale-[0.98] ${
                      session.buzzerOpen
                        ? 'bg-[#F1C56C] text-[#0E2142] shadow-md'
                        : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <Bell className="w-7 h-7" />
                    {session.buzzerOpen ? 'TEKAN BEL REBUTAN!' : 'BEL REBUTAN TERKUNCI'}
                  </button>
                )}
              </div>
            )}

            {/* Pilihan Ganda Question Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
              <div className="text-xs font-semibold text-[#2563EB]">
                Pilihan Ganda · {publicQuestion.topicName}
              </div>
              <div className="text-lg font-bold text-[#0E2142] leading-relaxed">
                <ArabicText text={publicQuestion.questionText} />
              </div>

              {publicQuestion.imageUrl && (
                <img
                  src={publicQuestion.imageUrl}
                  alt="Lampiran Pertanyaan"
                  referrerPolicy="no-referrer"
                  className="max-h-56 w-full object-contain rounded-xl bg-slate-50"
                />
              )}

              {/* Submission Status / Form (Multiple Choice Only) */}
              {!hasMultipleChoiceOptions ? (
                <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 flex items-center gap-3 text-sm text-slate-700">
                  <Bell className="w-5 h-5 text-[#2563EB] shrink-0" />
                  <span>
                    Gunakan tombol Bel Rebutan di atas untuk menjawab pertanyaan ini bersama Admin.
                  </span>
                </div>
              ) : receipt ? (
                <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                    <span>Jawaban Terkirim ({receipt.participantName})</span>
                  </div>
                  <div className="text-xs text-emerald-800">
                    Jawaban pilihan ganda Anda telah tercatat. Menunggu pertanyaan berikutnya dari Admin.
                  </div>
                </div>
              ) : !isTeamAuthorized ? (
                <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 flex items-center gap-3 text-sm text-slate-700">
                  <Lock className="w-5 h-5 text-slate-500 shrink-0" />
                  <span>
                    Pertanyaan ini khusus untuk kelompok yang sedang mendapat giliran.
                  </span>
                </div>
              ) : !isRoleAuthorized ? (
                <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 flex items-center gap-3 text-sm text-slate-700">
                  <Lock className="w-5 h-5 text-slate-500 shrink-0" />
                  <span>
                    Pengiriman jawaban saat ini melalui perwakilan kelompok ({currentTeam?.captainName || 'Ketua'}).
                  </span>
                </div>
              ) : !session.submissionsOpen ? (
                <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 flex items-center gap-3 text-sm text-slate-700">
                  <Lock className="w-5 h-5 text-slate-500 shrink-0" />
                  <span>Pengiriman jawaban sedang ditutup oleh Admin.</span>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                  <div className="space-y-2.5">
                    {publicQuestion.options!.map((opt, idx) => {
                      const active = selectedOption === opt;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedOption(opt)}
                          className={`w-full min-h-[52px] p-4 rounded-xl border text-left text-sm sm:text-base font-semibold flex items-center gap-3 transition-colors ${
                            active
                              ? 'bg-[#2563EB] text-white border-[#2563EB]'
                              : 'bg-slate-50 text-[#0E2142] border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          <span
                            className={`w-7 h-7 rounded-lg font-mono text-xs font-bold flex items-center justify-center shrink-0 ${
                              active
                                ? 'bg-white text-[#2563EB]'
                                : 'bg-white border border-slate-300 text-[#0E2142]'
                            }`}
                          >
                            {String.fromCharCode(65 + idx)}
                          </span>
                          <span className="flex-1">
                            <ArabicText text={opt} />
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !selectedOption}
                    className="w-full min-h-[52px] py-3.5 px-5 rounded-xl bg-[#2563EB] text-white text-base font-bold hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Send className="w-5 h-5" />
                    <span>{submitting ? 'Mengirim Jawaban...' : 'Kirim Jawaban'}</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
