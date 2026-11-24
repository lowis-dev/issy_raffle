import React, { useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { Participant, RaffleRound, RaffleSettings, WinnerRecord } from '../types/raffle';
import { secureRandomInt } from '../utils/raffleEngine';
import { playTickSound, playWinFanfare } from '../utils/sound';
import type { ThemePalette } from '../utils/theme';
import { LiveDrawModal } from './LiveDrawModal';

interface DrawStageProps {
  activeRound: RaffleRound;
  nextRound: RaffleRound | null;
  pool: Participant[];
  roundWinners: WinnerRecord[];
  latestBatchWinners: WinnerRecord[];
  settings: RaffleSettings;
  palette: ThemePalette;
  onExecuteDraw: (count: number) => WinnerRecord[];
  onRedrawWinner: (winnerId: string) => void;
  onSelectRound: (roundId: string) => void;
  onToggleSound: () => void;
  onToggleConfetti: () => void;
  onViewAllWinners: () => void;
}

export const DrawStage: React.FC<DrawStageProps> = ({
  activeRound,
  nextRound,
  pool,
  roundWinners,
  latestBatchWinners,
  settings,
  palette,
  onExecuteDraw,
  onRedrawWinner,
  onSelectRound,
  onToggleSound,
  onToggleConfetti,
  onViewAllWinners,
}) => {
  const activeWinners = useMemo(
    () => roundWinners.filter((w) => w.status === 'active'),
    [roundWinners]
  );
  const slotsLeft = Math.max(0, activeRound.winnerCount - activeWinners.length);
  const maxDrawable = Math.min(slotsLeft, pool.length);

  const [batchSize, setBatchSize] = useState<number>(activeRound.defaultBatchSize);
  const [isSpinning, setIsSpinning] = useState(false);
  const [reelItems, setReelItems] = useState<Participant[]>([]);
  const [stageFullscreen, setStageFullscreen] = useState(false);
  const [showLiveModal, setShowLiveModal] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const rafRef = useRef<number | null>(null);
  const onExecuteDrawRef = useRef(onExecuteDraw);
  const settingsRef = useRef(settings);
  const startDrawRef = useRef<() => void>(() => {});

  onExecuteDrawRef.current = onExecuteDraw;
  settingsRef.current = settings;

  // Cancel any active spin if the user switches rounds or the pool becomes empty
  useEffect(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setIsSpinning(false);
  }, [activeRound.id, pool.length === 0]);

  // Sync batch size cleanly when switching rounds or resetting draws
  useEffect(() => {
    setBatchSize(Math.min(activeRound.defaultBatchSize, Math.max(1, maxDrawable)));
  }, [activeRound.id, activeRound.defaultBatchSize, activeWinners.length === 0]);

  useEffect(() => {
    if (maxDrawable > 0 && batchSize > maxDrawable) {
      setBatchSize(maxDrawable);
    }
  }, [maxDrawable, batchSize]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const effectiveDrawCount = Math.min(batchSize, maxDrawable);
  const canDraw = !isSpinning && effectiveDrawCount > 0;

  const fireCelebration = () => {
    if (!settings.confettiEnabled) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    try {
      confetti({
        particleCount: 75,
        spread: 70,
        origin: { y: 0.6 },
        zIndex: 40,
        colors: palette.confettiColors,
      });
    } catch {
      // Ignore canvas errors in headless environments
    }
  };

  const handleStartDraw = () => {
    if (!canDraw) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const duration = prefersReducedMotion ? 250 : settings.animationDurationMs;
    const drawCount = effectiveDrawCount;
    setIsSpinning(true);

    const startTime = performance.now();
    let lastSwapTime = 0;

    // Scale sample size with draw count so multi-winner draws feel dynamic
    const sampleCount = drawCount > 5 ? Math.min(6, pool.length) : Math.min(3, pool.length);

    const pickPreviewSamples = (): Participant[] => {
      const samples: Participant[] = [];
      for (let i = 0; i < sampleCount; i++) {
        samples.push(pool[secureRandomInt(pool.length)]);
      }
      return samples;
    };

    setReelItems(pickPreviewSamples());

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);

      // Smooth deceleration interval: starts fast (40ms) and slows down (240ms) near reveal
      const easedInterval = 40 + Math.pow(progress, 2.4) * 200;
      const currentSettings = settingsRef.current;

      if (now - lastSwapTime >= easedInterval) {
        lastSwapTime = now;
        setReelItems(pickPreviewSamples());
        if (currentSettings.soundEnabled) {
          playTickSound(progress);
        }
      }

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        rafRef.current = null;
        const drawn = onExecuteDrawRef.current(drawCount);
        setIsSpinning(false);
        if (drawn.length > 0) {
          if (currentSettings.soundEnabled) {
            playWinFanfare();
          }
          fireCelebration();
          // Automatically open full live draw showcase so spectators can see everything
          setShowLiveModal(true);
        }
      }
    };

    rafRef.current = requestAnimationFrame(animate);
  };

  startDrawRef.current = handleStartDraw;

  // Spacebar shortcut in Stage Fullscreen Mode
  useEffect(() => {
    if (!stageFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.code === 'Space' && canDraw) {
        e.preventDefault();
        startDrawRef.current();
      } else if (e.code === 'Escape') {
        setStageFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [stageFullscreen, canDraw]);

  const batchChoices = useMemo(() => {
    const presets = [1, 5, 10, 25, 50];
    const valid = presets.filter((n) => n < slotsLeft && n <= pool.length);
    if (maxDrawable > 0 && !valid.includes(maxDrawable)) {
      valid.push(maxDrawable);
    }
    return valid;
  }, [slotsLeft, pool.length, maxDrawable]);

  const roundCompleted = slotsLeft === 0;
  const pctComplete =
    activeRound.winnerCount > 0
      ? Math.min(100, Math.round((activeWinners.length / activeRound.winnerCount) * 100))
      : 0;

  const currentBatchMatchesRound =
    latestBatchWinners.length > 0 && latestBatchWinners[0].roundId === activeRound.id;

  const wrapperClass = stageFullscreen
    ? 'fixed inset-0 z-50 flex flex-col overflow-y-auto bg-slate-50 p-6 sm:p-10'
    : 'space-y-6';

  return (
    <section aria-label="Live Raffle Draw Stage" className={wrapperClass}>
      {/* Event Title & Active Round Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-800">{settings.eventTitle}</span>
            <span aria-hidden="true">·</span>
            <span>Round {activeRound.order}</span>
            <span aria-hidden="true">·</span>
            <span>{activeRound.prize}</span>
          </div>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            {activeRound.title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{settings.eventSubtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Live Draw Showcase Trigger */}
          {(currentBatchMatchesRound || activeWinners.length > 0) && (
            <button
              type="button"
              onClick={() => setShowLiveModal(true)}
              aria-label="Open Live Draw Showcase"
              className={`inline-flex h-10 items-center gap-2 rounded-lg px-3.5 text-xs font-bold text-white shadow-sm transition-all whitespace-nowrap shrink-0 ${palette.primaryBg} ${palette.primaryHover}`}
            >
              <Trophy className="h-4 w-4" aria-hidden="true" />
              Live Draw Showcase
              {currentBatchMatchesRound && (
                <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-[10px] font-mono">
                  {latestBatchWinners.length}
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onToggleSound}
            aria-label={settings.soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            {settings.soundEnabled ? (
              <Volume2 className="h-4 w-4 text-slate-700" aria-hidden="true" />
            ) : (
              <VolumeX className="h-4 w-4 text-slate-400" aria-hidden="true" />
            )}
            Sound
          </button>
          <button
            type="button"
            onClick={onToggleConfetti}
            aria-label={settings.confettiEnabled ? 'Disable confetti' : 'Enable confetti'}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Sparkles
              className={`h-4 w-4 ${settings.confettiEnabled ? palette.primaryText : 'text-slate-400'}`}
              aria-hidden="true"
            />
            Confetti
          </button>
          <button
            type="button"
            onClick={() => setStageFullscreen((v) => !v)}
            aria-label={stageFullscreen ? 'Exit stage view' : 'Open stage view'}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            {stageFullscreen ? (
              <>
                <Minimize2 className="h-4 w-4" aria-hidden="true" />
                Exit Stage
              </>
            ) : (
              <>
                <Maximize2 className="h-4 w-4" aria-hidden="true" />
                Stage View
              </>
            )}
          </button>
        </div>
      </div>

      {/* Primary Focal Anchor: Live Draw Stage Surface */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
        {/* Progress & Pool Metrics Row */}
        <div className="grid grid-cols-1 gap-4 border-b border-slate-200 pb-5 sm:grid-cols-3">
          <div>
            <p className="text-xs text-slate-500">Round Progress</p>
            <p
              data-testid="stage-round-progress"
              className="mt-1 font-mono text-2xl font-bold text-slate-950 tabular-nums"
            >
              {activeWinners.length} / {activeRound.winnerCount}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 tabular-nums">
              {slotsLeft} slots remaining ({pctComplete}%)
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Eligible Main Pool</p>
            <p
              data-testid="stage-pool-remaining"
              className="mt-1 font-mono text-2xl font-bold text-slate-950 tabular-nums"
            >
              {pool.length.toLocaleString()}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {settings.removeWinnerFromPool
                ? 'Picked names are auto-removed'
                : 'Winners stay in pool'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Next Draw Batch</p>
            <p className="mt-1 font-mono text-2xl font-bold text-slate-950 tabular-nums">
              {roundCompleted ? 'Done' : `${effectiveDrawCount} ${effectiveDrawCount === 1 ? 'Winner' : 'Winners'}`}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Cryptographic random selection
            </p>
          </div>
        </div>

        {/* Center Reel / Stage Viewport */}
        <div
          data-testid="draw-reel-area"
          className="mt-5 flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50/80 p-5 sm:p-6 text-center"
        >
          {isSpinning ? (
            <div className="w-full max-w-2xl space-y-4" aria-live="polite">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                  Drawing {effectiveDrawCount} {effectiveDrawCount === 1 ? 'Winner' : 'Winners'}...
                </span>
                <span className="font-mono text-slate-400">
                  Pool: {pool.length.toLocaleString()} entries
                </span>
              </div>

              {/* Multi-slot spinning reel cards */}
              <div
                className={`grid gap-2.5 ${
                  reelItems.length > 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1'
                }`}
              >
                {reelItems.map((item, idx) => (
                  <div
                    key={`${item.id}-${idx}`}
                    className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm transition-transform duration-75 scale-[1.01]"
                  >
                    <p className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-950 truncate">
                      {item.name}
                    </p>
                    {(() => {
                      const metaParts = [
                        settings.showTicketNumber ? item.ticketNumber : undefined,
                        settings.showDepartment ? item.department : undefined,
                      ].filter(Boolean);
                      if (metaParts.length === 0) return null;
                      return (
                        <p className="mt-1 font-mono text-xs text-slate-500 truncate">
                          {metaParts.join(' · ')}
                        </p>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </div>
          ) : roundCompleted ? (
            <div className="max-w-lg py-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Check className="h-6 w-6" aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-2xl font-bold text-slate-950">
                {activeRound.title} Complete
              </h2>
              <p className="mt-1.5 text-sm text-slate-600">
                All {activeRound.winnerCount} winners have been randomly drawn and recorded.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowLiveModal(true)}
                  className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors whitespace-nowrap shrink-0 ${palette.primaryBg} ${palette.primaryHover}`}
                >
                  <Trophy className="h-4 w-4" />
                  Show All {activeWinners.length} Winners in Live Draw
                </button>
                {nextRound && (
                  <button
                    type="button"
                    onClick={() => onSelectRound(nextRound.id)}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                  >
                    Proceed to Round {nextRound.order}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onViewAllWinners}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  Winners Master List
                </button>
              </div>
            </div>
          ) : pool.length === 0 ? (
            <div className="max-w-md py-4">
              <h2 className="text-lg font-bold text-slate-900">Main Pool is Empty</h2>
              <p className="mt-1.5 text-sm text-slate-600">
                Load your entries from Google Drive (RAFFLE ENTRIES 2026), upload a CSV/Excel file, or add participants in the Main List tab.
              </p>
            </div>
          ) : latestBatchWinners.length === 1 && currentBatchMatchesRound ? (
            <div className="w-full max-w-xl py-2" aria-live="polite">
              <p className="text-xs font-medium text-slate-500">
                Winner #{latestBatchWinners[0].slotNumber} of {activeRound.winnerCount} ·{' '}
                {latestBatchWinners[0].prize}
              </p>
              <p
                data-testid="spotlight-winner-name"
                className="mt-2 font-display text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl"
              >
                {latestBatchWinners[0].participant.name}
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-sm text-slate-600">
                {settings.showTicketNumber && latestBatchWinners[0].participant.ticketNumber && (
                  <span className="font-mono font-medium">
                    {latestBatchWinners[0].participant.ticketNumber}
                  </span>
                )}
                {settings.showTicketNumber &&
                  latestBatchWinners[0].participant.ticketNumber &&
                  settings.showDepartment &&
                  latestBatchWinners[0].participant.department && (
                    <span aria-hidden="true">·</span>
                  )}
                {settings.showDepartment && latestBatchWinners[0].participant.department && (
                  <span>{latestBatchWinners[0].participant.department}</span>
                )}
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowLiveModal(true)}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold text-white ${palette.primaryBg} ${palette.primaryHover}`}
                >
                  <Trophy className="h-3.5 w-3.5" />
                  Show in Live Draw Theater
                </button>
                <button
                  type="button"
                  onClick={() => onRedrawWinner(latestBatchWinners[0].id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  Redraw Slot #{latestBatchWinners[0].slotNumber}
                </button>
              </div>
            </div>
          ) : latestBatchWinners.length > 1 && currentBatchMatchesRound ? (
            <div className="w-full text-left" aria-live="polite">
              {/* Header with full reveal button */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <p className="text-sm font-bold text-slate-950">
                      Latest Draw Reveal · {latestBatchWinners.length} Winners Selected
                    </p>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {settings.removeWinnerFromPool
                      ? 'Automatically removed from Main List.'
                      : 'Recorded in Winners Master List.'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowLiveModal(true)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold text-white shadow-xs ${palette.primaryBg} ${palette.primaryHover}`}
                  >
                    <Trophy className="h-3.5 w-3.5" />
                    Open Live Draw Board (Show Everything)
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsExpanded((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="h-3.5 w-3.5" />
                        Compact
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3.5 w-3.5" />
                        Expand ({latestBatchWinners.length})
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Grid of latest drawn winners */}
              <div
                data-testid="latest-winners-list"
                className={`grid grid-cols-1 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3 transition-all ${
                  isExpanded ? 'max-h-[640px]' : 'max-h-[280px]'
                }`}
              >
                {latestBatchWinners.map((winner) => (
                  <div
                    key={winner.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-2xs hover:border-slate-300 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 rounded px-1.5 py-0.5 tabular-nums">
                          #{String(winner.slotNumber).padStart(3, '0')}
                        </span>
                        <p className="truncate text-sm font-bold text-slate-950">
                          {winner.participant.name}
                        </p>
                      </div>
                      <p className="mt-1 truncate pl-10 text-xs text-slate-500">
                        {settings.showTicketNumber && winner.participant.ticketNumber
                          ? winner.participant.ticketNumber
                          : 'Verified Entry'}
                        {settings.showDepartment && winner.participant.department
                          ? ` · ${winner.participant.department}`
                          : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRedrawWinner(winner.id)}
                      aria-label={`Redraw slot ${winner.slotNumber} (${winner.participant.name})`}
                      className="rounded-md px-2 py-1 text-xs font-medium text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors whitespace-nowrap shrink-0"
                    >
                      Redraw
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-lg py-4">
              <p className="text-xs font-medium text-slate-500">
                Ready for Round {activeRound.order} · {activeRound.prize}
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                Draw {effectiveDrawCount}{' '}
                {effectiveDrawCount === 1 ? 'Winner' : 'Winners'} from{' '}
                {pool.length.toLocaleString()} Entries
              </h2>
              <p className="mt-1.5 text-sm text-slate-600">
                Select how many winners to pick per spin below, then press Start Draw.
                {stageFullscreen ? ' Tip: press Spacebar on stage to trigger the draw.' : ''}
              </p>
            </div>
          )}
        </div>

        {/* Draw Controls Bar */}
        {!roundCompleted && pool.length > 0 && (
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-medium text-slate-500">Pick per draw:</span>
              <div
                role="group"
                aria-label="Winners per draw batch"
                className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1"
              >
                {batchChoices.map((count) => {
                  const active = batchSize === count;
                  const isAll = count === maxDrawable && count > 1 && count === slotsLeft;
                  return (
                    <button
                      key={count}
                      type="button"
                      disabled={isSpinning}
                      onClick={() => setBatchSize(count)}
                      className={`rounded-md px-3 py-1.5 font-mono text-xs font-semibold tabular-nums transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-white text-slate-950 shadow-sm'
                          : 'text-slate-600 hover:text-slate-950'
                      }`}
                    >
                      {isAll ? `All (${count})` : count}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={handleStartDraw}
              disabled={!canDraw}
              data-testid="start-draw-button"
              className={`inline-flex h-12 items-center justify-center gap-2.5 rounded-lg px-7 text-base font-bold text-white transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${palette.primaryBg} ${palette.primaryHover} ${palette.ring}`}
            >
              <Play className="h-4 w-4 fill-current" aria-hidden="true" />
              {isSpinning
                ? 'Drawing...'
                : `Start Draw (${effectiveDrawCount})`}
            </button>
          </div>
        )}
      </div>

      {/* Recent Winners Grid when round is completed */}
      {roundCompleted && latestBatchWinners.length > 0 && currentBatchMatchesRound && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Final Batch Results ({latestBatchWinners.length}{' '}
                {latestBatchWinners.length === 1 ? 'Winner' : 'Winners'})
              </h2>
              <p className="text-xs text-slate-500">
                {settings.removeWinnerFromPool
                  ? 'Automatically removed from the Main List so they cannot win again.'
                  : 'Recorded in the Winners Master List.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowLiveModal(true)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white ${palette.primaryBg} ${palette.primaryHover}`}
              >
                <Trophy className="h-3.5 w-3.5" />
                Show All in Live Draw
              </button>
              <button
                type="button"
                onClick={onViewAllWinners}
                className="text-xs font-semibold text-slate-700 hover:text-slate-950 hover:underline whitespace-nowrap shrink-0"
              >
                View All {activeWinners.length} Round Winners
              </button>
            </div>
          </div>

          <div
            data-testid="latest-winners-list"
            className="grid max-h-[340px] grid-cols-1 divide-y divide-slate-100 overflow-y-auto sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3"
          >
            {latestBatchWinners.map((winner) => (
              <div
                key={winner.id}
                className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5 sm:border-r"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-slate-400 tabular-nums">
                      #{String(winner.slotNumber).padStart(3, '0')}
                    </span>
                    <p className="truncate text-sm font-semibold text-slate-950">
                      {winner.participant.name}
                    </p>
                  </div>
                  <p className="mt-0.5 truncate pl-9 text-xs text-slate-500">
                    {settings.showTicketNumber && winner.participant.ticketNumber
                      ? winner.participant.ticketNumber
                      : 'Verified Entry'}
                    {settings.showDepartment && winner.participant.department
                      ? ` · ${winner.participant.department}`
                      : ''}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onRedrawWinner(winner.id)}
                  aria-label={`Redraw slot ${winner.slotNumber} (${winner.participant.name})`}
                  className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap shrink-0"
                >
                  Redraw
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Draw Showcase & Full Reveal Modal */}
      <LiveDrawModal
        open={showLiveModal}
        onClose={() => setShowLiveModal(false)}
        round={activeRound}
        batchWinners={latestBatchWinners}
        allRoundWinners={activeWinners}
        settings={settings}
        palette={palette}
        onRedrawWinner={onRedrawWinner}
      />
    </section>
  );
};
