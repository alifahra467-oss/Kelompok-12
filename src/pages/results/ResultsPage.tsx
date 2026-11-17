import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Papa from 'papaparse';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { ArrowLeft, Download, Printer, Trophy, Users } from 'lucide-react';
import { ArabicText } from '../../components/ArabicText';
import { EmptyState, LoadingState } from '../../components/StatusViews';
import { db, handleFirestoreError } from '../../lib/firebase';
import {
  OperationType,
  type Course,
  type Participant,
  type PublicQuestion,
  type ScoreEvent,
  type Session,
  type SubmissionReceipt,
  type Team,
} from '../../types/arena';

export const ResultsPage: React.FC = () => {
  const { id: sessionId = '' } = useParams<{ id: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [receipts, setReceipts] = useState<SubmissionReceipt[]>([]);
  const [scoreEvents, setScoreEvents] = useState<ScoreEvent[]>([]);
  const [loading, setLoading] = useState(true);

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

    const unsubQ = onSnapshot(
      collection(db, 'sessions', sessionId, 'public_questions'),
      (snap) => setQuestions(snap.docs.map((d) => d.data() as PublicQuestion)),
      (err) =>
        handleFirestoreError(err, OperationType.LIST, `sessions/${sessionId}/public_questions`)
    );

    const unsubRec = onSnapshot(
      collection(db, 'sessions', sessionId, 'submission_receipts'),
      (snap) => setReceipts(snap.docs.map((d) => d.data() as SubmissionReceipt)),
      (err) =>
        handleFirestoreError(err, OperationType.LIST, `sessions/${sessionId}/submission_receipts`)
    );

    const unsubEvents = onSnapshot(
      query(collection(db, 'sessions', sessionId, 'score_events'), orderBy('createdAt', 'desc')),
      (snap) => setScoreEvents(snap.docs.map((d) => d.data() as ScoreEvent)),
      (err) => handleFirestoreError(err, OperationType.LIST, `sessions/${sessionId}/score_events`)
    );

    return () => {
      unsubCourse();
      unsubSes();
      unsubTeams();
      unsubParts();
      unsubQ();
      unsubRec();
      unsubEvents();
    };
  }, [sessionId]);

  const sortedTeams = useMemo(() => [...teams].sort((a, b) => b.score - a.score), [teams]);
  const approvedParticipants = useMemo(
    () => participants.filter((p) => p.status === 'APPROVED'),
    [participants]
  );

  const completionRate = useMemo(() => {
    if (questions.length === 0 || teams.length === 0) return 0;
    const expected = questions.length * teams.length;
    return Math.min(100, Math.round((receipts.length / expected) * 100));
  }, [questions.length, teams.length, receipts.length]);

  const handleExportCSV = () => {
    if (!session) return;
    const rows = sortedTeams.map((t, idx) => ({
      Peringkat: idx + 1,
      NamaTim: t.name,
      KetuaTim: t.captainName || '-',
      JumlahAnggota: approvedParticipants.filter((p) => p.teamId === t.teamId).length,
      SkorAkhir: t.score,
    }));
    const csv = '\uFEFF' + Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hasil-${session.joinCode}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center">
        <LoadingState label="Memuat hasil dan laporan sesi..." />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#F1F5F9] p-8 flex items-center justify-center">
        <EmptyState
          title="Laporan Sesi Tidak Ditemukan"
          description="Sesi kompetisi tidak tersedia atau ID sesi salah."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-[#0E2142]">
      <header className="bg-white border-b border-slate-200 px-6 py-4 no-print">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/admin/sessions"
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
              title="Kembali ke Daftar Sesi"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-[#0E2142]">Laporan Hasil Kompetisi</h1>
              <p className="text-xs text-slate-500">
                {course?.title || 'ARENA KELAS 2.0'} · {session.title}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              Ekspor CSV
            </button>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 rounded-xl bg-[#0E2142] text-white text-xs font-semibold hover:bg-[#16315E] flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              Cetak / Simpan PDF
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Winner Header */}
        <section className="bg-[#0E2142] text-white rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-[#F1C56C]">
              {course?.title || 'Mata Kuliah'} · {session.meetingLabel || 'Sesi Kompetisi'} · Kode{' '}
              {session.joinCode}
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold">{session.title}</h2>
            <p className="text-sm text-slate-300">
              Mode: {session.gameMode} · Status: {session.status}
            </p>
          </div>

          {sortedTeams[0] && (
            <div className="bg-[#13294E] border border-[#F1C56C]/50 rounded-2xl px-6 py-4 flex items-center gap-4 shrink-0">
              <Trophy className="w-9 h-9 text-[#F1C56C]" />
              <div>
                <div className="text-xs text-[#F1C56C] font-semibold">Peringkat Tertinggi</div>
                <div className="text-xl font-bold">{sortedTeams[0].name}</div>
                <div className="font-mono text-lg font-bold text-[#F1C56C] tabular-nums">
                  {sortedTeams[0].score} poin
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Summary Metrics */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="text-xs text-slate-500 font-semibold">Jumlah Tim</div>
            <div className="text-2xl font-bold text-[#0E2142] tabular-nums mt-1">{teams.length}</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="text-xs text-slate-500 font-semibold">Kehadiran Mahasiswa</div>
            <div className="text-2xl font-bold text-[#0E2142] tabular-nums mt-1">
              {approvedParticipants.length}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="text-xs text-slate-500 font-semibold">Soal Dimainkan</div>
            <div className="text-2xl font-bold text-[#0E2142] tabular-nums mt-1">
              {questions.length}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="text-xs text-slate-500 font-semibold">Tingkat Pengumpulan</div>
            <div className="text-2xl font-bold text-[#2563EB] tabular-nums mt-1">
              {completionRate}%
            </div>
          </div>
        </section>

        {/* Leaderboard & Team Breakdown */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h3 className="text-base font-bold text-[#0E2142]">Klasemen &amp; Rincian Tim</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-2.5 pr-4">Peringkat</th>
                  <th className="py-2.5 pr-4">Tim</th>
                  <th className="py-2.5 pr-4">Ketua Tim</th>
                  <th className="py-2.5 pr-4">Anggota Hadir</th>
                  <th className="py-2.5 text-right">Skor Akhir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedTeams.map((team, idx) => {
                  const members = approvedParticipants.filter((p) => p.teamId === team.teamId);
                  return (
                    <tr key={team.teamId}>
                      <td className="py-3 pr-4 font-mono font-bold tabular-nums">#{idx + 1}</td>
                      <td className="py-3 pr-4 font-bold text-[#0E2142]">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: team.color }}
                          />
                          <span>{team.name}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{team.captainName || '-'}</td>
                      <td className="py-3 pr-4 text-slate-600">
                        {members.map((m) => m.displayName).join(', ') || '-'}
                      </td>
                      <td className="py-3 text-right font-mono font-bold text-[#0E2142] tabular-nums">
                        {team.score}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Question-level results */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h3 className="text-base font-bold text-[#0E2142]">Hasil Per Soal</h3>
          {questions.length === 0 ? (
            <p className="text-sm text-slate-500">Belum ada soal yang dirilis pada sesi ini.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {questions.map((q) => {
                const qReceipts = receipts.filter((r) => r.questionId === q.questionId);
                return (
                  <div key={q.questionId} className="py-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>
                        {q.topicName} · {q.points} Poin maks
                      </span>
                      <span className="tabular-nums">{qReceipts.length} respons terkirim</span>
                    </div>
                    <div className="text-sm font-semibold text-[#0E2142]">
                      <ArabicText text={q.questionText} />
                    </div>
                    {qReceipts.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {qReceipts.map((r) => (
                          <div
                            key={r.submissionId}
                            className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                          >
                            <span className="font-semibold text-[#0E2142]">{r.teamName}</span>
                            <span className="text-slate-500">
                              {' '}
                              ·{' '}
                              {r.status === 'GRADED'
                                ? `${r.awardedPoints >= 0 ? `+${r.awardedPoints}` : r.awardedPoints} poin`
                                : 'Belum dinilai'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Attendance & Grading Records */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#2563EB]" />
              <h3 className="text-base font-bold text-[#0E2142]">
                Daftar Hadir Peserta ({approvedParticipants.length})
              </h3>
            </div>
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto text-sm">
              {approvedParticipants.map((p) => {
                const team = teams.find((t) => t.teamId === p.teamId);
                return (
                  <div key={p.participantId} className="py-2 flex items-center justify-between">
                    <span className="font-medium text-[#0E2142]">
                      {p.displayName} {p.isCaptain ? '(Ketua Tim)' : ''}
                    </span>
                    <span className="text-xs text-slate-500">{team?.name || p.teamId}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
            <h3 className="text-base font-bold text-[#0E2142]">Catatan Penilaian Admin</h3>
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto text-xs">
              {scoreEvents.length === 0 ? (
                <p className="text-slate-400 py-4">Belum ada catatan penilaian.</p>
              ) : (
                scoreEvents.map((ev) => (
                  <div
                    key={ev.eventId}
                    className={`py-2.5 flex items-center justify-between gap-2 ${
                      ev.undone ? 'text-slate-400 line-through' : 'text-slate-700'
                    }`}
                  >
                    <div>
                      <span className="font-bold text-[#0E2142]">{ev.teamName}</span>
                      <span className="text-slate-500"> · {ev.reason}</span>
                    </div>
                    <span className="font-mono font-bold tabular-nums shrink-0">
                      {ev.delta >= 0 ? `+${ev.delta}` : ev.delta}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};
