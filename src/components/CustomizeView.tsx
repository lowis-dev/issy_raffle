import React, { useRef } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Download,
  Gift,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  Volume2,
} from 'lucide-react';
import type { RaffleRound, RaffleSettings, ThemeAccent, WinnerRecord } from '../types/raffle';
import { THEME_PALETTES, type ThemePalette } from '../utils/theme';

interface CustomizeViewProps {
  rounds: RaffleRound[];
  winners: WinnerRecord[];
  settings: RaffleSettings;
  palette: ThemePalette;
  onUpdateSettings: (patch: Partial<RaffleSettings>) => void;
  onUpdateRound: (roundId: string, patch: Partial<RaffleRound>) => void;
  onMoveRound: (roundId: string, direction: 'up' | 'down') => void;
  onAddRound: () => void;
  onDeleteRound: (roundId: string) => void;
  onRestoreDefaultSequence: () => void;
  onOpenBonusModal?: () => void;
  onExportBackup?: () => void;
  onImportBackup?: (jsonText: string) => void;
}

const ACCENT_OPTIONS: ThemeAccent[] = ['emerald', 'blue', 'crimson', 'amber', 'slate'];

const SPEED_OPTIONS = [
  { label: 'Fast (1.4s)', ms: 1400 },
  { label: 'Standard (2.6s)', ms: 2600 },
  { label: 'Dramatic (4.2s)', ms: 4200 },
];

export const CustomizeView: React.FC<CustomizeViewProps> = ({
  rounds,
  winners,
  settings,
  palette,
  onUpdateSettings,
  onUpdateRound,
  onMoveRound,
  onAddRound,
  onDeleteRound,
  onRestoreDefaultSequence,
  onOpenBonusModal,
  onExportBackup,
  onImportBackup,
}) => {
  const sortedRounds = [...rounds].sort((a, b) => a.order - b.order);
  const totalWinnersPlanned = sortedRounds.reduce((acc, r) => acc + r.winnerCount, 0);

  return (
    <section aria-label="Customize Raffle Setup" className="space-y-8">
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">
          Customize Raffle Setup
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Adjust the draw order, number of winners per round, pool removal rules, and event branding — no technical setup required.
        </p>
      </div>

      {/* Section 1: Draw Sequence & Rounds */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Draw Order & Winner Counts
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 tabular-nums">
              Default sequence: 150 → 50 → 35 → 25 winners · Currently{' '}
              <strong className="font-mono text-slate-800">{totalWinnersPlanned}</strong> total winners across{' '}
              <strong className="font-mono text-slate-800">{sortedRounds.length}</strong> rounds
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRestoreDefaultSequence}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Restore 150 → 50 → 35 → 25
            </button>
            <button
              type="button"
              onClick={onAddRound}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold text-white whitespace-nowrap shrink-0 ${palette.primaryBg} ${palette.primaryHover}`}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add Round
            </button>
            <button
              type="button"
              onClick={onOpenBonusModal}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 text-xs font-bold text-amber-900 hover:bg-amber-100 whitespace-nowrap shrink-0"
            >
              <Gift className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
              + Bonus Round
            </button>
          </div>
        </div>

        <div className="mt-4 divide-y divide-slate-200">
          {sortedRounds.map((round, index) => {
            const drawnCount = winners.filter(
              (w) => w.roundId === round.id && w.status === 'active'
            ).length;

            return (
              <div
                key={round.id}
                className="grid grid-cols-1 gap-3 py-4 sm:grid-cols-12 sm:items-end"
              >
                <div className="sm:col-span-4">
                  <div className="flex items-center gap-1.5">
                    <label
                      htmlFor={`round-title-${round.id}`}
                      className="block text-xs font-medium text-slate-500"
                    >
                      Round {round.order} Title
                    </label>
                    {round.isBonusRound && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.2 text-[10px] font-bold text-amber-800">
                        Bonus Pool ({round.bonusPool?.length ?? 0})
                      </span>
                    )}
                  </div>
                  <input
                    id={`round-title-${round.id}`}
                    type="text"
                    value={round.title}
                    onChange={(e) => onUpdateRound(round.id, { title: e.target.value })}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label
                    htmlFor={`round-prize-${round.id}`}
                    className="block text-xs font-medium text-slate-500"
                  >
                    Prize Name
                  </label>
                  <input
                    id={`round-prize-${round.id}`}
                    type="text"
                    value={round.prize}
                    onChange={(e) => onUpdateRound(round.id, { prize: e.target.value })}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor={`round-count-${round.id}`}
                    className="block text-xs font-medium text-slate-500"
                  >
                    Winners ({drawnCount} drawn)
                  </label>
                  <input
                    id={`round-count-${round.id}`}
                    type="number"
                    min={Math.max(1, drawnCount)}
                    max={5000}
                    value={round.winnerCount}
                    onChange={(e) => {
                      const val = Math.min(
                        5000,
                        Math.max(Math.max(1, drawnCount), Number(e.target.value) || 1)
                      );
                      onUpdateRound(round.id, {
                        winnerCount: val,
                        defaultBatchSize: Math.min(round.defaultBatchSize, val),
                      });
                    }}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-sm text-slate-900 tabular-nums focus:border-slate-400 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-1">
                  <label
                    htmlFor={`round-batch-${round.id}`}
                    className="block text-xs font-medium text-slate-500"
                  >
                    Batch
                  </label>
                  <input
                    id={`round-batch-${round.id}`}
                    type="number"
                    min={1}
                    max={round.winnerCount}
                    value={round.defaultBatchSize}
                    onChange={(e) => {
                      const val = Math.max(
                        1,
                        Math.min(round.winnerCount, Number(e.target.value) || 1)
                      );
                      onUpdateRound(round.id, { defaultBatchSize: val });
                    }}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 font-mono text-sm text-slate-900 tabular-nums focus:border-slate-400 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-1 sm:col-span-2">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => onMoveRound(round.id, 'up')}
                    aria-label={`Move ${round.title} up`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-35"
                  >
                    <ArrowUp className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={index === sortedRounds.length - 1}
                    onClick={() => onMoveRound(round.id, 'down')}
                    aria-label={`Move ${round.title} down`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-35"
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={sortedRounds.length <= 1 || drawnCount > 0}
                    onClick={() => onDeleteRound(round.id)}
                    aria-label={`Delete ${round.title}`}
                    title={drawnCount > 0 ? 'Reset draws before deleting a round with winners' : 'Delete round'}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-35"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Pool & Fairness Rules */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-bold text-slate-900">
          Pool & Fairness Rules
        </h2>
        <div className="mt-4 divide-y divide-slate-100">
          <label className="flex cursor-pointer items-start justify-between gap-4 py-3.5">
            <div>
              <span className="block text-sm font-semibold text-slate-900">
                Auto-remove picked winner from Main List
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Once a name is drawn as a winner, it is immediately removed from the main pool so they cannot be picked again.
              </span>
            </div>
            <input
              type="checkbox"
              checked={settings.removeWinnerFromPool}
              onChange={(e) => onUpdateSettings({ removeWinnerFromPool: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-slate-300"
            />
          </label>

          <label className="flex cursor-pointer items-start justify-between gap-4 py-3.5">
            <div>
              <span className="block text-sm font-semibold text-slate-900">
                Remove all entries sharing the same winner name
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Useful if participants hold multiple raffle tickets and each person may only win once across all rounds.
              </span>
            </div>
            <input
              type="checkbox"
              disabled={!settings.removeWinnerFromPool}
              checked={settings.removeAllEntriesByName}
              onChange={(e) => onUpdateSettings({ removeAllEntriesByName: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-slate-300 disabled:opacity-40"
            />
          </label>

          <label className="flex cursor-pointer items-start justify-between gap-4 py-3.5">
            <div>
              <span className="block text-sm font-semibold text-slate-900">
                Show ticket / entry number on Live Draw Stage
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Displays each participant's ticket ID beneath their name during reveals.
              </span>
            </div>
            <input
              type="checkbox"
              checked={settings.showTicketNumber}
              onChange={(e) => onUpdateSettings({ showTicketNumber: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-slate-300"
            />
          </label>

          <label className="flex cursor-pointer items-start justify-between gap-4 py-3.5">
            <div>
              <span className="block text-sm font-semibold text-slate-900">
                Show branch or department on Live Draw Stage
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Helpful for company events to distinguish participants with similar names.
              </span>
            </div>
            <input
              type="checkbox"
              checked={settings.showDepartment}
              onChange={(e) => onUpdateSettings({ showDepartment: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-slate-300"
            />
          </label>

          <label className="flex cursor-pointer items-start justify-between gap-4 py-3.5">
            <div>
              <span className="block text-sm font-semibold text-slate-900">
                Voice Announcer (Text-to-Speech)
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Uses speech synthesis to announce each winner's name and prize automatically over the stage sound system.
              </span>
            </div>
            <input
              type="checkbox"
              checked={settings.voiceAnnounceEnabled ?? false}
              onChange={(e) => onUpdateSettings({ voiceAnnounceEnabled: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-slate-300"
            />
          </label>
        </div>
      </div>

      {/* Section 3: Event Branding & Draw Animation */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-bold text-slate-900">
          Event Branding & Draw Animation
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="setting-event-title" className="block text-xs font-semibold text-slate-700">
              Event Title
            </label>
            <input
              id="setting-event-title"
              type="text"
              value={settings.eventTitle}
              onChange={(e) => onUpdateSettings({ eventTitle: e.target.value })}
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="setting-event-subtitle" className="block text-xs font-semibold text-slate-700">
              Event Subtitle
            </label>
            <input
              id="setting-event-subtitle"
              type="text"
              value={settings.eventSubtitle}
              onChange={(e) => onUpdateSettings({ eventSubtitle: e.target.value })}
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
            />
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-700">Theme Accent Color</span>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {ACCENT_OPTIONS.map((accent) => {
                const p = THEME_PALETTES[accent];
                const isSelected = settings.accentTheme === accent;
                return (
                  <button
                    key={accent}
                    type="button"
                    onClick={() => onUpdateSettings({ accentTheme: accent })}
                    aria-pressed={isSelected}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      isSelected
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className="h-3 w-3 rounded-full border border-white/40"
                      style={{ backgroundColor: p.swatch }}
                      aria-hidden="true"
                    />
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-700">Draw Spin Duration</span>
            <div className="mt-2 flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 w-fit">
              {SPEED_OPTIONS.map((opt) => {
                const active = settings.animationDurationMs === opt.ms;
                return (
                  <button
                    key={opt.ms}
                    type="button"
                    onClick={() => onUpdateSettings({ animationDurationMs: opt.ms })}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      active ? 'bg-white text-slate-950 shadow-sm font-semibold' : 'text-slate-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Event Backup & Disaster Recovery */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-bold text-slate-900">
          Event Backup & Disaster Recovery
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Download a complete snapshot of your event setup, eligible entries, bonus rounds, and recorded winners.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onExportBackup}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <Download className="h-4 w-4 text-emerald-600" />
            Download Event Backup (JSON)
          </button>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs">
            <Upload className="h-4 w-4 text-indigo-600" />
            <span>Restore Event from Backup</span>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (evt) => {
                  const text = evt.target?.result as string;
                  if (text && onImportBackup) onImportBackup(text);
                };
                reader.readAsText(file);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </div>
    </section>
  );
};
