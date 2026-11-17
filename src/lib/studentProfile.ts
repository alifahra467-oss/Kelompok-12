import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface StudentProfile {
  fullName: string;
  nim: string;
}

export type StudentTargetMode = 'KUIS_PG' | 'SESI_KELAS';

export interface StudentCheckinRecord {
  checkinId: string;
  fullName: string;
  nim: string;
  targetMode: StudentTargetMode;
  checkedInAtMs: number;
  source: 'firestore' | 'server' | 'both';
}

const STUDENT_PROFILE_KEY = 'stiu_student_profile_v1';

export function saveStudentProfile(profile: StudentProfile): void {
  const clean: StudentProfile = {
    fullName: profile.fullName.trim().slice(0, 60),
    nim: profile.nim.replace(/\s+/g, '').slice(0, 30),
  };
  localStorage.setItem(STUDENT_PROFILE_KEY, JSON.stringify(clean));
  if (clean.fullName) {
    localStorage.setItem('arena_uq_quiz_student_name', clean.fullName);
  }
}

export function loadStudentProfile(): StudentProfile | null {
  try {
    const raw = localStorage.getItem(STUDENT_PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StudentProfile>;
    if (!parsed.fullName || parsed.fullName.trim().length < 2) return null;
    return {
      fullName: parsed.fullName.trim(),
      nim: (parsed.nim ?? '').trim(),
    };
  } catch {
    return null;
  }
}

export function clearStudentProfile(): void {
  localStorage.removeItem(STUDENT_PROFILE_KEY);
}

export function formatStudentDisplayName(fullName: string, nim?: string): string {
  const cleanName = fullName.trim();
  const cleanNim = (nim ?? '').trim();
  if (!cleanNim) return cleanName.slice(0, 60);
  const suffix = ` (${cleanNim})`;
  const maxNameLen = Math.max(2, 60 - suffix.length);
  return `${cleanName.slice(0, maxNameLen)}${suffix}`;
}

export async function recordStudentCheckin(params: {
  fullName: string;
  nim: string;
  targetMode: StudentTargetMode;
}): Promise<string> {
  const cleanName = params.fullName.trim().slice(0, 60);
  const cleanNim = params.nim.replace(/\s+/g, '').trim().slice(0, 30);
  if (cleanName.length < 2 || cleanNim.length < 3) return '';

  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
      : Math.random().toString(36).slice(2, 10);
  const checkinId = `chk_${Date.now()}_${rand}`;

  const serverWrite = fetch('/api/student/check-in', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      checkinId,
      fullName: cleanName,
      nim: cleanNim,
      targetMode: params.targetMode,
    }),
  }).catch(() => undefined);

  const firestoreWrite = setDoc(doc(db, 'student_checkins', checkinId), {
    checkinId,
    fullName: cleanName,
    nim: cleanNim,
    targetMode: params.targetMode,
    checkedInAt: serverTimestamp(),
  }).catch(() => undefined);

  await Promise.all([serverWrite, firestoreWrite]);
  return checkinId;
}

export async function deleteStudentCheckin(checkinId: string): Promise<void> {
  const token = sessionStorage.getItem('arena_admin_unlock_token');
  const serverDelete = token
    ? fetch(`/api/admin/student-checkins/${encodeURIComponent(checkinId)}`, {
        method: 'DELETE',
        headers: { 'x-admin-unlock-token': token },
      }).catch(() => undefined)
    : Promise.resolve();

  const firestoreDelete = deleteDoc(doc(db, 'student_checkins', checkinId)).catch(() => undefined);

  await Promise.all([serverDelete, firestoreDelete]);
}
