import { TEAM_COLOR_PALETTE } from '../types/arena';
import type {
  BalanceReportPrivate,
  BalancedTeamMemberPublic,
  BalancedTeamPublic,
  PretestAllocationPublic,
  PretestParticipant,
  PretestQuestionPrivate,
  PretestResult,
  PretestSubmission,
  ProposedCaptain,
  SpinnerRevealItem,
  TeamBalanceStat,
} from '../types/pretest';

export function getDefaultTeamNames(teamCount: number): string[] {
  const letters = 'ABCDEFGHIJKL';
  return Array.from({ length: teamCount }, (_, i) => `Kelompok ${letters[i] ?? i + 1}`);
}

/**
 * Evaluasi jawaban pre-test seluruh peserta secara deterministik.
 * Tidak pernah menggunakan kecepatan internet sebagai penentu peringkat.
 */
export function evaluatePretestResults(params: {
  participants: PretestParticipant[];
  questions: PretestQuestionPrivate[];
  submissions: PretestSubmission[];
  useWeightedPoints: boolean;
}): PretestResult[] {
  const { participants, questions, submissions, useWeightedPoints } = params;
  const activeParticipants = participants.filter((p) => p.status !== 'REMOVED');
  const questionMap = new Map(questions.map((q) => [q.questionId, q]));
  const maxWeightedScore = questions.reduce((acc, q) => acc + (Number(q.points) || 1), 0);
  const totalQuestions = questions.length;

  const subsByParticipant = new Map<string, PretestSubmission[]>();
  for (const sub of submissions) {
    const arr = subsByParticipant.get(sub.participantId) ?? [];
    arr.push(sub);
    subsByParticipant.set(sub.participantId, arr);
  }

  const raw: PretestResult[] = activeParticipants.map((p) => {
    const pSubs = subsByParticipant.get(p.participantId) ?? [];
    const seenQ = new Set<string>();
    let totalCorrect = 0;
    let weightedScore = 0;
    let answeredCount = 0;

    for (const s of pSubs) {
      if (seenQ.has(s.questionId)) continue;
      const q = questionMap.get(s.questionId);
      if (!q) continue;
      seenQ.add(s.questionId);
      answeredCount += 1;
      if (s.selectedOption.trim() === q.correctAnswer.trim()) {
        totalCorrect += 1;
        weightedScore += Number(q.points) || 1;
      }
    }

    const percentage = useWeightedPoints
      ? maxWeightedScore > 0
        ? Math.round((weightedScore / maxWeightedScore) * 1000) / 10
        : 0
      : totalQuestions > 0
      ? Math.round((totalCorrect / totalQuestions) * 1000) / 10
      : 0;

    return {
      participantId: p.participantId,
      displayName: p.displayName,
      totalCorrect,
      weightedScore,
      maxWeightedScore,
      totalQuestions,
      answeredCount,
      percentage,
      rank: 1,
      isTied: false,
    };
  });

  const primaryScore = (r: PretestResult) => (useWeightedPoints ? r.weightedScore : r.totalCorrect);

  raw.sort((a, b) => {
    const diffPrimary = primaryScore(b) - primaryScore(a);
    if (diffPrimary !== 0) return diffPrimary;
    const diffCorrect = b.totalCorrect - a.totalCorrect;
    if (diffCorrect !== 0) return diffCorrect;
    return a.displayName.localeCompare(b.displayName, 'id');
  });

  // Hitung jumlah kemunculan setiap skor utama untuk menandai seri (tie)
  const scoreCounts = new Map<number, number>();
  for (const r of raw) {
    const s = primaryScore(r);
    scoreCounts.set(s, (scoreCounts.get(s) ?? 0) + 1);
  }

  let currentRank = 1;
  for (let i = 0; i < raw.length; i++) {
    const s = primaryScore(raw[i]);
    if (i > 0 && primaryScore(raw[i - 1]) !== s) {
      currentRank = i + 1;
    }
    raw[i].rank = currentRank;
    raw[i].isTied = (scoreCounts.get(s) ?? 0) > 1;
  }

  return raw;
}

/**
 * Mengusulkan ketua tim otomatis dari peringkat tertinggi pre-test.
 * Mendeteksi apabila terdapat nilai seri tepat di batas pemotongan ketua.
 */
export function proposeTeamCaptains(params: {
  results: PretestResult[];
  participants: PretestParticipant[];
  teamCount: number;
  useWeightedPoints: boolean;
  teamNames?: string[];
}): ProposedCaptain[] {
  const { results, participants, teamCount, useWeightedPoints, teamNames } = params;
  const names = teamNames && teamNames.length >= teamCount ? teamNames : getDefaultTeamNames(teamCount);
  const scoreOf = (r: PretestResult) => (useWeightedPoints ? r.weightedScore : r.totalCorrect);

  // Pastikan seluruh peserta aktif ikut terwakili walau belum ada hasil tersimpan
  const resultById = new Map(results.map((r) => [r.participantId, r]));
  const combined: PretestResult[] = participants
    .filter((p) => p.status !== 'REMOVED')
    .map(
      (p) =>
        resultById.get(p.participantId) ?? {
          participantId: p.participantId,
          displayName: p.displayName,
          totalCorrect: 0,
          weightedScore: 0,
          maxWeightedScore: results[0]?.maxWeightedScore ?? 0,
          totalQuestions: results[0]?.totalQuestions ?? 0,
          answeredCount: 0,
          percentage: 0,
          rank: results.length + 1,
          isTied: true,
        }
    );

  combined.sort((a, b) => {
    const d = scoreOf(b) - scoreOf(a);
    if (d !== 0) return d;
    return a.displayName.localeCompare(b.displayName, 'id');
  });

  const count = Math.min(teamCount, combined.length);
  const cutoffScore = count > 0 && combined.length > count ? scoreOf(combined[count - 1]) : null;
  const nextOutsideScore = count > 0 && combined.length > count ? scoreOf(combined[count]) : null;
  const hasBoundaryTie = cutoffScore !== null && nextOutsideScore !== null && cutoffScore === nextOutsideScore;

  return combined.slice(0, count).map((r, idx) => ({
    teamId: `team_${idx + 1}`,
    teamName: names[idx] ?? `Kelompok ${idx + 1}`,
    participantId: r.participantId,
    displayName: r.displayName,
    score: scoreOf(r),
    rank: r.rank,
    isTiedAtCutoff: hasBoundaryTie && scoreOf(r) === cutoffScore,
  }));
}

interface CandidateItem {
  participantId: string;
  displayName: string;
  score: number;
  band: number;
}

function assignScoreBands(candidates: Omit<CandidateItem, 'band'>[], bandCount = 3): CandidateItem[] {
  if (candidates.length === 0) return [];
  const sorted = [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.displayName.localeCompare(b.displayName, 'id');
  });

  const uniqueScores = new Set(sorted.map((c) => c.score));
  if (uniqueScores.size <= 1) {
    return sorted.map((c) => ({ ...c, band: 0 }));
  }

  const effectiveBands = Math.min(bandCount, Math.max(2, sorted.length));
  return sorted.map((c, idx) => {
    const band = Math.min(effectiveBands - 1, Math.floor((idx * effectiveBands) / sorted.length));
    return { ...c, band };
  });
}

function shuffleWithinSameScore<T extends { score: number }>(items: T[]): T[] {
  const out = [...items];
  let i = 0;
  while (i < out.length) {
    let j = i + 1;
    while (j < out.length && out[j].score === out[i].score) j++;
    // Fisher-Yates hanya untuk kandidat yang memiliki skor sama persis
    for (let k = j - 1; k > i; k--) {
      const r = i + Math.floor(Math.random() * (k - i + 1));
      [out[k], out[r]] = [out[r], out[k]];
    }
    i = j;
  }
  return out;
}

function computeObjective(
  teamBuckets: { captain: CandidateItem | null; members: CandidateItem[] }[],
  bandCount: number
): { maxAvgDiff: number; variance: number; bandImbalance: number } {
  const nonEmptyTeams = teamBuckets.filter((t) => (t.captain ? 1 : 0) + t.members.length > 0);
  if (nonEmptyTeams.length <= 1) {
    return { maxAvgDiff: 0, variance: 0, bandImbalance: 0 };
  }

  const avgs = nonEmptyTeams.map((t) => {
    const all = t.captain ? [t.captain, ...t.members] : t.members;
    const sum = all.reduce((s, m) => s + m.score, 0);
    return sum / all.length;
  });

  const maxAvg = Math.max(...avgs);
  const minAvg = Math.min(...avgs);
  const meanAvg = avgs.reduce((a, b) => a + b, 0) / avgs.length;
  const variance = avgs.reduce((acc, a) => acc + (a - meanAvg) ** 2, 0) / avgs.length;

  let bandImbalance = 0;
  for (let b = 0; b < bandCount; b++) {
    const counts = nonEmptyTeams.map((t) => t.members.filter((m) => m.band === b).length);
    bandImbalance += Math.max(...counts) - Math.min(...counts);
  }

  return { maxAvgDiff: maxAvg - minAvg, variance, bandImbalance };
}

function isObjectiveBetter(
  next: { maxAvgDiff: number; variance: number; bandImbalance: number },
  curr: { maxAvgDiff: number; variance: number; bandImbalance: number }
): boolean {
  if (next.maxAvgDiff < curr.maxAvgDiff - 1e-6) return true;
  if (Math.abs(next.maxAvgDiff - curr.maxAvgDiff) <= 1e-6) {
    if (next.variance < curr.variance - 1e-6) return true;
    if (Math.abs(next.variance - curr.variance) <= 1e-6) {
      return next.bandImbalance < curr.bandImbalance;
    }
  }
  return false;
}

export function recomputeBalanceReport(params: {
  teams: BalancedTeamPublic[];
  memberScores: Record<string, number>;
  warnings?: string[];
}): BalanceReportPrivate {
  const { teams, memberScores, warnings = [] } = params;
  const allMemberIds: string[] = [];
  const captainTeamSet = new Set<string>();
  let allCaptainDistinct = true;

  // Hitung band secara global untuk diagnosa distribusi
  const allEntries = teams.flatMap((t) =>
    t.members.map((m) => ({
      participantId: m.participantId,
      displayName: m.displayName,
      score: memberScores[m.participantId] ?? 0,
    }))
  );
  const bandItems = assignScoreBands(allEntries, 3);
  const bandById = new Map(bandItems.map((b) => [b.participantId, b.band]));

  const teamStats: TeamBalanceStat[] = teams.map((team) => {
    const scores = team.members.map((m) => memberScores[m.participantId] ?? 0);
    const totalScore = scores.reduce((a, b) => a + b, 0);
    const memberCount = team.members.length;
    const avgScore = memberCount > 0 ? Math.round((totalScore / memberCount) * 100) / 100 : 0;
    const minScore = scores.length > 0 ? Math.min(...scores) : 0;
    const maxScore = scores.length > 0 ? Math.max(...scores) : 0;

    const bandCounts = [0, 0, 0];
    let captainsInTeam = 0;
    for (const m of team.members) {
      allMemberIds.push(m.participantId);
      const b = bandById.get(m.participantId) ?? 0;
      if (b >= 0 && b < bandCounts.length) bandCounts[b] += 1;
      if (m.isCaptain) {
        captainsInTeam += 1;
        if (captainTeamSet.has(m.participantId)) {
          allCaptainDistinct = false;
        }
        captainTeamSet.add(m.participantId);
      }
    }
    if (captainsInTeam > 1) {
      allCaptainDistinct = false;
    }

    return {
      teamId: team.teamId,
      teamName: team.name,
      memberCount,
      captainName: team.captainName || '-',
      totalScore,
      avgScore,
      minScore,
      maxScore,
      bandCounts,
    };
  });

  const uniqueMemberIds = new Set(allMemberIds);
  const sizes = teamStats.map((t) => t.memberCount);
  const maxSizeDifference = sizes.length > 0 ? Math.max(...sizes) - Math.min(...sizes) : 0;

  const nonEmptyAvgs = teamStats.filter((t) => t.memberCount > 0).map((t) => t.avgScore);
  const maxAvgDifference =
    nonEmptyAvgs.length > 1
      ? Math.round((Math.max(...nonEmptyAvgs) - Math.min(...nonEmptyAvgs)) * 100) / 100
      : 0;

  const totalStudents = allEntries.length;
  const globalAvgScore =
    totalStudents > 0
      ? Math.round((allEntries.reduce((s, e) => s + e.score, 0) / totalStudents) * 100) / 100
      : 0;

  const scoreStdDev =
    nonEmptyAvgs.length > 1
      ? Math.round(
          Math.sqrt(
            nonEmptyAvgs.reduce((acc, a) => acc + (a - globalAvgScore) ** 2, 0) / nonEmptyAvgs.length
          ) * 100
        ) / 100
      : 0;

  const invariantsVerified =
    uniqueMemberIds.size === allMemberIds.length &&
    maxSizeDifference <= 1 &&
    allCaptainDistinct;

  return {
    generatedAtIso: new Date().toISOString(),
    teamCount: teams.length,
    totalStudents,
    globalAvgScore,
    maxAvgDifference,
    scoreStdDev,
    maxSizeDifference,
    teamStats,
    invariantsVerified,
    warnings,
  };
}

/**
 * Algoritma Pembentuk Tim Seimbang:
 * 1. Mengunci ketua pada masing-masing tim (maks 1 ketua per tim).
 * 2. Membagi kandidat non-ketua ke dalam pita skor (score bands).
 * 3. Menetapkan target kapasitas tim (selisih ukuran maks 1).
 * 4. Mendistribusikan kandidat tiap pita secara merata ke tim dengan rata-rata terendah.
 * 5. Mengoptimalkan keseimbangan dengan constrained swaps antar-tim dalam pita sama/berdekatan.
 */
export function allocateBalancedTeams(params: {
  participants: PretestParticipant[];
  results: PretestResult[];
  captains: ProposedCaptain[];
  teamCount: number;
  useWeightedPoints: boolean;
  teamNames?: string[];
}): {
  allocation: PretestAllocationPublic;
  balanceReport: BalanceReportPrivate;
  memberScores: Record<string, number>;
} {
  const { participants, results, captains, teamCount, useWeightedPoints, teamNames } = params;
  const safeTeamCount = Math.max(2, Math.min(12, teamCount));
  const names =
    teamNames && teamNames.length >= safeTeamCount
      ? teamNames
      : getDefaultTeamNames(safeTeamCount);

  const warnings: string[] = [];
  const activeParticipants = participants.filter((p) => p.status !== 'REMOVED');
  const resultMap = new Map(results.map((r) => [r.participantId, r]));

  const memberScores: Record<string, number> = {};
  for (const p of activeParticipants) {
    const r = resultMap.get(p.participantId);
    memberScores[p.participantId] = r
      ? useWeightedPoints
        ? r.weightedScore
        : r.totalCorrect
      : 0;
  }

  if (activeParticipants.length === 0) {
    warnings.push('Belum ada mahasiswa aktif yang terdaftar pada pre-test.');
  }
  if (results.length === 0 && activeParticipants.length > 0) {
    warnings.push('Belum ada nilai pre-test yang dievaluasi; seluruh mahasiswa diberi skor awal 0.');
  }
  if (safeTeamCount > activeParticipants.length) {
    warnings.push(
      `Jumlah tim (${safeTeamCount}) melebihi jumlah mahasiswa (${activeParticipants.length}), sehingga terdapat tim yang belum penuh.`
    );
  }

  // Validasi dan petakan ketua unik ke masing-masing tim (maks 1 ketua per tim)
  const usedCaptainIds = new Set<string>();
  const captainByTeamIdx = new Map<number, CandidateItem>();
  const activeIdSet = new Set(activeParticipants.map((p) => p.participantId));

  for (let idx = 0; idx < safeTeamCount; idx++) {
    const teamId = `team_${idx + 1}`;
    const c = captains.find((cap) => cap.teamId === teamId) ?? captains[idx];
    if (
      c &&
      activeIdSet.has(c.participantId) &&
      !usedCaptainIds.has(c.participantId)
    ) {
      usedCaptainIds.add(c.participantId);
      captainByTeamIdx.set(idx, {
        participantId: c.participantId,
        displayName: c.displayName,
        score: memberScores[c.participantId] ?? 0,
        band: 0,
      });
    }
  }

  // Kandidat tersisa di luar ketua yang dikunci
  const remainingRaw = activeParticipants
    .filter((p) => !usedCaptainIds.has(p.participantId))
    .map((p) => ({
      participantId: p.participantId,
      displayName: p.displayName,
      score: memberScores[p.participantId] ?? 0,
    }));

  const shuffledRemaining = shuffleWithinSameScore(remainingRaw);
  const bandedCandidates = assignScoreBands(shuffledRemaining, 3);
  const bandCount = Math.max(1, new Set(bandedCandidates.map((b) => b.band)).size);

  // Target ukuran tiap tim agar selisih ukuran <= 1
  const totalCount = activeParticipants.length;
  const baseSize = Math.floor(totalCount / safeTeamCount);
  const remainder = totalCount % safeTeamCount;

  const targetSizes = Array.from({ length: safeTeamCount }, (_, idx) =>
    idx < remainder ? baseSize + 1 : baseSize
  );

  // Jika ketua belum menempati slot awal dan ada tim tanpa ketua saat totalCount >= safeTeamCount
  const teamBuckets: {
    teamId: string;
    name: string;
    color: string;
    captain: CandidateItem | null;
    members: CandidateItem[];
    targetSize: number;
  }[] = Array.from({ length: safeTeamCount }, (_, idx) => ({
    teamId: `team_${idx + 1}`,
    name: names[idx] ?? `Kelompok ${idx + 1}`,
    color: TEAM_COLOR_PALETTE[idx % TEAM_COLOR_PALETTE.length],
    captain: captainByTeamIdx.get(idx) ?? null,
    members: [],
    targetSize: targetSizes[idx],
  }));

  const currentTeamSize = (t: (typeof teamBuckets)[number]) =>
    (t.captain ? 1 : 0) + t.members.length;

  const currentTeamAvg = (t: (typeof teamBuckets)[number]) => {
    const all = t.captain ? [t.captain, ...t.members] : t.members;
    if (all.length === 0) return 0;
    return all.reduce((s, m) => s + m.score, 0) / all.length;
  };

  // Distribusikan kandidat berdasarkan pita skor secara bergiliran ke tim dengan kapasitas tersisa
  for (let b = 0; b < 3; b++) {
    const bandMembers = bandedCandidates.filter((c) => c.band === b);
    for (const candidate of bandMembers) {
      const eligible = teamBuckets.filter((t) => currentTeamSize(t) < t.targetSize);
      if (eligible.length === 0) break;

      eligible.sort((t1, t2) => {
        const b1 = t1.members.filter((m) => m.band === b).length;
        const b2 = t2.members.filter((m) => m.band === b).length;
        if (b1 !== b2) return b1 - b2;

        const avg1 = currentTeamAvg(t1);
        const avg2 = currentTeamAvg(t2);
        if (Math.abs(avg1 - avg2) > 1e-6) return avg1 - avg2;

        return currentTeamSize(t1) - currentTeamSize(t2);
      });

      eligible[0].members.push(candidate);
    }
  }

  // Optimasi pertukaran terbatas (constrained swaps)
  let currentObj = computeObjective(teamBuckets, bandCount);
  let improved = true;
  let iterations = 0;
  const maxIterations = 250;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations += 1;

    let bestSwap: {
      t1: number;
      m1: number;
      t2: number;
      m2: number;
      obj: { maxAvgDiff: number; variance: number; bandImbalance: number };
    } | null = null;

    for (let i = 0; i < teamBuckets.length; i++) {
      for (let j = i + 1; j < teamBuckets.length; j++) {
        const memA = teamBuckets[i].members;
        const memB = teamBuckets[j].members;
        for (let a = 0; a < memA.length; a++) {
          for (let b = 0; b < memB.length; b++) {
            // Prioritaskan pertukaran di pita yang sama atau berdekatan
            if (Math.abs(memA[a].band - memB[b].band) > 1) continue;

            [memA[a], memB[b]] = [memB[b], memA[a]];
            const nextObj = computeObjective(teamBuckets, bandCount);
            if (isObjectiveBetter(nextObj, bestSwap ? bestSwap.obj : currentObj)) {
              bestSwap = { t1: i, m1: a, t2: j, m2: b, obj: nextObj };
            }
            [memA[a], memB[b]] = [memB[b], memA[a]];
          }
        }
      }
    }

    if (bestSwap) {
      const { t1, m1, t2, m2, obj } = bestSwap;
      [teamBuckets[t1].members[m1], teamBuckets[t2].members[m2]] = [
        teamBuckets[t2].members[m2],
        teamBuckets[t1].members[m1],
      ];
      currentObj = obj;
      improved = true;
    }
  }

  const publicTeams: BalancedTeamPublic[] = teamBuckets.map((tb) => {
    const members: BalancedTeamMemberPublic[] = [];
    if (tb.captain) {
      members.push({
        participantId: tb.captain.participantId,
        displayName: tb.captain.displayName,
        isCaptain: true,
      });
    }
    for (const m of tb.members) {
      members.push({
        participantId: m.participantId,
        displayName: m.displayName,
        isCaptain: false,
      });
    }
    return {
      teamId: tb.teamId,
      name: tb.name,
      color: tb.color,
      captainParticipantId: tb.captain?.participantId ?? '',
      captainName: tb.captain?.displayName ?? '',
      members,
    };
  });

  // Susun antrean reveal spinner secara round-robin (ketua sudah tampil sebagai jangkar tiap tim)
  const revealQueue: SpinnerRevealItem[] = [];
  const maxMembers = Math.max(0, ...teamBuckets.map((tb) => tb.members.length));
  for (let r = 0; r < maxMembers; r++) {
    for (const tb of teamBuckets) {
      const m = tb.members[r];
      if (m) {
        revealQueue.push({
          participantId: m.participantId,
          displayName: m.displayName,
          teamId: tb.teamId,
          teamName: tb.name,
          teamColor: tb.color,
          isCaptain: false,
        });
      }
    }
  }

  // Ketua sudah langsung terlihat sejak awal di kartu tim
  const revealedParticipantIds = teamBuckets
    .map((tb) => tb.captain?.participantId)
    .filter((id): id is string => Boolean(id));

  const allocation: PretestAllocationPublic = {
    teams: publicTeams,
    revealQueue,
    revealIndex: 0,
    spinnerStatus: revealQueue.length === 0 ? 'COMPLETED' : 'IDLE',
    revealedParticipantIds,
    lastRevealed: null,
    spinNonce: 0,
  };

  const balanceReport = recomputeBalanceReport({
    teams: publicTeams,
    memberScores,
    warnings,
  });

  if (!balanceReport.invariantsVerified) {
    warnings.push('Peringatan integritas alokasi: periksa ulang susunan tim.');
  }

  return { allocation, balanceReport, memberScores };
}

/**
 * Memindahkan atau menukar anggota non-ketua antar-tim secara manual oleh Admin
 * dan langsung menghitung ulang laporan keseimbangan serta menyinkronkan antrean spinner.
 */
export function moveStudentBetweenTeams(params: {
  allocation: PretestAllocationPublic;
  participantId: string;
  targetTeamId: string;
  memberScores: Record<string, number>;
}): {
  allocation: PretestAllocationPublic;
  balanceReport: BalanceReportPrivate;
} {
  const { allocation, participantId, targetTeamId, memberScores } = params;

  const clonedTeams: BalancedTeamPublic[] = allocation.teams.map((t) => ({
    ...t,
    members: t.members.map((m) => ({ ...m })),
  }));

  const sourceTeam = clonedTeams.find((t) =>
    t.members.some((m) => m.participantId === participantId)
  );
  const destTeam = clonedTeams.find((t) => t.teamId === targetTeamId);

  if (!sourceTeam || !destTeam || sourceTeam.teamId === destTeam.teamId) {
    return {
      allocation,
      balanceReport: recomputeBalanceReport({ teams: clonedTeams, memberScores }),
    };
  }

  const movingMember = sourceTeam.members.find((m) => m.participantId === participantId);
  if (!movingMember || movingMember.isCaptain) {
    throw new Error('Ketua tim yang terkunci tidak dapat dipindahkan secara langsung. Ganti ketua terlebih dahulu.');
  }

  sourceTeam.members = sourceTeam.members.filter((m) => m.participantId !== participantId);
  destTeam.members.push(movingMember);

  // Perbarui antrean spinner agar selalu sinkron dengan penempatan tim terbaru
  const teamMap = new Map(clonedTeams.map((t) => [t.teamId, t]));
  const updatedQueue = allocation.revealQueue.map((item) => {
    if (item.participantId !== participantId) return item;
    const t = teamMap.get(destTeam.teamId)!;
    return {
      ...item,
      teamId: t.teamId,
      teamName: t.name,
      teamColor: t.color,
    };
  });

  const updatedAllocation: PretestAllocationPublic = {
    ...allocation,
    teams: clonedTeams,
    revealQueue: updatedQueue,
    lastRevealed:
      allocation.lastRevealed?.participantId === participantId
        ? {
            ...allocation.lastRevealed,
            teamId: destTeam.teamId,
            teamName: destTeam.name,
            teamColor: destTeam.color,
          }
        : allocation.lastRevealed,
  };

  const balanceReport = recomputeBalanceReport({
    teams: clonedTeams,
    memberScores,
  });

  return { allocation: updatedAllocation, balanceReport };
}
