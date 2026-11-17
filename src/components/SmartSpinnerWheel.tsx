import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Volume2, VolumeX } from 'lucide-react';
import type { BalancedTeamPublic, PretestAllocationPublic } from '../types/pretest';

interface SmartSpinnerWheelProps {
  allocation: PretestAllocationPublic;
  size?: number;
  projectorMode?: boolean;
  muted?: boolean;
  onToggleMute?: () => void;
}

function playSpinTick(ctx: AudioContext) {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.035);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.045);
  } catch {
    // Ignore audio context restriction before user gesture
  }
}

function playRevealChime(ctx: AudioContext, isGrandFinale = false) {
  try {
    const notes = isGrandFinale ? [523.25, 659.25, 783.99, 1046.5] : [587.33, 739.99, 880];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + idx * 0.085;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.12, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.5);
    });
  } catch {
    // Ignore audio error
  }
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function createWedgePath(
  cx: number,
  cy: number,
  r: number,
  startAngleDeg: number,
  endAngleDeg: number
): string {
  const start = polarToCartesian(cx, cy, r, endAngleDeg);
  const end = polarToCartesian(cx, cy, r, startAngleDeg);
  const largeArcFlag = endAngleDeg - startAngleDeg <= 180 ? '0' : '1';
  return [
    'M',
    cx,
    cy,
    'L',
    start.x,
    start.y,
    'A',
    r,
    r,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
    'Z',
  ].join(' ');
}

export const ConfettiBurst: React.FC<{ active: boolean }> = ({ active }) => {
  const pieces = useMemo(
    () =>
      Array.from({ length: 36 }, (_, idx) => ({
        id: idx,
        left: `${(idx * 29 + 7) % 100}%`,
        delay: `${(idx % 9) * 0.14}s`,
        duration: `${2.2 + (idx % 5) * 0.35}s`,
        color: ['#F1C56C', '#2563EB', '#10B981', '#F59E0B', '#FFFFFF'][idx % 5],
      })),
    []
  );

  if (!active) return null;

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-40" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute top-0 w-2.5 h-4 rounded-sm animate-bounce"
          style={{
            left: p.left,
            backgroundColor: p.color,
            animationDelay: p.delay,
            animationDuration: p.duration,
            transform: `translateY(${(p.id % 7) * 12}vh) rotate(${p.id * 37}deg)`,
            opacity: 0.9,
          }}
        />
      ))}
    </div>
  );
};

export const SmartSpinnerWheel: React.FC<SmartSpinnerWheelProps> = ({
  allocation,
  size = 380,
  projectorMode = false,
  muted = false,
  onToggleMute,
}) => {
  const teams: BalancedTeamPublic[] = allocation.teams;
  const sliceAngle = teams.length > 0 ? 360 / teams.length : 360;

  const [rotation, setRotation] = useState(0);
  const rotationRef = useRef(0);
  const lastSpinNonceRef = useRef(0);
  const lastCompletedCountRef = useRef(allocation.revealIndex);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const ensureAudioCtx = () => {
    if (muted || typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current.state === 'suspended') {
      void audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  // Sinkronkan rotasi tepat ke sektor tim hasil alokasi yang sudah dikunci
  useEffect(() => {
    if (
      allocation.spinnerStatus === 'SPINNING' &&
      allocation.lastRevealed &&
      allocation.spinNonce > lastSpinNonceRef.current
    ) {
      lastSpinNonceRef.current = allocation.spinNonce;
      const targetIndex = Math.max(
        0,
        teams.findIndex((t) => t.teamId === allocation.lastRevealed?.teamId)
      );

      // Saat rotasi = 0, pusat sektor ke-targetIndex berada pada targetIndex * sliceAngle searah jarum jam
      const targetBase = (360 - ((targetIndex * sliceAngle) % 360)) % 360;
      const safeOffset = ((allocation.spinNonce % 3) - 1) * Math.min(8, sliceAngle * 0.16);
      const currentMod = ((rotationRef.current % 360) + 360) % 360;
      const deltaToTarget = (targetBase + safeOffset - currentMod + 360) % 360;
      const nextRotation = rotationRef.current + 5 * 360 + deltaToTarget;

      rotationRef.current = nextRotation;
      setRotation(nextRotation);

      // Efek bunyi putaran roda bertahap hingga melambat
      const ctx = ensureAudioCtx();
      if (ctx) {
        const tickDelays = [
          80, 160, 240, 330, 430, 540, 660, 790, 940, 1110, 1300, 1520, 1770, 2060, 2390, 2760,
          3160,
        ];
        const timers = tickDelays.map((ms) => window.setTimeout(() => playSpinTick(ctx), ms));
        return () => timers.forEach((t) => window.clearTimeout(t));
      }
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allocation.spinNonce, allocation.spinnerStatus, allocation.lastRevealed?.teamId]);

  useEffect(() => {
    if (allocation.revealIndex > lastCompletedCountRef.current) {
      lastCompletedCountRef.current = allocation.revealIndex;
      const ctx = ensureAudioCtx();
      if (ctx) {
        playRevealChime(ctx, allocation.spinnerStatus === 'COMPLETED');
      }
    } else if (allocation.revealIndex < lastCompletedCountRef.current) {
      lastCompletedCountRef.current = allocation.revealIndex;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allocation.revealIndex, allocation.spinnerStatus]);

  const currentCandidate =
    allocation.spinnerStatus === 'SPINNING'
      ? allocation.lastRevealed
      : allocation.revealQueue[allocation.revealIndex] ?? allocation.lastRevealed;

  const isSpinning = allocation.spinnerStatus === 'SPINNING';
  const isCompleted = allocation.spinnerStatus === 'COMPLETED';
  const cx = 200;
  const cy = 200;
  const radius = 178;

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex items-center justify-between w-full max-w-md gap-3">
        <div
          className={`text-xs font-bold uppercase tracking-wider ${
            projectorMode ? 'text-[#F1C56C]' : 'text-slate-500'
          }`}
        >
          Progres Pengungkapan: {allocation.revealIndex} / {allocation.revealQueue.length} Mahasiswa
        </div>
        {onToggleMute && (
          <button
            type="button"
            onClick={onToggleMute}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              projectorMode
                ? 'bg-white/10 text-white hover:bg-white/20'
                : 'bg-slate-100 text-[#0E2142] hover:bg-slate-200'
            }`}
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span>{muted ? 'Suara Mati' : 'Suara Aktif'}</span>
          </button>
        )}
      </div>

      {/* Wheel Container */}
      <div
        className="relative flex items-center justify-center select-none"
        style={{ width: size, height: size }}
      >
        {/* Top Gold Pointer */}
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 drop-shadow-md"
          aria-hidden="true"
        >
          <svg width="36" height="40" viewBox="0 0 36 40">
            <polygon
              points="18,38 3,6 33,6"
              fill="#F1C56C"
              stroke="#0E2142"
              strokeWidth="3"
            />
          </svg>
        </div>

        {/* Outer Gold Ring */}
        <div
          className="rounded-full p-2.5 shadow-2xl"
          style={{
            width: size,
            height: size,
            background: 'linear-gradient(135deg, #F1C56C 0%, #B7872D 50%, #F1C56C 100%)',
          }}
        >
          <div className="w-full h-full rounded-full bg-[#0E2142] p-1 overflow-hidden">
            <svg
              viewBox="0 0 400 400"
              className="w-full h-full"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: isSpinning
                  ? 'transform 3.4s cubic-bezier(0.12, 0.86, 0.16, 1)'
                  : 'transform 0.5s ease-out',
              }}
            >
              {teams.map((team, idx) => {
                const centerAngle = idx * sliceAngle - 90;
                const startAngle = centerAngle - sliceAngle / 2;
                const endAngle = centerAngle + sliceAngle / 2;
                const labelPos = polarToCartesian(cx, cy, radius * 0.64, centerAngle);

                return (
                  <g key={team.teamId}>
                    <path
                      d={createWedgePath(cx, cy, radius, startAngle, endAngle)}
                      fill={team.color || '#2563EB'}
                      stroke="#0E2142"
                      strokeWidth="3"
                    />
                    <text
                      x={labelPos.x}
                      y={labelPos.y}
                      fill="#FFFFFF"
                      fontSize={teams.length > 6 ? '13' : '15'}
                      fontWeight="800"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(${centerAngle + 90}, ${labelPos.x}, ${labelPos.y})`}
                      style={{ textShadow: '0 1px 3px rgba(0,0,0,0.65)' }}
                    >
                      {team.name}
                    </text>
                  </g>
                );
              })}

              {/* Inner Decorative Ring & Hub */}
              <circle cx={cx} cy={cy} r="50" fill="#0E2142" stroke="#F1C56C" strokeWidth="4" />
              <circle cx={cx} cy={cy} r="36" fill="#13294E" />
            </svg>
          </div>
        </div>

        {/* Center Hub Label (non-rotating) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-20 h-20 rounded-full flex flex-col items-center justify-center text-center px-2">
            <Sparkles className="w-5 h-5 text-[#F1C56C] mb-0.5" />
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-white">
              {isSpinning ? 'MEMUTAR' : isCompleted ? 'SELESAI' : 'SIAP'}
            </span>
          </div>
        </div>
      </div>

      {/* Spotlight Card */}
      <div
        className={`w-full max-w-md rounded-2xl border p-4 text-center transition-all ${
          projectorMode
            ? 'bg-[#13294E] border-[#F1C56C]/40 text-white'
            : 'bg-slate-50 border-slate-200 text-[#0E2142]'
        }`}
      >
        {isCompleted ? (
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-500">
              Seluruh Anggota Tim Telah Ditempatkan
            </div>
            <div className="text-lg font-extrabold">
              Komposisi Tim Seimbang Siap Dikunci &amp; Dimulai
            </div>
          </div>
        ) : currentCandidate ? (
          <div className="space-y-1.5">
            <div
              className={`text-xs font-bold uppercase tracking-wider ${
                projectorMode ? 'text-[#F1C56C]' : 'text-[#2563EB]'
              }`}
            >
              {isSpinning
                ? 'Menentukan Penempatan Tim...'
                : allocation.lastRevealed &&
                  allocation.revealedParticipantIds.includes(allocation.lastRevealed.participantId)
                ? 'Mahasiswa Terakhir Ditempatkan'
                : 'Giliran Berikutnya'}
            </div>
            <div className="text-2xl font-extrabold truncate">{currentCandidate.displayName}</div>
            {(!isSpinning &&
              allocation.lastRevealed &&
              allocation.lastRevealed.participantId === currentCandidate.participantId &&
              allocation.revealedParticipantIds.includes(currentCandidate.participantId)) ? (
              <div className="flex items-center justify-center gap-2 pt-1">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: currentCandidate.teamColor }}
                />
                <span className="text-sm font-bold">Bergabung ke {currentCandidate.teamName}</span>
              </div>
            ) : (
              <div className={`text-xs ${projectorMode ? 'text-slate-300' : 'text-slate-500'}`}>
                {isSpinning ? 'Menuju tim yang telah ditetapkan...' : 'Siap diputar pada roda tim'}
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm font-semibold">Belum ada antrean mahasiswa untuk diputar.</div>
        )}
      </div>
    </div>
  );
};
