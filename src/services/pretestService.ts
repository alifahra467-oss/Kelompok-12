import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError } from '../lib/firebase';
import { getServerNowMs } from '../lib/serverTime';
import { ULUMUL_QURAN_QUESTIONS } from '../lib/ulumulQuranQuestions';
import {
  allocateBalancedTeams,
  evaluatePretestResults,
  moveStudentBetweenTeams,
  proposeTeamCaptains,
} from '../lib/teamBalancer';
import {
  DEFAULT_SCORING_CONFIG,
  OperationType,
  type GameMode,
  type QuestionPrivate,
  type SubmissionMode,
} from '../types/arena';
import type {
  BalanceReportPrivate,
  Pretest,
  PretestAdminSummary,
  PretestAllocationPublic,
  PretestParticipant,
  PretestQuestionPrivate,
  PretestResult,
  PretestStudentIdentity,
  PretestSubmission,
  ProposedCaptain,
} from '../types/pretest';
import { generateJoinCode } from './firestoreService';

function generateId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 14)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${rand}`;
}

function clampStr(val: string | undefined | null, max: number): string {
  return (val ?? '').trim().slice(0, max);
}

function getCurrentUid(): string {
  const uid = auth?.currentUser?.uid;
  if (!uid) throw new Error('Admin harus masuk terlebih dahulu.');
  return uid;
}

const PRETEST_STUDENT_STORAGE_PREFIX = 'arena_pretest_student_';

export function savePretestStudentIdentity(identity: PretestStudentIdentity): void {
  localStorage.setItem(`${PRETEST_STUDENT_STORAGE_PREFIX}${identity.pretestId}`, JSON.stringify(identity));
}

export function loadPretestStudentIdentity(pretestId: string): PretestStudentIdentity | null {
  try {
    const raw = localStorage.getItem(`${PRETEST_STUDENT_STORAGE_PREFIX}${pretestId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PretestStudentIdentity;
    if (!parsed?.participantId || !parsed?.authProof || !parsed?.identitySignature) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function verifyStoredPretestIdentity(identity: PretestStudentIdentity): Promise<boolean> {
  try {
    const res = await fetch('/api/student/verify-identity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: identity.pretestId,
        participantId: identity.participantId,
        authProof: identity.authProof,
        identitySignature: identity.identitySignature,
      }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { valid?: boolean };
    return Boolean(data.valid);
  } catch {
    return false;
  }
}

export async function listOpenPretests(): Promise<Pretest[]> {
  const path = 'pretests';
  try {
    const q = query(
      collection(db, 'pretests'),
      where('status', 'in', ['LOBBY', 'ACTIVE', 'PAUSED'])
    );
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => d.data() as Pretest);
    list.sort((a, b) => {
      const aMs = (a.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
      const bMs = (b.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
      return bMs - aMs;
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

// ==========================================
// ADMIN: PRE-TEST CRUD & QUESTIONS
// ==========================================

export async function createPretest(params: {
  title: string;
  meetingLabel?: string;
  teamCount: number;
  useWeightedPoints: boolean;
  releaseAllQuestions: boolean;
}): Promise<string> {
  const uid = getCurrentUid();
  const pretestId = generateId('pre');
  const joinCode = generateJoinCode();
  const path = `pretests/${pretestId}`;
  try {
    await setDoc(doc(db, 'pretests', pretestId), {
      pretestId,
      title: clampStr(params.title, 160),
      meetingLabel: clampStr(params.meetingLabel, 120),
      joinCode,
      status: 'LOBBY',
      useWeightedPoints: Boolean(params.useWeightedPoints),
      releaseAllQuestions: Boolean(params.releaseAllQuestions),
      activeQuestionId: null,
      timerRunning: false,
      timerDurationSec: 0,
      timerRemainingSec: 0,
      timerEndTimeMs: null,
      submissionDeadline: null,
      teamCount: Math.max(2, Math.min(12, Number(params.teamCount) || 4)),
      captainsLocked: false,
      teamsLocked: false,
      teamsPublished: false,
      showResultsToStudents: false,
      allocation: null,
      linkedSessionId: null,
      linkedGameMode: null,
      createdByUid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return pretestId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    return pretestId;
  }
}

export async function updatePretestFields(
  pretestId: string,
  fields: Record<string, unknown>
): Promise<void> {
  const path = `pretests/${pretestId}`;
  try {
    await updateDoc(doc(db, 'pretests', pretestId), {
      ...fields,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deletePretest(pretestId: string): Promise<void> {
  const path = `pretests/${pretestId}`;
  try {
    await deleteDoc(doc(db, 'pretests', pretestId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function savePretestQuestion(
  pretestId: string,
  input: Omit<PretestQuestionPrivate, 'questionId' | 'createdAt' | 'updatedAt'> & { questionId?: string }
): Promise<string> {
  const questionId = input.questionId || generateId('pq');
  const path = `pretests/${pretestId}/questions_private/${questionId}`;
  const docRef = doc(db, 'pretests', pretestId, 'questions_private', questionId);
  try {
    const existing = await getDoc(docRef);
    const cleanOptions = input.options.map((o) => clampStr(o, 500)).filter(Boolean).slice(0, 6);
    if (cleanOptions.length < 4) {
      throw new Error('Minimal 4 pilihan jawaban wajib diisi.');
    }
    const payload: Record<string, unknown> = {
      questionId,
      questionText: clampStr(input.questionText, 5000),
      options: cleanOptions,
      correctAnswer: clampStr(input.correctAnswer, 2000),
      explanation: clampStr(input.explanation, 5000),
      timeLimitSec: Math.max(5, Math.min(3600, Number(input.timeLimitSec) || 30)),
      orderIndex: Math.max(0, Math.min(1000, Number(input.orderIndex) || 0)),
      points: Math.max(1, Math.min(1000, Number(input.points) || 1)),
      isTieBreak: Boolean(input.isTieBreak),
      releasedToProjector: Boolean(input.releasedToProjector),
      updatedAt: serverTimestamp(),
      createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
    };
    await setDoc(docRef, payload);
    return questionId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return questionId;
  }
}

export async function deletePretestQuestion(pretestId: string, questionId: string): Promise<void> {
  const path = `pretests/${pretestId}/questions_private/${questionId}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'pretests', pretestId, 'questions_private', questionId));
    batch.delete(doc(db, 'pretests', pretestId, 'questions_public', questionId));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function importBankQuestionsToPretest(
  pretestId: string,
  bankQuestions: QuestionPrivate[],
  startOrderIndex: number
): Promise<number> {
  const mcQuestions = bankQuestions.filter(
    (q) => (q.type === 'MULTIPLE_CHOICE' || q.type === 'TRUE_FALSE') && (q.options?.length ?? 0) >= 4
  );
  if (mcQuestions.length === 0) return 0;

  const batch = writeBatch(db);
  mcQuestions.forEach((q, idx) => {
    const questionId = generateId('pq');
    batch.set(doc(db, 'pretests', pretestId, 'questions_private', questionId), {
      questionId,
      questionText: clampStr(q.questionText, 5000),
      options: (q.options ?? []).slice(0, 6),
      correctAnswer: clampStr(q.correctAnswer, 2000),
      explanation: clampStr(q.explanation, 5000),
      timeLimitSec: Math.max(10, Math.min(3600, q.timeLimitSec || 30)),
      orderIndex: startOrderIndex + idx,
      points: Math.max(1, Math.min(1000, q.points || 10)),
      isTieBreak: false,
      releasedToProjector: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
  return mcQuestions.length;
}

export async function importUlumulQuranQuestionsToPretest(
  pretestId: string,
  startOrderIndex: number
): Promise<number> {
  const batch = writeBatch(db);
  ULUMUL_QURAN_QUESTIONS.forEach((q, idx) => {
    const questionId = `${q.questionId}_${Date.now().toString(36)}`;
    batch.set(doc(db, 'pretests', pretestId, 'questions_private', questionId), {
      questionId,
      questionText: clampStr(q.questionText, 5000),
      options: (q.options ?? []).slice(0, 6),
      correctAnswer: clampStr(q.correctAnswer, 2000),
      explanation: clampStr(q.explanation, 5000),
      timeLimitSec: Math.max(10, Math.min(3600, q.timeLimitSec || 45)),
      orderIndex: startOrderIndex + idx,
      points: Math.max(1, Math.min(1000, q.points || 10)),
      isTieBreak: false,
      releasedToProjector: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
  return ULUMUL_QURAN_QUESTIONS.length;
}

// ==========================================
// ADMIN: LIVE PRE-TEST HOST CONTROLS
// ==========================================

export async function startAllPretestQuestions(
  pretest: Pretest,
  questions: PretestQuestionPrivate[],
  totalDurationSec?: number
): Promise<void> {
  const standardQuestions = questions.filter((q) => !q.isTieBreak);
  const targetList = standardQuestions.length > 0 ? standardQuestions : questions;
  if (targetList.length === 0) {
    throw new Error('Tambahkan minimal 1 soal pre-test terlebih dahulu.');
  }

  const duration =
    totalDurationSec && totalDurationSec > 0
      ? totalDurationSec
      : targetList.reduce((sum, q) => sum + (Number(q.timeLimitSec) || 30), 0);

  const nowMs = getServerNowMs();
  const endMs = nowMs + duration * 1000;
  const deadline = Timestamp.fromMillis(endMs + 4000);

  const batch = writeBatch(db);
  for (const q of targetList) {
    batch.set(doc(db, 'pretests', pretest.pretestId, 'questions_public', q.questionId), {
      questionId: q.questionId,
      questionText: q.questionText,
      options: q.options,
      timeLimitSec: q.timeLimitSec,
      orderIndex: q.orderIndex,
      points: q.points,
      isTieBreak: q.isTieBreak,
      answerRevealed: false,
      revealedAnswer: null,
      revealedExplanation: null,
      releasedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'pretests', pretest.pretestId, 'questions_private', q.questionId), {
      releasedToProjector: true,
      updatedAt: serverTimestamp(),
    });
  }

  batch.update(doc(db, 'pretests', pretest.pretestId), {
    status: 'ACTIVE',
    releaseAllQuestions: true,
    activeQuestionId: targetList[0].questionId,
    timerRunning: true,
    timerDurationSec: duration,
    timerRemainingSec: duration,
    timerEndTimeMs: endMs,
    submissionDeadline: deadline,
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
}

export async function releaseSinglePretestQuestion(
  pretest: Pretest,
  question: PretestQuestionPrivate
): Promise<void> {
  const duration = Math.max(10, Number(question.timeLimitSec) || 30);
  const nowMs = getServerNowMs();
  const endMs = nowMs + duration * 1000;
  const deadline = Timestamp.fromMillis(endMs + 4000);

  const batch = writeBatch(db);
  batch.set(doc(db, 'pretests', pretest.pretestId, 'questions_public', question.questionId), {
    questionId: question.questionId,
    questionText: question.questionText,
    options: question.options,
    timeLimitSec: question.timeLimitSec,
    orderIndex: question.orderIndex,
    points: question.points,
    isTieBreak: question.isTieBreak,
    answerRevealed: false,
    revealedAnswer: null,
    revealedExplanation: null,
    releasedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'pretests', pretest.pretestId, 'questions_private', question.questionId), {
    releasedToProjector: true,
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'pretests', pretest.pretestId), {
    status: 'ACTIVE',
    releaseAllQuestions: false,
    activeQuestionId: question.questionId,
    timerRunning: true,
    timerDurationSec: duration,
    timerRemainingSec: duration,
    timerEndTimeMs: endMs,
    submissionDeadline: deadline,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function pausePretest(pretest: Pretest): Promise<void> {
  const remaining = pretest.timerEndTimeMs
    ? Math.max(0, Math.ceil((pretest.timerEndTimeMs - getServerNowMs()) / 1000))
    : pretest.timerRemainingSec ?? 0;

  await updatePretestFields(pretest.pretestId, {
    status: 'PAUSED',
    timerRunning: false,
    timerRemainingSec: remaining,
    timerEndTimeMs: null,
  });
}

export async function resumePretest(pretest: Pretest): Promise<void> {
  const remaining = Math.max(5, pretest.timerRemainingSec || pretest.timerDurationSec || 60);
  const endMs = getServerNowMs() + remaining * 1000;
  await updatePretestFields(pretest.pretestId, {
    status: 'ACTIVE',
    timerRunning: true,
    timerRemainingSec: remaining,
    timerEndTimeMs: endMs,
    submissionDeadline: Timestamp.fromMillis(endMs + 4000),
  });
}

export async function finishPretest(pretestId: string): Promise<void> {
  await updatePretestFields(pretestId, {
    status: 'FINISHED',
    timerRunning: false,
    timerRemainingSec: 0,
    timerEndTimeMs: null,
  });
}

export async function revealPretestQuestionAnswer(
  pretestId: string,
  question: PretestQuestionPrivate
): Promise<void> {
  const docRef = doc(db, 'pretests', pretestId, 'questions_public', question.questionId);
  await updateDoc(docRef, {
    answerRevealed: true,
    revealedAnswer: question.correctAnswer,
    revealedExplanation: question.explanation || '',
  });
}

export async function finishAndRevealAllPretestAnswers(
  pretestId: string,
  questions: PretestQuestionPrivate[]
): Promise<void> {
  const batch = writeBatch(db);
  for (const q of questions) {
    if (!q.isTieBreak) {
      batch.set(doc(db, 'pretests', pretestId, 'questions_public', q.questionId), {
        questionId: q.questionId,
        questionText: q.questionText,
        options: q.options,
        timeLimitSec: q.timeLimitSec,
        orderIndex: q.orderIndex,
        points: q.points,
        isTieBreak: q.isTieBreak,
        answerRevealed: true,
        revealedAnswer: q.correctAnswer,
        revealedExplanation: q.explanation || '',
        releasedAt: serverTimestamp(),
      });
    }
  }
  batch.update(doc(db, 'pretests', pretestId), {
    status: 'FINISHED',
    showResultsToStudents: true,
    timerRunning: false,
    timerRemainingSec: 0,
    timerEndTimeMs: null,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

// ==========================================
// STUDENT JOIN, HEARTBEAT & SUBMISSION
// ==========================================

export async function findOpenPretestByJoinCode(code: string): Promise<Pretest | null> {
  const normalized = code.replace(/\D/g, '').slice(0, 6);
  if (normalized.length !== 6) return null;
  const q = query(
    collection(db, 'pretests'),
    where('joinCode', '==', normalized),
    where('status', 'in', ['LOBBY', 'ACTIVE', 'PAUSED']),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data() as Pretest;
}

export async function joinPretestAsStudent(params: {
  pretest: Pretest;
  displayName: string;
}): Promise<PretestStudentIdentity> {
  const { pretest, displayName } = params;

  const mintRes = await fetch('/api/student/mint-identity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: pretest.pretestId,
      displayName: clampStr(displayName, 60),
      teamId: 'pretest',
    }),
  });

  if (!mintRes.ok) {
    throw new Error('Gagal membuat identitas peserta pre-test.');
  }

  const minted = (await mintRes.json()) as {
    participantId: string;
    authProof: string;
    proofHash: string;
    identitySignature: string;
  };
  const participantId = minted.participantId;

  const batch = writeBatch(db);
  batch.set(doc(db, 'pretests', pretest.pretestId, 'participants', participantId), {
    participantId,
    displayName: clampStr(displayName, 60),
    status: 'APPROVED',
    isConnected: true,
    joinedAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
  });
  batch.set(doc(db, 'pretests', pretest.pretestId, 'participant_credentials', participantId), {
    participantId,
    proofHash: minted.proofHash,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `pretests/${pretest.pretestId}/participants`);
  }

  const identity: PretestStudentIdentity = {
    pretestId: pretest.pretestId,
    participantId,
    authProof: minted.authProof,
    proofHash: minted.proofHash,
    identitySignature: minted.identitySignature,
    displayName: clampStr(displayName, 60),
  };
  savePretestStudentIdentity(identity);
  return identity;
}

export async function sendPretestHeartbeat(
  pretestId: string,
  participantId: string,
  isConnected: boolean
): Promise<void> {
  try {
    await updateDoc(doc(db, 'pretests', pretestId, 'participants', participantId), {
      isConnected,
      lastSeenAt: serverTimestamp(),
    });
  } catch {
    // Heartbeat non-blocking
  }
}

export async function submitPretestAnswer(params: {
  pretestId: string;
  questionId: string;
  identity: PretestStudentIdentity;
  selectedOption: string;
}): Promise<void> {
  const { pretestId, questionId, identity, selectedOption } = params;
  const submissionId = `${questionId}_${identity.participantId}`;
  const path = `pretests/${pretestId}/submissions/${submissionId}`;

  const batch = writeBatch(db);
  batch.set(doc(db, 'pretests', pretestId, 'submissions', submissionId), {
    submissionId,
    questionId,
    participantId: identity.participantId,
    participantName: identity.displayName,
    authProof: identity.authProof,
    selectedOption: clampStr(selectedOption, 1000),
    submittedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'pretests', pretestId, 'submission_receipts', submissionId), {
    submissionId,
    questionId,
    participantId: identity.participantId,
    participantName: identity.displayName,
    submittedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// ==========================================
// ADMIN: EVALUATE, CAPTAINS, BALANCER, SPINNER, HANDOVER
// ==========================================

export async function evaluateAndSavePretestResults(params: {
  pretest: Pretest;
  participants: PretestParticipant[];
  questions: PretestQuestionPrivate[];
  submissions: PretestSubmission[];
  existingSummary?: PretestAdminSummary | null;
}): Promise<{
  results: PretestResult[];
  proposedCaptains: ProposedCaptain[];
}> {
  const { pretest, participants, questions, submissions, existingSummary } = params;
  const results = evaluatePretestResults({
    participants,
    questions,
    submissions,
    useWeightedPoints: pretest.useWeightedPoints,
  });

  const proposedCaptains = proposeTeamCaptains({
    results,
    participants,
    teamCount: pretest.teamCount,
    useWeightedPoints: pretest.useWeightedPoints,
  });

  const memberScores: Record<string, number> = {};
  for (const r of results) {
    memberScores[r.participantId] = pretest.useWeightedPoints ? r.weightedScore : r.totalCorrect;
  }

  const batch = writeBatch(db);
  for (const r of results) {
    batch.set(doc(db, 'pretests', pretest.pretestId, 'results', r.participantId), {
      ...r,
      updatedAt: serverTimestamp(),
    });
  }

  batch.set(doc(db, 'pretests', pretest.pretestId, 'admin_state', 'summary'), {
    docId: 'summary',
    proposedCaptains: pretest.captainsLocked && existingSummary?.proposedCaptains?.length
      ? existingSummary.proposedCaptains
      : proposedCaptains,
    balanceReport: existingSummary?.balanceReport ?? null,
    memberScores,
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
  return { results, proposedCaptains };
}

export async function saveProposedCaptains(
  pretestId: string,
  summary: PretestAdminSummary | null,
  captains: ProposedCaptain[],
  captainsLocked: boolean
): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(db, 'pretests', pretestId, 'admin_state', 'summary'), {
    docId: 'summary',
    proposedCaptains: captains,
    balanceReport: summary?.balanceReport ?? null,
    memberScores: summary?.memberScores ?? {},
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'pretests', pretestId), {
    captainsLocked,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function generateAndSaveBalancedAllocation(params: {
  pretest: Pretest;
  participants: PretestParticipant[];
  results: PretestResult[];
  captains: ProposedCaptain[];
  teamNames?: string[];
}): Promise<{
  allocation: PretestAllocationPublic;
  balanceReport: BalanceReportPrivate;
}> {
  const { pretest, participants, results, captains, teamNames } = params;
  const { allocation, balanceReport, memberScores } = allocateBalancedTeams({
    participants,
    results,
    captains,
    teamCount: pretest.teamCount,
    useWeightedPoints: pretest.useWeightedPoints,
    teamNames,
  });

  const batch = writeBatch(db);
  batch.update(doc(db, 'pretests', pretest.pretestId), {
    captainsLocked: true,
    teamsLocked: false,
    allocation,
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'pretests', pretest.pretestId, 'admin_state', 'summary'), {
    docId: 'summary',
    proposedCaptains: captains,
    balanceReport,
    memberScores,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
  return { allocation, balanceReport };
}

export async function moveStudentAndRecompute(params: {
  pretest: Pretest;
  summary: PretestAdminSummary;
  participantId: string;
  targetTeamId: string;
}): Promise<void> {
  const { pretest, summary, participantId, targetTeamId } = params;
  if (!pretest.allocation) throw new Error('Alokasi tim belum dibuat.');

  const { allocation, balanceReport } = moveStudentBetweenTeams({
    allocation: pretest.allocation,
    participantId,
    targetTeamId,
    memberScores: summary.memberScores,
  });

  const batch = writeBatch(db);
  batch.update(doc(db, 'pretests', pretest.pretestId), {
    allocation,
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'pretests', pretest.pretestId, 'admin_state', 'summary'), {
    docId: 'summary',
    proposedCaptains: summary.proposedCaptains,
    balanceReport,
    memberScores: summary.memberScores,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function startNextSpinnerSpin(pretest: Pretest): Promise<void> {
  const alloc = pretest.allocation;
  if (!alloc || alloc.revealIndex >= alloc.revealQueue.length) return;
  const nextItem = alloc.revealQueue[alloc.revealIndex];

  await updatePretestFields(pretest.pretestId, {
    allocation: {
      ...alloc,
      spinnerStatus: 'SPINNING',
      lastRevealed: nextItem,
      spinNonce: (alloc.spinNonce || 0) + 1,
    },
  });
}

export async function completeCurrentSpinReveal(pretest: Pretest): Promise<void> {
  const alloc = pretest.allocation;
  if (!alloc || alloc.revealIndex >= alloc.revealQueue.length) return;

  const currentItem = alloc.revealQueue[alloc.revealIndex];
  const revealedSet = new Set(alloc.revealedParticipantIds);
  revealedSet.add(currentItem.participantId);
  const nextIndex = alloc.revealIndex + 1;
  const isCompleted = nextIndex >= alloc.revealQueue.length;

  await updatePretestFields(pretest.pretestId, {
    allocation: {
      ...alloc,
      revealIndex: nextIndex,
      revealedParticipantIds: Array.from(revealedSet),
      lastRevealed: currentItem,
      spinnerStatus: isCompleted ? 'COMPLETED' : 'IDLE',
    },
    teamsPublished: isCompleted ? true : pretest.teamsPublished,
  });
}

export async function pauseSpinnerPresentation(pretest: Pretest): Promise<void> {
  if (!pretest.allocation) return;
  await updatePretestFields(pretest.pretestId, {
    allocation: {
      ...pretest.allocation,
      spinnerStatus: 'PAUSED',
    },
  });
}

export async function revealAllRemainingSpinner(pretest: Pretest): Promise<void> {
  const alloc = pretest.allocation;
  if (!alloc) return;

  const revealedSet = new Set(alloc.revealedParticipantIds);
  for (const item of alloc.revealQueue) {
    revealedSet.add(item.participantId);
  }
  const lastItem =
    alloc.revealQueue.length > 0 ? alloc.revealQueue[alloc.revealQueue.length - 1] : alloc.lastRevealed;

  await updatePretestFields(pretest.pretestId, {
    teamsPublished: true,
    allocation: {
      ...alloc,
      revealIndex: alloc.revealQueue.length,
      revealedParticipantIds: Array.from(revealedSet),
      lastRevealed: lastItem ?? null,
      spinnerStatus: 'COMPLETED',
    },
  });
}

export async function resetSpinnerPresentation(pretest: Pretest): Promise<void> {
  const alloc = pretest.allocation;
  if (!alloc) return;
  const captainIds = alloc.teams
    .map((t) => t.captainParticipantId)
    .filter(Boolean);

  await updatePretestFields(pretest.pretestId, {
    teamsPublished: false,
    allocation: {
      ...alloc,
      revealIndex: 0,
      revealedParticipantIds: captainIds,
      lastRevealed: null,
      spinnerStatus: alloc.revealQueue.length === 0 ? 'COMPLETED' : 'IDLE',
      spinNonce: 0,
    },
  });
}

export async function launchGameSessionFromPretest(params: {
  pretest: Pretest;
  title: string;
  meetingLabel?: string;
  gameMode: GameMode;
  submissionMode: SubmissionMode;
  requireJoinApproval: boolean;
}): Promise<string> {
  const { pretest, title, meetingLabel, gameMode, submissionMode, requireJoinApproval } = params;
  const uid = getCurrentUid();
  if (!pretest.allocation || pretest.allocation.teams.length === 0) {
    throw new Error('Susunan tim seimbang belum tersedia.');
  }

  const sessionId = generateId('ses');
  const joinCode = generateJoinCode();

  // Baca credential hash peserta pre-test (hanya dapat diakses Admin terverifikasi)
  const credSnap = await getDocs(
    collection(db, 'pretests', pretest.pretestId, 'participant_credentials')
  );
  const credMap = new Map<string, string>();
  for (const d of credSnap.docs) {
    const data = d.data() as { participantId: string; proofHash: string };
    credMap.set(data.participantId, data.proofHash);
  }

  const batch = writeBatch(db);

  batch.set(doc(db, 'sessions', sessionId), {
    sessionId,
    title: clampStr(title, 160),
    meetingLabel: clampStr(meetingLabel ?? pretest.meetingLabel ?? 'Kompetisi Utama', 120),
    gameMode,
    status: 'LOBBY',
    joinCode,
    requireJoinApproval,
    isJoinLocked: false,
    submissionMode,
    cerdasCermatRound: 'WAJIB',
    activeQuestionId: null,
    activeQuestionNumber: 0,
    activeTeamId: pretest.allocation.teams[0]?.teamId ?? null,
    authorizedTeamId: null,
    buzzerOpen: false,
    buzzerAttempt: 0,
    buzzerWinnerTeamId: null,
    buzzerWinnerTeamName: null,
    buzzerWinnerParticipantName: null,
    submissionsOpen: false,
    timerRunning: false,
    timerDurationSec: 0,
    timerRemainingSec: 0,
    timerEndTimeMs: null,
    submissionDeadline: null,
    answerRevealed: false,
    revealedAnswer: null,
    explanationRevealed: false,
    revealedExplanation: null,
    revealedReference: null,
    statsReleased: false,
    questionStats: null,
    scoringConfig: DEFAULT_SCORING_CONFIG,
    boardConfig: {
      columns: ['Kategori 1', 'Kategori 2', 'Kategori 3'],
      rows: [100, 200, 300, 400],
      tiles: {},
    },
    createdByUid: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  pretest.allocation.teams.forEach((team, idx) => {
    batch.set(doc(db, 'sessions', sessionId, 'teams', team.teamId), {
      teamId: team.teamId,
      name: team.name,
      color: team.color,
      score: 0,
      captainParticipantId: team.captainParticipantId || null,
      captainName: team.captainName || null,
      orderIndex: idx,
      updatedAt: serverTimestamp(),
    });

    for (const member of team.members) {
      batch.set(doc(db, 'sessions', sessionId, 'participants', member.participantId), {
        participantId: member.participantId,
        displayName: member.displayName,
        teamId: team.teamId,
        status: 'APPROVED',
        isCaptain: Boolean(member.isCaptain),
        isConnected: true,
        joinedAt: serverTimestamp(),
        lastSeenAt: serverTimestamp(),
      });

      const proofHash = credMap.get(member.participantId);
      if (proofHash) {
        batch.set(doc(db, 'sessions', sessionId, 'participant_credentials', member.participantId), {
          participantId: member.participantId,
          proofHash,
          createdAt: serverTimestamp(),
        });
      }
    }
  });

  batch.update(doc(db, 'pretests', pretest.pretestId), {
    teamsLocked: true,
    teamsPublished: true,
    linkedSessionId: sessionId,
    linkedGameMode: gameMode,
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
  return sessionId;
}
