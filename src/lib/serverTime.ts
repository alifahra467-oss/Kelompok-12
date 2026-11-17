import { useEffect, useState } from 'react';

let cachedOffsetMs = 0;
let lastSyncAt = 0;

export async function syncServerTime(): Promise<number> {
  try {
    const start = Date.now();
    const res = await fetch('/api/time', { cache: 'no-store' });
    if (!res.ok) return cachedOffsetMs;
    const data = (await res.json()) as { serverTimeMs?: number };
    const end = Date.now();
    if (typeof data.serverTimeMs === 'number') {
      const rtt = end - start;
      const estimatedClientAtServerResponse = start + rtt / 2;
      cachedOffsetMs = data.serverTimeMs - estimatedClientAtServerResponse;
      lastSyncAt = end;
    }
  } catch {
    // Keep last known offset if offline temporarily
  }
  return cachedOffsetMs;
}

export function getServerNowMs(): number {
  return Date.now() + cachedOffsetMs;
}

export function getCachedServerOffsetMs(): number {
  return cachedOffsetMs;
}

export function useServerCountdown(
  timerRunning: boolean,
  timerEndTimeMs?: number | null,
  timerRemainingSec?: number
): number {
  const computeRemaining = () => {
    if (timerRunning && typeof timerEndTimeMs === 'number') {
      const diffMs = timerEndTimeMs - getServerNowMs();
      return Math.max(0, Math.ceil(diffMs / 1000));
    }
    return Math.max(0, Math.round(timerRemainingSec ?? 0));
  };

  const [secondsLeft, setSecondsLeft] = useState<number>(computeRemaining);

  useEffect(() => {
    if (Date.now() - lastSyncAt > 30000) {
      void syncServerTime();
    }
    setSecondsLeft(computeRemaining());

    if (!timerRunning || typeof timerEndTimeMs !== 'number') {
      return;
    }

    const id = window.setInterval(() => {
      setSecondsLeft(computeRemaining());
    }, 250);

    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerRunning, timerEndTimeMs, timerRemainingSec]);

  return secondsLeft;
}

export function formatSeconds(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}
