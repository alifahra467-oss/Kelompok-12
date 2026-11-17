import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, googleProvider, isFirebaseConfigured } from '../lib/firebase';

const BOOTSTRAPPED_LECTURER_EMAIL = 'alifahra467@gmail.com';
const ADMIN_UNLOCK_STORAGE_KEY = 'arena_admin_unlock_token';

interface AuthContextValue {
  user: User | null;
  isLecturer: boolean;
  isAdminPasswordUnlocked: boolean;
  authLoading: boolean;
  authError: string | null;
  loginWithGoogle: () => Promise<void>;
  verifyAdminPassword: (password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  recheckApproval: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLecturer, setIsLecturer] = useState(false);
  const [isAdminPasswordUnlocked, setIsAdminPasswordUnlocked] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const checkLecturerStatus = async (currentUser: User | null) => {
    if (!currentUser || !currentUser.email || !currentUser.emailVerified) {
      setIsLecturer(false);
      return;
    }
    const emailLower = currentUser.email.toLowerCase();
    if (emailLower === BOOTSTRAPPED_LECTURER_EMAIL) {
      setIsLecturer(true);
      return;
    }
    try {
      const snap = await getDoc(doc(db, 'approved_lecturers', currentUser.email));
      setIsLecturer(snap.exists());
    } catch {
      setIsLecturer(false);
    }
  };

  useEffect(() => {
    let active = true;

    const verifyStoredUnlock = async () => {
      try {
        const token = sessionStorage.getItem(ADMIN_UNLOCK_STORAGE_KEY);
        if (!token) return false;
        const res = await fetch('/api/admin/verify-unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ unlockToken: token }),
        });
        if (!res.ok) return false;
        const data = (await res.json()) as { valid?: boolean };
        if (!data.valid) {
          sessionStorage.removeItem(ADMIN_UNLOCK_STORAGE_KEY);
        }
        return Boolean(data.valid);
      } catch {
        return false;
      }
    };

    if (!isFirebaseConfigured || !auth) {
      setAuthLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      const [, unlocked] = await Promise.all([
        checkLecturerStatus(nextUser),
        nextUser ? verifyStoredUnlock() : Promise.resolve(false),
      ]);
      if (!active) return;
      setUser(nextUser);
      setIsAdminPasswordUnlocked(unlocked);
      setAuthLoading(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const verifyAdminPassword = async (password: string): Promise<boolean> => {
    setAuthError(null);
    try {
      const res = await fetch('/api/admin/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as {
        valid?: boolean;
        unlockToken?: string;
        error?: string;
      };
      if (!res.ok || !data.valid || !data.unlockToken) {
        setAuthError(data.error || 'Kata sandi admin tidak sesuai.');
        setIsAdminPasswordUnlocked(false);
        return false;
      }
      sessionStorage.setItem(ADMIN_UNLOCK_STORAGE_KEY, data.unlockToken);
      setIsAdminPasswordUnlocked(true);
      return true;
    } catch {
      setAuthError('Gagal menghubungi server verifikasi admin.');
      return false;
    }
  };

  const loginWithGoogle = async () => {
    if (!auth) return;
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      await checkLecturerStatus(cred.user);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Gagal masuk dengan Google.';
      setAuthError(msg);
    }
  };

  const logout = async () => {
    sessionStorage.removeItem(ADMIN_UNLOCK_STORAGE_KEY);
    setIsAdminPasswordUnlocked(false);
    if (!auth) return;
    await signOut(auth);
    setIsLecturer(false);
  };

  const recheckApproval = async () => {
    await checkLecturerStatus(user);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLecturer,
        isAdminPasswordUnlocked,
        authLoading,
        authError,
        loginWithGoogle,
        verifyAdminPassword,
        logout,
        recheckApproval,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus digunakan di dalam AuthProvider.');
  return ctx;
}
