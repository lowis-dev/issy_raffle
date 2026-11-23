import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  Printer,
  RotateCcw,
  Search,
} from 'lucide-react';
import type { RaffleRound, RaffleSettings, WinnerRecord } from '../types/raffle';
import { exportWinnersToCsv } from '../utils/raffleEngine';
import type { ThemePalette } from '../utils/theme';

interface WinnersViewProps {
  rounds: RaffleRound[];
  winners: WinnerRecord[];
  settings: RaffleSettings;
  palette: ThemePalette;
  onToggleClaimed: (winnerId: string) => void;
  onRequestRedraw: (winner: WinnerRecord) => void;
  onGoToDrawStage: () => void;
}

export const WinnersView: React.FC<WinnersViewProps> = ({
  rounds,
  winners,
  settings,
  palette,
  onToggleClaimed,
  onRequestRedraw,
  onGoToDrawStage,
}) => {
  const [selectedRoundFilter, setSelectedRoundFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showVoided, setShowVoided] = useState(false);
  const [copied, setCopied] = useState(false);

  const sortedRounds = useMemo(
    () => [...rounds].sort((a, b) => a.order - b.order),
    [rounds]
  );

  const roundMap = useMemo(() => new Map(rounds.map((r) => [r.id, r])), [rounds]);

  const effectiveRoundFilter =
    selectedRoundFilter === 'all' || rounds.some((r) => r.id === selectedRoundFilter)
      ? selectedRoundFilter
      : 'all';

  const filteredWinners = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return winners
      .filter((w) => (showVoided ? true : w.status === 'active'))
      .filter((w) => (effectiveRoundFilter === 'all' ? true : w.roundId === effectiveRoundFilter))
      .filter((w) => {
        if (!q) return true;
        const round = roundMap.get(w.roundId);
        const title = round?.title ?? w.roundTitle;
        const prize = round?.prize ?? w.prize;
        return (
          w.participant.name.toLowerCase().includes(q) ||
          (w.participant.ticketNumber?.toLowerCase().includes(q) ?? false) ||
          (w.participant.department?.toLowerCase().includes(q) ?? false) ||
          title.toLowerCase().includes(q) ||
          prize.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const orderA = roundMap.get(a.roundId)?.order ?? a.roundOrder;
        const orderB = roundMap.get(b.roundId)?.order ?? b.roundOrder;
        if (orderA !== orderB) return orderA - orderB;
        if (a.slotNumber !== b.slotNumber) return a.slotNumber - b.slotNumber;
        return a.drawnAt.localeCompare(b.drawnAt);
      });
  }, [winners, effectiveRoundFilter, searchQuery, showVoided, roundMap]);

  const activeWinnersTotal = winners.filter((w) => w.status === 'active').length;
  const claimedTotal = winners.filter((w) => w.status === 'active' && w.claimed).length;

  const handleExportCsv = () => {
    const csv = exportWinnersToCsv(filteredWinners, rounds);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `raffle-winners-2026-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = () => {
    const dataRows = filteredWinners.map((w) => {
      const round = roundMap.get(w.roundId);
      return {
        'Round Order': round?.order ?? w.roundOrder,
        'Round Title': round?.title ?? w.roundTitle,
        Prize: round?.prize ?? w.prize,
        'Slot #': w.slotNumber,
        'Winner Name': w.participant.name,
        'Ticket / Entry #': w.participant.ticketNumber ?? '',
        'Branch / Department': w.participant.department ?? '',
        Contact: w.participant.contact ?? '',
        Status: w.status === 'active' ? 'Winner' : 'Voided / Redrawn',
        Claimed: w.claimed ? 'Yes' : 'No',
        'Drawn At': new Date(w.drawnAt).toLocaleString(),
      };
    });
    const sheet = XLSX.utils.json_to_sheet(dataRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'Raffle Winners');
    XLSX.writeFile(wb, `raffle-winners-2026-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleCopyList = async () => {
    const lines = filteredWinners.map((w) => {
      const roundOrder = roundMap.get(w.roundId)?.order ?? w.roundOrder;
      return `Round ${roundOrder} #${w.slotNumber} - ${w.participant.name}${
        w.participant.ticketNumber ? ` (${w.participant.ticketNumber})` : ''
      }${w.participant.department ? ` - ${w.participant.department}` : ''}`;
    });
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked in restricted frame
    }
  };

  return (
    <section aria-label="Winners Master List" className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Winners Master List
          </h1>
          <p className="mt-1 text-sm text-slate-500 tabular-nums">
            {settings.eventTitle} · {activeWinnersTotal.toLocaleString()} official winners ·{' '}
            {claimedTotal.toLocaleString()} claimed
          </p>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyList}
            disabled={filteredWinners.length === 0}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-45 whitespace-nowrap shrink-0"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {copied ? 'Copied' : 'Copy List'}
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            disabled={filteredWinners.length === 0}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-45 whitespace-nowrap shrink-0"
          >
            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
            Print Sheet
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredWinners.length === 0}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-45 whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Export CSV
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={filteredWinners.length === 0}
            className={`inline-flex h-10 items-center gap-1.5 rounded-lg px-4 text-xs font-semibold text-white disabled:opacity-45 whitespace-nowrap shrink-0 ${palette.primaryBg} ${palette.primaryHover}`}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
            Export Excel
          </button>
        </div>
      </div>

      {/* Round Filter Tabs & Search */}
      <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="group"
          aria-label="Filter winners by round"
          className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1"
        >
          <button
            type="button"
            onClick={() => setSelectedRoundFilter('all')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              effectiveRoundFilter === 'all'
                ? 'bg-white text-slate-950 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Rounds ({activeWinnersTotal})
          </button>
          {sortedRounds.map((round) => {
            const count = winners.filter(
              (w) => w.roundId === round.id && w.status === 'active'
            ).length;
            const active = effectiveRoundFilter === round.id;
            return (
              <button
                key={round.id}
                type="button"
                onClick={() => setSelectedRoundFilter(round.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                  active
                    ? 'bg-white text-slate-950 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                R{round.order}: {count}/{round.winnerCount}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-xs text-slate-600 whitespace-nowrap shrink-0">
            <input
              type="checkbox"
              checked={showVoided}
              onChange={(e) => setShowVoided(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300"
            />
            Show redrawn/voided
          </label>
          <div className="relative w-full sm:w-64">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search winner..."
              aria-label="Search winners list"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Winners Table */}
      <div className="rounded-xl border border-slate-200 bg-white">
        {winners.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <h2 className="text-base font-bold text-slate-900">No Winners Drawn Yet</h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Head to the Live Draw Stage to begin Round 1 ({sortedRounds[0]?.winnerCount ?? 150} winners).
            </p>
            <button
              type="button"
              onClick={onGoToDrawStage}
              className={`mt-5 rounded-lg px-5 py-2.5 text-sm font-semibold text-white ${palette.primaryBg} ${palette.primaryHover}`}
            >
              Go to Live Draw Stage
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                <tr>
                  <th className="w-20 px-5 py-3">Claimed</th>
                  <th className="px-4 py-3">Round & Slot</th>
                  <th className="px-4 py-3">Winner Name</th>
                  <th className="px-4 py-3">Ticket / Entry #</th>
                  <th className="px-4 py-3">Branch / Dept</th>
                  <th className="px-4 py-3">Drawn Time</th>
                  <th className="no-print w-24 px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredWinners.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">
                      No winners match your current filter.
                    </td>
                  </tr>
                ) : (
                  filteredWinners.map((w) => {
                    const isVoided = w.status === 'voided';
                    return (
                      <tr
                        key={w.id}
                        className={isVoided ? 'bg-slate-50/70 text-slate-400 line-through' : 'hover:bg-slate-50/70'}
                      >
                        <td className="px-5 py-3">
                          <input
                            type="checkbox"
                            disabled={isVoided}
                            checked={w.claimed}
                            onChange={() => onToggleClaimed(w.id)}
                            aria-label={`Mark ${w.participant.name} prize as claimed`}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                        </td>
                        <td className="px-4 py-3 text-xs tabular-nums">
                          <span className="font-mono font-semibold text-slate-700">
                            R{roundMap.get(w.roundId)?.order ?? w.roundOrder} · #{String(w.slotNumber).padStart(3, '0')}
                          </span>
                          <div className="text-slate-500">{roundMap.get(w.roundId)?.prize ?? w.prize}</div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-950">
                          {w.participant.name}
                          {isVoided && (
                            <span className="ml-2 text-xs font-normal text-rose-600 no-underline">
                              (Voided)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500 tabular-nums">
                          {w.participant.ticketNumber || '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {w.participant.department || '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500 tabular-nums">
                          {new Date(w.drawnAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>
                        <td className="no-print px-5 py-3 text-right">
                          {!isVoided && (
                            <button
                              type="button"
                              onClick={() => onRequestRedraw(w)}
                              aria-label={`Redraw winner ${w.participant.name}`}
                              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap shrink-0"
                            >
                              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                              Redraw
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};
