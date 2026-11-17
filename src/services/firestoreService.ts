import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError } from '../lib/firebase';
import { DEMO_COURSE, DEMO_QUESTIONS, DEMO_TOPICS } from '../lib/demoSeed';
import {
  ULUMUL_QURAN_COURSE,
  ULUMUL_QURAN_QUESTIONS,
  ULUMUL_QURAN_TOPICS,
} from '../lib/ulumulQuranQuestions';
import { getServerNowMs } from '../lib/serverTime';
import {
  DEFAULT_SCORING_CONFIG,
  FIELD_LIMITS,
  OperationType,
  TEAM_COLOR_PALETTE,
  type ApprovedLecturer,
  type BoardConfig,
  type BuzzerClaim,
  type BuzzerEvent,
  type CerdasCermatRound,
  type Course,
  type GameMode,
  type Participant,
  type PublicQuestion,
  type PublicResponse,
  type QuestionPrivate,
  type QuestionStats,
  type RubricScores,
  type ScoreEvent,
  type ScoringConfig,
  type Session,
  type SessionStatus,
  type StudentIdentity,
  type Submission,
  type SubmissionMode,
  type Team,
  type Topic,
} from '../types/arena';

function generateId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 14)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${rand}`;
}

export function generateJoinCode(): string {
  const n = Math.floor(100000 + Math.random() * 900000);
  return String(n);
}

function clampStr(val: string | undefined | null, max: number): string {
  return (val ?? '').trim().slice(0, max);
}

function getCurrentUid(): string {
  const uid = auth?.currentUser?.uid;
  if (!uid) throw new Error('Admin harus masuk terlebih dahulu.');
  return uid;
}

// ==========================================
// COURSE & LECTURERS & TOPICS
// ==========================================

export async function saveCourse(course: Omit<Course, 'updatedAt'>): Promise<void> {
  const path = `course/${course.courseId}`;
  try {
    await setDoc(doc(db, 'course', course.courseId), {
      courseId: course.courseId,
      title: clampStr(course.title, FIELD_LIMITS.COURSE_TITLE_MAX),
      description: clampStr(course.description, FIELD_LIMITS.COURSE_DESC_MAX),
      lecturerName: clampStr(course.lecturerName, FIELD_LIMITS.LECTURER_NAME_MAX),
      semester: clampStr(course.semester, FIELD_LIMITS.SEMESTER_MAX),
      logoUrl: clampStr(course.logoUrl, 500),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function addApprovedLecturer(email: string, name: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const path = `approved_lecturers/${normalized}`;
  try {
    await setDoc(doc(db, 'approved_lecturers', normalized), {
      email: normalized,
      name: clampStr(name, 120),
      addedBy: auth?.currentUser?.email ?? 'lecturer',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function removeApprovedLecturer(email: string): Promise<void> {
  const path = `approved_lecturers/${email}`;
  try {
    await deleteDoc(doc(db, 'approved_lecturers', email));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveTopic(topic: Omit<Topic, 'updatedAt'>): Promise<void> {
  const id = topic.topicId || generateId('topic');
  const path = `topics/${id}`;
  try {
    await setDoc(doc(db, 'topics', id), {
      topicId: id,
      name: clampStr(topic.name, FIELD_LIMITS.TOPIC_NAME_MAX),
      description: clampStr(topic.description, 500),
      subtopics: topic.subtopics.map((s) => clampStr(s, 100)).filter(Boolean).slice(0, 30),
      orderIndex: Math.max(0, Math.min(1000, Number(topic.orderIndex) || 0)),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteTopic(topicId: string): Promise<void> {
  const path = `topics/${topicId}`;
  try {
    await deleteDoc(doc(db, 'topics', topicId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function seedSirahDemoData(): Promise<void> {
  const path = 'demo_seed';
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'course', DEMO_COURSE.courseId), {
      ...DEMO_COURSE,
      updatedAt: serverTimestamp(),
    });

    for (const topic of DEMO_TOPICS) {
      batch.set(doc(db, 'topics', topic.topicId), {
        ...topic,
        updatedAt: serverTimestamp(),
      });
    }

    for (const q of DEMO_QUESTIONS) {
      batch.set(doc(db, 'questions_private', q.questionId), {
        ...q,
        options: q.options ?? [],
        explanation: q.explanation ?? '',
        reference: q.reference ?? '',
        imageUrl: q.imageUrl ?? '',
        referenceRequirement: q.referenceRequirement ?? '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function seedUlumulQuranBank(): Promise<void> {
  const path = 'ulumul_quran_seed';
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'course', ULUMUL_QURAN_COURSE.courseId), {
      ...ULUMUL_QURAN_COURSE,
      updatedAt: serverTimestamp(),
    });

    for (const topic of ULUMUL_QURAN_TOPICS) {
      batch.set(doc(db, 'topics', topic.topicId), {
        ...topic,
        updatedAt: serverTimestamp(),
      });
    }

    for (const q of ULUMUL_QURAN_QUESTIONS) {
      batch.set(doc(db, 'questions_private', q.questionId), {
        ...q,
        options: q.options ?? [],
        explanation: q.explanation ?? '',
        reference: q.reference ?? '',
        imageUrl: q.imageUrl ?? '',
        referenceRequirement: q.referenceRequirement ?? '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ==========================================
// QUESTION BANK (PRIVATE)
// ==========================================

export async function createOrUpdateQuestion(
  input: Omit<QuestionPrivate, 'createdAt' | 'updatedAt'>,
  isEdit: boolean
): Promise<string> {
  const questionId = input.questionId || generateId('q');
  const path = `questions_private/${questionId}`;
  try {
    const ref = doc(db, 'questions_private', questionId);
    const payload = {
      questionId,
      topicId: clampStr(input.topicId, 128),
      topicName: clampStr(input.topicName, FIELD_LIMITS.TOPIC_NAME_MAX) || 'Umum',
      subtopic: clampStr(input.subtopic, 120),
      type: input.type,
      questionText: clampStr(input.questionText, FIELD_LIMITS.QUESTION_TEXT_MAX),
      options: (input.options ?? []).map((o) => clampStr(o, 500)).slice(0, 6),
      correctAnswer: clampStr(input.correctAnswer, FIELD_LIMITS.ANSWER_MAX),
      explanation: clampStr(input.explanation, FIELD_LIMITS.EXPLANATION_MAX),
      reference: clampStr(input.reference, FIELD_LIMITS.REFERENCE_MAX),
      difficulty: input.difficulty,
      points: Math.max(1, Math.min(5000, Number(input.points) || 100)),
      timeLimitSec: Math.max(5, Math.min(3600, Number(input.timeLimitSec) || 30)),
      enabledModes: input.enabledModes.length > 0 ? input.enabledModes.slice(0, 3) : ['CERDAS_CERMAT'],
      imageUrl: clampStr(input.imageUrl, 1000),
      referenceRequirement: clampStr(input.referenceRequirement, 500),
      isActive: Boolean(input.isActive),
      isDemo: Boolean(input.isDemo),
      updatedAt: serverTimestamp(),
    };

    if (isEdit) {
      const existingSnap = await getDoc(ref);
      const createdAt = existingSnap.exists() ? existingSnap.data().createdAt : serverTimestamp();
      await setDoc(ref, { ...payload, createdAt });
    } else {
      await setDoc(ref, { ...payload, createdAt: serverTimestamp() });
    }
    return questionId;
  } catch (error) {
    handleFirestoreError(error, isEdit ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteQuestion(questionId: string): Promise<void> {
  const path = `questions_private/${questionId}`;
  try {
    await deleteDoc(doc(db, 'questions_private', questionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function importQuestionsBatch(
  questions: Array<Omit<QuestionPrivate, 'questionId' | 'createdAt' | 'updatedAt'> & { questionId?: string }>
): Promise<number> {
  const path = 'questions_private';
  try {
    const chunkSize = 400;
    let total = 0;
    for (let i = 0; i < questions.length; i += chunkSize) {
      const slice = questions.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const q of slice) {
        const id = q.questionId && /^[a-zA-Z0-9_-]+$/.test(q.questionId) ? q.questionId : generateId('q');
        batch.set(doc(db, 'questions_private', id), {
          questionId: id,
          topicId: clampStr(q.topicId, 128),
          topicName: clampStr(q.topicName, 120) || 'Umum',
          subtopic: clampStr(q.subtopic, 120),
          type: q.type,
          questionText: clampStr(q.questionText, FIELD_LIMITS.QUESTION_TEXT_MAX),
          options: (q.options ?? []).map((o) => clampStr(o, 500)).slice(0, 6),
          correctAnswer: clampStr(q.correctAnswer, FIELD_LIMITS.ANSWER_MAX),
          explanation: clampStr(q.explanation, FIELD_LIMITS.EXPLANATION_MAX),
          reference: clampStr(q.reference, FIELD_LIMITS.REFERENCE_MAX),
          difficulty: q.difficulty || 'SEDANG',
          points: Math.max(1, Math.min(5000, Number(q.points) || 100)),
          timeLimitSec: Math.max(5, Math.min(3600, Number(q.timeLimitSec) || 30)),
          enabledModes: q.enabledModes?.length ? q.enabledModes.slice(0, 3) : ['CERDAS_CERMAT'],
          imageUrl: clampStr(q.imageUrl, 1000),
          referenceRequirement: clampStr(q.referenceRequirement, 500),
          isActive: q.isActive !== false,
          isDemo: Boolean(q.isDemo),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        total++;
      }
      await batch.commit();
    }
    return total;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function exportFullBackup(): Promise<Record<string, unknown>> {
  try {
    const [courseSnap, topicsSnap, questionsSnap, sessionsSnap] = await Promise.all([
      getDocs(collection(db, 'course')),
      getDocs(collection(db, 'topics')),
      getDocs(collection(db, 'questions_private')),
      getDocs(collection(db, 'sessions')),
    ]);
    return {
      exportedAt: new Date().toISOString(),
      version: 'ARENA_KELAS_2.0',
      course: courseSnap.docs.map((d) => d.data()),
      topics: topicsSnap.docs.map((d) => d.data()),
      questions: questionsSnap.docs.map((d) => d.data()),
      sessions: sessionsSnap.docs.map((d) => d.data()),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'backup');
  }
}

// ==========================================
// SESSIONS & TEAMS & PARTICIPANTS
// ==========================================

export async function createSession(params: {
  title: string;
  meetingLabel: string;
  gameMode: GameMode;
  submissionMode: SubmissionMode;
  requireJoinApproval: boolean;
  scoringConfig?: ScoringConfig;
  teamNames: string[];
  boardConfig?: BoardConfig;
}): Promise<string> {
  const uid = getCurrentUid();
  const sessionId = generateId('ses');
  const path = `sessions/${sessionId}`;
  try {
    const batch = writeBatch(db);
    const joinCode = generateJoinCode();
    const sessionDoc: Record<string, unknown> = {
      sessionId,
      title: clampStr(params.title, FIELD_LIMITS.SESSION_TITLE_MAX),
      meetingLabel: clampStr(params.meetingLabel, 120),
      gameMode: params.gameMode,
      status: 'LOBBY' as SessionStatus,
      joinCode,
      requireJoinApproval: params.requireJoinApproval,
      isJoinLocked: false,
      submissionMode: params.submissionMode,
      cerdasCermatRound: 'WAJIB' as CerdasCermatRound,
      activeQuestionId: null,
      activeQuestionNumber: 0,
      activeTeamId: null,
      authorizedTeamId: null,
      buzzerOpen: false,
      buzzerAttempt: 1,
      buzzerWinnerTeamId: null,
      buzzerWinnerTeamName: null,
      buzzerWinnerParticipantName: null,
      submissionsOpen: false,
      timerRunning: false,
      timerDurationSec: 30,
      timerRemainingSec: 30,
      timerEndTimeMs: null,
      submissionDeadline: null,
      answerRevealed: false,
      revealedAnswer: null,
      explanationRevealed: false,
      revealedExplanation: null,
      revealedReference: null,
      statsReleased: false,
      questionStats: null,
      scoringConfig: params.scoringConfig ?? DEFAULT_SCORING_CONFIG,
      createdByUid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (params.boardConfig) {
      sessionDoc.boardConfig = params.boardConfig;
    }

    batch.set(doc(db, 'sessions', sessionId), sessionDoc);

    const names = params.teamNames.length >= 2 ? params.teamNames : ['Tim Al-Muhajirin', 'Tim Al-Anshar'];
    names.forEach((name, idx) => {
      const teamId = `team_${idx + 1}`;
      batch.set(doc(db, 'sessions', sessionId, 'teams', teamId), {
        teamId,
        name: clampStr(name, FIELD_LIMITS.TEAM_NAME_MAX) || `Tim ${idx + 1}`,
        color: TEAM_COLOR_PALETTE[idx % TEAM_COLOR_PALETTE.length],
        score: 0,
        captainParticipantId: null,
        captainName: null,
        orderIndex: idx,
        updatedAt: serverTimestamp(),
      });
    });

    await batch.commit();
    return sessionId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateSessionFields(
  sessionId: string,
  fields: Partial<Session>
): Promise<void> {
  const path = `sessions/${sessionId}`;
  try {
    await updateDoc(doc(db, 'sessions', sessionId), {
      ...fields,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  const path = `sessions/${sessionId}`;
  try {
    await deleteDoc(doc(db, 'sessions', sessionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveTeam(
  sessionId: string,
  team: Omit<Team, 'updatedAt'>
): Promise<void> {
  const teamId = team.teamId || generateId('team');
  const path = `sessions/${sessionId}/teams/${teamId}`;
  try {
    await setDoc(doc(db, 'sessions', sessionId, 'teams', teamId), {
      teamId,
      name: clampStr(team.name, FIELD_LIMITS.TEAM_NAME_MAX),
      color: team.color || '#2563EB',
      score: Number(team.score) || 0,
      captainParticipantId: team.captainParticipantId ?? null,
      captainName: team.captainName ?? null,
      orderIndex: Number(team.orderIndex) || 0,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteTeam(sessionId: string, teamId: string): Promise<void> {
  const path = `sessions/${sessionId}/teams/${teamId}`;
  try {
    await deleteDoc(doc(db, 'sessions', sessionId, 'teams', teamId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function updateParticipantStatus(
  sessionId: string,
  participantId: string,
  status: Participant['status']
): Promise<void> {
  const path = `sessions/${sessionId}/participants/${participantId}`;
  try {
    await updateDoc(doc(db, 'sessions', sessionId, 'participants', participantId), {
      status,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function moveParticipantTeam(
  sessionId: string,
  participantId: string,
  newTeamId: string
): Promise<void> {
  const path = `sessions/${sessionId}/participants/${participantId}`;
  try {
    await updateDoc(doc(db, 'sessions', sessionId, 'participants', participantId), {
      teamId: newTeamId,
      isCaptain: false,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function setTeamCaptain(
  sessionId: string,
  teamId: string,
  participant: Participant
): Promise<void> {
  const path = `sessions/${sessionId}/teams/${teamId}`;
  try {
    const participantsSnap = await getDocs(
      query(collection(db, 'sessions', sessionId, 'participants'), where('teamId', '==', teamId))
    );
    const batch = writeBatch(db);
    for (const pDoc of participantsSnap.docs) {
      batch.update(pDoc.ref, { isCaptain: pDoc.id === participant.participantId });
    }
    batch.update(doc(db, 'sessions', sessionId, 'teams', teamId), {
      captainParticipantId: participant.participantId,
      captainName: participant.displayName,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ==========================================
// LECTURER LIVE GAME CONTROL
// ==========================================

export async function openQuestionOnStage(
  session: Session,
  question: QuestionPrivate,
  options?: {
    authorizedTeamId?: string | null;
    round?: CerdasCermatRound;
    autoOpenSubmissions?: boolean;
    autoStartTimer?: boolean;
  }
): Promise<void> {
  const path = `sessions/${session.sessionId}`;
  try {
    const pubRef = doc(db, 'sessions', session.sessionId, 'public_questions', question.questionId);
    const pubSnap = await getDoc(pubRef);
    const batch = writeBatch(db);

    const publicQuestionPayload: Record<string, unknown> = {
      questionId: question.questionId,
      topicName: question.topicName,
      subtopic: question.subtopic ?? '',
      type: question.type,
      questionText: question.questionText,
      options: question.options ?? [],
      difficulty: question.difficulty,
      points: question.points,
      timeLimitSec: question.timeLimitSec,
      imageUrl: question.imageUrl ?? '',
      referenceRequirement: question.referenceRequirement ?? '',
      releasedAt: pubSnap.exists() ? pubSnap.data().releasedAt : serverTimestamp(),
    };

    batch.set(pubRef, publicQuestionPayload);

    const nextNumber = (session.activeQuestionNumber ?? 0) + 1;
    const duration = question.timeLimitSec || 30;
    const nowMs = getServerNowMs();
    const startTimer = Boolean(options?.autoStartTimer);

    batch.update(doc(db, 'sessions', session.sessionId), {
      status: 'ACTIVE',
      activeQuestionId: question.questionId,
      activeQuestionNumber: nextNumber,
      cerdasCermatRound: options?.round ?? session.cerdasCermatRound ?? 'WAJIB',
      activeTeamId: options?.authorizedTeamId ?? session.activeTeamId ?? null,
      authorizedTeamId: options?.authorizedTeamId ?? null,
      buzzerOpen: false,
      buzzerAttempt: (session.buzzerAttempt ?? 0) + 1,
      buzzerWinnerTeamId: null,
      buzzerWinnerTeamName: null,
      buzzerWinnerParticipantName: null,
      submissionsOpen: options?.autoOpenSubmissions ?? true,
      timerRunning: startTimer,
      timerDurationSec: duration,
      timerRemainingSec: duration,
      timerEndTimeMs: startTimer ? nowMs + duration * 1000 : null,
      submissionDeadline: startTimer
        ? Timestamp.fromMillis(nowMs + (duration + 3) * 1000)
        : null,
      answerRevealed: false,
      revealedAnswer: null,
      explanationRevealed: false,
      revealedExplanation: null,
      revealedReference: null,
      statsReleased: false,
      questionStats: null,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function startSessionTimer(session: Session, durationSec?: number): Promise<void> {
  const sec = Math.max(1, durationSec ?? session.timerRemainingSec ?? session.timerDurationSec ?? 30);
  const nowMs = getServerNowMs();
  await updateSessionFields(session.sessionId, {
    timerRunning: true,
    timerRemainingSec: sec,
    timerEndTimeMs: nowMs + sec * 1000,
    submissionDeadline: Timestamp.fromMillis(nowMs + (sec + 3) * 1000),
  });
}

export async function pauseSessionTimer(session: Session, remainingSec: number): Promise<void> {
  await updateSessionFields(session.sessionId, {
    timerRunning: false,
    timerRemainingSec: Math.max(0, Math.round(remainingSec)),
    timerEndTimeMs: null,
    submissionDeadline: null,
  });
}

export async function resetSessionTimer(session: Session, fullDurationSec: number): Promise<void> {
  await updateSessionFields(session.sessionId, {
    timerRunning: false,
    timerDurationSec: fullDurationSec,
    timerRemainingSec: fullDurationSec,
    timerEndTimeMs: null,
    submissionDeadline: null,
  });
}

export async function openBuzzer(session: Session): Promise<void> {
  const nextAttempt = (session.buzzerAttempt ?? 0) + 1;
  await updateSessionFields(session.sessionId, {
    buzzerOpen: true,
    buzzerAttempt: nextAttempt,
    buzzerWinnerTeamId: null,
    buzzerWinnerTeamName: null,
    buzzerWinnerParticipantName: null,
    authorizedTeamId: null,
  });
}

export async function lockBuzzerAndSyncWinner(
  session: Session,
  claim: BuzzerClaim
): Promise<void> {
  const path = `sessions/${session.sessionId}/buzzer_events`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'sessions', session.sessionId), {
      buzzerOpen: false,
      buzzerWinnerTeamId: claim.teamId,
      buzzerWinnerTeamName: claim.teamName,
      buzzerWinnerParticipantName: claim.participantName,
      authorizedTeamId: claim.teamId,
      activeTeamId: claim.teamId,
      submissionsOpen: true,
      updatedAt: serverTimestamp(),
    });
    const eventId = generateId('buz');
    batch.set(doc(db, 'sessions', session.sessionId, 'buzzer_events', eventId), {
      eventId,
      questionId: claim.questionId,
      attempt: claim.attempt,
      teamId: claim.teamId,
      teamName: claim.teamName,
      participantId: claim.participantId,
      participantName: claim.participantName,
      status: 'WON',
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function rejectAndReopenBuzzer(session: Session): Promise<void> {
  const path = `sessions/${session.sessionId}/buzzer_events`;
  try {
    const batch = writeBatch(db);
    const nextAttempt = (session.buzzerAttempt ?? 0) + 1;
    if (session.buzzerWinnerTeamId && session.activeQuestionId) {
      const rejId = generateId('buz');
      batch.set(doc(db, 'sessions', session.sessionId, 'buzzer_events', rejId), {
        eventId: rejId,
        questionId: session.activeQuestionId,
        attempt: session.buzzerAttempt,
        teamId: session.buzzerWinnerTeamId,
        teamName: session.buzzerWinnerTeamName ?? '',
        participantId: '',
        participantName: session.buzzerWinnerParticipantName ?? '',
        status: 'REJECTED',
        createdAt: serverTimestamp(),
      });
    }
    if (session.activeQuestionId) {
      const reopenId = generateId('buz');
      batch.set(doc(db, 'sessions', session.sessionId, 'buzzer_events', reopenId), {
        eventId: reopenId,
        questionId: session.activeQuestionId,
        attempt: nextAttempt,
        status: 'REOPENED',
        createdAt: serverTimestamp(),
      });
    }

    batch.update(doc(db, 'sessions', session.sessionId), {
      buzzerOpen: true,
      buzzerAttempt: nextAttempt,
      buzzerWinnerTeamId: null,
      buzzerWinnerTeamName: null,
      buzzerWinnerParticipantName: null,
      authorizedTeamId: null,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function passQuestionToTeam(
  sessionId: string,
  targetTeamId: string
): Promise<void> {
  await updateSessionFields(sessionId, {
    cerdasCermatRound: 'LEMPARAN',
    authorizedTeamId: targetTeamId,
    activeTeamId: targetTeamId,
    submissionsOpen: true,
  });
}

export async function markBoardTileCompleted(
  session: Session,
  tileKey: string,
  teamId?: string | null,
  teamName?: string | null
): Promise<void> {
  if (!session.boardConfig) return;
  const tile = session.boardConfig.tiles[tileKey];
  if (!tile) return;

  const updatedBoard: BoardConfig = {
    ...session.boardConfig,
    tiles: {
      ...session.boardConfig.tiles,
      [tileKey]: {
        ...tile,
        completed: true,
        completedByTeamId: teamId ?? null,
        completedByTeamName: teamName ?? null,
      },
    },
  };

  await updateSessionFields(session.sessionId, {
    boardConfig: updatedBoard,
  });
}

export async function revealAnswerOrExplanation(
  sessionId: string,
  question: QuestionPrivate,
  opts: {
    revealAnswer?: boolean;
    revealExplanation?: boolean;
    stats?: QuestionStats;
  }
): Promise<void> {
  const patch: Partial<Session> = {};
  if (opts.revealAnswer) {
    patch.answerRevealed = true;
    patch.revealedAnswer = question.correctAnswer;
    patch.submissionsOpen = false;
    patch.buzzerOpen = false;
  }
  if (opts.revealExplanation) {
    patch.explanationRevealed = true;
    patch.revealedExplanation = question.explanation ?? 'Belum ada pembahasan tertulis.';
    patch.revealedReference = question.reference ?? '';
  }
  if (opts.stats) {
    patch.statsReleased = true;
    patch.questionStats = opts.stats;
  }
  await updateSessionFields(sessionId, patch);
}

export async function publishAnonymousResponseToProjector(
  sessionId: string,
  submission: Submission,
  anonymousLabel: string
): Promise<void> {
  const path = `sessions/${sessionId}/public_responses/${submission.submissionId}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'sessions', sessionId, 'public_responses', submission.submissionId), {
      responseId: submission.submissionId,
      questionId: submission.questionId,
      questionRoundKey: submission.questionRoundKey,
      anonymousLabel: clampStr(anonymousLabel, 80),
      answerText: clampStr(submission.answerText, 5000),
      argumentText: clampStr(submission.argumentText, 5000),
      referenceText: clampStr(submission.referenceText, 1000),
      awardedPoints: submission.awardedPoints,
      approvedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'sessions', sessionId, 'submissions', submission.submissionId), {
      approvedForProjector: true,
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ==========================================
// ATOMIC SCORING & GRADING & UNDO
// ==========================================

export async function applyScoreTransaction(params: {
  sessionId: string;
  teamId: string;
  delta: number;
  reason: string;
  type: ScoreEvent['type'];
  questionId?: string | null;
  submissionId?: string | null;
  isCorrect?: boolean | null;
  rubricScores?: RubricScores | null;
  lecturerFeedback?: string;
}): Promise<void> {
  const uid = getCurrentUid();
  const path = `sessions/${params.sessionId}/score_events`;
  try {
    await runTransaction(db, async (tx) => {
      const teamRef = doc(db, 'sessions', params.sessionId, 'teams', params.teamId);
      const teamSnap = await tx.get(teamRef);
      if (!teamSnap.exists()) {
        throw new Error('Tim tidak ditemukan.');
      }
      const teamData = teamSnap.data() as Team;
      const previousScore = Number(teamData.score) || 0;
      const newScore = previousScore + params.delta;

      let prevSubmissionDelta = 0;
      if (params.submissionId) {
        const subRef = doc(db, 'sessions', params.sessionId, 'submissions', params.submissionId);
        const subSnap = await tx.get(subRef);
        if (subSnap.exists()) {
          const subData = subSnap.data() as Submission;
          if (subData.isGraded) {
            prevSubmissionDelta = Number(subData.awardedPoints) || 0;
          }
          tx.update(subRef, {
            isGraded: true,
            isCorrect: params.isCorrect ?? null,
            awardedPoints: params.delta,
            rubricScores: params.rubricScores ?? null,
            lecturerFeedback: clampStr(params.lecturerFeedback, FIELD_LIMITS.FEEDBACK_MAX),
          });
          const receiptRef = doc(db, 'sessions', params.sessionId, 'submission_receipts', params.submissionId);
          tx.update(receiptRef, {
            status: 'GRADED',
            isCorrect: params.isCorrect ?? null,
            awardedPoints: params.delta,
          });
        }
      }

      const effectiveDelta = params.delta - prevSubmissionDelta;
      const adjustedNewScore = previousScore + effectiveDelta;

      tx.update(teamRef, {
        score: adjustedNewScore,
        updatedAt: serverTimestamp(),
      });

      const eventId = generateId('scr');
      tx.set(doc(db, 'sessions', params.sessionId, 'score_events', eventId), {
        eventId,
        teamId: params.teamId,
        teamName: teamData.name,
        questionId: params.questionId ?? null,
        submissionId: params.submissionId ?? null,
        delta: effectiveDelta,
        previousScore,
        newScore: adjustedNewScore,
        reason: clampStr(params.reason, 300) || 'Penilaian admin',
        type: params.type,
        undone: false,
        undoneByEventId: null,
        createdByUid: uid,
        createdAt: serverTimestamp(),
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function undoLastScoreEvent(sessionId: string): Promise<boolean> {
  const uid = getCurrentUid();
  const path = `sessions/${sessionId}/score_events`;
  try {
    const q = query(
      collection(db, 'sessions', sessionId, 'score_events'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const snap = await getDocs(q);
    const targetDoc = snap.docs.find((d) => {
      const data = d.data() as ScoreEvent;
      return !data.undone && data.type !== 'UNDO';
    });

    if (!targetDoc) return false;
    const target = targetDoc.data() as ScoreEvent;

    await runTransaction(db, async (tx) => {
      const freshTargetSnap = await tx.get(targetDoc.ref);
      if (!freshTargetSnap.exists()) return;
      const freshTarget = freshTargetSnap.data() as ScoreEvent;
      if (freshTarget.undone) return;

      const teamRef = doc(db, 'sessions', sessionId, 'teams', freshTarget.teamId);
      const teamSnap = await tx.get(teamRef);
      if (!teamSnap.exists()) return;

      const teamData = teamSnap.data() as Team;
      const previousScore = Number(teamData.score) || 0;
      const reversedDelta = -freshTarget.delta;
      const newScore = previousScore + reversedDelta;

      const undoEventId = generateId('undo');

      tx.update(teamRef, {
        score: newScore,
        updatedAt: serverTimestamp(),
      });

      tx.update(targetDoc.ref, {
        undone: true,
        undoneByEventId: undoEventId,
      });

      if (freshTarget.submissionId) {
        const subRef = doc(db, 'sessions', sessionId, 'submissions', freshTarget.submissionId);
        const subSnap = await tx.get(subRef);
        if (subSnap.exists()) {
          tx.update(subRef, {
            isGraded: false,
            isCorrect: null,
            awardedPoints: 0,
          });
        }
        const receiptRef = doc(db, 'sessions', sessionId, 'submission_receipts', freshTarget.submissionId);
        const receiptSnap = await tx.get(receiptRef);
        if (receiptSnap.exists()) {
          tx.update(receiptRef, {
            status: 'SUBMITTED',
            isCorrect: null,
            awardedPoints: 0,
          });
        }
      }

      tx.set(doc(db, 'sessions', sessionId, 'score_events', undoEventId), {
        eventId: undoEventId,
        teamId: freshTarget.teamId,
        teamName: freshTarget.teamName,
        questionId: freshTarget.questionId ?? null,
        submissionId: freshTarget.submissionId ?? null,
        delta: reversedDelta,
        previousScore,
        newScore,
        reason: clampStr(`Pembatalan: ${freshTarget.reason}`, 300),
        type: 'UNDO',
        undone: false,
        undoneByEventId: null,
        createdByUid: uid,
        createdAt: serverTimestamp(),
      });
    });

    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ==========================================
// STUDENT PORTAL OPERATIONS
// ==========================================

export function saveStudentIdentity(identity: StudentIdentity): void {
  try {
    localStorage.setItem(`arena_student_${identity.sessionId}`, JSON.stringify(identity));
  } catch {
    // Ignore storage quota issues
  }
}

export function loadStudentIdentity(sessionId: string): StudentIdentity | null {
  try {
    const raw = localStorage.getItem(`arena_student_${sessionId}`);
    if (!raw) return null;
    return JSON.parse(raw) as StudentIdentity;
  } catch {
    return null;
  }
}

export async function findOpenSessionByJoinCode(joinCode: string): Promise<Session | null> {
  const cleaned = joinCode.replace(/\D/g, '').slice(0, 6);
  if (cleaned.length !== 6) return null;
  const path = 'sessions';
  try {
    const q = query(
      collection(db, 'sessions'),
      where('joinCode', '==', cleaned),
      where('status', 'in', ['LOBBY', 'ACTIVE', 'PAUSED', 'REVIEWING']),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].data() as Session;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function listOpenSessions(): Promise<Session[]> {
  const path = 'sessions';
  try {
    const q = query(
      collection(db, 'sessions'),
      where('status', 'in', ['LOBBY', 'ACTIVE', 'PAUSED', 'REVIEWING'])
    );
    const snap = await getDocs(q);
    const list = snap.docs
      .map((d) => d.data() as Session)
      .filter((s) => !s.isJoinLocked);
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

export async function joinSessionAsStudent(params: {
  session: Session;
  displayName: string;
  teamId: string;
}): Promise<StudentIdentity> {
  const cleanName = clampStr(params.displayName, FIELD_LIMITS.DISPLAY_NAME_MAX);
  if (cleanName.length < 2) {
    throw new Error('Nama tampilan minimal 2 karakter.');
  }

  // Prevent duplicate participant names inside the same session
  const existingParticipants = await getDocs(
    collection(db, 'sessions', params.session.sessionId, 'participants')
  );
  const duplicate = existingParticipants.docs.find((d) => {
    const p = d.data() as Participant;
    return (
      p.status !== 'REMOVED' &&
      p.status !== 'REJECTED' &&
      p.displayName.trim().toLowerCase() === cleanName.toLowerCase()
    );
  });
  if (duplicate) {
    throw new Error(`Nama "${cleanName}" sudah terdaftar di sesi ini. Gunakan nama yang unik.`);
  }

  // Mint cryptographic identity on backend server
  const res = await fetch('/api/student/mint-identity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: params.session.sessionId,
      displayName: cleanName,
      teamId: params.teamId,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Gagal membuat identitas sesi mahasiswa.');
  }
  const minted = (await res.json()) as {
    participantId: string;
    authProof: string;
    proofHash: string;
    identitySignature: string;
  };

  const path = `sessions/${params.session.sessionId}/participants/${minted.participantId}`;
  try {
    const batch = writeBatch(db);
    const initialStatus = params.session.requireJoinApproval ? 'PENDING' : 'APPROVED';

    batch.set(doc(db, 'sessions', params.session.sessionId, 'participants', minted.participantId), {
      participantId: minted.participantId,
      displayName: cleanName,
      teamId: params.teamId,
      status: initialStatus,
      isCaptain: false,
      isConnected: true,
      joinedAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
    });

    batch.set(
      doc(db, 'sessions', params.session.sessionId, 'participant_credentials', minted.participantId),
      {
        participantId: minted.participantId,
        proofHash: minted.proofHash,
        createdAt: serverTimestamp(),
      }
    );

    await batch.commit();

    const identity: StudentIdentity = {
      sessionId: params.session.sessionId,
      participantId: minted.participantId,
      authProof: minted.authProof,
      proofHash: minted.proofHash,
      identitySignature: minted.identitySignature,
      displayName: cleanName,
      teamId: params.teamId,
    };
    saveStudentIdentity(identity);
    return identity;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function verifyStoredStudentIdentity(identity: StudentIdentity): Promise<boolean> {
  try {
    const res = await fetch('/api/student/verify-identity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: identity.sessionId,
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

export async function sendStudentHeartbeat(
  sessionId: string,
  participantId: string,
  isConnected = true
): Promise<void> {
  try {
    await updateDoc(doc(db, 'sessions', sessionId, 'participants', participantId), {
      isConnected,
      lastSeenAt: serverTimestamp(),
    });
  } catch {
    // Non-blocking heartbeat
  }
}

export function getQuestionRoundKey(session: Session, questionId: string): string {
  const num = session.activeQuestionNumber ?? 1;
  return `${questionId}_r${num}`;
}

export async function submitStudentAnswer(params: {
  session: Session;
  question: PublicQuestion;
  identity: StudentIdentity;
  participant: Participant;
  team: Team;
  selectedOption?: string | null;
  answerText?: string;
  argumentText?: string;
  referenceText?: string;
}): Promise<string> {
  const roundKey = getQuestionRoundKey(params.session, params.question.questionId);
  const submissionId =
    params.session.submissionMode === 'INDIVIDUAL'
      ? `${roundKey}_${params.participant.participantId}`
      : `${roundKey}_${params.team.teamId}`;

  const path = `sessions/${params.session.sessionId}/submissions/${submissionId}`;

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'sessions', params.session.sessionId, 'submissions', submissionId), {
      submissionId,
      questionId: params.question.questionId,
      questionRoundKey: roundKey,
      teamId: params.team.teamId,
      teamName: params.team.name,
      participantId: params.participant.participantId,
      participantName: params.participant.displayName,
      authProof: params.identity.authProof,
      selectedOption: params.selectedOption ?? null,
      answerText: clampStr(params.answerText, FIELD_LIMITS.QUESTION_TEXT_MAX),
      argumentText: clampStr(params.argumentText, FIELD_LIMITS.QUESTION_TEXT_MAX),
      referenceText: clampStr(params.referenceText, 1000),
      isGraded: false,
      isCorrect: null,
      awardedPoints: 0,
      rubricScores: null,
      lecturerFeedback: '',
      approvedForProjector: false,
      submittedAt: serverTimestamp(),
    });

    batch.set(
      doc(db, 'sessions', params.session.sessionId, 'submission_receipts', submissionId),
      {
        submissionId,
        questionRoundKey: roundKey,
        questionId: params.question.questionId,
        teamId: params.team.teamId,
        teamName: params.team.name,
        participantId: params.participant.participantId,
        participantName: params.participant.displayName,
        status: 'SUBMITTED',
        isCorrect: null,
        awardedPoints: 0,
        submittedAt: serverTimestamp(),
      }
    );

    await batch.commit();
    return submissionId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function claimStudentBuzzer(params: {
  session: Session;
  identity: StudentIdentity;
  participant: Participant;
  team: Team;
}): Promise<{ won: boolean; message: string }> {
  if (!params.session.activeQuestionId || !params.session.buzzerOpen) {
    return { won: false, message: 'Bel rebutan saat ini sedang dikunci oleh admin.' };
  }

  const claimId = `${params.session.activeQuestionId}_a${params.session.buzzerAttempt}`;
  try {
    const batch = writeBatch(db);

    batch.set(doc(db, 'sessions', params.session.sessionId, 'buzzer_claims', claimId), {
      claimId,
      questionId: params.session.activeQuestionId,
      attempt: params.session.buzzerAttempt,
      teamId: params.team.teamId,
      teamName: params.team.name,
      teamColor: params.team.color,
      participantId: params.participant.participantId,
      participantName: params.participant.displayName,
      claimedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'sessions', params.session.sessionId, 'buzzer_proofs', claimId), {
      claimId,
      participantId: params.participant.participantId,
      teamId: params.team.teamId,
      authProof: params.identity.authProof,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
    return { won: true, message: 'Buzzer berhasil diklaim! Tim Anda berhak menjawab.' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('permission-denied') || msg.includes('PERMISSION_DENIED') || msg.includes('already exists')) {
      return { won: false, message: 'Tim lain lebih cepat menekan buzzer!' };
    }
    return { won: false, message: 'Gagal mengklaim buzzer. Periksa koneksi Anda.' };
  }
}
