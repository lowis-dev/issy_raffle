import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Check,
  Copy,
  Gift,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import type { WinnerRecord } from '../types/raffle';
import type { ThemePalette } from '../utils/theme';

export interface WinnerCelebrationModalProps {
  open: boolean;
  winner: WinnerRecord | null;
  onClose: () => void;
  onDrawNext?: () => void;
  onRemoveWinner?: (winner: WinnerRecord) => void;
  onRedraw?: (winnerId: string) => void;
  palette: ThemePalette;
  hasMoreToDraw?: boolean;
}

export const WinnerCelebrationModal: React.FC<WinnerCelebrationModalProps> = ({
  open,
  winner,
  onClose,
  onDrawNext,
  onRemoveWinner,
  onRedraw,
  palette,
  hasMoreToDraw = false,
}) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open && winner) {
      try {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.5 },
          zIndex: 9999,
          colors: palette.confettiColors,
        });
      } catch {
        // Ignore in headless
      }
    }
  }, [open, winner, palette.confettiColors]);

  if (!open || !winner) return null;

  const handleCopy = () => {
    const text = `🎉 RAFFLE WINNER 🎉\nWinner: ${winner.participant.name}\nPrize: ${winner.prize}\nRound: ${winner.roundTitle}\nSlot: #${winner.slotNumber}\nTicket: ${winner.participant.ticketNumber || 'N/A'}\nDepartment: ${winner.participant.department || 'N/A'}`;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Winner Celebration"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 text-center shadow-2xl scale-100 transition-all">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Decorative Badge */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-200 text-amber-950 shadow-lg ring-8 ring-amber-50">
          <Trophy className="h-8 w-8" />
        </div>

        {/* Header Text */}
        <div className="mt-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900 border border-amber-200">
            <Sparkles className="h-3.5 w-3.5 text-amber-600" />
            WE HAVE A WINNER!
          </span>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            {winner.roundTitle} · Slot #{String(winner.slotNumber).padStart(3, '0')}
          </p>
        </div>

        {/* Winner Highlight Name */}
        <h2 className="mt-2 font-display text-3xl sm:text-5xl font-black tracking-tight text-slate-950 break-words">
          {winner.participant.name}
        </h2>

        {/* Prize Ribbon */}
        <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 border border-slate-200">
          <Gift className="h-4 w-4 text-amber-600" />
          <span className="font-bold text-slate-800 text-sm sm:text-base">
            {winner.prize}
          </span>
        </div>

        {/* Participant Details */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs sm:text-sm text-slate-600">
          {winner.participant.ticketNumber && (
            <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
              Ticket: {winner.participant.ticketNumber}
            </span>
          )}
          {winner.participant.department && (
            <span className="bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 font-medium">
              Dept: {winner.participant.department}
            </span>
          )}
        </div>

        {/* Actions Grid */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          {hasMoreToDraw && onDrawNext && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onDrawNext();
              }}
              className={`w-full sm:w-auto inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-sm font-bold text-white shadow-md transition-all ${palette.primaryBg} ${palette.primaryHover}`}
            >
              <Play className="h-4 w-4 fill-current" />
              Draw Next Winner
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className="w-full sm:w-auto inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied!' : 'Copy Winner'}
          </button>

          {onRedraw && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onRedraw(winner.id);
              }}
              className="w-full sm:w-auto inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              Redraw
            </button>
          )}
        </div>

        {/* Footer Close */}
        <div className="mt-4 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-slate-400 hover:text-slate-700"
          >
            Close Dialog (or press Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
