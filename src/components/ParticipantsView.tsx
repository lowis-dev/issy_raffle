import React, { useMemo, useState } from 'react';
import {
  FileSpreadsheet,
  Filter,
  Plus,
  RotateCcw,
  Search,
  Shuffle,
  Trash2,
  Upload,
} from 'lucide-react';
import type { DataSourceInfo, Participant } from '../types/raffle';
import {
  buildParsedTableAndMapping,
  mapTableToParticipants,
  parseDelimitedText,
} from '../utils/raffleEngine';
import type { ThemePalette } from '../utils/theme';

interface ParticipantsViewProps {
  pool: Participant[];
  totalWinnersCount: number;
  dataSource: DataSourceInfo;
  palette: ThemePalette;
  onOpenDriveModal: (tab?: 'upload' | 'sheets' | 'drive' | 'paste') => void;
  onAddSingleParticipant: (p: { name: string; ticketNumber?: string; department?: string }) => void;
  onRemoveParticipant: (id: string) => void;
  onImportParticipants: (
    participants: Participant[],
    mode: 'replace' | 'append',
    source: { type: 'upload' | 'manual' | 'demo'; label: string }
  ) => void;
  onDeduplicate: () => void;
  onShufflePool: () => void;
  onRequestLoadDemo: () => void;
  onRequestResetDraws: () => void;
}

const PAGE_SIZE = 50;

export const ParticipantsView: React.FC<ParticipantsViewProps> = ({
  pool,
  totalWinnersCount,
  dataSource,
  palette,
  onOpenDriveModal,
  onAddSingleParticipant,
  onRemoveParticipant,
  onImportParticipants,
  onDeduplicate,
  onShufflePool,
  onRequestLoadDemo,
  onRequestResetDraws,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  // Add single entry form
  const [newName, setNewName] = useState('');
  const [newTicket, setNewTicket] = useState('');
  const [newDept, setNewDept] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Paste list drawer state
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteMode, setPasteMode] = useState<'replace' | 'append'>('append');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const filteredPool = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return pool;
    return pool.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.ticketNumber?.toLowerCase().includes(q) ?? false) ||
        (p.department?.toLowerCase().includes(q) ?? false)
    );
  }, [pool, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredPool.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleRows = filteredPool.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newName.trim();
    if (!cleaned) {
      setFormError('Please enter a participant name.');
      return;
    }
    setFormError(null);
    onAddSingleParticipant({
      name: cleaned,
      ticketNumber: newTicket.trim() || undefined,
      department: newDept.trim() || undefined,
    });
    setNewName('');
    setNewTicket('');
    setNewDept('');
  };

  const handlePasteImport = () => {
    const rows = parseDelimitedText(pasteText);
    if (rows.length === 0) {
      setUploadError('Please paste at least one name before importing.');
      return;
    }
    setUploadError(null);
    const built = buildParsedTableAndMapping(rows);
    const imported = mapTableToParticipants(built.table, built.mapping, 'Pasted List');
    if (imported.length === 0) {
      setUploadError('Could not detect any names in the pasted text.');
      return;
    }
    onImportParticipants(imported, pasteMode, {
      type: 'manual',
      label: `Pasted List (${imported.length} entries)`,
    });
    setPasteText('');
    setShowPasteBox(false);
  };

  return (
    <section aria-label="Main Participants List" className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Main Raffle Pool
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Active entries eligible for upcoming draws. Picked winners are automatically removed from this list.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRequestLoadDemo}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            Load 300 Demo Entries
          </button>
          <button
            type="button"
            onClick={onRequestResetDraws}
            disabled={totalWinnersCount === 0}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-45 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Reset Draws & Restore Pool
          </button>
        </div>
      </div>

      {/* Google Drive & Import Sources Strip */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <h2 className="text-base font-bold text-slate-900">
              Import RAFFLE ENTRIES 2026 from Google Drive
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Connect your Google account to open your <span className="font-semibold text-slate-800">RAFFLE ENTRIES 2026</span> spreadsheet, folder, or CSV directly — or upload a local Excel/CSV file.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Current source: <span className="font-medium text-slate-800">{dataSource.label}</span>
              {' · '}
              <span className="font-mono tabular-nums">{pool.length.toLocaleString()}</span> active
              {' · '}
              <span className="font-mono tabular-nums">{totalWinnersCount.toLocaleString()}</span> already drawn
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => onOpenDriveModal('upload')}
              className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white whitespace-nowrap shrink-0 shadow-sm ${palette.primaryBg} ${palette.primaryHover}`}
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              Upload CSV / Excel
            </button>

            <button
              type="button"
              onClick={() => onOpenDriveModal('sheets')}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              Google Sheets Link
            </button>

            <button
              type="button"
              onClick={() => onOpenDriveModal('drive')}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              Google Drive
            </button>

            <button
              type="button"
              onClick={() => setShowPasteBox((v) => !v)}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              Paste Names
            </button>
          </div>
        </div>

        {uploadError && (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-700">
            {uploadError}
          </p>
        )}

        {showPasteBox && (
          <div className="mt-5 border-t border-slate-200 pt-5">
            <label htmlFor="paste-entries-input" className="block text-xs font-semibold text-slate-700">
              Paste one name per line, or copy-paste columns directly from Google Sheets / Excel
            </label>
            <textarea
              id="paste-entries-input"
              rows={5}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={"Maria Santos\nJuan Dela Cruz\nAngela Reyes"}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setPasteMode('append')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                    pasteMode === 'append' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  Add to Main List
                </button>
                <button
                  type="button"
                  onClick={() => setPasteMode('replace')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                    pasteMode === 'replace' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  Replace Main List
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPasteBox(false)}
                  className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePasteImport}
                  className={`rounded-lg px-4 py-2 text-xs font-semibold text-white ${palette.primaryBg} ${palette.primaryHover}`}
                >
                  Import Pasted Entries
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Single Entry Form */}
      <form
        onSubmit={handleAddSubmit}
        className="rounded-xl border border-slate-200 bg-white p-5"
      >
        <h2 className="text-sm font-bold text-slate-900">Add Single Participant</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-12">
          <div className="sm:col-span-5">
            <label htmlFor="add-participant-name" className="sr-only">
              Participant Full Name
            </label>
            <input
              id="add-participant-name"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Participant Full Name *"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="add-participant-ticket" className="sr-only">
              Ticket Number
            </label>
            <input
              id="add-participant-ticket"
              type="text"
              value={newTicket}
              onChange={(e) => setNewTicket(e.target.value)}
              placeholder="Ticket # (optional)"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
            />
          </div>
          <div className="sm:col-span-3">
            <label htmlFor="add-participant-dept" className="sr-only">
              Department or Branch
            </label>
            <input
              id="add-participant-dept"
              type="text"
              value={newDept}
              onChange={(e) => setNewDept(e.target.value)}
              placeholder="Branch / Dept (optional)"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className={`inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-semibold text-white whitespace-nowrap shrink-0 ${palette.primaryBg} ${palette.primaryHover}`}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Entry
            </button>
          </div>
        </div>
        {formError && <p className="mt-2 text-xs text-rose-600">{formError}</p>}
      </form>

      {/* Main List Data Table */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search name, ticket, or branch..."
              aria-label="Search main list"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onDeduplicate}
              disabled={pool.length < 2}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-45 whitespace-nowrap shrink-0"
            >
              <Filter className="h-3.5 w-3.5" aria-hidden="true" />
              Remove Duplicates
            </button>
            <button
              type="button"
              onClick={onShufflePool}
              disabled={pool.length < 2}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-45 whitespace-nowrap shrink-0"
            >
              <Shuffle className="h-3.5 w-3.5" aria-hidden="true" />
              Shuffle List
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
              <tr>
                <th className="w-16 px-5 py-3">#</th>
                <th className="px-4 py-3">Participant Name</th>
                <th className="px-4 py-3">Ticket / Entry #</th>
                <th className="px-4 py-3">Branch / Department</th>
                <th className="w-24 px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-500">
                    {pool.length === 0
                      ? 'No participants remaining in the main pool.'
                      : `No entries match "${searchQuery}".`}
                  </td>
                </tr>
              ) : (
                visibleRows.map((p, idx) => {
                  const rowNum = (currentPage - 1) * PAGE_SIZE + idx + 1;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-2.5 font-mono text-xs text-slate-400 tabular-nums">
                        {rowNum}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-900">{p.name}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-500 tabular-nums">
                        {p.ticketNumber || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-600">
                        {p.department || '—'}
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => onRemoveParticipant(p.id)}
                          aria-label={`Remove ${p.name} from main list`}
                          className="inline-flex items-center justify-center rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
          <span className="tabular-nums">
            Showing{' '}
            <strong className="font-mono text-slate-800">
              {filteredPool.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}–
              {Math.min(currentPage * PAGE_SIZE, filteredPool.length)}
            </strong>{' '}
            of <strong className="font-mono text-slate-800">{filteredPool.length.toLocaleString()}</strong>{' '}
            eligible participants
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-md border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="font-mono tabular-nums">
                Page {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-md border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
