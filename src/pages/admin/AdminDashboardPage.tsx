import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Database,
  PlayCircle,
  Plus,
  Save,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { AdminLayout } from '../../layouts/AdminLayout';
import { useAuth } from '../../context/AuthContext';
import { db, handleFirestoreError } from '../../lib/firebase';
import {
  addApprovedLecturer,
  deleteTopic,
  removeApprovedLecturer,
  saveCourse,
  saveTopic,
  seedSirahDemoData,
  seedUlumulQuranBank,
} from '../../services/firestoreService';
import {
  OperationType,
  type ApprovedLecturer,
  type Course,
  type QuestionPrivate,
  type Session,
  type Topic,
} from '../../types/arena';
import type { Pretest } from '../../types/pretest';
import { LoadingState } from '../../components/StatusViews';

export const AdminDashboardPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [courseForm, setCourseForm] = useState<Omit<Course, 'updatedAt'>>({
    courseId: 'main',
    title: '',
    description: '',
    lecturerName: '',
    semester: '',
    logoUrl: '/src/assets/images/course_emblem_sirah_1794722950872.jpg',
  });
  const [topics, setTopics] = useState<Topic[]>([]);
  const [lecturers, setLecturers] = useState<ApprovedLecturer[]>([]);
  const [questionCount, setQuestionCount] = useState(0);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [pretests, setPretests] = useState<Pretest[]>([]);

  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicDesc, setNewTopicDesc] = useState('');
  const [newTopicSubtopics, setNewTopicSubtopics] = useState('');

  const [newLecturerEmail, setNewLecturerEmail] = useState('');
  const [newLecturerName, setNewLecturerName] = useState('');

  const [feedback, setFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedingUq, setSeedingUq] = useState(false);
  const [uqAttempts, setUqAttempts] = useState<
    Array<{
      attemptId: string;
      studentName: string;
      studentNim?: string;
      totalCorrect: number;
      totalQuestions: number;
      percentage: number;
      submittedAtMs: number;
    }>
  >([]);

  const { user, isLecturer, authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !user || !isLecturer) return;
    const unsubCourse = onSnapshot(
      doc(db, 'course', 'main'),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data() as Course;
          setCourseForm({
            courseId: d.courseId,
            title: d.title || '',
            description: d.description || '',
            lecturerName: d.lecturerName || '',
            semester: d.semester || '',
            logoUrl: d.logoUrl || '/src/assets/images/course_emblem_sirah_1794722950872.jpg',
          });
        }
        setLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'course/main')
    );

    const unsubTopics = onSnapshot(
      query(collection(db, 'topics'), orderBy('orderIndex', 'asc')),
      (snap) => {
        setTopics(snap.docs.map((d) => d.data() as Topic));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'topics')
    );

    const unsubLecturers = onSnapshot(
      collection(db, 'approved_lecturers'),
      (snap) => {
        setLecturers(snap.docs.map((d) => d.data() as ApprovedLecturer));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'approved_lecturers')
    );

    const unsubQuestions = onSnapshot(
      collection(db, 'questions_private'),
      (snap) => {
        setQuestionCount(snap.docs.filter((d) => (d.data() as QuestionPrivate).isActive).length);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'questions_private')
    );

    const unsubSessions = onSnapshot(
      query(collection(db, 'sessions'), orderBy('createdAt', 'desc')),
      (snap) => {
        setSessions(snap.docs.map((d) => d.data() as Session));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'sessions')
    );

    const unsubPretests = onSnapshot(
      query(collection(db, 'pretests'), orderBy('createdAt', 'desc')),
      (snap) => {
        setPretests(snap.docs.map((d) => d.data() as Pretest));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'pretests')
    );

    const fetchUqAttempts = async () => {
      try {
        const token = sessionStorage.getItem('arena_admin_unlock_token');
        if (!token) return;
        const res = await fetch('/api/quiz/ulumul-quran/attempts', {
          headers: { 'x-admin-unlock-token': token },
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          attempts?: Array<{
            attemptId: string;
            studentName: string;
            studentNim?: string;
            totalCorrect: number;
            totalQuestions: number;
            percentage: number;
            submittedAtMs: number;
          }>;
        };
        setUqAttempts(data.attempts ?? []);
      } catch {
        // Non-blocking
      }
    };
    void fetchUqAttempts();

    return () => {
      unsubCourse();
      unsubTopics();
      unsubLecturers();
      unsubQuestions();
      unsubSessions();
      unsubPretests();
    };
  }, [authLoading, user, isLecturer]);

  const showNotice = (msg: string) => {
    setFeedback(msg);
    window.setTimeout(() => setFeedback(null), 4000);
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseForm.title.trim() || !courseForm.lecturerName.trim()) return;
    setSaving(true);
    try {
      await saveCourse(courseForm);
      showNotice('Profil pembelajaran berhasil disimpan.');
    } finally {
      setSaving(false);
    }
  };

  const handleSeedDemo = async () => {
    setSeeding(true);
    try {
      await seedSirahDemoData();
      showNotice('Contoh data Sirah Nabawiyah (materi, 4 topik, 18 soal) berhasil dimuat.');
    } finally {
      setSeeding(false);
    }
  };

  const handleSeedUlumulQuran = async () => {
    setSeedingUq(true);
    try {
      await seedUlumulQuranBank();
      showNotice(
        'Bank Soal ‘Ulûmul Qur’ân (4 Bab: Asbabun Nuzul, Turunnya Al-Qur’an, Pengumpulan & Penyusunan, Tujuh Huruf — 15 soal pilihan ganda) berhasil dimuat ke Bank Soal.'
      );
    } finally {
      setSeedingUq(false);
    }
  };

  const handleAddTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicName.trim()) return;
    const subtopics = newTopicSubtopics
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    await saveTopic({
      topicId: `topic_${Date.now()}`,
      name: newTopicName.trim(),
      description: newTopicDesc.trim(),
      subtopics,
      orderIndex: topics.length + 1,
    });
    setNewTopicName('');
    setNewTopicDesc('');
    setNewTopicSubtopics('');
    showNotice('Topik pembelajaran ditambahkan.');
  };

  const handleAddLecturer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLecturerEmail.includes('@')) return;
    await addApprovedLecturer(newLecturerEmail, newLecturerName);
    setNewLecturerEmail('');
    setNewLecturerName('');
    showNotice('Akun admin ditambahkan ke daftar izin.');
  };

  return (
    <AdminLayout
      title="Pusat Admin & Edit Pembelajaran"
      subtitle="Kelola materi pembelajaran, bank soal & kunci jawaban, nilai pilihan ganda, Smart Spinner, dan sesi Cerdas Cermat"
    >
      {loading ? (
        <LoadingState label="Memuat pusat kendali admin..." />
      ) : (
        <div className="space-y-6">
          {feedback && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl px-4 py-3 flex items-center gap-2.5 text-sm font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{feedback}</span>
            </div>
          )}

          {/* Top Summary Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="text-xs font-semibold text-slate-500 mb-1">Bank Soal &amp; Kunci</div>
              <div className="text-3xl font-bold text-[#0E2142] tabular-nums">{questionCount}</div>
              <div className="mt-2 text-xs text-slate-500">
                <Link to="/admin/questions" className="text-[#2563EB] font-semibold hover:underline">
                  Edit Pertanyaan &amp; Jawaban
                </Link>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="text-xs font-semibold text-slate-500 mb-1">Topik Pembelajaran</div>
              <div className="text-3xl font-bold text-[#0E2142] tabular-nums">{topics.length}</div>
              <div className="mt-2 text-xs text-slate-500">
                Materi aktif &amp; subtopik
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="text-xs font-semibold text-slate-500 mb-1">Sesi Pilihan Ganda &amp; Spinner</div>
              <div className="text-3xl font-bold text-[#0E2142] tabular-nums">{pretests.length}</div>
              <div className="mt-2 text-xs text-slate-500">
                <Link to="/admin/pretest" className="text-[#2563EB] font-semibold hover:underline">
                  Lihat Nilai PG &amp; Spinner
                </Link>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="text-xs font-semibold text-slate-500 mb-1">Sesi Cerdas Cermat</div>
              <div className="text-3xl font-bold text-[#0E2142] tabular-nums">{sessions.length}</div>
              <div className="mt-2 text-xs text-slate-500">
                <Link to="/admin/sessions" className="text-[#2563EB] font-semibold hover:underline">
                  Kelola Sesi Cerdas Cermat
                </Link>
              </div>
            </div>
          </div>

          {/* Unified Admin Visibility Hub: Nilai PG + Spinner + Cerdas Cermat */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Nilai Pilihan Ganda & Smart Team Spinner */}
            <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-bold text-[#0E2142] flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-[#2563EB]" />
                    <span>Nilai Pilihan Ganda &amp; Smart Spinner</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Pantau nilai pilihan ganda mahasiswa dan putar pembagian tim secara langsung
                  </p>
                </div>
                <Link
                  to="/admin/pretest"
                  className="text-xs font-bold text-[#2563EB] hover:underline whitespace-nowrap shrink-0"
                >
                  Semua Pre-Test
                </Link>
              </div>

              {pretests.length === 0 ? (
                <div className="py-6 text-center space-y-2">
                  <p className="text-xs text-slate-500">Belum ada sesi Pilihan Ganda / Spinner.</p>
                  <Link
                    to="/admin/pretest"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2563EB] text-white text-xs font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Buat Pilihan Ganda &amp; Spinner</span>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {pretests.slice(0, 4).map((pt) => (
                    <div
                      key={pt.pretestId}
                      className="p-3.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-500 tabular-nums">
                          {pt.status} · Kode {pt.joinCode} · {pt.teamCount} Tim
                        </div>
                        <div className="text-sm font-bold text-[#0E2142] truncate">{pt.title}</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <Link
                          to={`/admin/pretest/${pt.pretestId}?tab=MONITOR`}
                          className="px-2.5 py-1.5 rounded-lg bg-[#2563EB] text-white text-xs font-semibold hover:bg-blue-700"
                        >
                          Nilai PG
                        </Link>
                        <Link
                          to={`/admin/pretest/${pt.pretestId}?tab=SPINNER`}
                          className="px-2.5 py-1.5 rounded-lg bg-[#0E2142] text-[#F1C56C] text-xs font-semibold hover:bg-[#16315E] flex items-center gap-1"
                        >
                          <Users className="w-3 h-3" />
                          <span>Spinner</span>
                        </Link>
                        <Link
                          to={`/admin/pretest/${pt.pretestId}?tab=SOAL`}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Edit Soal
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Sesi Cerdas Cermat */}
            <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-bold text-[#0E2142] flex items-center gap-2">
                    <PlayCircle className="w-4 h-4 text-[#2563EB]" />
                    <span>Sesi Cerdas Cermat &amp; Bel Rebutan</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Kendalikan babak wajib, lemparan, bel rebutan, skor tim, dan laporan hasil
                  </p>
                </div>
                <Link
                  to="/admin/sessions"
                  className="text-xs font-bold text-[#2563EB] hover:underline whitespace-nowrap shrink-0"
                >
                  Semua Sesi
                </Link>
              </div>

              {sessions.length === 0 ? (
                <div className="py-6 text-center space-y-2">
                  <p className="text-xs text-slate-500">Belum ada sesi Cerdas Cermat.</p>
                  <Link
                    to="/admin/sessions"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0E2142] text-white text-xs font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Buat Sesi Cerdas Cermat</span>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {sessions.slice(0, 4).map((ses) => (
                    <div
                      key={ses.sessionId}
                      className="p-3.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-500 tabular-nums">
                          {ses.status} · {ses.gameMode} · Kode {ses.joinCode}
                        </div>
                        <div className="text-sm font-bold text-[#0E2142] truncate">{ses.title}</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <Link
                          to={`/admin/control/${ses.sessionId}`}
                          className="px-3 py-1.5 rounded-lg bg-[#2563EB] text-white text-xs font-semibold hover:bg-blue-700 flex items-center gap-1"
                        >
                          <span>Konsol Sesi</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                        <Link
                          to={`/results/${ses.sessionId}`}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Skor &amp; Laporan
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Ulumul Qur'an 15-Question Bank Banner */}
          <div className="bg-white rounded-2xl border border-[#2563EB]/30 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-[#0E2142] mb-1">
                Paket Soal ‘Ulûmul Qur’ân (4 Bab · 15 Soal Pilihan Ganda)
              </h2>
              <p className="text-sm text-slate-600 max-w-2xl">
                Muat 15 soal pilihan ganda beserta kunci jawaban dan pembahasan khusus dari Bab Asbabun Nuzul, Turunnya Al-Qur’an, Pengumpulan &amp; Penyusunan Al-Qur’an, serta Tujuh Huruf ke Bank Soal agar dapat diedit atau dipakai di Pre-Test dan Cerdas Cermat.
              </p>
            </div>
            <button
              onClick={() => void handleSeedUlumulQuran()}
              disabled={seedingUq}
              className="px-4 py-2.5 rounded-xl bg-[#2563EB] text-white text-sm font-bold hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 disabled:opacity-60"
            >
              <Database className="w-4 h-4" />
              {seedingUq ? 'Memuat 15 Soal...' : 'Muat 15 Soal ‘Ulûmul Qur’ân'}
            </button>
          </div>

          {/* Nilai Kuis PG Mandiri 15 Soal Ulumul Qur'an */}
          {uqAttempts.length > 0 && (
            <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-bold text-[#0E2142]">
                    Rekap Nilai Kuis Pilihan Ganda ‘Ulûmul Qur’ân (15 Soal)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Hasil pengerjaan mahasiswa pada halaman Kuis Pilihan Ganda Mandiri (/kuis-pg)
                  </p>
                </div>
                <span className="text-xs font-bold text-[#2563EB] tabular-nums">
                  {uqAttempts.length} Pengumpulan
                </span>
              </div>
              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-xs">
                  <thead className="text-left text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2 pr-3">Nama Mahasiswi</th>
                      <th className="py-2 pr-3">NIM</th>
                      <th className="py-2 pr-3 text-right">Jawaban Benar</th>
                      <th className="py-2 pr-3 text-right">Nilai</th>
                      <th className="py-2 text-right">Waktu Selesai</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {uqAttempts.map((a) => (
                      <tr key={a.attemptId}>
                        <td className="py-2.5 pr-3 font-semibold text-[#0E2142]">{a.studentName}</td>
                        <td className="py-2.5 pr-3 font-mono text-slate-600 tabular-nums">
                          {a.studentNim || '—'}
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">
                          {a.totalCorrect} / {a.totalQuestions}
                        </td>
                        <td className="py-2.5 pr-3 text-right font-bold text-[#2563EB] tabular-nums">
                          {a.percentage}%
                        </td>
                        <td className="py-2.5 text-right text-slate-500 tabular-nums">
                          {new Date(a.submittedAtMs).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Demo Data Banner */}
          <div className="bg-[#0E2142] text-white rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-[#F1C56C] mb-1">
                Contoh Data Pembelajaran: Sirah Nabawiyah
              </h2>
              <p className="text-sm text-slate-300 max-w-2xl">
                Muat contoh data resmi (berlabel [Contoh Data]) berisi profil pembelajaran Sirah Nabawiyah, 4 topik utama, dan 18 soal lengkap dengan teks Arab berharakat serta pembahasan.
              </p>
            </div>
            <button
              onClick={() => void handleSeedDemo()}
              disabled={seeding}
              className="px-4 py-2.5 rounded-xl bg-[#F1C56C] text-[#0E2142] text-sm font-bold hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 disabled:opacity-60"
            >
              <Database className="w-4 h-4" />
              {seeding ? 'Memuat Contoh Data...' : 'Muat Contoh Data Sirah Nabawiyah'}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Learning Profile Editor */}
            <form
              onSubmit={handleSaveCourse}
              className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-[#0E2142]">Identitas Materi Pembelajaran</h2>
                  <p className="text-xs text-slate-500">
                    Edit judul pembelajaran, pengelola admin, dan deskripsi materi aktif
                  </p>
                </div>
                {courseForm.logoUrl && (
                  <img
                    src={courseForm.logoUrl}
                    alt="Logo Pembelajaran"
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-xl object-cover border border-slate-200"
                  />
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Judul Materi / Pembelajaran
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={160}
                    value={courseForm.title}
                    onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                    placeholder="Contoh: Sirah Nabawiyah & Sejarah Peradaban Islam"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Nama Admin / Pengelola
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={courseForm.lecturerName}
                    onChange={(e) => setCourseForm({ ...courseForm, lecturerName: e.target.value })}
                    placeholder="Nama Admin Pengelola"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Periode / Semester
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={60}
                    value={courseForm.semester}
                    onChange={(e) => setCourseForm({ ...courseForm, semester: e.target.value })}
                    placeholder="Ganjil 2026/2027"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Deskripsi Singkat Pembelajaran
                  </label>
                  <textarea
                    rows={3}
                    maxLength={1500}
                    value={courseForm.description}
                    onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                    placeholder="Ruang lingkup kajian dan tujuan pembelajaran..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    URL Logo Pembelajaran (Opsional)
                  </label>
                  <input
                    type="text"
                    maxLength={500}
                    value={courseForm.logoUrl}
                    onChange={(e) => setCourseForm({ ...courseForm, logoUrl: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-[#2563EB] text-white text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-60"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Menyimpan...' : 'Simpan Profil Pembelajaran'}
                </button>
              </div>
            </form>

            {/* Approved Admins */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-base font-bold text-[#0E2142]">Daftar Admin Disetujui</h2>
                <p className="text-xs text-slate-500">
                  Hanya email Google di bawah ini yang dapat mengakses dasbor admin
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-[#0E2142]">alifahra467@gmail.com</div>
                    <div className="text-slate-500">Admin Utama</div>
                  </div>
                </div>

                {lecturers.map((lec) => (
                  <div
                    key={lec.email}
                    className="px-3.5 py-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-[#0E2142] truncate">{lec.email}</div>
                      {lec.name && <div className="text-slate-500 truncate">{lec.name}</div>}
                    </div>
                    <button
                      type="button"
                      onClick={() => void removeApprovedLecturer(lec.email)}
                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                      title="Hapus akses admin"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddLecturer} className="space-y-3 pt-2 border-t border-slate-100">
                <input
                  type="email"
                  required
                  value={newLecturerEmail}
                  onChange={(e) => setNewLecturerEmail(e.target.value)}
                  placeholder="Email Google admin pendamping"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
                <input
                  type="text"
                  value={newLecturerName}
                  onChange={(e) => setNewLecturerName(e.target.value)}
                  placeholder="Nama admin (opsional)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
                <button
                  type="submit"
                  className="w-full py-2 px-3 rounded-xl bg-[#0E2142] text-white text-xs font-semibold hover:bg-[#16315E] transition-colors flex items-center justify-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Tambah Admin
                </button>
              </form>
            </div>
          </div>

          {/* Topics & Subtopics */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-base font-bold text-[#0E2142]">Topik &amp; Subtopik Pembelajaran</h2>
              <p className="text-xs text-slate-500">
                Digunakan untuk pengelompokan bank soal, materi pembelajaran, dan kategori Papan Tantangan
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {topics.map((topic) => (
                <div
                  key={topic.topicId}
                  className="p-4 rounded-xl border border-slate-200 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-[#0E2142]">{topic.name}</div>
                    {topic.description && (
                      <p className="text-xs text-slate-500 mt-1">{topic.description}</p>
                    )}
                    {topic.subtopics.length > 0 && (
                      <div className="text-xs text-slate-600 mt-2">
                        Subtopik: {topic.subtopics.join(' · ')}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => void deleteTopic(topic.topicId)}
                    className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 shrink-0"
                    title="Hapus topik"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <form
              onSubmit={handleAddTopic}
              className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-4 border-t border-slate-100"
            >
              <input
                type="text"
                required
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                placeholder="Nama topik baru"
                className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
              <input
                type="text"
                value={newTopicSubtopics}
                onChange={(e) => setNewTopicSubtopics(e.target.value)}
                placeholder="Subtopik (pisahkan koma)"
                className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
              <input
                type="text"
                value={newTopicDesc}
                onChange={(e) => setNewTopicDesc(e.target.value)}
                placeholder="Keterangan singkat"
                className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-[#0E2142] text-white text-sm font-semibold hover:bg-[#16315E] transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Tambah Topik
              </button>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
