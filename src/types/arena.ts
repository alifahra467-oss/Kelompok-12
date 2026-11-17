export type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'ESSAY_CASE';
export type DifficultyLevel = 'MUDAH' | 'SEDANG' | 'SULIT';
export type GameMode = 'CERDAS_CERMAT' | 'PAPAN_TANTANGAN' | 'TANTANGAN_ANALISIS';
export type SessionStatus = 'DRAFT' | 'LOBBY' | 'ACTIVE' | 'PAUSED' | 'REVIEWING' | 'FINISHED';
export type CerdasCermatRound = 'WAJIB' | 'LEMPARAN' | 'REBUTAN';
export type SubmissionMode = 'CAPTAIN_ONLY' | 'INDIVIDUAL' | 'TEAM_CONSENSUS';
export type ParticipantStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REMOVED';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export const FIELD_LIMITS = {
  COURSE_TITLE_MAX: 160,
  COURSE_DESC_MAX: 1500,
  LECTURER_NAME_MAX: 120,
  SEMESTER_MAX: 60,
  TOPIC_NAME_MAX: 120,
  QUESTION_TEXT_MAX: 5000,
  ANSWER_MAX: 2000,
  EXPLANATION_MAX: 5000,
  REFERENCE_MAX: 500,
  SESSION_TITLE_MAX: 160,
  TEAM_NAME_MAX: 80,
  DISPLAY_NAME_MAX: 60,
  FEEDBACK_MAX: 1500,
} as const;

export interface Course {
  courseId: string;
  title: string;
  description?: string;
  lecturerName: string;
  semester: string;
  logoUrl?: string;
  updatedAt?: unknown;
}

export interface ApprovedLecturer {
  email: string;
  name?: string;
  addedBy?: string;
  createdAt?: unknown;
}

export interface Topic {
  topicId: string;
  name: string;
  description?: string;
  subtopics: string[];
  orderIndex: number;
  updatedAt?: unknown;
}

export interface QuestionPrivate {
  questionId: string;
  topicId?: string;
  topicName: string;
  subtopic?: string;
  type: QuestionType;
  questionText: string;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  reference?: string;
  difficulty: DifficultyLevel;
  points: number;
  timeLimitSec: number;
  enabledModes: GameMode[];
  imageUrl?: string;
  referenceRequirement?: string;
  isActive: boolean;
  isDemo?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PublicQuestion {
  questionId: string;
  topicName: string;
  subtopic?: string;
  type: QuestionType;
  questionText: string;
  options?: string[];
  difficulty?: DifficultyLevel;
  points: number;
  timeLimitSec: number;
  imageUrl?: string;
  referenceRequirement?: string;
  releasedAt?: unknown;
}

export interface RubricWeights {
  contentAccuracy: number;
  reasoning: number;
  sources: number;
  clarity: number;
}

export interface ScoringConfig {
  wajibCorrect: number;
  wajibWrong: number;
  lemparanCorrect: number;
  lemparanWrong: number;
  rebutanCorrect: number;
  rebutanWrong: number;
  rubricWeights: RubricWeights;
}

export interface BoardTile {
  tileKey: string;
  categoryIndex: number;
  rowIndex: number;
  questionId: string;
  points: number;
  completed: boolean;
  completedByTeamId?: string | null;
  completedByTeamName?: string | null;
}

export interface BoardConfig {
  categories: string[];
  pointLevels: number[];
  tiles: Record<string, BoardTile>;
}

export interface QuestionStats {
  totalSubmissions: number;
  optionCounts: Record<string, number>;
}

export interface Session {
  sessionId: string;
  title: string;
  meetingLabel?: string;
  gameMode: GameMode;
  status: SessionStatus;
  joinCode: string;
  requireJoinApproval: boolean;
  isJoinLocked: boolean;
  submissionMode: SubmissionMode;
  cerdasCermatRound?: CerdasCermatRound;
  activeQuestionId?: string | null;
  activeQuestionNumber?: number;
  activeTeamId?: string | null;
  authorizedTeamId?: string | null;
  buzzerOpen: boolean;
  buzzerAttempt: number;
  buzzerWinnerTeamId?: string | null;
  buzzerWinnerTeamName?: string | null;
  buzzerWinnerParticipantName?: string | null;
  submissionsOpen: boolean;
  timerRunning: boolean;
  timerDurationSec?: number;
  timerRemainingSec?: number;
  timerEndTimeMs?: number | null;
  submissionDeadline?: unknown;
  answerRevealed: boolean;
  revealedAnswer?: string | null;
  explanationRevealed: boolean;
  revealedExplanation?: string | null;
  revealedReference?: string | null;
  statsReleased: boolean;
  questionStats?: QuestionStats | null;
  scoringConfig?: ScoringConfig;
  boardConfig?: BoardConfig;
  createdByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Team {
  teamId: string;
  name: string;
  color: string;
  score: number;
  captainParticipantId?: string | null;
  captainName?: string | null;
  orderIndex: number;
  updatedAt?: unknown;
}

export interface Participant {
  participantId: string;
  displayName: string;
  teamId: string;
  status: ParticipantStatus;
  isCaptain: boolean;
  isConnected: boolean;
  joinedAt?: unknown;
  lastSeenAt?: unknown;
}

export interface RubricScores {
  contentAccuracy: number;
  reasoning: number;
  sources: number;
  clarity: number;
  weightedPercent?: number;
}

export interface Submission {
  submissionId: string;
  questionId: string;
  questionRoundKey: string;
  teamId: string;
  teamName: string;
  participantId: string;
  participantName: string;
  authProof: string;
  selectedOption?: string | null;
  answerText?: string;
  argumentText?: string;
  referenceText?: string;
  isGraded: boolean;
  isCorrect?: boolean | null;
  awardedPoints: number;
  rubricScores?: RubricScores | null;
  lecturerFeedback?: string;
  approvedForProjector: boolean;
  submittedAt?: unknown;
}

export interface SubmissionReceipt {
  submissionId: string;
  questionRoundKey: string;
  questionId: string;
  teamId: string;
  teamName: string;
  participantId: string;
  participantName: string;
  status: 'SUBMITTED' | 'GRADED';
  isCorrect?: boolean | null;
  awardedPoints: number;
  submittedAt?: unknown;
}

export interface PublicResponse {
  responseId: string;
  questionId: string;
  questionRoundKey: string;
  anonymousLabel: string;
  answerText: string;
  argumentText?: string;
  referenceText?: string;
  awardedPoints: number;
  approvedAt?: unknown;
}

export interface BuzzerClaim {
  claimId: string;
  questionId: string;
  attempt: number;
  teamId: string;
  teamName: string;
  teamColor: string;
  participantId: string;
  participantName: string;
  claimedAt?: unknown;
}

export interface BuzzerEvent {
  eventId: string;
  questionId: string;
  attempt: number;
  teamId?: string;
  teamName?: string;
  participantId?: string;
  participantName?: string;
  status: 'WON' | 'REJECTED' | 'REOPENED';
  createdAt?: unknown;
}

export interface ScoreEvent {
  eventId: string;
  teamId: string;
  teamName: string;
  questionId?: string | null;
  submissionId?: string | null;
  delta: number;
  previousScore: number;
  newScore: number;
  reason: string;
  type: 'AWARD' | 'PENALTY' | 'MANUAL_ADJUST' | 'RUBRIC_GRADE' | 'UNDO';
  undone: boolean;
  undoneByEventId?: string | null;
  createdByUid: string;
  createdAt?: unknown;
}

export interface StudentIdentity {
  sessionId: string;
  participantId: string;
  authProof: string;
  proofHash: string;
  identitySignature: string;
  displayName: string;
  teamId: string;
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  wajibCorrect: 100,
  wajibWrong: 0,
  lemparanCorrect: 100,
  lemparanWrong: 0,
  rebutanCorrect: 100,
  rebutanWrong: -50,
  rubricWeights: {
    contentAccuracy: 40,
    reasoning: 30,
    sources: 20,
    clarity: 10,
  },
};

export const TEAM_COLOR_PALETTE = [
  '#2563EB',
  '#D97706',
  '#059669',
  '#DC2626',
  '#7C3AED',
  '#0891B2',
];
