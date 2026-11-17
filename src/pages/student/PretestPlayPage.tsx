import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { collection, doc, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { CheckCircle2, Clock, PauseCircle, Send, Users } from 'lucide-react';
import { ArabicText } from '../../components/ArabicText';
import { DisconnectedBanner, LoadingState } from '../../components/StatusViews';
import { db, handleFirestoreError } from '../../lib/firebase';
import { formatSeconds, syncServerTime, useServerCountdown } from '../../lib/serverTime';
import { saveStudentIdentity } from '../../services/firestoreService';
import {
  loadPretestStudentIdentity,
  sendPretestHeartbeat,
  submitPretestAnswer,
  verifyStoredPretestIdentity,
} from '../../services/pretestService';
import { OperationType } from '../../types/arena';
import type {
  Pretest,
  PretestParticipant,
  PretestQuestionPublic,
  PretestStudentIdentity,
  PretestSubmissionReceipt,
} from '../../types/pretest';

export const PretestPlayPage: React.FC = () => {
  const { id: pretestId = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [identity, setIdentity] = useState<PretestStudentIdentity | null>(null);
  const [identityChecked, setIdentityChecked] = useState(false);

  const [pretest, setPretest] = useState<Pretest | null>(null);
  const [participant, setParticipant] = useState<PretestParticipant | null>(null);
  const [publicQuestions, setPublicQuestions] = useState<PretestQuestionPublic[]>([]);
  const [myReceipts, setMyReceipts] = useState<PretestSubmissionReceipt[]>([]);

  const [draftChoices, setDraftChoices] = useState<Record<string, string>>({});
  const [submittingQId, setSubmittingQId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [bridging, setBridging] = useState(false);
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
    if (!pretestId) return;
    const stored = loadPretestStudentIdentity(pretestId);
    if (!stored) {
      setIdentityChecked(true);
      return;
    }
    void verifyStoredPretestIdentity(stored).then((valid) => {
      setIdentity(valid ? stored : null);
      setIdentityChecked(true);
    });
  }, [pretestId]);

  useEffect(() => {
    if (!pretestId || !identity) return;

    const unsubPre = onSnapshot(
      doc(db, 'pretests', pretestId),
      (snap) => setPretest(snap.exists() ? (snap.data() as Pretest) : null),
      (err) => handleFirestoreError(err, OperationType.GET, `pretests/${pretestId}`)
    );

    const unsubPart = onSnapshot(
      doc(db, 'pretests', pretestId, 'participants', identity.participantId),
      (snap) => setParticipant(snap.exists() ? (snap.data() as PretestParticipant) : null),
      (err) =>
        handleFirestoreError(
          err,
          OperationType.GET,
          `pretests/${pretestId}/participants/${identity.participantId}`
        )
    );

    const unsubQ = onSnapshot(
      query(
        collection(db, 'pretests', pretestId, 'questions_public'),
        orderBy('orderIndex', 'asc')
      ),
      (snap) => setPublicQuestions(snap.docs.map((d) => d.data() as PretestQuestionPublic)),
      (err) =>
        handleFirestoreError(err, OperationType.LIST, `pretests/${pretestId}/questions_public`)
    );

    const unsubRec = onSnapshot(
      query(
        collection(db, 'pretests', pretestId, 'submission_receipts'),
        where('participantId', '==', identity.participantId)
      ),
      (snap) => setMyReceipts(snap.docs.map((d) => d.data() as PretestSubmissionReceipt)),
      (err) =>
        handleFirestoreError(
          err,
          OperationType.LIST,
          `pretests/${pretestId}/submission_receipts`
        )
    );

    void sendPretestHeartbeat(pretestId, identity.participantId, true);
    const hb = window.setInterval(() => {
      void sendPretestHeartbeat(pretestId, identity.participantId, true);
    }, 20000);

    return () => {
      unsubPre();
      unsubPart();
      unsubQ();
      unsubRec();
      window.clearInterval(hb);
    };
  }, [pretestId, identity]);

  // Transisi otomatis ke sesi Cerdas Cermat / Bel Rebutan setelah Admin meluncurkannya
  const handleEnterLinkedGame = async () => {
    if (!pretest?.linkedSessionId || !identity || !pretest.allocation) return;
    setBridging(true);
    setErrorMsg(null);
    try {
      const assignedTeam = pretest.allocation.teams.find((t) =>
        t.members.some((m) => m.participantId === identity.participantId)
      );
      if (!assignedTeam) {
        throw new Error('Penempatan kelompok Anda belum tersedia.');
      }

      const res = await fetch('/api/student/bridge-identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromSessionId: pretest.pretestId,
          toSessionId: pretest.linkedSessionId,
          participantId: identity.participantId,
          authProof: identity.authProof,
          identitySignature: identity.identitySignature,
        }),
      });
      if (!res.ok) {
        throw new Error('Gagal memverifikasi perpindahan sesi.');
      }
      const data = (await res.json()) as {
        proofHash: string;
        identitySignature: string;
      };

      saveStudentIdentity({
        sessionId: pretest.linkedSessionId,
        participantId: identity.participantId,
        authProof: identity.authProof,
        proofHash: data.proofHash,
        identitySignature: data.identitySignature,
        displayName: identity.displayName,
        teamId: assignedTeam.teamId,
      });

      navigate(`/play/${pretest.linkedSessionId}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal berpindah ke sesi berikutnya.');
    } finally {
      setBridging(false);
    }
  };

  useEffect(() => {
    if (pretest?.linkedSessionId && identity && pretest.allocation && !bridging) {
      void handleEnterLinkedGame();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pretest?.linkedSessionId]);

  const countdownSec = useServerCountdown(
    pretest?.timerRunning ?? false,
    pretest?.timerEndTimeMs,
    pretest?.timerRemainingSec ?? 0
  );

  const submittedQIds = useMemo(
    () => new Set(myReceipts.map((r) => r.questionId)),
    [myReceipts]
  );

  const visibleQuestions = useMemo(() => {
    if (!pretest) return [];
    if (pretest.releaseAllQuestions) return publicQuestions;
    return publicQuestions.filter((q) => q.questionId === pretest.activeQuestionId);
  }, [pretest, publicQuestions]);

  const standardQuestions = useMemo(
    () => publicQuestions.filter((q) => !q.isTieBreak),
    [publicQuestions]
  );

  const handleSubmitOne = async (questionId: string) => {
    if (!identity) return;
    const choice = draftChoices[questionId];
    if (!choice) return;
    setSubmittingQId(questionId);
    setErrorMsg(null);
    try {
      await submitPretestAnswer({
        pretestId,
        questionId,
        identity,
        selectedOption: choice,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mengirim jawaban.');
    } finally {
      setSubmittingQId(null);
    }
  };

  if (!identityChecked) {
    return (
      <div className="min-h-screen bg-[#0E2142] text-white flex items-center justify-center">
        <LoadingState label="Memeriksa sesi pilihan ganda..." />
      </div>
    );
  }

  if (!identity) {
    return (
      <div className="min-h-screen bg-[#0E2142] flex items-center justify-center p-5">
        <div className="max-w-md w-full bg-white rounded-2xl p-7 text-center space-y-4">
          <h1 className="text-xl font-extrabold text-[#0E2142]">Identitas Tidak Ditemukan</h1>
          <p className="text-sm text-slate-600">
            Silakan masuk kembali melalui halaman Portal Mahasiswa.
          </p>
          <Link
            to="/join"
            className="inline-flex w-full min-h-[48px] items-center justify-center rounded-xl bg-[#2563EB] text-white font-bold text-sm"
          >
            Kembali ke Halaman Masuk
          </Link>
        </div>
      </div>
    );
  }

  if (!pretest) {
    return (
      <div className="min-h-screen bg-[#0E2142] text-white flex items-center justify-center">
        <LoadingState label="Menghubungkan ke sesi pilihan ganda..." />
      </div>
    );
  }

  const allStandardAnswered =
    standardQuestions.length > 0 && standardQuestions.every((q) => submittedQIds.has(q.questionId));

  const allVisibleAnswered =
    visibleQuestions.length > 0 && visibleQuestions.every((q) => submittedQIds.has(q.questionId));

  const revealedAtEnd =
    allStandardAnswered &&
    (pretest.status === 'FINISHED' || pretest.showResultsToStudents) &&
    standardQuestions.some((q) => q.answerRevealed && Boolean(q.revealedAnswer));

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-[#0E2142] flex flex-col">
      {!isOnline && <DisconnectedBanner />}

      {/* Compact Sticky Top Bar */}
      <header className="bg-[#0E2142] text-white px-4 py-3.5 sticky top-0 z-20 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#F1C56C]">
            Pilihan Ganda · {pretest.joinCode}
          </div>
          <div className="text-sm font-extrabold truncate">
            {participant?.displayName || identity.displayName}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {pretest.timerRunning && (
            <div className="px-3 py-1.5 rounded-lg bg-white/10 font-mono text-sm font-extrabold text-[#F1C56C] tabular-nums flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              <span>{formatSeconds(countdownSec)}</span>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 p-4 max-w-xl w-full mx-auto space-y-4">
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800">
            {errorMsg}
          </div>
        )}

        {/* Lobby / Paused / Finished */}
        {(pretest.status === 'LOBBY' || pretest.status === 'DRAFT') && (
          <div className="bg-white rounded-2xl border border-slate-200 p-7 text-center space-y-3 mt-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <h1 className="text-lg font-extrabold text-[#0E2142]">Anda Sudah Masuk</h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Menunggu Admin membuka soal pilihan ganda. Tetap buka halaman ini di ponsel Anda.
            </p>
          </div>
        )}

        {pretest.status === 'PAUSED' && (
          <div className="bg-white rounded-2xl border border-amber-200 p-7 text-center space-y-3 mt-4">
            <PauseCircle className="w-10 h-10 text-amber-500 mx-auto" />
            <h2 className="text-lg font-extrabold text-[#0E2142]">Kuis Dijeda</h2>
            <p className="text-sm text-slate-600">
              Admin menjeda sesi sementara. Tunggu instruksi berikutnya.
            </p>
          </div>
        )}

        {pretest.status === 'FINISHED' && (
          <div className="space-y-4 mt-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-7 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <h2 className="text-lg font-extrabold text-[#0E2142]">Kuis Pilihan Ganda Selesai</h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                {revealedAtEnd
                  ? 'Seluruh pertanyaan telah selesai dikerjakan. Kunci jawaban dan pembahasan tersedia di bawah ini.'
                  : 'Jawaban Anda telah tersimpan dengan aman. Menunggu arahan Admin untuk sesi berikutnya.'}
              </p>
            </div>

            {revealedAtEnd && (
              <div className="space-y-3">
                <h3 className="text-sm font-extrabold text-[#0E2142] px-1">
                  Kunci Jawaban &amp; Pembahasan Akhir
                </h3>
                {standardQuestions.map((q, idx) =>
                  q.answerRevealed && q.revealedAnswer ? (
                    <div
                      key={q.questionId}
                      className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2.5"
                    >
                      <div className="text-xs font-bold text-slate-500">
                        SOAL #{idx + 1}
                      </div>
                      <ArabicText
                        text={q.questionText}
                        className="text-sm font-bold text-[#0E2142] leading-relaxed"
                      />
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900">
                        Kunci Jawaban: <ArabicText text={q.revealedAnswer} className="inline" />
                      </div>
                      {q.revealedExplanation && (
                        <div className="text-xs text-slate-600 leading-relaxed">
                          <span className="font-bold text-[#0E2142]">Pembahasan: </span>
                          <ArabicText text={q.revealedExplanation} className="inline" />
                        </div>
                      )}
                    </div>
                  ) : null
                )}
              </div>
            )}
          </div>
        )}

        {/* Active Multiple-Choice Questions ONLY */}
        {pretest.status === 'ACTIVE' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between text-xs font-bold">
              <span className="text-slate-600">Progres Jawaban Anda</span>
              <span className="text-[#2563EB] tabular-nums">
                {myReceipts.length} / {visibleQuestions.length} Soal Terkirim
              </span>
            </div>

            {allVisibleAnswered && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center space-y-1">
                <div className="text-sm font-extrabold text-emerald-800">
                  Seluruh Soal Saat Ini Sudah Terkirim
                </div>
                <p className="text-xs text-emerald-700">
                  {revealedAtEnd
                    ? 'Kunci jawaban telah dibuka di akhir pengerjaan.'
                    : 'Menunggu Admin menutup sesi dan membuka kunci jawaban akhir.'}
                </p>
              </div>
            )}

            {revealedAtEnd && (
              <div className="space-y-3">
                <h3 className="text-sm font-extrabold text-[#0E2142] px-1">
                  Kunci Jawaban &amp; Pembahasan Akhir
                </h3>
                {standardQuestions.map((q, idx) =>
                  q.answerRevealed && q.revealedAnswer ? (
                    <div
                      key={q.questionId}
                      className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2.5"
                    >
                      <div className="text-xs font-bold text-slate-500">
                        SOAL #{idx + 1}
                      </div>
                      <ArabicText
                        text={q.questionText}
                        className="text-sm font-bold text-[#0E2142] leading-relaxed"
                      />
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900">
                        Kunci Jawaban: <ArabicText text={q.revealedAnswer} className="inline" />
                      </div>
                      {q.revealedExplanation && (
                        <div className="text-xs text-slate-600 leading-relaxed">
                          <span className="font-bold text-[#0E2142]">Pembahasan: </span>
                          <ArabicText text={q.revealedExplanation} className="inline" />
                        </div>
                      )}
                    </div>
                  ) : null
                )}
              </div>
            )}

            {visibleQuestions.map((q, idx) => {
              const isSubmitted = submittedQIds.has(q.questionId);
              const selected = draftChoices[q.questionId] ?? '';
              return (
                <div
                  key={q.questionId}
                  className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>SOAL PILIHAN GANDA #{idx + 1}</span>
                    {isSubmitted && (
                      <span className="text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Terkirim
                      </span>
                    )}
                  </div>

                  <ArabicText
                    text={q.questionText}
                    className="text-base font-bold text-[#0E2142] leading-relaxed"
                  />

                  <div className="space-y-2.5">
                    {q.options.map((opt, optIdx) => {
                      const activeChoice = selected === opt;
                      return (
                        <button
                          key={optIdx}
                          type="button"
                          disabled={isSubmitted}
                          onClick={() =>
                            setDraftChoices((prev) => ({ ...prev, [q.questionId]: opt }))
                          }
                          className={`w-full min-h-[48px] p-3.5 rounded-xl border text-left text-sm font-semibold flex items-center gap-3 transition-colors disabled:opacity-60 ${
                            activeChoice
                              ? 'bg-[#0E2142] text-white border-[#0E2142]'
                              : 'bg-slate-50 text-[#0E2142] border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          <span
                            className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-extrabold shrink-0 ${
                              activeChoice
                                ? 'bg-[#F1C56C] text-[#0E2142]'
                                : 'bg-white border border-slate-300 text-slate-600'
                            }`}
                          >
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          <ArabicText text={opt} className="flex-1" />
                        </button>
                      );
                    })}
                  </div>

                  {!isSubmitted && (
                    <button
                      type="button"
                      disabled={!selected || submittingQId === q.questionId}
                      onClick={() => void handleSubmitOne(q.questionId)}
                      className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-[#2563EB] text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      <span>
                        {submittingQId === q.questionId ? 'Mengirim...' : 'Kirim Jawaban'}
                      </span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
