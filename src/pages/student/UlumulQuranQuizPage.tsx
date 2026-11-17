import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Send,
  XCircle,
} from 'lucide-react';
import { ArabicText } from '../../components/ArabicText';
import { LoadingState } from '../../components/StatusViews';
import type { PublicUlumulQuranQuestion } from '../../lib/ulumulQuranQuestions';
import { loadStudentProfile, saveStudentProfile } from '../../lib/studentProfile';

interface ReviewItem {
  questionId: string;
  number: number;
  topicName: string;
  subtopic: string;
  questionText: string;
  options: string[];
  selectedOption: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation: string;
  reference: string;
}

interface TopicSummaryItem {
  topicName: string;
  correct: number;
  total: number;
}

interface CompletedQuizResult {
  attemptId: string;
  studentName: string;
  studentNim: string;
  totalCorrect: number;
  totalQuestions: number;
  percentage: number;
  topicSummary: TopicSummaryItem[];
  reviewItems: ReviewItem[];
  submittedAtMs: number;
}

const STORAGE_RESULT_KEY = 'arena_uq_quiz_result_v1';

export const UlumulQuranQuizPage: React.FC = () => {
  const savedProfile = loadStudentProfile();

  const [questions, setQuestions] = useState<PublicUlumulQuranQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [studentName, setStudentName] = useState(savedProfile?.fullName ?? '');
  const [studentNim, setStudentNim] = useState(savedProfile?.nim ?? '');
  const [started, setStarted] = useState(() => Boolean(savedProfile && savedProfile.fullName.length >= 2));
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<CompletedQuizResult | null>(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_RESULT_KEY);
      return raw ? (JSON.parse(raw) as CompletedQuizResult) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let active = true;
    const loadQuestions = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch('/api/quiz/ulumul-quran/questions');
        if (!res.ok) throw new Error('Gagal memuat daftar soal.');
        const data = (await res.json()) as { questions?: PublicUlumulQuranQuestion[] };
        if (active) {
          setQuestions(data.questions ?? []);
        }
      } catch (err) {
        if (active) {
          setLoadError(err instanceof Error ? err.message : 'Gagal memuat kuis.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadQuestions();
    return () => {
      active = false;
    };
  }, []);

  const answeredCount = useMemo(
    () => questions.filter((q) => Boolean(answers[q.questionId])).length,
    [questions, answers]
  );

  const allCompleted = questions.length > 0 && answeredCount === questions.length;
  const currentQuestion = questions[currentIdx] ?? null;

  const handleStartQuiz = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = studentName.trim();
    const cleanNim = studentNim.trim();
    if (cleanName.length < 2) return;
    saveStudentProfile({ fullName: cleanName, nim: cleanNim });
    setStarted(true);
    setCurrentIdx(0);
    setSubmitError(null);
  };

  const handleSelectOption = (questionId: string, option: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
    setSubmitError(null);
  };

  const handleSubmitAll = async () => {
    if (!allCompleted) {
      setSubmitError(
        `Masih ada ${questions.length - answeredCount} pertanyaan yang belum terjawab. Selesaikan semua 15 pertanyaan terlebih dahulu untuk melihat kunci jawaban.`
      );
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/quiz/ulumul-quran/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: studentName.trim(),
          studentNim: studentNim.trim(),
          answers,
        }),
      });
      const data = (await res.json()) as CompletedQuizResult & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengirim jawaban.');
      }
      setResult(data);
      sessionStorage.setItem(STORAGE_RESULT_KEY, JSON.stringify(data));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Gagal menyelesaikan kuis.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetake = () => {
    sessionStorage.removeItem(STORAGE_RESULT_KEY);
    setResult(null);
    setAnswers({});
    setCurrentIdx(0);
    setSubmitError(null);
    setStarted(true);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1E3A2F] flex flex-col">
      {/* Header */}
      <header className="border-b border-[#1B5E4B]/15 bg-white sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3 min-w-0 whitespace-nowrap shrink-0">
            <img
              src="/src/assets/images/stiu_emblem_notext_1794928187045.jpg"
              alt="Logo STIU Darul Hikmah"
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-xl object-cover border border-[#1B5E4B]/20 bg-[#E2EFEA] shrink-0"
            />
            <span className="font-display text-base font-extrabold tracking-tight text-[#1B5E4B] truncate">
              STIU Darul Hikmah
            </span>
          </Link>

          <nav className="flex items-center gap-5 text-sm font-semibold">
            <Link
              to="/join"
              className="text-[#1B5E4B] hover:text-[#2E7D67] hover:underline underline-offset-4 flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Sesi Kelas</span>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-8 py-8">
        {loading ? (
          <div className="bg-white rounded-3xl border border-[#1B5E4B]/15 p-10">
            <LoadingState label="Memuat 15 soal pilihan ganda ‘Ulûmul Qur’ân..." />
          </div>
        ) : loadError ? (
          <div className="bg-white rounded-3xl border border-rose-200 p-8 text-center space-y-4">
            <p className="text-sm font-semibold text-rose-800">{loadError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-2xl bg-[#1B5E4B] text-white text-sm font-bold"
            >
              Muat Ulang
            </button>
          </div>
        ) : result ? (
          /* STEP 3: HASIL & KUNCI JAWABAN LENGKAP (HANYA MUNCUL SETELAH SEMUA 15 SOAL SELESAI) */
          <div className="space-y-6">
            <section className="bg-gradient-to-br from-[#2E7D67] to-[#1B5E4B] text-white rounded-[28px] p-6 sm:p-8 space-y-6 shadow-[0_15px_35px_rgba(27,94,75,0.22)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/15 pb-5">
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#DFBD69]">
                    Seluruh 15 Pertanyaan Selesai · Kunci Jawaban Dibuka
                  </p>
                  <h1 className="font-display text-2xl sm:text-3xl font-extrabold">
                    Hasil Kuis Pilihan Ganda ‘Ulûmul Qur’ân
                  </h1>
                  <p className="text-sm text-white/85">
                    Mahasiswi: <span className="font-bold text-white">{result.studentName}</span>
                    {result.studentNim && (
                      <span className="ml-2 font-mono text-xs text-[#DFBD69] tabular-nums">
                        · NIM {result.studentNim}
                      </span>
                    )}
                  </p>
                </div>

                <div className="bg-white/10 border border-white/20 rounded-2xl px-6 py-4 text-center shrink-0">
                  <div className="text-xs font-semibold text-white/80">Skor Akhir</div>
                  <div className="font-mono text-3xl font-extrabold text-[#DFBD69] tabular-nums">
                    {result.totalCorrect} / {result.totalQuestions}
                  </div>
                  <div className="text-xs font-bold text-white tabular-nums mt-0.5">
                    Nilai: {result.percentage}%
                  </div>
                </div>
              </div>

              {/* Ringkasan Per Bab */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {result.topicSummary.map((item) => (
                  <div
                    key={item.topicName}
                    className="rounded-2xl bg-white/10 border border-white/15 p-3.5 space-y-1"
                  >
                    <div className="text-xs text-white/85 font-semibold leading-snug">
                      {item.topicName}
                    </div>
                    <div className="font-mono text-lg font-extrabold text-white tabular-nums">
                      {item.correct} / {item.total} Benar
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleRetake}
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-br from-[#DFBD69] to-[#C59B38] text-[#1E3A2F] text-sm font-extrabold hover:brightness-105 transition-all flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Kerjakan Ulang</span>
                </button>
                <Link
                  to="/"
                  className="px-5 py-2.5 rounded-2xl border border-white/30 text-white text-sm font-semibold hover:bg-white/10 transition-colors"
                >
                  Kembali ke Halaman Masuk
                </Link>
              </div>
            </section>

            {/* Daftar Lengkap Kunci Jawaban & Pembahasan 15 Soal */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-extrabold text-[#1B5E4B]">
                  Kunci Jawaban &amp; Pembahasan (15 Soal)
                </h2>
                <span className="text-xs font-semibold text-slate-500">
                  Urutan Soal 1–15
                </span>
              </div>

              {result.reviewItems.map((item) => (
                <article
                  key={item.questionId}
                  className="bg-white rounded-3xl border border-[#1B5E4B]/15 p-5 sm:p-6 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="text-xs font-bold text-[#1B5E4B]/80">
                      SOAL #{item.number} · {item.topicName}
                    </div>
                    {item.isCorrect ? (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Jawaban Benar</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700">
                        <XCircle className="w-4 h-4" />
                        <span>Jawaban Kurang Tepat</span>
                      </div>
                    )}
                  </div>

                  <ArabicText
                    text={item.questionText}
                    className="text-base font-bold text-[#1E3A2F] leading-relaxed"
                  />

                  <div className="space-y-2">
                    {item.options.map((opt, idx) => {
                      const isCorrectOpt = opt === item.correctAnswer;
                      const isStudentOpt = opt === item.selectedOption;

                      let rowClass = 'border-slate-200 bg-[#FAF8F5] text-slate-700';
                      let badgeClass = 'bg-white border-slate-300 text-slate-600';

                      if (isCorrectOpt) {
                        rowClass = 'border-[#2E7D67] bg-[#E2EFEA] text-[#1E3A2F] font-semibold';
                        badgeClass = 'bg-[#1B5E4B] border-[#1B5E4B] text-white';
                      } else if (isStudentOpt && !isCorrectOpt) {
                        rowClass = 'border-rose-300 bg-rose-50 text-rose-950';
                        badgeClass = 'bg-rose-600 border-rose-600 text-white';
                      }

                      return (
                        <div
                          key={idx}
                          className={`p-3.5 rounded-2xl border text-sm flex items-start gap-3 ${rowClass}`}
                        >
                          <span
                            className={`w-7 h-7 rounded-xl border flex items-center justify-center text-xs font-extrabold shrink-0 ${badgeClass}`}
                          >
                            {String.fromCharCode(65 + idx)}
                          </span>
                          <div className="flex-1 space-y-1">
                            <ArabicText text={opt} />
                            <div className="flex flex-wrap gap-3 text-[11px] font-bold">
                              {isStudentOpt && (
                                <span className={isCorrectOpt ? 'text-[#1B5E4B]' : 'text-rose-700'}>
                                  Pilihan Anda
                                </span>
                              )}
                              {isCorrectOpt && (
                                <span className="text-[#1B5E4B]">Kunci Jawaban Benar</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="rounded-2xl bg-[#FAF8F5] border border-[#1B5E4B]/15 p-4 space-y-1.5">
                    <div className="text-xs font-bold text-[#1B5E4B]">Pembahasan Materi</div>
                    <ArabicText
                      text={item.explanation}
                      className="text-xs sm:text-sm text-slate-700 leading-relaxed"
                    />
                    {item.reference && (
                      <div className="text-[11px] font-semibold text-slate-500 pt-1">
                        Rujukan: {item.reference}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </section>
          </div>
        ) : !started ? (
          /* STEP 1: IDENTITAS MAHASISWI (JIKA MASUK LANGSUNG KE /kuis-pg) */
          <div className="max-w-md mx-auto bg-[#E2EFEA] rounded-[32px] border-2 border-white shadow-[0_15px_35px_rgba(46,125,103,0.12)] p-7 sm:p-8 space-y-6 relative overflow-hidden">
            <div
              aria-hidden="true"
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1]"
            >
              <img
                src="/src/assets/images/stiu_emblem_notext_1794928187045.jpg"
                alt=""
                referrerPolicy="no-referrer"
                className="w-[82%] h-[82%] object-contain opacity-[0.18] mix-blend-multiply select-none"
              />
            </div>

            <div className="relative z-[2] space-y-2 text-center">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1B5E4B]">
                <BookOpen className="w-4 h-4" />
                <span>Pilihan Ganda ‘Ulûmul Qur’ân · 15 Soal</span>
              </div>
              <h1 className="font-display text-2xl font-extrabold text-[#1B5E4B]">
                STIU Darul Hikmah
              </h1>
              <p className="text-xs text-[#1E3A2F]/80 leading-relaxed">
                Bab Asbabun Nuzul, Turunnya Al-Qur’an, Pengumpulan &amp; Penyusunan, dan Tujuh Huruf. Jawaban ditampilkan di akhir setelah 15 soal selesai.
              </p>
            </div>

            <form onSubmit={handleStartQuiz} className="relative z-[2] space-y-4">
              <input
                type="text"
                required
                minLength={2}
                maxLength={60}
                autoFocus
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Nama Lengkap"
                className="w-full px-6 py-4 rounded-[24px] bg-gradient-to-br from-[#2E7D67] to-[#1B5E4B] text-white placeholder:text-white/75 text-base font-bold shadow-[0_8px_18px_rgba(27,94,75,0.25)] outline-none focus:ring-2 focus:ring-[#D4AF37]"
              />
              <input
                type="text"
                required
                minLength={3}
                maxLength={30}
                inputMode="numeric"
                value={studentNim}
                onChange={(e) =>
                  setStudentNim(e.target.value.replace(/[^0-9A-Za-z.-]/g, '').slice(0, 30))
                }
                placeholder="NIM"
                className="w-full px-6 py-4 rounded-[24px] bg-gradient-to-br from-[#2E7D67] to-[#1B5E4B] text-white placeholder:text-white/75 text-base font-bold tabular-nums shadow-[0_8px_18px_rgba(27,94,75,0.25)] outline-none focus:ring-2 focus:ring-[#D4AF37]"
              />

              <button
                type="submit"
                disabled={studentName.trim().length < 2 || studentNim.trim().length < 3}
                className="w-full py-4 px-6 rounded-[24px] bg-gradient-to-br from-[#DFBD69] to-[#C59B38] text-[#1E3A2F] text-base font-extrabold shadow-[0_8px_18px_rgba(197,155,56,0.3)] hover:brightness-105 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>Mulai 15 Soal Pilihan Ganda</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          /* STEP 2: PENGERJAAN 15 SOAL PILIHAN GANDA (TANPA KUNCI JAWABAN) */
          <div className="space-y-5">
            {/* Progress & Navigator */}
            <div className="bg-[#E2EFEA] rounded-3xl border-2 border-white p-4 sm:p-5 space-y-4 shadow-[0_10px_25px_rgba(46,125,103,0.08)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-[#1B5E4B]">
                    Mahasiswi: <span className="font-extrabold">{studentName.trim()}</span>
                    {studentNim.trim() && (
                      <span className="ml-2 font-mono tabular-nums">· NIM {studentNim.trim()}</span>
                    )}
                  </div>
                  <div className="text-xs text-[#1E3A2F]/75 mt-0.5">
                    Jawaban dan pembahasan dibuka di akhir setelah semua 15 pertanyaan selesai.
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setStarted(false)}
                    className="text-xs font-bold text-[#1B5E4B] hover:underline"
                  >
                    Ubah Data
                  </button>
                  <div className="font-mono text-sm font-extrabold text-[#1B5E4B] tabular-nums">
                    {answeredCount} / {questions.length} Terjawab
                  </div>
                </div>
              </div>

              <div className="w-full h-2.5 rounded-full bg-white/80 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#2E7D67] to-[#1B5E4B] transition-all duration-200"
                  style={{
                    width: `${questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0}%`,
                  }}
                />
              </div>

              <div className="grid grid-cols-5 sm:grid-cols-15 gap-1.5">
                {questions.map((q, idx) => {
                  const isAnswered = Boolean(answers[q.questionId]);
                  const isCurrent = idx === currentIdx;
                  return (
                    <button
                      key={q.questionId}
                      type="button"
                      onClick={() => setCurrentIdx(idx)}
                      className={`h-9 rounded-xl font-mono text-xs font-bold tabular-nums border transition-colors ${
                        isCurrent
                          ? 'bg-[#1B5E4B] text-white border-[#1B5E4B]'
                          : isAnswered
                          ? 'bg-white text-[#1B5E4B] border-[#2E7D67]/50'
                          : 'bg-white/60 text-slate-600 border-white hover:bg-white'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            {submitError && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800">
                {submitError}
              </div>
            )}

            {/* Active Question Card */}
            {currentQuestion && (
              <div className="bg-white rounded-3xl border border-[#1B5E4B]/15 p-5 sm:p-7 space-y-5 shadow-[0_10px_28px_rgba(27,94,75,0.06)]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <span className="text-xs font-extrabold text-[#2E7D67]">
                    SOAL {currentQuestion.number} DARI {questions.length}
                  </span>
                  <span className="text-xs font-semibold text-slate-600">
                    Bab: {currentQuestion.topicName}
                  </span>
                </div>

                <ArabicText
                  text={currentQuestion.questionText}
                  className="text-base sm:text-lg font-bold text-[#1E3A2F] leading-relaxed"
                />

                <div className="space-y-2.5">
                  {currentQuestion.options.map((opt, optIdx) => {
                    const selected = answers[currentQuestion.questionId] === opt;
                    return (
                      <button
                        key={optIdx}
                        type="button"
                        onClick={() => handleSelectOption(currentQuestion.questionId, opt)}
                        className={`w-full min-h-[52px] p-4 rounded-2xl border text-left text-sm font-semibold flex items-start gap-3 transition-all ${
                          selected
                            ? 'bg-gradient-to-br from-[#2E7D67] to-[#1B5E4B] text-white border-[#1B5E4B] shadow-[0_6px_16px_rgba(27,94,75,0.22)]'
                            : 'bg-[#FAF8F5] text-[#1E3A2F] border-[#1B5E4B]/15 hover:bg-[#E2EFEA]/60'
                        }`}
                      >
                        <span
                          className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-extrabold shrink-0 mt-0.5 ${
                            selected
                              ? 'bg-[#DFBD69] text-[#1E3A2F]'
                              : 'bg-white border border-[#1B5E4B]/20 text-[#1B5E4B]'
                          }`}
                        >
                          {String.fromCharCode(65 + optIdx)}
                        </span>
                        <ArabicText text={opt} className="flex-1 leading-relaxed" />
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={currentIdx === 0}
                      onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                      className="min-h-[44px] px-4 py-2 rounded-2xl border border-[#1B5E4B]/25 text-xs font-bold text-[#1B5E4B] hover:bg-[#E2EFEA]/50 disabled:opacity-40 flex items-center gap-1.5"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Sebelumnya</span>
                    </button>

                    {currentIdx < questions.length - 1 && (
                      <button
                        type="button"
                        onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
                        className="min-h-[44px] px-4 py-2 rounded-2xl bg-[#1B5E4B] text-white text-xs font-bold hover:bg-[#2E7D67] flex items-center gap-1.5"
                      >
                        <span>Berikutnya</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={!allCompleted || submitting}
                    onClick={() => void handleSubmitAll()}
                    className="min-h-[46px] px-5 py-2.5 rounded-2xl bg-gradient-to-br from-[#DFBD69] to-[#C59B38] text-[#1E3A2F] text-sm font-extrabold shadow-[0_6px_16px_rgba(197,155,56,0.28)] hover:brightness-105 disabled:opacity-45 flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>
                      {submitting
                        ? 'Menilai Jawaban...'
                        : allCompleted
                        ? 'Selesai & Lihat Jawaban Akhir'
                        : `Selesaikan Semua (${answeredCount}/15)`}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
