export type PretestStatus = 'DRAFT' | 'LOBBY' | 'ACTIVE' | 'PAUSED' | 'FINISHED';
export type SpinnerStatus = 'IDLE' | 'SPINNING' | 'PAUSED' | 'COMPLETED';

export interface PretestQuestionPrivate {
  questionId: string;
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  timeLimitSec: number;
  orderIndex: number;
  points: number;
  isTieBreak: boolean;
  releasedToProjector: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PretestQuestionPublic {
  questionId: string;
  questionText: string;
  options: string[];
  timeLimitSec: number;
  orderIndex: number;
  points: number;
  isTieBreak: boolean;
  answerRevealed: boolean;
  revealedAnswer?: string | null;
  revealedExplanation?: string | null;
  releasedAt?: unknown;
}

export interface PretestParticipant {
  participantId: string;
  displayName: string;
  status: 'APPROVED' | 'REMOVED';
  isConnected: boolean;
  joinedAt?: unknown;
  lastSeenAt?: unknown;
}

export interface PretestSubmission {
  submissionId: string;
  questionId: string;
  participantId: string;
  participantName: string;
  authProof: string;
  selectedOption: string;
  submittedAt?: unknown;
}

export interface PretestSubmissionReceipt {
  submissionId: string;
  questionId: string;
  participantId: string;
  participantName: string;
  submittedAt?: unknown;
}

export interface PretestResult {
  participantId: string;
  displayName: string;
  totalCorrect: number;
  weightedScore: number;
  maxWeightedScore: number;
  totalQuestions: number;
  answeredCount: number;
  percentage: number;
  rank: number;
  isTied: boolean;
  updatedAt?: unknown;
}

export interface BalancedTeamMemberPublic {
  participantId: string;
  displayName: string;
  isCaptain: boolean;
}

export interface BalancedTeamPublic {
  teamId: string;
  name: string;
  color: string;
  captainParticipantId: string;
  captainName: string;
  members: BalancedTeamMemberPublic[];
}

export interface SpinnerRevealItem {
  participantId: string;
  displayName: string;
  teamId: string;
  teamName: string;
  teamColor: string;
  isCaptain: boolean;
}

export interface PretestAllocationPublic {
  teams: BalancedTeamPublic[];
  revealQueue: SpinnerRevealItem[];
  revealIndex: number;
  spinnerStatus: SpinnerStatus;
  revealedParticipantIds: string[];
  lastRevealed: SpinnerRevealItem | null;
  spinNonce: number;
}

export interface TeamBalanceStat {
  teamId: string;
  teamName: string;
  memberCount: number;
  captainName: string;
  totalScore: number;
  avgScore: number;
  minScore: number;
  maxScore: number;
  bandCounts: number[];
}

export interface BalanceReportPrivate {
  generatedAtIso: string;
  teamCount: number;
  totalStudents: number;
  globalAvgScore: number;
  maxAvgDifference: number;
  scoreStdDev: number;
  maxSizeDifference: number;
  teamStats: TeamBalanceStat[];
  invariantsVerified: boolean;
  warnings: string[];
}

export interface ProposedCaptain {
  teamId: string;
  teamName: string;
  participantId: string;
  displayName: string;
  score: number;
  rank: number;
  isTiedAtCutoff: boolean;
}

export interface PretestAdminSummary {
  docId: string;
  proposedCaptains: ProposedCaptain[];
  balanceReport: BalanceReportPrivate | null;
  memberScores: Record<string, number>;
  updatedAt?: unknown;
}

export interface Pretest {
  pretestId: string;
  title: string;
  meetingLabel?: string;
  joinCode: string;
  status: PretestStatus;
  useWeightedPoints: boolean;
  releaseAllQuestions: boolean;
  activeQuestionId?: string | null;
  timerRunning: boolean;
  timerDurationSec?: number;
  timerRemainingSec?: number;
  timerEndTimeMs?: number | null;
  submissionDeadline?: unknown;
  teamCount: number;
  captainsLocked: boolean;
  teamsLocked: boolean;
  teamsPublished: boolean;
  showResultsToStudents: boolean;
  allocation?: PretestAllocationPublic | null;
  linkedSessionId?: string | null;
  linkedGameMode?: 'CERDAS_CERMAT' | 'PAPAN_TANTANGAN' | 'TANTANGAN_ANALISIS' | null;
  createdByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PretestStudentIdentity {
  pretestId: string;
  participantId: string;
  authProof: string;
  proofHash: string;
  identitySignature: string;
  displayName: string;
}
