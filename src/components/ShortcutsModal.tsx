import React from 'react';
import { Command, Keyboard, X } from 'lucide-react';

export interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { key: 'Space', desc: 'Start Draw / Pause / Resume sequence' },
  { key: 'F', desc: 'Toggle Stage Fullscreen (Projector Mode)' },
  { key: 'M', desc: 'Toggle Sound Effects (Mute / Unmute)' },
  { key: 'C', desc: 'Trigger Confetti Cannon' },
  { key: 'P', desc: 'Open Audience Pool / Ticket Checker' },
  { key: '?', desc: 'Open Keyboard Shortcuts cheat sheet' },
  { key: 'Esc', desc: 'Exit Fullscreen or close active dialog' },
];

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard Shortcuts"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">Stage Keyboard Shortcuts</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 divide-y divide-slate-100">
          {SHORTCUTS.map((s) => (
            <div key={s.key} className="flex items-center justify-between py-2.5 text-xs">
              <span className="text-slate-600 font-medium">{s.desc}</span>
              <kbd className="rounded-md border border-slate-200 bg-slate-100 px-2 py-1 font-mono font-bold text-slate-800 shadow-2xs">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="mt-5 border-t border-slate-100 pt-3 text-center">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
