import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import {
  ULUMUL_QURAN_QUESTIONS,
  getPublicUlumulQuranQuestions,
} from './src/lib/ulumulQuranQuestions.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

function resolveIdentitySecret(): string {
  if (process.env.ARENA_IDENTITY_SECRET && process.env.ARENA_IDENTITY_SECRET.length >= 16) {
    return process.env.ARENA_IDENTITY_SECRET;
  }
  try {
    const cfgPath = path.join(__dirname, 'firebase-applet-config.json');
    const raw = fs.readFileSync(cfgPath, 'utf8');
    return crypto.createHash('sha256').update(`arena-kelas-2:${raw}`).digest('hex');
  } catch {
    return crypto.createHash('sha256').update('arena-kelas-2-fallback-key').digest('hex');
  }
}

const IDENTITY_SECRET = resolveIdentitySecret();
const ADMIN_ACCESS_PASSWORD = process.env.ADMIN_ACCESS_PASSWORD || 'myadmin123';
const UNLOCK_TTL_MS = 12 * 60 * 60 * 1000;

function signStudentIdentity(sessionId: string, participantId: string, proofHash: string): string {
  return crypto
    .createHmac('sha256', IDENTITY_SECRET)
    .update(`${sessionId}:${participantId}:${proofHash}`)
    .digest('hex');
}

function signAdminUnlock(issuedAtMs: number): string {
  const sig = crypto
    .createHmac('sha256', IDENTITY_SECRET)
    .update(`admin-unlock:${issuedAtMs}`)
    .digest('hex');
  return `${issuedAtMs}.${sig}`;
}

function verifyAdminUnlockToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const issuedAtMs = Number(parts[0]);
  if (!Number.isFinite(issuedAtMs) || Date.now() - issuedAtMs > UNLOCK_TTL_MS || issuedAtMs > Date.now() + 60000) {
    return false;
  }
  const expected = signAdminUnlock(issuedAtMs);
  const a = Buffer.from(token, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', serverTimeMs: Date.now() });
  });

  app.get('/api/time', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ serverTimeMs: Date.now() });
  });

  app.post('/api/student/mint-identity', (req, res) => {
    const { sessionId, displayName, teamId } = req.body ?? {};
    if (
      typeof sessionId !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(sessionId) ||
      typeof displayName !== 'string' ||
      displayName.trim().length < 2 ||
      displayName.trim().length > 60 ||
      typeof teamId !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(teamId)
    ) {
      res.status(400).json({ error: 'Data identitas peserta tidak valid.' });
      return;
    }

    const participantId = `p_${crypto.randomBytes(10).toString('hex')}`;
    const authProof = crypto.randomBytes(24).toString('hex');
    const proofHash = crypto.createHash('sha256').update(authProof, 'utf8').digest('hex');
    const identitySignature = signStudentIdentity(sessionId, participantId, proofHash);

    res.json({
      participantId,
      authProof,
      proofHash,
      identitySignature,
      issuedAtMs: Date.now(),
    });
  });

  app.post('/api/student/verify-identity', (req, res) => {
    const { sessionId, participantId, authProof, identitySignature } = req.body ?? {};
    if (
      typeof sessionId !== 'string' ||
      typeof participantId !== 'string' ||
      typeof authProof !== 'string' ||
      typeof identitySignature !== 'string'
    ) {
      res.status(400).json({ valid: false });
      return;
    }

    const proofHash = crypto.createHash('sha256').update(authProof, 'utf8').digest('hex');
    const expected = signStudentIdentity(sessionId, participantId, proofHash);
    const sigBuf = Buffer.from(identitySignature, 'utf8');
    const expBuf = Buffer.from(expected, 'utf8');

    const valid = sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
    res.json({ valid, proofHash: valid ? proofHash : null });
  });

  app.post('/api/student/bridge-identity', (req, res) => {
    const { fromSessionId, toSessionId, participantId, authProof, identitySignature } = req.body ?? {};
    if (
      typeof fromSessionId !== 'string' ||
      typeof toSessionId !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(toSessionId) ||
      typeof participantId !== 'string' ||
      typeof authProof !== 'string' ||
      typeof identitySignature !== 'string'
    ) {
      res.status(400).json({ error: 'Parameter jembatan identitas tidak valid.' });
      return;
    }

    const proofHash = crypto.createHash('sha256').update(authProof, 'utf8').digest('hex');
    const expected = signStudentIdentity(fromSessionId, participantId, proofHash);
    const sigBuf = Buffer.from(identitySignature, 'utf8');
    const expBuf = Buffer.from(expected, 'utf8');

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      res.status(403).json({ error: 'Identitas tidak terverifikasi.' });
      return;
    }

    const nextSignature = signStudentIdentity(toSessionId, participantId, proofHash);
    res.json({
      participantId,
      authProof,
      proofHash,
      identitySignature: nextSignature,
    });
  });

  app.post('/api/admin/verify-password', (req, res) => {
    const { password } = req.body ?? {};
    if (typeof password !== 'string' || password.length === 0) {
      res.status(400).json({ valid: false, error: 'Masukkan kata sandi admin terlebih dahulu.' });
      return;
    }

    const inputHash = crypto.createHash('sha256').update(password, 'utf8').digest();
    const expectedHash = crypto.createHash('sha256').update(ADMIN_ACCESS_PASSWORD, 'utf8').digest();
    const valid = crypto.timingSafeEqual(inputHash, expectedHash);

    if (!valid) {
      res.status(401).json({ valid: false, error: 'Kata sandi admin tidak sesuai.' });
      return;
    }

    const issuedAtMs = Date.now();
    res.json({
      valid: true,
      unlockToken: signAdminUnlock(issuedAtMs),
      issuedAtMs,
    });
  });

  app.post('/api/admin/verify-unlock', (req, res) => {
    const { unlockToken } = req.body ?? {};
    if (typeof unlockToken !== 'string') {
      res.json({ valid: false });
      return;
    }
    res.json({ valid: verifyAdminUnlockToken(unlockToken) });
  });

  // Self-paced 15-question Ulumul Qur'an Multiple-Choice Quiz
  // Correct answers & explanations remain hidden until all 15 questions are submitted.
  interface StoredQuizAttempt {
    attemptId: string;
    studentName: string;
    studentNim: string;
    totalCorrect: number;
    totalQuestions: number;
    percentage: number;
    topicSummary: Array<{
      topicName: string;
      correct: number;
      total: number;
    }>;
    submittedAtMs: number;
  }

  const attemptsFile = path.join(__dirname, 'data', 'ulumul_quran_attempts.json');
  let quizAttempts: StoredQuizAttempt[] = [];
  try {
    if (fs.existsSync(attemptsFile)) {
      const parsed = JSON.parse(fs.readFileSync(attemptsFile, 'utf8')) as StoredQuizAttempt[];
      if (Array.isArray(parsed)) quizAttempts = parsed;
    }
  } catch {
    quizAttempts = [];
  }

  const persistAttempt = (attempt: StoredQuizAttempt) => {
    quizAttempts = [attempt, ...quizAttempts].slice(0, 500);
    try {
      fs.mkdirSync(path.dirname(attemptsFile), { recursive: true });
      fs.writeFileSync(attemptsFile, JSON.stringify(quizAttempts, null, 2), 'utf8');
    } catch {
      // Non-blocking in ephemeral container filesystems
    }
  };

  app.get('/api/quiz/ulumul-quran/questions', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      title: 'Kuis Pilihan Ganda ‘Ulûmul Qur’ân (4 Bab)',
      totalQuestions: ULUMUL_QURAN_QUESTIONS.length,
      questions: getPublicUlumulQuranQuestions(),
    });
  });

  app.post('/api/quiz/ulumul-quran/submit', (req, res) => {
    const { studentName, studentNim, answers } = req.body ?? {};
    if (
      typeof studentName !== 'string' ||
      studentName.trim().length < 2 ||
      studentName.trim().length > 60
    ) {
      res.status(400).json({ error: 'Masukkan nama lengkap mahasiswi (2–60 karakter).' });
      return;
    }

    const cleanNim = typeof studentNim === 'string' ? studentNim.trim().slice(0, 30) : '';

    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
      res.status(400).json({ error: 'Format jawaban tidak valid.' });
      return;
    }

    const answerMap = answers as Record<string, unknown>;
    const unanswered: number[] = [];

    ULUMUL_QURAN_QUESTIONS.forEach((q, idx) => {
      const chosen = answerMap[q.questionId];
      if (typeof chosen !== 'string' || !q.options?.includes(chosen)) {
        unanswered.push(idx + 1);
      }
    });

    if (unanswered.length > 0) {
      res.status(400).json({
        error: `Harap selesaikan seluruh 15 pertanyaan terlebih dahulu sebelum melihat jawaban akhir. Soal belum terjawab: nomor ${unanswered.join(', ')}.`,
      });
      return;
    }

    let totalCorrect = 0;
    const topicBucket = new Map<string, { topicName: string; correct: number; total: number }>();

    const reviewItems = ULUMUL_QURAN_QUESTIONS.map((q, idx) => {
      const selectedOption = String(answerMap[q.questionId]);
      const isCorrect = selectedOption === q.correctAnswer;
      if (isCorrect) totalCorrect += 1;

      const bucket = topicBucket.get(q.topicName) ?? {
        topicName: q.topicName,
        correct: 0,
        total: 0,
      };
      bucket.total += 1;
      if (isCorrect) bucket.correct += 1;
      topicBucket.set(q.topicName, bucket);

      return {
        questionId: q.questionId,
        number: idx + 1,
        topicName: q.topicName,
        subtopic: q.subtopic ?? '',
        questionText: q.questionText,
        options: q.options ?? [],
        selectedOption,
        correctAnswer: q.correctAnswer,
        isCorrect,
        explanation: q.explanation ?? '',
        reference: q.reference ?? '',
      };
    });

    const totalQuestions = ULUMUL_QURAN_QUESTIONS.length;
    const percentage = Math.round((totalCorrect / totalQuestions) * 100);
    const submittedAtMs = Date.now();
    const attemptId = `uq_${crypto.randomBytes(6).toString('hex')}`;

    const attemptSummary: StoredQuizAttempt = {
      attemptId,
      studentName: studentName.trim(),
      studentNim: cleanNim,
      totalCorrect,
      totalQuestions,
      percentage,
      topicSummary: Array.from(topicBucket.values()),
      submittedAtMs,
    };

    persistAttempt(attemptSummary);

    res.json({
      ...attemptSummary,
      reviewItems,
    });
  });

  app.get('/api/quiz/ulumul-quran/attempts', (req, res) => {
    const token = req.headers['x-admin-unlock-token'];
    if (typeof token !== 'string' || !verifyAdminUnlockToken(token)) {
      res.status(403).json({ error: 'Akses khusus admin.' });
      return;
    }
    res.json({ attempts: quizAttempts });
  });

  // Student Entry Check-in Registry (Nama Lengkap & NIM — readable exclusively by Admin)
  interface StoredStudentCheckin {
    checkinId: string;
    fullName: string;
    nim: string;
    targetMode: 'KUIS_PG' | 'SESI_KELAS';
    checkedInAtMs: number;
  }

  const checkinsFile = path.join(__dirname, 'data', 'student_checkins.json');
  let studentCheckins: StoredStudentCheckin[] = [];
  try {
    if (fs.existsSync(checkinsFile)) {
      const parsed = JSON.parse(fs.readFileSync(checkinsFile, 'utf8')) as StoredStudentCheckin[];
      if (Array.isArray(parsed)) studentCheckins = parsed;
    }
  } catch {
    studentCheckins = [];
  }

  const persistCheckins = () => {
    try {
      fs.mkdirSync(path.dirname(checkinsFile), { recursive: true });
      fs.writeFileSync(checkinsFile, JSON.stringify(studentCheckins, null, 2), 'utf8');
    } catch {
      // Non-blocking in ephemeral filesystems
    }
  };

  app.post('/api/student/check-in', (req, res) => {
    const { checkinId, fullName, nim, targetMode } = req.body ?? {};
    if (
      typeof fullName !== 'string' ||
      fullName.trim().length < 2 ||
      fullName.trim().length > 60
    ) {
      res.status(400).json({ error: 'Nama lengkap minimal 2 karakter.' });
      return;
    }
    const cleanNim = typeof nim === 'string' ? nim.replace(/\s+/g, '').trim().slice(0, 30) : '';
    if (cleanNim.length < 3) {
      res.status(400).json({ error: 'NIM minimal 3 karakter.' });
      return;
    }
    const validMode: 'KUIS_PG' | 'SESI_KELAS' =
      targetMode === 'SESI_KELAS' ? 'SESI_KELAS' : 'KUIS_PG';

    const cleanId =
      typeof checkinId === 'string' && /^[a-zA-Z0-9_-]{4,128}$/.test(checkinId)
        ? checkinId
        : `chk_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const record: StoredStudentCheckin = {
      checkinId: cleanId,
      fullName: fullName.trim(),
      nim: cleanNim,
      targetMode: validMode,
      checkedInAtMs: Date.now(),
    };

    studentCheckins = [
      record,
      ...studentCheckins.filter((item) => item.checkinId !== cleanId),
    ].slice(0, 1000);
    persistCheckins();

    res.json({ ok: true, checkinId: cleanId });
  });

  app.get('/api/admin/student-checkins', (req, res) => {
    const token = req.headers['x-admin-unlock-token'];
    if (typeof token !== 'string' || !verifyAdminUnlockToken(token)) {
      res.status(403).json({ error: 'Akses khusus admin.' });
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json({ checkins: studentCheckins });
  });

  app.delete('/api/admin/student-checkins/:checkinId', (req, res) => {
    const token = req.headers['x-admin-unlock-token'];
    if (typeof token !== 'string' || !verifyAdminUnlockToken(token)) {
      res.status(403).json({ error: 'Akses khusus admin.' });
      return;
    }
    const { checkinId } = req.params;
    studentCheckins = studentCheckins.filter((item) => item.checkinId !== checkinId);
    persistCheckins();
    res.json({ ok: true });
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ARENA KELAS 2.0 server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
