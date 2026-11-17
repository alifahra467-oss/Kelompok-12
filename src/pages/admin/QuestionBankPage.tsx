import React, { useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import {
  Copy,
  Download,
  Edit3,
  Eye,
  FileUp,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { AdminLayout } from '../../layouts/AdminLayout';
import { useAuth } from '../../context/AuthContext';
import { ArabicText } from '../../components/ArabicText';
import { EmptyState, LoadingState } from '../../components/StatusViews';
import { db, handleFirestoreError } from '../../lib/firebase';
import {
  createOrUpdateQuestion,
  deleteQuestion,
  exportFullBackup,
  importQuestionsBatch,
} from '../../services/firestoreService';
import {
  OperationType,
  type DifficultyLevel,
  type GameMode,
  type QuestionPrivate,
  type QuestionType,
  type Topic,
} from '../../types/arena';

const TYPE_LABELS: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: 'Pilihan Ganda',
  TRUE_FALSE: 'Benar / Salah',
  SHORT_ANSWER: 'Jawaban Singkat',
  ESSAY_CASE: 'Esai / Studi Kasus',
};

const MODE_LABELS: Record<GameMode, string> = {
  CERDAS_CERMAT: 'Cerdas Cermat',
  PAPAN_TANTANGAN: 'Papan Tantangan',
  TANTANGAN_ANALISIS: 'Tantangan Analisis',
};

const EMPTY_FORM: Omit<QuestionPrivate, 'createdAt' | 'updatedAt'> = {
  questionId: '',
  topicId: '',
  topicName: 'Periode Makkah',
  subtopic: '',
  type: 'MULTIPLE_CHOICE',
  questionText: '',
  options: ['', '', '', ''],
  correctAnswer: '',
  explanation: '',
  reference: '',
  difficulty: 'SEDANG',
  points: 100,
  timeLimitSec: 30,
  enabledModes: ['CERDAS_CERMAT', 'PAPAN_TANTANGAN'],
  imageUrl: '',
  referenceRequirement: '',
  isActive: true,
  isDemo: false,
};

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const QuestionBankPage: React.FC = () => {
  const [questions, setQuestions] = useState<QuestionPrivate[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchText, setSearchText] = useState('');
  const [filterTopic, setFilterTopic] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [filterMode, setFilterMode] = useState('ALL');

  const [editorOpen, setEditorOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [previewQuestion, setPreviewQuestion] = useState<QuestionPrivate | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<QuestionPrivate | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const csvInputRef = useRef<HTMLInputElement | null>(null);

  const { user, isLecturer, authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !user || !isLecturer) return;
    const unsubQ = onSnapshot(
      query(collection(db, 'questions_private'), orderBy('updatedAt', 'desc')),
      (snap) => {
        setQuestions(snap.docs.map((d) => d.data() as QuestionPrivate));
        setLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'questions_private')
    );

    const unsubT = onSnapshot(
      query(collection(db, 'topics'), orderBy('orderIndex', 'asc')),
      (snap) => {
        setTopics(snap.docs.map((d) => d.data() as Topic));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'topics')
    );

    return () => {
      unsubQ();
      unsubT();
    };
  }, [authLoading, user, isLecturer]);

  const topicNames = useMemo(() => {
    const set = new Set<string>(topics.map((t) => t.name));
    questions.forEach((q) => {
      if (q.topicName) set.add(q.topicName);
    });
    return Array.from(set);
  }, [topics, questions]);

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (filterTopic !== 'ALL' && q.topicName !== filterTopic) return false;
      if (filterType !== 'ALL' && q.type !== filterType) return false;
      if (filterMode !== 'ALL' && !q.enabledModes.includes(filterMode as GameMode)) return false;
      if (searchText.trim()) {
        const needle = searchText.toLowerCase();
        const hay = `${q.questionText} ${q.topicName} ${q.subtopic ?? ''} ${q.reference ?? ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [questions, filterTopic, filterType, filterMode, searchText]);

  const showNotice = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 4000);
  };

  const openCreateModal = () => {
    setIsEditing(false);
    setForm({
      ...EMPTY_FORM,
      topicName: topicNames[0] || 'Periode Makkah',
    });
    setEditorOpen(true);
  };

  const openEditModal = (q: QuestionPrivate) => {
    setIsEditing(true);
    setForm({
      questionId: q.questionId,
      topicId: q.topicId ?? '',
      topicName: q.topicName,
      subtopic: q.subtopic ?? '',
      type: q.type,
      questionText: q.questionText,
      options:
        q.type === 'MULTIPLE_CHOICE'
          ? [...(q.options ?? []), '', '', '', ''].slice(0, 4)
          : q.type === 'TRUE_FALSE'
          ? ['Benar', 'Salah']
          : [],
      correctAnswer: q.correctAnswer,
      explanation: q.explanation ?? '',
      reference: q.reference ?? '',
      difficulty: q.difficulty,
      points: q.points,
      timeLimitSec: q.timeLimitSec,
      enabledModes: q.enabledModes,
      imageUrl: q.imageUrl ?? '',
      referenceRequirement: q.referenceRequirement ?? '',
      isActive: q.isActive,
      isDemo: Boolean(q.isDemo),
    });
    setEditorOpen(true);
  };

  const handleDuplicate = async (q: QuestionPrivate) => {
    await createOrUpdateQuestion(
      {
        ...q,
        questionId: '',
        questionText: `[Salinan] ${q.questionText}`,
      },
      false
    );
    showNotice('Soal berhasil diduplikasi.');
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.questionText.trim() || !form.correctAnswer.trim()) return;
    setSaving(true);
    try {
      const cleanedOptions =
        form.type === 'MULTIPLE_CHOICE'
          ? (form.options ?? []).map((o) => o.trim()).filter(Boolean)
          : form.type === 'TRUE_FALSE'
          ? ['Benar', 'Salah']
          : [];
      await createOrUpdateQuestion(
        {
          ...form,
          options: cleanedOptions,
        },
        isEditing
      );
      setEditorOpen(false);
      showNotice(isEditing ? 'Soal berhasil diperbarui.' : 'Soal baru ditambahkan ke bank soal.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmTarget) return;
    await deleteQuestion(deleteConfirmTarget.questionId);
    setDeleteConfirmTarget(null);
    showNotice('Soal telah dihapus dari bank soal.');
  };

  const handleExportCSV = () => {
    const rows = filteredQuestions.map((q) => ({
      questionId: q.questionId,
      topicName: q.topicName,
      subtopic: q.subtopic ?? '',
      type: q.type,
      questionText: q.questionText,
      options: (q.options ?? []).join(' | '),
      correctAnswer: q.correctAnswer,
      explanation: q.explanation ?? '',
      reference: q.reference ?? '',
      difficulty: q.difficulty,
      points: q.points,
      timeLimitSec: q.timeLimitSec,
      enabledModes: q.enabledModes.join(','),
      imageUrl: q.imageUrl ?? '',
      referenceRequirement: q.referenceRequirement ?? '',
      isActive: q.isActive ? 'true' : 'false',
    }));
    const csv = '\uFEFF' + Papa.unparse(rows);
    downloadFile(`bank-soal-arena-${Date.now()}.csv`, csv, 'text/csv;charset=utf-8;');
  };

  const handleExportJSON = () => {
    const json = JSON.stringify(filteredQuestions, null, 2);
    downloadFile(`bank-soal-arena-${Date.now()}.json`, json, 'application/json');
  };

  const handleFullBackup = async () => {
    const backup = await exportFullBackup();
    downloadFile(
      `cadangan-penuh-arena-kelas-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(backup, null, 2),
      'application/json'
    );
    showNotice('Cadangan lengkap basis data berhasil diunduh.');
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const parsed = results.data
          .filter((row) => row.questionText && row.correctAnswer)
          .map((row) => {
            const rawType = (row.type || 'MULTIPLE_CHOICE').trim() as QuestionType;
            const validType: QuestionType = ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER', 'ESSAY_CASE'].includes(rawType)
              ? rawType
              : 'MULTIPLE_CHOICE';
            const rawDiff = (row.difficulty || 'SEDANG').trim() as DifficultyLevel;
            const validDiff: DifficultyLevel = ['MUDAH', 'SEDANG', 'SULIT'].includes(rawDiff)
              ? rawDiff
              : 'SEDANG';
            const options = row.options
              ? row.options.split('|').map((s) => s.trim()).filter(Boolean)
              : validType === 'TRUE_FALSE'
              ? ['Benar', 'Salah']
              : [];
            const enabledModes = row.enabledModes
              ? (row.enabledModes
                  .split(',')
                  .map((m) => m.trim())
                  .filter((m) =>
                    ['CERDAS_CERMAT', 'PAPAN_TANTANGAN', 'TANTANGAN_ANALISIS'].includes(m)
                  ) as GameMode[])
              : (['CERDAS_CERMAT'] as GameMode[]);

            return {
              topicId: '',
              topicName: row.topicName || 'Umum',
              subtopic: row.subtopic || '',
              type: validType,
              questionText: row.questionText,
              options,
              correctAnswer: row.correctAnswer,
              explanation: row.explanation || '',
              reference: row.reference || '',
              difficulty: validDiff,
              points: Number(row.points) || 100,
              timeLimitSec: Number(row.timeLimitSec) || 30,
              enabledModes: enabledModes.length ? enabledModes : (['CERDAS_CERMAT'] as GameMode[]),
              imageUrl: row.imageUrl || '',
              referenceRequirement: row.referenceRequirement || '',
              isActive: row.isActive !== 'false',
              isDemo: false,
            };
          });

        if (parsed.length === 0) {
          showNotice('Tidak ada baris soal valid pada berkas CSV.');
          return;
        }
        const count = await importQuestionsBatch(parsed);
        showNotice(`${count} soal berhasil diimpor dari CSV.`);
      },
    });
    e.target.value = '';
  };

  const toggleMode = (mode: GameMode) => {
    const exists = form.enabledModes.includes(mode);
    if (exists && form.enabledModes.length === 1) return;
    setForm({
      ...form,
      enabledModes: exists
        ? form.enabledModes.filter((m) => m !== mode)
        : [...form.enabledModes, mode],
    });
  };

  return (
    <AdminLayout
      title="Bank Soal Mata Kuliah"
      subtitle="Buat, sunting, impor/ekspor, dan cadangkan soal secara manual (mendukung Arab berharakat & RTL)"
    >
      <div className="space-y-6">
        {notice && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl px-4 py-3 text-sm font-medium">
            {notice}
          </div>
        )}

        {/* Action Toolbar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={openCreateModal}
              className="px-4 py-2.5 rounded-xl bg-[#2563EB] text-white text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Tambah Soal Baru
            </button>

            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleImportCSV}
              className="hidden"
            />
            <button
              onClick={() => csvInputRef.current?.click()}
              className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-50 transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <FileUp className="w-4 h-4" />
              Impor CSV
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Ekspor CSV
            </button>
            <button
              onClick={handleExportJSON}
              className="px-3 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Ekspor JSON
            </button>
            <button
              onClick={() => void handleFullBackup()}
              className="px-3 py-2 rounded-xl bg-[#0E2142] text-white text-xs font-semibold hover:bg-[#16315E] flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Cadangkan Basis Data
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Cari teks soal, topik, atau referensi..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>

          <select
            value={filterTopic}
            onChange={(e) => setFilterTopic(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          >
            <option value="ALL">Semua Topik</option>
            {topicNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          >
            <option value="ALL">Semua Tipe Soal</option>
            <option value="MULTIPLE_CHOICE">Pilihan Ganda</option>
            <option value="TRUE_FALSE">Benar / Salah</option>
            <option value="SHORT_ANSWER">Jawaban Singkat</option>
            <option value="ESSAY_CASE">Esai / Studi Kasus</option>
          </select>

          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          >
            <option value="ALL">Semua Mode Permainan</option>
            <option value="CERDAS_CERMAT">Cerdas Cermat</option>
            <option value="PAPAN_TANTANGAN">Papan Tantangan</option>
            <option value="TANTANGAN_ANALISIS">Tantangan Analisis</option>
          </select>
        </div>

        {/* Question List */}
        {loading ? (
          <LoadingState label="Memuat bank soal..." />
        ) : filteredQuestions.length === 0 ? (
          <EmptyState
            title="Belum Ada Soal Sesuai Kriteria"
            description="Tambahkan soal secara manual, impor melalui CSV, atau muat contoh data Sirah Nabawiyah dari menu Ringkasan."
            actionLabel="Tambah Soal Pertama"
            onAction={openCreateModal}
          />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-200">
            {filteredQuestions.map((q) => (
              <div key={q.questionId} className="p-5 flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    <span className="font-semibold text-[#0E2142]">{q.topicName}</span>
                    {q.subtopic && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{q.subtopic}</span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span>{TYPE_LABELS[q.type]}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums font-semibold text-[#2563EB]">{q.points} poin</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{q.timeLimitSec} dtk</span>
                    <span aria-hidden="true">·</span>
                    <span>{q.difficulty}</span>
                    {!q.isActive && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-rose-600 font-semibold">Nonaktif</span>
                      </>
                    )}
                  </div>

                  <div className="text-sm sm:text-base font-medium text-[#0E2142] leading-relaxed">
                    <ArabicText text={q.questionText} />
                  </div>

                  <div className="text-xs text-slate-600">
                    <span className="font-semibold text-emerald-700">Kunci:</span>{' '}
                    <ArabicText text={q.correctAnswer} />
                    {q.reference && (
                      <span className="text-slate-400"> · Rujukan: {q.reference}</span>
                    )}
                  </div>

                  <div className="text-xs text-slate-500">
                    Mode: {q.enabledModes.map((m) => MODE_LABELS[m]).join(' · ')}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setPreviewQuestion(q)}
                    className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                    title="Pratinjau Soal"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openEditModal(q)}
                    className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                    title="Edit Soal"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => void handleDuplicate(q)}
                    className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                    title="Duplikat Soal"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirmTarget(q)}
                    className="p-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50"
                    title="Hapus Soal"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-[#0E2142]">
                {isEditing ? 'Sunting Soal' : 'Tambah Soal Baru'}
              </h2>
              <button
                onClick={() => setEditorOpen(false)}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuestion} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Topik</label>
                  <input
                    type="text"
                    required
                    list="topic-suggestions"
                    value={form.topicName}
                    onChange={(e) => setForm({ ...form, topicName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                  <datalist id="topic-suggestions">
                    {topicNames.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Subtopik</label>
                  <input
                    type="text"
                    value={form.subtopic}
                    onChange={(e) => setForm({ ...form, subtopic: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tipe Soal</label>
                  <select
                    value={form.type}
                    onChange={(e) => {
                      const nextType = e.target.value as QuestionType;
                      setForm({
                        ...form,
                        type: nextType,
                        options:
                          nextType === 'MULTIPLE_CHOICE'
                            ? ['', '', '', '']
                            : nextType === 'TRUE_FALSE'
                            ? ['Benar', 'Salah']
                            : [],
                        correctAnswer: nextType === 'TRUE_FALSE' ? 'Benar' : form.correctAnswer,
                      });
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    <option value="MULTIPLE_CHOICE">Pilihan Ganda</option>
                    <option value="TRUE_FALSE">Benar / Salah</option>
                    <option value="SHORT_ANSWER">Jawaban Singkat</option>
                    <option value="ESSAY_CASE">Esai / Studi Kasus</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Teks Pertanyaan / Kasus (Mendukung Arab berharakat &amp; RTL)
                </label>
                <textarea
                  required
                  rows={4}
                  dir="auto"
                  value={form.questionText}
                  onChange={(e) => setForm({ ...form, questionText: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              {form.type === 'MULTIPLE_CHOICE' && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Pilihan Jawaban (A–D)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {[0, 1, 2, 3].map((idx) => (
                      <input
                        key={idx}
                        type="text"
                        dir="auto"
                        placeholder={`Opsi ${String.fromCharCode(65 + idx)}`}
                        value={form.options?.[idx] ?? ''}
                        onChange={(e) => {
                          const next = [...(form.options ?? ['', '', '', ''])];
                          next[idx] = e.target.value;
                          setForm({ ...form, options: next });
                        }}
                        className="px-3 py-2 rounded-xl border border-slate-300 text-sm"
                      />
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kunci Jawaban / Kriteria Jawaban Benar (Privat — Tidak dikirim ke Proyektor)
                </label>
                {form.type === 'MULTIPLE_CHOICE' ? (
                  <select
                    required
                    value={form.correctAnswer}
                    onChange={(e) => setForm({ ...form, correctAnswer: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    <option value="">-- Pilih Opsi Benar --</option>
                    {(form.options ?? []).filter(Boolean).map((opt, idx) => (
                      <option key={idx} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : form.type === 'TRUE_FALSE' ? (
                  <select
                    value={form.correctAnswer}
                    onChange={(e) => setForm({ ...form, correctAnswer: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    <option value="Benar">Benar</option>
                    <option value="Salah">Salah</option>
                  </select>
                ) : (
                  <textarea
                    required
                    rows={2}
                    dir="auto"
                    value={form.correctAnswer}
                    onChange={(e) => setForm({ ...form, correctAnswer: e.target.value })}
                    placeholder="Tulis kunci jawaban resmi atau poin rubrik admin..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pembahasan Lengkap (Ditampilkan hanya jika admin klik Rilis)
                  </label>
                  <textarea
                    rows={3}
                    dir="auto"
                    value={form.explanation}
                    onChange={(e) => setForm({ ...form, explanation: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Referensi / Sumber Rujukan
                    </label>
                    <input
                      type="text"
                      value={form.reference}
                      onChange={(e) => setForm({ ...form, reference: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Syarat Rujukan (Khusus Tantangan Analisis)
                    </label>
                    <input
                      type="text"
                      value={form.referenceRequirement}
                      onChange={(e) => setForm({ ...form, referenceRequirement: e.target.value })}
                      placeholder="Contoh: Minimal 1 kitab Sirah atau ayat Al-Qur'an"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Kesulitan</label>
                  <select
                    value={form.difficulty}
                    onChange={(e) =>
                      setForm({ ...form, difficulty: e.target.value as DifficultyLevel })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    <option value="MUDAH">Mudah</option>
                    <option value="SEDANG">Sedang</option>
                    <option value="SULIT">Sulit</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nilai Poin</label>
                  <input
                    type="number"
                    min={1}
                    max={5000}
                    value={form.points}
                    onChange={(e) => setForm({ ...form, points: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Batas Waktu (Detik)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={3600}
                    value={form.timeLimitSec}
                    onChange={(e) => setForm({ ...form, timeLimitSec: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status Soal
                  </label>
                  <select
                    value={form.isActive ? 'ACTIVE' : 'INACTIVE'}
                    onChange={(e) => setForm({ ...form, isActive: e.target.value === 'ACTIVE' })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    <option value="ACTIVE">Aktif</option>
                    <option value="INACTIVE">Nonaktif</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    URL Gambar Pendukung (Opsional)
                  </label>
                  <input
                    type="text"
                    value={form.imageUrl}
                    onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Mode Permainan yang Diizinkan
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(['CERDAS_CERMAT', 'PAPAN_TANTANGAN', 'TANTANGAN_ANALISIS'] as GameMode[]).map(
                      (mode) => {
                        const active = form.enabledModes.includes(mode);
                        return (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => toggleMode(mode)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                              active
                                ? 'bg-[#0E2142] text-white border-[#0E2142]'
                                : 'bg-white text-slate-600 border-slate-300'
                            }`}
                          >
                            {MODE_LABELS[mode]}
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-[#2563EB] text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Soal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewQuestion && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-[#0E2142] text-white rounded-2xl max-w-2xl w-full p-7 space-y-5 border border-white/15">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>
                {previewQuestion.topicName} · {TYPE_LABELS[previewQuestion.type]} ·{' '}
                {previewQuestion.points} Poin
              </span>
              <button
                onClick={() => setPreviewQuestion(null)}
                className="p-1.5 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <ArabicText
              as="p"
              text={previewQuestion.questionText}
              className="block w-full text-left text-[18px] font-bold leading-[1.6]"
            />
            {previewQuestion.imageUrl && (
              <img
                src={previewQuestion.imageUrl}
                alt="Lampiran Soal"
                referrerPolicy="no-referrer"
                className="max-h-56 rounded-xl object-contain bg-black/20"
              />
            )}
            {previewQuestion.options && previewQuestion.options.length > 0 && (
              <div className="space-y-2.5">
                {previewQuestion.options.map((opt, idx) => (
                  <div
                    key={idx}
                    className="px-4 py-3.5 rounded-xl bg-white/10 border border-white/15 flex items-start gap-3 text-left"
                  >
                    <span className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center text-[13px] font-bold shrink-0 mt-0.5">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <ArabicText
                      as="span"
                      text={opt}
                      className="flex-1 min-w-0 block text-left text-[15px] font-medium leading-[1.55]"
                    />
                  </div>
                ))}
              </div>
            )}
            <div className="pt-4 border-t border-white/15 text-xs text-slate-300 space-y-1">
              <div className="text-[#F1C56C] font-semibold">
                Kunci Jawaban (Privat): <ArabicText text={previewQuestion.correctAnswer} />
              </div>
              {previewQuestion.explanation && (
                <div>
                  Pembahasan: <ArabicText text={previewQuestion.explanation} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-[#0E2142]">Konfirmasi Hapus Soal</h3>
            <p className="text-sm text-slate-600">
              Apakah Anda yakin ingin menghapus soal ini secara permanen? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 line-clamp-3">
              {deleteConfirmTarget.questionText}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700"
              >
                Batal
              </button>
              <button
                onClick={() => void handleConfirmDelete()}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700"
              >
                Ya, Hapus Soal
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
