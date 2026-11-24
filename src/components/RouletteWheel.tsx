import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Participant } from '../types/raffle';
import { playTickSound, playWinFanfare } from '../utils/sound';
import type { ThemePalette } from '../utils/theme';

export interface RouletteWheelProps {
  participants: Participant[];
  targetWinner: Participant | null;
  isSpinning: boolean;
  onSpinComplete: () => void;
  palette: ThemePalette;
  soundEnabled: boolean;
  speed?: 'fast' | 'normal' | 'dramatic';
  disabled?: boolean;
  onTriggerSpin?: () => void;
}

const SLICE_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#14b8a6', // teal
  '#84cc16', // lime
];

export const RouletteWheel: React.FC<RouletteWheelProps> = ({
  participants,
  targetWinner,
  isSpinning,
  onSpinComplete,
  palette,
  soundEnabled,
  speed = 'normal',
  disabled = false,
  onTriggerSpin,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Wheel state refs
  const currentAngleRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const lastSliceIdxRef = useRef<number>(-1);
  const needleDeflectionRef = useRef<number>(0);
  const onSpinCompleteRef = useRef(onSpinComplete);
  onSpinCompleteRef.current = onSpinComplete;

  const [activePassingName, setActivePassingName] = useState<string>('');
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 440,
    height: 440,
  });

  // Keep track of container size
  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const minDim = Math.min(rect.width, 560);
      const size = Math.max(280, Math.min(minDim, window.innerHeight * 0.52));
      setDimensions({ width: size, height: size });
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const totalParticipants = participants.length;
  const sliceAngle = totalParticipants > 0 ? (2 * Math.PI) / totalParticipants : 2 * Math.PI;

  // Calculate slice currently under the 12 o'clock needle (-PI/2)
  const getSliceUnderNeedle = useCallback(
    (rotationAngle: number): number => {
      if (totalParticipants === 0) return 0;
      // Needle is at -PI/2 (12 o'clock)
      // Angle on wheel at needle: theta = (-PI/2 - rotationAngle) % (2*PI)
      let theta = (-Math.PI / 2 - rotationAngle) % (2 * Math.PI);
      if (theta < 0) theta += 2 * Math.PI;
      const idx = Math.floor(theta / sliceAngle) % totalParticipants;
      return idx >= 0 ? idx : 0;
    },
    [totalParticipants, sliceAngle]
  );

  // Draw the entire roulette wheel frame
  const drawWheel = useCallback(
    (rotationAngle: number, needleAngle: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const width = dimensions.width;
      const height = dimensions.height;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.resetTransform();
      ctx.scale(dpr, dpr);

      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(centerX, centerY) - 18;

      ctx.clearRect(0, 0, width, height);

      // Outer rim drop shadow
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + 10, 0, 2 * Math.PI);
      ctx.fillStyle = '#1e293b';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 6;
      ctx.fill();
      ctx.restore();

      // Outer gold/metallic bezel
      const rimGradient = ctx.createRadialGradient(
        centerX,
        centerY,
        radius,
        centerX,
        centerY,
        radius + 10
      );
      rimGradient.addColorStop(0, '#f1f5f9');
      rimGradient.addColorStop(0.5, '#cbd5e1');
      rimGradient.addColorStop(1, '#64748b');

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + 10, 0, 2 * Math.PI);
      ctx.lineWidth = 10;
      ctx.strokeStyle = rimGradient;
      ctx.stroke();

      // Rotate wheel
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotationAngle);

      if (totalParticipants === 0) {
        // Placeholder wheel
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, 2 * Math.PI);
        ctx.fillStyle = '#e2e8f0';
        ctx.fill();
        ctx.restore();
        return;
      }

      // Draw all colored slices
      for (let i = 0; i < totalParticipants; i++) {
        const start = i * sliceAngle;
        const end = (i + 1) * sliceAngle;

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, start, end);
        ctx.closePath();

        const baseColor = SLICE_COLORS[i % SLICE_COLORS.length];
        ctx.fillStyle = baseColor;
        ctx.fill();

        // Slice subtle border
        ctx.lineWidth = totalParticipants > 100 ? 0.4 : 1.2;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.stroke();

        // Draw text label along radial line if participant count is reasonable
        if (totalParticipants <= 70) {
          ctx.save();
          const midAngle = start + sliceAngle / 2;
          ctx.rotate(midAngle);
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#ffffff';

          const fontSize = Math.max(9, Math.min(14, Math.floor(radius / 18)));
          ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;
          ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
          ctx.shadowBlur = 3;

          const p = participants[i];
          const maxTextWidth = radius - 60;
          let text = p.name;
          if (ctx.measureText(text).width > maxTextWidth) {
            text = text.slice(0, 14) + '…';
          }
          ctx.fillText(text, radius - 16, 0);
          ctx.restore();
        }
      }

      // Outer metallic pins/pegs around the rim
      const pegStep = totalParticipants <= 60 ? 1 : Math.ceil(totalParticipants / 48);
      for (let i = 0; i < totalParticipants; i += pegStep) {
        const angle = i * sliceAngle;
        const px = Math.cos(angle) * (radius - 2);
        const py = Math.sin(angle) * (radius - 2);

        ctx.beginPath();
        ctx.arc(px, py, 3, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 2;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#94a3b8';
        ctx.stroke();
      }

      ctx.restore(); // Restore wheel rotation

      // Center Hub Button
      const hubRadius = Math.max(34, Math.min(52, radius * 0.24));
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, hubRadius + 4, 0, 2 * Math.PI);
      ctx.fillStyle = '#0f172a';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 3;
      ctx.fill();

      // Hub inner gradient
      const hubGrad = ctx.createLinearGradient(
        centerX - hubRadius,
        centerY - hubRadius,
        centerX + hubRadius,
        centerY + hubRadius
      );
      hubGrad.addColorStop(0, '#ffffff');
      hubGrad.addColorStop(1, '#f1f5f9');

      ctx.beginPath();
      ctx.arc(centerX, centerY, hubRadius, 0, 2 * Math.PI);
      ctx.fillStyle = hubGrad;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#e2e8f0';
      ctx.stroke();

      // Hub Text
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#0f172a';
      ctx.font = `800 ${Math.max(11, Math.floor(hubRadius * 0.38))}px system-ui, sans-serif`;
      ctx.fillText(isSpinning ? 'SPINNING' : 'SPIN', centerX, centerY);
      ctx.restore();

      // Top Needle / Flapper (at 12 o'clock, pointing down into the wheel)
      const needleTopY = centerY - radius - 16;
      const needleBottomY = centerY - radius + 14;
      const needleCenterX = centerX;

      ctx.save();
      ctx.translate(needleCenterX, needleTopY + 8);
      ctx.rotate(needleAngle); // Deflect flapper on peg contact

      ctx.beginPath();
      ctx.moveTo(-9, -8);
      ctx.lineTo(9, -8);
      ctx.lineTo(0, needleBottomY - needleTopY);
      ctx.closePath();

      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 3;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Needle pivot dot
      ctx.beginPath();
      ctx.arc(0, -2, 4, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();
    },
    [dimensions, totalParticipants, sliceAngle, participants, isSpinning]
  );

  // Render initial frame or static wheel
  useEffect(() => {
    if (!isSpinning) {
      drawWheel(currentAngleRef.current, needleDeflectionRef.current);
      if (totalParticipants > 0) {
        const idx = getSliceUnderNeedle(currentAngleRef.current);
        if (participants[idx]) {
          setActivePassingName(participants[idx].name);
        }
      }
    }
  }, [drawWheel, isSpinning, totalParticipants, getSliceUnderNeedle, participants]);

  // Main Spin Physics Runner (Ease-Out Quartic Deceleration)
  useEffect(() => {
    if (!isSpinning || !targetWinner || totalParticipants === 0) {
      return;
    }

    // Find target winner's index
    const winnerIdx = participants.findIndex((p) => p.id === targetWinner.id);
    const resolvedWinnerIdx = winnerIdx >= 0 ? winnerIdx : 0;

    // Angle of target slice center on wheel
    const targetSliceCenter = resolvedWinnerIdx * sliceAngle + sliceAngle / 2;

    // We want (3*PI/2 - (currentAngle + delta)) % (2*PI) === targetSliceCenter
    // needle is at 12 o'clock: -PI/2 (or 3*PI/2)
    const currentNorm = currentAngleRef.current % (2 * Math.PI);
    let desiredEndNorm = (-Math.PI / 2 - targetSliceCenter) % (2 * Math.PI);
    if (desiredEndNorm < 0) desiredEndNorm += 2 * Math.PI;

    // Natural random jitter within the winner slice so it doesn't land dead center every time
    const jitter = (Math.random() - 0.5) * (sliceAngle * 0.6);

    let angleDiff = desiredEndNorm - (currentNorm < 0 ? currentNorm + 2 * Math.PI : currentNorm);
    if (angleDiff < 0) angleDiff += 2 * Math.PI;

    // Full rotations based on chosen speed
    const fullTurns =
      speed === 'fast'
        ? 5 + Math.floor(Math.random() * 2)
        : speed === 'normal'
        ? 8 + Math.floor(Math.random() * 3)
        : 14 + Math.floor(Math.random() * 4);

    const startAngle = currentAngleRef.current;
    const totalRotation = fullTurns * 2 * Math.PI + angleDiff + jitter;
    const finalTargetAngle = startAngle + totalRotation;

    const duration =
      speed === 'fast' ? 2200 : speed === 'normal' ? 4200 : 7000;

    const startTime = performance.now();
    lastSliceIdxRef.current = getSliceUnderNeedle(startAngle);

    // Quartic ease out curve
    const easeOut = (t: number): number => {
      return 1 - Math.pow(1 - t, 3.8);
    };

    const animateSpin = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const easedProgress = easeOut(progress);

      const currentRot = startAngle + totalRotation * easedProgress;
      currentAngleRef.current = currentRot;

      // Slice change detection for tick sound and needle deflection
      const currentSliceIdx = getSliceUnderNeedle(currentRot);
      if (currentSliceIdx !== lastSliceIdxRef.current) {
        lastSliceIdxRef.current = currentSliceIdx;
        if (participants[currentSliceIdx]) {
          setActivePassingName(participants[currentSliceIdx].name);
        }

        // Flapper bounces on peg
        needleDeflectionRef.current = (Math.random() > 0.5 ? 1 : -1) * 0.22;

        if (soundEnabled) {
          playTickSound(progress);
        }
      } else {
        // Needle springs back to center
        needleDeflectionRef.current *= 0.85;
      }

      drawWheel(currentRot, needleDeflectionRef.current);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animateSpin);
      } else {
        // Spin finished: lock on final angle
        currentAngleRef.current = finalTargetAngle;
        needleDeflectionRef.current = 0;
        drawWheel(finalTargetAngle, 0);

        if (participants[resolvedWinnerIdx]) {
          setActivePassingName(participants[resolvedWinnerIdx].name);
        }

        if (soundEnabled) {
          playWinFanfare();
        }

        // Complete callback
        onSpinCompleteRef.current();
      }
    };

    animationFrameRef.current = requestAnimationFrame(animateSpin);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    isSpinning,
    targetWinner,
    totalParticipants,
    participants,
    sliceAngle,
    speed,
    soundEnabled,
    getSliceUnderNeedle,
    drawWheel,
  ]);

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center justify-center p-2 select-none"
    >
      {/* Real-time Passing Name Ticker Banner */}
      <div className="mb-3 flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-1.5 shadow-xs backdrop-blur-xs">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            isSpinning ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'
          }`}
        />
        <p className="text-xs font-semibold text-slate-700">
          {isSpinning ? (
            <>
              Passing: <span className="text-slate-950 font-bold">{activePassingName}</span>
            </>
          ) : (
            `Roulette Ready · ${totalParticipants} Participants on Wheel`
          )}
        </p>
      </div>

      {/* Interactive Canvas Container */}
      <div
        className="relative cursor-pointer transition-transform duration-200 active:scale-[0.99]"
        onClick={() => {
          if (!isSpinning && !disabled && onTriggerSpin) {
            onTriggerSpin();
          }
        }}
        title={!isSpinning ? 'Click wheel to spin!' : 'Spinning...'}
      >
        <canvas
          ref={canvasRef}
          style={{ width: dimensions.width, height: dimensions.height }}
          className="rounded-full"
        />
      </div>

      {/* Hint for Host */}
      {!isSpinning && !disabled && (
        <p className="mt-2 text-[11px] text-slate-400">
          Click the wheel hub or press <kbd className="font-mono bg-slate-100 px-1 py-0.5 rounded border border-slate-200 text-slate-600">Space</kbd> to spin
        </p>
      )}
    </div>
  );
};
