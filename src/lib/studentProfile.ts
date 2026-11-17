export interface StudentProfile {
  fullName: string;
  nim: string;
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
