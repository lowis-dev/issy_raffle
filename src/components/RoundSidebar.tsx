import React from 'react';
import { CheckCircle2, Circle, SlidersHorizontal } from 'lucide-react';
import type { DataSourceInfo, RaffleRound, WinnerRecord } from '../types/raffle';
import { getRoundProgress } from '../utils/raffleEngine';
import type { ThemePalette } from '../utils/theme';

interface RoundSidebarProps {
  rounds: RaffleRound[];
  winners: WinnerRecord[];
  activeRoundId: string;
  remainingPoolCount: number;
  removeWinnerFromPool: boolean;
  dataSource: DataSourceInfo;
  palette: ThemePalette;
  onSelectRound: (roundId: string) => void;
  onOpenCustomize: () => void;
}

export const RoundSidebar: React.FC<RoundSidebarProps> = ({
  rounds,
  winners,
  activeRoundId,
  remainingPoolCount,
  removeWinnerFromPool,
  dataSource,
  palette,
  onSelectRound,
  onOpenCustomize,
}) => {
  const progressList = getRoundProgress(rounds, winners);
  const totalTarget = progressList.reduce((acc, item) => acc + item.round.winnerCount, 0);
  const totalDrawn = progressList.reduce((acc, item) => acc + item.drawn, 0);

  return (
    <aside className="no-print flex w-full flex-col border-b border-slate-200 bg-white lg:w-[280px] lg:shrink-0 lg:border-b-0 lg:border-r">
      {/* Compact Mobile Summary & Round Switcher (<lg) */}
      <div className="flex flex-col gap-3 px-4 py-3.5 lg:hidden">
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-baseline gap-2">
            <span className="text-slate-500">Main Pool:</span>
            <span className="font-mono text-base font-bold text-slate-950 tabular-nums">
              {remainingPoolCount.toLocaleString()}
            </span>
          </div>
          <span className="font-mono text-slate-500 tabular-nums">
            {totalDrawn} / {totalTarget} drawn
          </span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5" role="group" aria-label="Select raffle round">
          {progressList.map(({ round, drawn, isComplete }) => {
            const isSelected = round.id === activeRoundId;
            return (
              <button
                key={round.id}
                type="button"
                onClick={() => onSelectRound(round.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold tabular-nums whitespace-nowrap shrink-0 transition-colors ${
                  isSelected
                    ? `${palette.softBg} ${palette.softBorder} ${palette.softText}`
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                R{round.order}: {drawn}/{round.winnerCount}
                {isComplete ? ' ✓' : ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop Pool Summary Block */}
      <div className="hidden border-b border-slate-200 px-5 py-5 lg:block">
        <p className="text-xs font-medium text-slate-500">Remaining in Main Pool</p>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <span
            data-testid="sidebar-pool-count"
            className="font-mono text-3xl font-bold tracking-tight text-slate-950 tabular-nums"
          >
            {remainingPoolCount.toLocaleString()}
          </span>
          <span className="text-xs font-medium text-slate-500 tabular-nums">
            {totalDrawn.toLocaleString()} / {totalTarget.toLocaleString()} drawn
          </span>
        </div>
        <div className="mt-3 text-xs text-slate-500 leading-relaxed">
          <span className="font-medium text-slate-700">Source:</span>{' '}
          <span className="truncate">{dataSource.label}</span>
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Auto-remove winners:{' '}
          <span className="font-semibold text-slate-800">
            {removeWinnerFromPool ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </div>

      {/* Desktop Draw Sequence Queue */}
      <div className="hidden flex-1 flex-col px-4 py-5 lg:flex">
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-slate-900">Draw Sequence</h2>
          <button
            type="button"
            onClick={onOpenCustomize}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 whitespace-nowrap shrink-0"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            Edit
          </button>
        </div>

        <ol className="space-y-2" aria-label="Raffle draw sequence">
          {progressList.map(({ round, drawn, isComplete }) => {
            const isSelected = round.id === activeRoundId;
            const pct = round.winnerCount > 0 ? Math.min(100, (drawn / round.winnerCount) * 100) : 0;

            return (
              <li key={round.id}>
                <button
                  type="button"
                  onClick={() => onSelectRound(round.id)}
                  aria-current={isSelected ? 'step' : undefined}
                  className={`w-full rounded-lg border px-3.5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 ${
                    palette.ring
                  } ${
                    isSelected
                      ? `${palette.softBg} ${palette.softBorder}`
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <span className="font-mono font-semibold tabular-nums">
                          {String(round.order).padStart(2, '0')}.
                        </span>
                        <span>{isComplete ? 'Completed' : isSelected ? 'Active' : 'Queued'}</span>
                      </div>
                      <p
                        className={`mt-0.5 truncate text-sm font-semibold ${
                          isSelected ? palette.softText : 'text-slate-900'
                        }`}
                      >
                        {round.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{round.prize}</p>
                    </div>
                    <div className="mt-0.5 shrink-0">
                      {isComplete ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                      ) : (
                        <Circle
                          className={`h-4 w-4 ${isSelected ? palette.primaryText : 'text-slate-300'}`}
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-slate-600 tabular-nums">
                    <span className="font-mono font-medium">
                      {drawn} / {round.winnerCount} winners
                    </span>
                    <span className="font-mono text-slate-400">{Math.round(pct)}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isComplete ? 'bg-emerald-600' : palette.barFill
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </aside>
  );
};
