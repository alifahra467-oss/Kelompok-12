# Security Specification — ARENA KELAS 2.0

## 1. Data Invariants
1. Answer keys, grading rubrics, and unpublished explanations in `questions_private` MUST ONLY be readable and writable by verified approved lecturers (`isLecturer()`).
2. Student submissions in `submissions` MUST ONLY be readable by approved lecturers; students and projectors cannot read unapproved peer answers.
3. Student session identities are cryptographically backed by `participant_credentials/{participantId}` (SHA-256 `proofHash` unreadable by peers); neither name nor `teamId` alone grants submission or buzzer privileges.
4. Students cannot modify `sessions`, `teams`, `public_questions`, `score_events`, or `public_responses`.
5. Students cannot edit an official submission (`allow update: if isLecturer()`), submit after `submissionDeadline` (`request.time <= session.submissionDeadline`), or submit when `submissionsOpen == false` or `authorizedTeamId` mismatches.
6. Buzzer claims (`buzzer_claims/{claimId}`) are strictly create-once (`!exists(...)`) and atomically paired with `buzzer_proofs/{claimId}`, ensuring at most one winning team per buzzer attempt.
7. Score updates and undos are exclusively performed by `isLecturer()` via atomic Firestore transactions.

## 2. The "Dirty Dozen" Attack Payloads (All Must Fail with PERMISSION_DENIED)
1. Unauthenticated read of `/questions_private/q1` (Answer key leak attempt).
2. Unverified Google email (`email_verified: false`) claiming `alifahra467@gmail.com` writing to `/questions_private/q1`.
3. Student reading `/sessions/s1/submissions/sub1` to peek at another team's answer.
4. Student reading `/sessions/s1/participant_credentials/p2` to steal another student's `proofHash`.
5. Student updating `/sessions/s1/teams/t1` to give their team `+500` score.
6. Student updating `/sessions/s1` to set `answerRevealed: true` or extend `submissionDeadline`.
7. Student creating a `Participant` with `isCaptain: true` or `status: 'APPROVED'` when `requireJoinApproval: true`.
8. Student joining a `FINISHED` or locked (`isJoinLocked: true`) session.
9. Student creating a `Submission` with spoofed `participantId` (wrong `authProof` against `participant_credentials`).
10. Unauthorized team submitting during a `WAJIB` or `LEMPARAN` round where `authorizedTeamId` belongs to another team.
11. Student submitting an official answer with `isGraded: true` and `awardedPoints: 100` or updating an existing submission.
12. Second student attempting to overwrite or update an already-claimed `buzzer_claims/q1_a1`.
