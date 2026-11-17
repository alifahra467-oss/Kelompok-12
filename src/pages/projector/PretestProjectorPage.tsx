import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowRight,
  Clock,
  Crown,
  Maximize2,
  Minimize2,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ArabicText } from '../../components/ArabicText';
import { ConfettiBurst, SmartSpinnerWheel } from '../../components/SmartSpinnerWheel';
import { LoadingState } from '../../components/StatusViews';
import { db, handleFirestoreError } from '../../lib/firebase';
import { formatSeconds, syncServerTime, useServerCountdown } from '../../lib/serverTime';
import { OperationType } from '../../types/arena';
import type {
  Pretest,
  PretestParticipant,
  PretestQuestionPublic,
  PretestSubmissionReceipt,
} from '../../types/pretest';

export const PretestProjectorPage: React.FC = () => {
  const { id: pretestId = '' } = useParams<{ id: string }>();

  const [pretest, setPretest] = useState<Pretest | null>(null);
  const [publicQuestions, setPublicQuestions] = useState<PretestQuestionPublic[]>([]);
  const [participants, setParticipants] = useState<PretestParticipant[]>([]);
  const [receipts, setReceipts] = useState<PretestSubmissionReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    void syncServerTime();
  }, []);

  useEffect(() => {
    if (!pretestId) return;

    const unsubPre = onSnapshot(
      doc(db, 'pretests', pretestId),
      (snap) => {
        setPretest(snap.exists() ? (snap.data() as Pretest) : null);
        setLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, `pretests/${pretestId}`);
        setLoading(false);
      }
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

    const unsubPart = onSnapshot(
      query(collection(db, 'pretests', pretestId, 'participants'), orderBy('joinedAt', 'asc')),
      (snap) => setParticipants(snap.docs.map((d) => d.data() as PretestParticipant)),
      (err) =>
        handleFirestoreError(err, OperationType.LIST, `pretests/${pretestId}/participants`)
    );

    const unsubRec = onSnapshot(
      collection(db, 'pretests', pretestId, 'submission_receipts'),
      (snap) => setReceipts(snap.docs.map((d) => d.data() as PretestSubmissionReceipt)),
      (err) =>
        handleFirestoreError(err, OperationType.LIST, `pretests/${pretestId}/submission_receipts`)
    );

    return () => {
      unsubPre();
      unsubQ();
      unsubPart();
      unsubRec();
    };
  }, [pretestId]);

  const countdownSec = useServerCountdown(
    pretest?.timerRunning ?? false,
    pretest?.timerEndTimeMs,
    pretest?.timerRemainingSec ?? 0
  );

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  const activeParticipants = useMemo(
    () => participants.filter((p) => p.status !== 'REMOVED'),
    [participants]
  );

  const activePublicQuestion = useMemo(
    () => publicQuestions.find((q) => q.questionId === pretest?.activeQuestionId) ?? null,
    [publicQuestions, pretest?.activeQuestionId]
  );

  const joinUrl =
    typeof window !== 'undefined' && pretest
      ? `${window.location.origin}/join?code=${pretest.joinCode}`
      : '';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0E2142] text-white flex items-center justify-center">
        <LoadingState label="Menyiapkan layar proyektor pre-test..." />
      </div>
    );
  }

  if (!pretest) {
    return (
      <div className="min-h-screen bg-[#0E2142] text-white flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-bold">Sesi Pre-Test Tidak Ditemukan</h1>
          <p className="text-sm text-slate-300">Periksa kembali tautan proyektor dari konsol admin.</p>
        </div>
      </div>
    );
  }

  const alloc = pretest.allocation;

  return (
    <div
      className="min-h-screen bg-[#0E2142] text-white flex flex-col relative overflow-hidden"
      style={{
        backgroundImage:
          'linear-gradient(rgba(14,33,66,0.92), rgba(14,33,66,0.96)), url(/src/assets/images/projector_stage_backdrop_1794722952391.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <ConfettiBurst active={alloc?.spinnerStatus === 'COMPLETED'} />

      {/* Top Broadcast Header */}
      <header className="px-6 lg:px-10 py-4 border-b border-white/10 flex items-center justify-between gap-6 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/src/assets/images/course_emblem_sirah_1794722950872.jpg"
            alt="Logo"
            className="w-10 h-10 rounded-xl object-cover border border-[#F1C56C]/40 shrink-0"
          />
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-widest text-[#F1C56C]">
              ARENA KELAS 2.0 · {alloc ? 'SMART TEAM SPINNER' : 'PRE-TEST SELEKSI TIM'}
            </div>
            <h1 className="text-xl lg:text-2xl font-extrabold truncate">{pretest.title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {pretest.timerRunning && (
            <div className="px-4 py-2 rounded-2xl bg-[#13294E] border border-[#F1C56C]/40 font-mono text-2xl font-extrabold text-[#F1C56C] tabular-nums flex items-center gap-2">
              <Clock className="w-5 h-5" />
              <span>{formatSeconds(countdownSec)}</span>
            </div>
          )}

          <div className="px-4 py-2 rounded-2xl bg-white/10 text-sm font-bold tabular-nums flex items-center gap-2">
            <Users className="w-4 h-4 text-[#F1C56C]" />
            <span>{activeParticipants.length} Peserta</span>
          </div>

          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white"
            aria-label="Toggle Suara"
          >
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>

          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white"
            aria-label="Layar Penuh"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Stage */}
      <main className="flex-1 p-6 lg:p-10 flex flex-col justify-center z-10">
        {alloc ? (
          <div className="max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left: Animated Spinner */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <SmartSpinnerWheel
                allocation={alloc}
                size={400}
                projectorMode
                muted={muted}
                onToggleMute={() => setMuted((m) => !m)}
              />

              {pretest.linkedSessionId && (
                <Link
                  to={`/present/${pretest.linkedSessionId}`}
                  className="mt-5 px-6 py-3.5 rounded-2xl bg-[#F1C56C] text-[#0E2142] text-sm font-extrabold hover:bg-amber-300 flex items-center gap-2"
                >
                  <span>Buka Layar Proyektor Kompetisi Utama</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>

            {/* Right: Revealed Teams Board */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {alloc.teams.map((team) => {
                const visibleMembers = team.members.filter(
                  (m) => m.isCaptain || alloc.revealedParticipantIds.includes(m.participantId)
                );
                const isLastTeam =
                  alloc.lastRevealed?.teamId === team.teamId &&
                  alloc.spinnerStatus !== 'COMPLETED';

                return (
                  <div
                    key={team.teamId}
                    className={`rounded-3xl border p-5 transition-all ${
                      isLastTeam
                        ? 'bg-[#173566] border-[#F1C56C] shadow-xl'
                        : 'bg-[#13294E]/90 border-white/15'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-white/10">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-4 h-4 rounded-full shrink-0"
                          style={{ backgroundColor: team.color }}
                        />
                        <h2 className="text-xl font-extrabold">{team.name}</h2>
                      </div>
                      <span className="text-xs font-bold text-slate-300 tabular-nums">
                        {visibleMembers.length} / {team.members.length}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {visibleMembers.map((m) => (
                        <div
                          key={m.participantId}
                          className={`px-3.5 py-2 rounded-xl flex items-center justify-between gap-2 ${
                            m.isCaptain
                              ? 'bg-[#F1C56C]/15 border border-[#F1C56C]/40 text-[#F1C56C]'
                              : 'bg-white/10 text-white'
                          }`}
                        >
                          <span className="font-bold text-sm lg:text-base truncate">
                            {m.displayName}
                          </span>
                          {m.isCaptain && (
                            <span className="flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider shrink-0">
                              <Crown className="w-3.5 h-3.5" />
                              Ketua
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : pretest.status === 'LOBBY' || pretest.status === 'DRAFT' ? (
          <div className="max-w-5xl w-full mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div className="bg-white text-[#0E2142] rounded-3xl p-8 flex flex-col items-center text-center space-y-5 shadow-2xl">
              <div className="text-xs font-extrabold uppercase tracking-widest text-[#2563EB]">
                Pindai QR atau Masukkan Kode
              </div>
              <QRCodeSVG value={joinUrl} size={230} />
              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-500">KODE PRE-TEST</div>
                <div className="font-mono text-5xl font-extrabold tracking-[0.22em] tabular-nums">
                  {pretest.joinCode}
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <div className="text-sm font-bold text-[#F1C56C] uppercase tracking-wider">
                  Lobi Pre-Test Terbuka
                </div>
                <h2 className="text-3xl font-extrabold mt-1">
                  {activeParticipants.length} Mahasiswa Sudah Bergabung
                </h2>
                <p className="text-sm text-slate-300 mt-1">
                  Kerjakan pre-test secara individu di ponsel masing-masing untuk menentukan pembagian tim yang seimbang.
                </p>
              </div>

              <div className="flex flex-wrap gap-2.5 max-h-72 overflow-y-auto">
                {activeParticipants.map((p) => (
                  <div
                    key={p.participantId}
                    className="px-4 py-2 rounded-xl bg-white/10 border border-white/15 text-sm font-bold"
                  >
                    {p.displayName}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : pretest.status === 'FINISHED' ? (
          <div className="max-w-3xl w-full mx-auto text-center space-y-4">
            <div className="text-sm font-bold uppercase tracking-widest text-[#F1C56C]">
              Pre-Test Selesai
            </div>
            <h2 className="text-4xl font-extrabold">
              Menghitung Peringkat &amp; Mempersiapkan Smart Team Spinner
            </h2>
            <p className="text-base text-slate-300">
              Admin sedang mengonfirmasi ketua tim dan menyeimbangkan komposisi kelompok kompetisi.
            </p>
          </div>
        ) : activePublicQuestion && !pretest.releaseAllQuestions ? (
          <div className="max-w-5xl w-full mx-auto space-y-6">
            <div className="bg-[#13294E] border border-white/15 rounded-3xl p-8 space-y-6">
              <div className="flex items-center justify-between text-sm font-bold text-[#F1C56C]">
                <span>
                  {activePublicQuestion.isTieBreak
                    ? 'PERTANYAAN PENENTU SERI (TIE-BREAK)'
                    : `SOAL #${activePublicQuestion.orderIndex}`}
                </span>
                <span className="tabular-nums">
                  {
                    receipts.filter((r) => r.questionId === activePublicQuestion.questionId)
                      .length
                  }{' '}
                  / {activeParticipants.length} Mahasiswa Menjawab
                </span>
              </div>

              <ArabicText
                text={activePublicQuestion.questionText}
                className="text-2xl lg:text-3xl font-extrabold leading-snug"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activePublicQuestion.options.map((opt, idx) => {
                  const isRevealedRight =
                    activePublicQuestion.answerRevealed &&
                    activePublicQuestion.revealedAnswer === opt;
                  return (
                    <div
                      key={idx}
                      className={`p-5 rounded-2xl border text-lg font-bold flex items-center gap-3 ${
                        isRevealedRight
                          ? 'bg-emerald-600/30 border-emerald-400 text-white'
                          : 'bg-white/10 border-white/15 text-white'
                      }`}
                    >
                      <span className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center text-sm font-extrabold shrink-0">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <ArabicText text={opt} className="flex-1" />
                    </div>
                  );
                })}
              </div>

              {activePublicQuestion.answerRevealed && activePublicQuestion.revealedExplanation && (
                <div className="p-5 rounded-2xl bg-emerald-950/60 border border-emerald-400/40 text-base text-emerald-100">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-300 mb-1">
                    Pembahasan
                  </div>
                  <ArabicText text={activePublicQuestion.revealedExplanation} />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-4xl w-full mx-auto text-center space-y-6">
            <div className="text-sm font-bold uppercase tracking-widest text-[#F1C56C]">
              {pretest.status === 'PAUSED'
                ? 'PRE-TEST DIJEDA SEMENTARA'
                : 'PRE-TEST SEDANG BERLANGSUNG'}
            </div>
            <h2 className="text-4xl lg:text-5xl font-extrabold">
              Kerjakan Soal di Ponsel Anda
            </h2>
            <p className="text-lg text-slate-300">
              Seluruh soal tampil secara individual di perangkat masing-masing. Pastikan seluruh nomor dijawab sebelum waktu berakhir.
            </p>
            <div className="inline-flex items-center gap-6 px-8 py-5 rounded-3xl bg-[#13294E] border border-white/15">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Total Jawaban Masuk
                </div>
                <div className="text-3xl font-extrabold text-[#F1C56C] tabular-nums">
                  {receipts.length}
                </div>
              </div>
              <div className="w-px h-10 bg-white/15" />
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Kode Gabung
                </div>
                <div className="font-mono text-3xl font-extrabold tabular-nums">
                  {pretest.joinCode}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
