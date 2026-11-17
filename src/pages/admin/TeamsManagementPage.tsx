import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import {
  Check,
  Crown,
  Lock,
  Plus,
  Trash2,
  Unlock,
  UserX,
  X,
} from 'lucide-react';
import { AdminLayout } from '../../layouts/AdminLayout';
import { AdminStudentCheckinsPanel } from '../../components/AdminStudentCheckinsPanel';
import { useAuth } from '../../context/AuthContext';
import { EmptyState, LoadingState } from '../../components/StatusViews';
import { db, handleFirestoreError } from '../../lib/firebase';
import {
  deleteTeam,
  moveParticipantTeam,
  saveTeam,
  setTeamCaptain,
  updateParticipantStatus,
  updateSessionFields,
} from '../../services/firestoreService';
import {
  OperationType,
  TEAM_COLOR_PALETTE,
  type Participant,
  type Session,
  type Team,
} from '../../types/arena';

export const TeamsManagementPage: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamColor, setNewTeamColor] = useState(TEAM_COLOR_PALETTE[0]);

  const { user, isLecturer, authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !user || !isLecturer) return;
    const unsub = onSnapshot(
      query(collection(db, 'sessions'), orderBy('createdAt', 'desc')),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Session);
        setSessions(list);
        if (list.length > 0 && !selectedSessionId) {
          setSelectedSessionId(list[0].sessionId);
        }
        setLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'sessions')
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, isLecturer]);

  useEffect(() => {
    if (authLoading || !user || !isLecturer || !selectedSessionId) return;
    const unsubTeams = onSnapshot(
      query(collection(db, 'sessions', selectedSessionId, 'teams'), orderBy('orderIndex', 'asc')),
      (snap) => setTeams(snap.docs.map((d) => d.data() as Team)),
      (err) => handleFirestoreError(err, OperationType.LIST, `sessions/${selectedSessionId}/teams`)
    );
    const unsubParts = onSnapshot(
      query(collection(db, 'sessions', selectedSessionId, 'participants'), orderBy('joinedAt', 'asc')),
      (snap) => setParticipants(snap.docs.map((d) => d.data() as Participant)),
      (err) =>
        handleFirestoreError(err, OperationType.LIST, `sessions/${selectedSessionId}/participants`)
    );
    return () => {
      unsubTeams();
      unsubParts();
    };
  }, [authLoading, user, isLecturer, selectedSessionId]);

  const activeSession = sessions.find((s) => s.sessionId === selectedSessionId) ?? null;

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession || !newTeamName.trim()) return;
    await saveTeam(activeSession.sessionId, {
      teamId: `team_${Date.now()}`,
      name: newTeamName.trim(),
      color: newTeamColor,
      score: 0,
      captainParticipantId: null,
      captainName: null,
      orderIndex: teams.length,
    });
    setNewTeamName('');
  };

  const handleRenameTeam = async (team: Team, nextName: string) => {
    if (!activeSession || !nextName.trim()) return;
    await saveTeam(activeSession.sessionId, { ...team, name: nextName.trim() });
  };

  const handleColorTeam = async (team: Team, color: string) => {
    if (!activeSession) return;
    await saveTeam(activeSession.sessionId, { ...team, color });
  };

  const joinUrl = activeSession
    ? `${window.location.origin}/join?code=${activeSession.joinCode}`
    : '';

  const pendingParticipants = participants.filter((p) => p.status === 'PENDING');
  const activeParticipants = participants.filter((p) => p.status === 'APPROVED');

  return (
    <AdminLayout
      title="Manajemen Tim & Mahasiswa"
      subtitle="Atur tim (2 hingga 6+ tim), persetujuan masuk, ketua tim, dan akses bergabung"
    >
      {loading ? (
        <LoadingState label="Memuat data sesi dan tim..." />
      ) : (
        <div className="space-y-6">
          <AdminStudentCheckinsPanel compact />

          {sessions.length === 0 ? (
            <EmptyState
              title="Belum Ada Sesi Kompetisi"
              description="Buat sesi kompetisi terlebih dahulu di menu Sesi Kompetisi untuk mulai mengelola tim dan peserta."
            />
          ) : (
            <div className="space-y-6">
          {/* Session Picker + Join Lock & QR */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3 flex-1">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Pilih Sesi Kompetisi
                </label>
                <select
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  className="w-full max-w-md px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold bg-white"
                >
                  {sessions.map((s) => (
                    <option key={s.sessionId} value={s.sessionId}>
                      {s.title} ({s.status} · Kode {s.joinCode})
                    </option>
                  ))}
                </select>
              </div>

              {activeSession && (
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    onClick={() =>
                      void updateSessionFields(activeSession.sessionId, {
                        isJoinLocked: !activeSession.isJoinLocked,
                      })
                    }
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-colors ${
                      activeSession.isJoinLocked
                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : 'bg-slate-50 text-[#0E2142] border-slate-200'
                    }`}
                  >
                    {activeSession.isJoinLocked ? (
                      <Lock className="w-3.5 h-3.5" />
                    ) : (
                      <Unlock className="w-3.5 h-3.5" />
                    )}
                    {activeSession.isJoinLocked ? 'Pendaftaran Terkunci' : 'Pendaftaran Terbuka'}
                  </button>

                  <button
                    onClick={() =>
                      void updateSessionFields(activeSession.sessionId, {
                        requireJoinApproval: !activeSession.requireJoinApproval,
                      })
                    }
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-slate-50 text-[#0E2142]"
                  >
                    Persetujuan Admin:{' '}
                    {activeSession.requireJoinApproval ? 'Wajib Disetujui' : 'Otomatis Masuk'}
                  </button>

                  <select
                    value={activeSession.submissionMode}
                    onChange={(e) =>
                      void updateSessionFields(activeSession.sessionId, {
                        submissionMode: e.target.value as Session['submissionMode'],
                      })
                    }
                    className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white"
                  >
                    <option value="CAPTAIN_ONLY">Mode Jawab: Khusus Ketua Tim</option>
                    <option value="TEAM_CONSENSUS">Mode Jawab: Konsensus Tim (1 Jawaban/Tim)</option>
                    <option value="INDIVIDUAL">Mode Jawab: Individu Mahasiswa</option>
                  </select>
                </div>
              )}
            </div>

            {activeSession && (
              <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-2xl p-4 shrink-0">
                <QRCodeSVG value={joinUrl} size={84} />
                <div>
                  <div className="text-xs text-slate-500">Kode Gabung Sesi</div>
                  <div className="text-2xl font-mono font-bold text-[#0E2142] tabular-nums tracking-wider">
                    {activeSession.joinCode}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {activeParticipants.length} disetujui · {pendingParticipants.length} menunggu
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Pending Approvals */}
          {pendingParticipants.length > 0 && activeSession && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
              <h2 className="text-sm font-bold text-amber-950">
                Menunggu Persetujuan Admin ({pendingParticipants.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {pendingParticipants.map((p) => {
                  const team = teams.find((t) => t.teamId === p.teamId);
                  return (
                    <div
                      key={p.participantId}
                      className="bg-white rounded-xl border border-amber-200 p-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-[#0E2142] truncate">
                          {p.displayName}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          Memilih: {team?.name || p.teamId}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() =>
                            void updateParticipantStatus(
                              activeSession.sessionId,
                              p.participantId,
                              'APPROVED'
                            )
                          }
                          className="p-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                          title="Setujui peserta"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() =>
                            void updateParticipantStatus(
                              activeSession.sessionId,
                              p.participantId,
                              'REJECTED'
                            )
                          }
                          className="p-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700"
                          title="Tolak peserta"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Teams Grid */}
          {activeSession && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {teams.map((team) => {
                const members = activeParticipants.filter((p) => p.teamId === team.teamId);
                return (
                  <div
                    key={team.teamId}
                    className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <input
                            type="color"
                            value={team.color}
                            onChange={(e) => void handleColorTeam(team, e.target.value)}
                            className="w-7 h-7 rounded-lg border border-slate-200 cursor-pointer shrink-0"
                            title="Ubah warna tim"
                          />
                          <input
                            type="text"
                            defaultValue={team.name}
                            onBlur={(e) => void handleRenameTeam(team, e.target.value)}
                            className="font-bold text-base text-[#0E2142] bg-transparent border-b border-transparent focus:border-slate-300 focus:outline-none w-full"
                          />
                        </div>
                        <button
                          onClick={() => void deleteTeam(activeSession.sessionId, team.teamId)}
                          disabled={teams.length <= 2}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30"
                          title="Hapus tim (minimal 2 tim)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="text-xs text-slate-500 flex items-center justify-between">
                        <span>{members.length} anggota aktif</span>
                        <span className="font-mono font-bold text-[#0E2142] tabular-nums">
                          {team.score} poin
                        </span>
                      </div>

                      <div className="divide-y divide-slate-100 border-t border-slate-100">
                        {members.length === 0 ? (
                          <div className="py-4 text-xs text-slate-400 text-center">
                            Belum ada mahasiswa di tim ini
                          </div>
                        ) : (
                          members.map((m) => (
                            <div
                              key={m.participantId}
                              className="py-2.5 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-[#0E2142] truncate flex items-center gap-1.5">
                                  <span>{m.displayName}</span>
                                  {m.isCaptain && (
                                    <Crown
                                      className="w-3.5 h-3.5 text-amber-600 shrink-0"
                                      aria-label="Ketua Tim"
                                    />
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {!m.isCaptain && (
                                  <button
                                    onClick={() =>
                                      void setTeamCaptain(activeSession.sessionId, team.teamId, m)
                                    }
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-amber-700 hover:bg-amber-50"
                                    title="Jadikan Ketua Tim"
                                  >
                                    <Crown className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                <select
                                  value={m.teamId}
                                  onChange={(e) =>
                                    void moveParticipantTeam(
                                      activeSession.sessionId,
                                      m.participantId,
                                      e.target.value
                                    )
                                  }
                                  className="text-xs border border-slate-200 rounded-lg px-1.5 py-1 bg-white max-w-[110px]"
                                  title="Pindahkan ke tim lain"
                                >
                                  {teams.map((t) => (
                                    <option key={t.teamId} value={t.teamId}>
                                      {t.name}
                                    </option>
                                  ))}
                                </select>

                                <button
                                  onClick={() =>
                                    void updateParticipantStatus(
                                      activeSession.sessionId,
                                      m.participantId,
                                      'REMOVED'
                                    )
                                  }
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                  title="Keluarkan peserta"
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Add Team Form */}
              <form
                onSubmit={handleAddTeam}
                className="bg-slate-50 rounded-2xl border border-dashed border-slate-300 p-5 flex flex-col justify-center gap-3"
              >
                <div className="text-sm font-bold text-[#0E2142]">Tambah Tim Baru</div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newTeamColor}
                    onChange={(e) => setNewTeamColor(e.target.value)}
                    className="w-10 h-10 rounded-xl border border-slate-300 cursor-pointer shrink-0"
                  />
                  <input
                    type="text"
                    required
                    maxLength={80}
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="Nama Tim Baru (mis. Tim Al-Faruq)"
                    className="flex-1 px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-[#0E2142] text-white text-sm font-semibold hover:bg-[#16315E] flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Tambahkan Tim
                </button>
              </form>
            </div>
          )}
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
};
