import React, { useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Check,
  Copy,
  Download,
  Eye,
  Grid3X3,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { RaffleRound, RaffleSettings, WinnerRecord } from '../types/raffle';
import { exportWinnersToCsv } from '../utils/raffleEngine';
import { playTickSound, playWinFanfare } from '../utils/sound';
import type { ThemePalette } from '../utils/theme';

export interface LiveDrawModalProps {
  open: boolean;
  onClose: () => void;
  round: RaffleRound;
  batchWinners: WinnerRecord[];
  allRoundWinners: WinnerRecord[];
  settings: RaffleSettings;
  palette: ThemePalette;
  onRedrawWinner: (winnerId: string) => void;
}

type LiveViewMode = 'grid' | 'spotlight' | 'theater';

export const LiveDrawModal: React.FC<LiveDrawModalProps> = ({
  open,
  onClose,
  round,
  batchWinners,
  allRoundWinners,
  settings,
  palette,
  onRedrawWinner,
}) => {
  const [viewMode, setViewMode] = useState<LiveViewMode>('grid');
  const [density, setDensity] = useState<'normal' | 'dense'>('normal');
  const [scope, setScope] = useState<'batch' | 'all'>('batch');
  const [searchQuery, setSearchQuery] = useState('');
  const [spotlightIdx, setSpotlightIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(settings.soundEnabled);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync initial scope: if batchWinners is empty, default to allRoundWinners
  useEffect(() => {
    if (batchWinners.length === 0 && allRoundWinners.length > 0) {
      setScope('all');
    } else {
      setScope('batch');
    }
    setSpotlightIdx(0);
  }, [batchWinners, allRoundWinners]);

  const activeList = useMemo(() => {
    const list = scope === 'batch' && batchWinners.length > 0 ? batchWinners : allRoundWinners;
    // Filter active (non-voided) winners first
    return list.filter((w) => w.status === 'active');
  }, [scope, batchWinners, allRoundWinners]);

  const filteredWinners = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return activeList;
    return activeList.filter(
      (w) =>
        w.participant.name.toLowerCase().includes(q) ||
        (w.participant.ticketNumber?.toLowerCase().includes(q) ?? false) ||
        (w.participant.department?.toLowerCase().includes(q) ?? false) ||
        String(w.slotNumber).includes(q)
    );
  }, [activeList, searchQuery]);

  // Keep spotlightIdx within bounds
  useEffect(() => {
    if (spotlightIdx >= activeList.length && activeList.length > 0) {
      setSpotlightIdx(0);
    }
  }, [activeList.length, spotlightIdx]);

  // Autoplay progression for Spotlight mode
  useEffect(() => {
    if (!isPlaying || viewMode !== 'spotlight') {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
      return;
    }

    autoPlayTimerRef.current = setInterval(() => {
      setSpotlightIdx((prev) => {
        const next = prev + 1;
        if (next >= activeList.length) {
          setIsPlaying(false);
          return prev;
        }
        if (soundEnabled) {
          playTickSound(0.6);
        }
        return next;
      });
    }, 1800);

    return () => {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
      }
    };
  }, [isPlaying, viewMode, activeList.length, soundEnabled]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Escape') {
        onClose();
      } else if (viewMode === 'spotlight') {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          setSpotlightIdx((prev) => Math.min(activeList.length - 1, prev + 1));
          if (soundEnabled) playTickSound(0.6);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          setSpotlightIdx((prev) => Math.max(0, prev - 1));
          if (soundEnabled) playTickSound(0.4);
        } else if (e.code === 'Space') {
          e.preventDefault();
          setIsPlaying((p) => !p);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, viewMode, activeList.length, soundEnabled, onClose]);

  const fireCelebration = () => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    try {
      confetti({
        particleCount: 80,
        spread: 85,
        origin: { y: 0.5 },
        zIndex: 9999,
        colors: palette.confettiColors,
      });
    } catch {
      // Ignore in headless
    }
    if (soundEnabled) {
      playWinFanfare();
    }
  };

  const handleCopyAll = async () => {
    if (activeList.length === 0) return;
    const text = activeList
      .map((w, i) => {
        const meta = [w.participant.ticketNumber, w.participant.department]
          .filter(Boolean)
          .join(' - ');
        return `${i + 1}. #${String(w.slotNumber).padStart(3, '0')} ${w.participant.name}${
          meta ? ` (${meta})` : ''
        }`;
      })
      .join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleExportCsv = () => {
    const csv = exportWinnersToCsv(activeList, [round]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `raffle-draw-${round.title.replace(/\s+/g, '-').toLowerCase()}-${activeList.length}-winners.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      try {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } catch {
        setIsFullscreen(!isFullscreen);
      }
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  if (!open) return null;

  const currentSpotlight = activeList[spotlightIdx];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="live-draw-modal-title"
      ref={containerRef}
      className={`fixed inset-0 z-50 flex flex-col ${
        viewMode === 'theater' ? 'bg-slate-950 text-white' : 'bg-slate-900/80 backdrop-blur-md'
      }`}
    >
      <div
        className={`flex h-full w-full flex-col overflow-hidden transition-all duration-200 ${
          viewMode === 'theater'
            ? 'p-4 sm:p-8'
            : 'mx-auto max-w-7xl p-3 sm:p-6 sm:py-8'
        }`}
      >
        {/* Main Card Shell */}
        <div
          className={`flex h-full w-full flex-col overflow-hidden rounded-2xl border shadow-2xl transition-colors ${
            viewMode === 'theater'
              ? 'border-slate-800 bg-slate-900/90 text-white'
              : 'border-slate-200 bg-white text-slate-900'
          }`}
        >
          {/* Header Bar */}
          <header
            className={`flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 ${
              viewMode === 'theater'
                ? 'border-slate-800 bg-slate-950/70'
                : 'border-slate-100 bg-slate-50/70'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold text-white shadow-sm ${palette.primaryBg}`}
              >
                <Trophy className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={`font-semibold uppercase tracking-wider ${
                      viewMode === 'theater' ? 'text-amber-400' : palette.primaryText
                    }`}
                  >
                    Live Draw Showcase
                  </span>
                  <span className="text-slate-400">·</span>
                  <span
                    className={`font-medium ${
                      viewMode === 'theater' ? 'text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    Round {round.order}: {round.prize}
                  </span>
                </div>
                <h2
                  id="live-draw-modal-title"
                  className={`text-lg font-bold sm:text-xl ${
                    viewMode === 'theater' ? 'text-white' : 'text-slate-950'
                  }`}
                >
                  {round.title} ·{' '}
                  <span className="tabular-nums font-mono text-emerald-500">
                    {activeList.length}
                  </span>{' '}
                  {activeList.length === 1 ? 'Winner' : 'Winners Revealed'}
                </h2>
              </div>
            </div>

            {/* Right Action Tools */}
            <div className="flex flex-wrap items-center gap-2">
              {/* View Switcher */}
              <div
                role="group"
                aria-label="View Mode"
                className={`flex items-center rounded-lg p-1 ${
                  viewMode === 'theater' ? 'bg-slate-800' : 'bg-slate-200/80'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                    viewMode === 'grid'
                      ? 'bg-white text-slate-950 shadow-sm'
                      : viewMode === 'theater'
                      ? 'text-slate-400 hover:text-white'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Show All ({activeList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('spotlight')}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                    viewMode === 'spotlight'
                      ? 'bg-white text-slate-950 shadow-sm'
                      : viewMode === 'theater'
                      ? 'text-slate-400 hover:text-white'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  <Eye className="h-3.5 w-3.5" />
                  Spotlight
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('theater')}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                    viewMode === 'theater'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  Theater
                </button>
              </div>

              {/* Confetti Trigger */}
              <button
                type="button"
                onClick={fireCelebration}
                aria-label="Celebrate winners"
                title="Celebrate winners"
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors ${
                  viewMode === 'theater'
                    ? 'border-slate-700 bg-slate-800 text-amber-300 hover:bg-slate-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Celebrate
              </button>

              {/* Sound Toggle */}
              <button
                type="button"
                onClick={() => setSoundEnabled((v) => !v)}
                aria-label={soundEnabled ? 'Mute sound' : 'Enable sound'}
                className={`inline-flex h-9 items-center justify-center rounded-lg border px-2.5 text-xs transition-colors ${
                  viewMode === 'theater'
                    ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {soundEnabled ? (
                  <Volume2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <VolumeX className="h-4 w-4 text-slate-400" />
                )}
              </button>

              {/* Fullscreen Toggle */}
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                className={`inline-flex h-9 items-center justify-center rounded-lg border px-2.5 text-xs transition-colors ${
                  viewMode === 'theater'
                    ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close Live Draw Viewer"
                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
                  viewMode === 'theater'
                    ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* Subheader / Toolbar for Grid mode */}
          {viewMode === 'grid' && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-white px-5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                {/* Scope selector if batch != all */}
                {batchWinners.length > 0 &&
                  allRoundWinners.length > batchWinners.length && (
                    <div className="flex items-center rounded-md bg-slate-100 p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setScope('batch')}
                        className={`rounded px-2.5 py-1 font-medium transition-colors ${
                          scope === 'batch'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Latest Batch ({batchWinners.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setScope('all')}
                        className={`rounded px-2.5 py-1 font-medium transition-colors ${
                          scope === 'all'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        All Round Winners ({allRoundWinners.length})
                      </button>
                    </div>
                  )}

                {/* Instant Filter / Search Bar */}
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    placeholder="Quick search winner..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 w-44 rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none sm:w-56"
                  />
                </div>

                {/* Density Switcher */}
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <button
                    type="button"
                    onClick={() => setDensity('normal')}
                    title="Comfortable Cards"
                    className={`rounded p-1.5 ${
                      density === 'normal'
                        ? 'bg-slate-100 text-slate-900 font-semibold'
                        : 'text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDensity('dense')}
                    title="Compact Wall (High Density)"
                    className={`rounded p-1.5 ${
                      density === 'dense'
                        ? 'bg-slate-100 text-slate-900 font-semibold'
                        : 'text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    <Grid3X3 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Utility Exports */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyAll}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-slate-500" />
                      <span>Copy List</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Download className="h-3.5 w-3.5 text-slate-500" />
                  <span>Download CSV</span>
                </button>
              </div>
            </div>
          )}

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {/* VIEW 1: COMPLETE GRID / BOARD ("Show Everything") */}
            {viewMode === 'grid' && (
              <div className="space-y-4">
                {filteredWinners.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-sm font-medium text-slate-500">
                      No winners found matching &ldquo;{searchQuery}&rdquo;.
                    </p>
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="mt-2 text-xs font-semibold text-slate-700 underline"
                    >
                      Clear search
                    </button>
                  </div>
                ) : (
                  <div
                    className={`grid gap-2.5 ${
                      density === 'dense'
                        ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                        : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
                    }`}
                  >
                    {filteredWinners.map((winner, index) => (
                      <div
                        key={winner.id}
                        className={`group relative flex flex-col justify-between rounded-xl border transition-all hover:border-slate-300 hover:shadow-md ${
                          density === 'dense' ? 'p-2.5' : 'p-3.5'
                        } border-slate-200 bg-white`}
                      >
                        <div>
                          {/* Card Top: Slot Number Badge */}
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-0.5 font-mono text-xs font-bold tabular-nums ${
                                density === 'dense' ? 'text-[11px]' : 'text-xs'
                              } bg-slate-100 text-slate-700`}
                            >
                              #{String(winner.slotNumber).padStart(3, '0')}
                            </span>
                            <span className="text-[11px] font-medium text-slate-400">
                              #{index + 1}
                            </span>
                          </div>

                          {/* Winner Name: Prominent & High Contrast */}
                          <p
                            className={`mt-2 font-display font-bold tracking-tight text-slate-950 truncate ${
                              density === 'dense' ? 'text-sm' : 'text-base sm:text-lg'
                            }`}
                            title={winner.participant.name}
                          >
                            {winner.participant.name}
                          </p>

                          {/* Ticket & Department Metadata */}
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                            {settings.showTicketNumber && winner.participant.ticketNumber && (
                              <span className="font-mono text-[11px] font-medium text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                {winner.participant.ticketNumber}
                              </span>
                            )}
                            {settings.showDepartment && winner.participant.department && (
                              <span className="truncate text-[11px]">
                                {winner.participant.department}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Card Footer: Quick Redraw Action */}
                        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                          <span className="text-[10px] uppercase font-semibold tracking-wider text-emerald-600">
                            Verified Winner
                          </span>
                          <button
                            type="button"
                            onClick={() => onRedrawWinner(winner.id)}
                            className="rounded px-1.5 py-0.5 text-[11px] font-medium text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                          >
                            Redraw
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* VIEW 2: SPOTLIGHT REVEAL / EMCEE MODE */}
            {viewMode === 'spotlight' && (
              <div className="flex h-full min-h-[420px] flex-col items-center justify-center text-center">
                {currentSpotlight ? (
                  <div className="w-full max-w-2xl space-y-6">
                    {/* Position Indicator */}
                    <div className="flex items-center justify-center gap-2">
                      <span className="rounded-full bg-emerald-100 px-3 py-1 font-mono text-xs font-bold text-emerald-800">
                        Winner #{currentSpotlight.slotNumber} of {round.winnerCount}
                      </span>
                      <span className="text-xs text-slate-400">
                        ({spotlightIdx + 1} of {activeList.length} in this batch)
                      </span>
                    </div>

                    {/* Spotlight Hero Card */}
                    <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/80 p-8 shadow-xl sm:p-12">
                      <p className="font-mono text-sm uppercase tracking-widest text-slate-400">
                        {round.prize}
                      </p>

                      <h3 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                        {currentSpotlight.participant.name}
                      </h3>

                      <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-base text-slate-600">
                        {settings.showTicketNumber && currentSpotlight.participant.ticketNumber && (
                          <span className="rounded-lg border border-slate-200 bg-white px-3 py-1 font-mono font-bold text-slate-800 shadow-xs">
                            {currentSpotlight.participant.ticketNumber}
                          </span>
                        )}
                        {settings.showDepartment && currentSpotlight.participant.department && (
                          <span className="font-medium">
                            {currentSpotlight.participant.department}
                          </span>
                        )}
                      </div>

                      <div className="mt-8 flex items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => onRedrawWinner(currentSpotlight.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Redraw This Slot
                        </button>
                      </div>
                    </div>

                    {/* Navigation Carousel Controls */}
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        disabled={spotlightIdx === 0}
                        onClick={() => {
                          setSpotlightIdx((p) => Math.max(0, p - 1));
                          if (soundEnabled) playTickSound(0.4);
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                      >
                        ← Previous
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsPlaying((p) => !p)}
                        className={`inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-bold text-white shadow-sm transition-colors ${
                          isPlaying
                            ? 'bg-amber-600 hover:bg-amber-700'
                            : `${palette.primaryBg} ${palette.primaryHover}`
                        }`}
                      >
                        {isPlaying ? (
                          <>
                            <Pause className="h-4 w-4 fill-current" />
                            Pause Auto-Play
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 fill-current" />
                            Auto-Play Reveal
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        disabled={spotlightIdx === activeList.length - 1}
                        onClick={() => {
                          setSpotlightIdx((p) => Math.min(activeList.length - 1, p + 1));
                          if (soundEnabled) playTickSound(0.6);
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                      >
                        Next →
                      </button>
                    </div>

                    <p className="text-xs text-slate-400">
                      Tip: Use Left / Right arrow keys to navigate, Spacebar to toggle Auto-Play.
                    </p>
                  </div>
                ) : (
                  <p className="text-slate-500">No winners to spotlight.</p>
                )}
              </div>
            )}

            {/* VIEW 3: THEATER / PROJECTOR WALL */}
            {viewMode === 'theater' && (
              <div className="h-full space-y-6">
                <div className="text-center">
                  <h3 className="font-display text-3xl font-extrabold tracking-tight text-amber-300 sm:text-4xl">
                    {round.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-400">
                    {round.prize} · All {activeList.length} Official Winners
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {activeList.map((winner) => (
                    <div
                      key={winner.id}
                      className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 shadow-inner hover:border-amber-400/50 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-amber-400">
                          #{String(winner.slotNumber).padStart(3, '0')}
                        </span>
                        {winner.participant.ticketNumber && (
                          <span className="font-mono text-[10px] text-slate-400">
                            {winner.participant.ticketNumber}
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 truncate font-display text-base font-bold text-white">
                        {winner.participant.name}
                      </p>
                      {winner.participant.department && (
                        <p className="mt-0.5 truncate text-[11px] text-slate-400">
                          {winner.participant.department}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer Bar */}
          <footer
            className={`flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 text-xs ${
              viewMode === 'theater'
                ? 'border-slate-800 bg-slate-950/70 text-slate-400'
                : 'border-slate-100 bg-slate-50/70 text-slate-500'
            }`}
          >
            <div>
              <span>Official Live Draw Record</span>
              <span className="mx-2">·</span>
              <span>{settings.eventTitle}</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className={`rounded-lg px-4 py-1.5 text-xs font-semibold ${
                  viewMode === 'theater'
                    ? 'bg-slate-800 text-white hover:bg-slate-700'
                    : 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                }`}
              >
                Back to Stage
              </button>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
};
