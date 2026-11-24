import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertCircle,
  Check,
  FileSpreadsheet,
  Gift,
  Plus,
  Sparkles,
  Upload,
  Users,
  X,
} from 'lucide-react';
import type { Participant, RaffleRound } from '../types/raffle';
import { buildParsedTableAndMapping, mapTableToParticipants, parseDelimitedText } from '../utils/raffleEngine';
import type { ThemePalette } from '../utils/theme';

export interface BonusRoundModalProps {
  open: boolean;
  onClose: () => void;
  existingRoundCount: number;
  editingRound?: RaffleRound | null;
  onSaveBonusRound: (round: RaffleRound, options: { startImmediately: boolean }) => void;
  palette: ThemePalette;
}

export const BonusRoundModal: React.FC<BonusRoundModalProps> = ({
  open,
  onClose,
  existingRoundCount,
  editingRound,
  onSaveBonusRound,
  palette,
}) => {
  const [title, setTitle] = useState('');
  const [prize, setPrize] = useState('');
  const [winnerCount, setWinnerCount] = useState<number>(3);
  const [rawText, setRawText] = useState('');
  const [parsedParticipants, setParsedParticipants] = useState<Participant[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);

  // Initialize or reset when modal opens or editingRound changes
  useEffect(() => {
    if (!open) return;

    if (editingRound) {
      setTitle(editingRound.title);
      setPrize(editingRound.prize);
      setWinnerCount(editingRound.winnerCount);
      const existingNames = (editingRound.bonusPool ?? [])
        .map((p) => {
          const parts = [p.name, p.department, p.ticketNumber].filter(Boolean);
          return parts.join(', ');
        })
        .join('\n');
      setRawText(existingNames);
      setParsedParticipants(editingRound.bonusPool ?? []);
    } else {
      const nextOrder = existingRoundCount + 1;
      setTitle(`Bonus Draw ${nextOrder}`);
      setPrize('Surprise Bonus Prize');
      setWinnerCount(3);
      setRawText('');
      setParsedParticipants([]);
    }
    setFileError(null);
  }, [open, editingRound, existingRoundCount]);

  // Parse text into participants whenever rawText changes
  useEffect(() => {
    const text = rawText.trim();
    if (!text) {
      setParsedParticipants([]);
      return;
    }

    const rows = parseDelimitedText(text);
    if (rows.length === 0) {
      setParsedParticipants([]);
      return;
    }

    const built = buildParsedTableAndMapping(rows);
    const mapped = mapTableToParticipants(built.table, built.mapping, 'Bonus Pool');
    setParsedParticipants(mapped);
  }, [rawText]);

  const duplicateCount = useMemo(() => {
    const seen = new Set<string>();
    let dupes = 0;
    for (const p of parsedParticipants) {
      const norm = p.name.trim().toLowerCase();
      if (seen.has(norm)) {
        dupes++;
      } else {
        seen.add(norm);
      }
    }
    return dupes;
  }, [parsedParticipants]);

  const handleDeduplicate = () => {
    const seen = new Set<string>();
    const unique: Participant[] = [];
    for (const p of parsedParticipants) {
      const norm = p.name.trim().toLowerCase();
      if (!seen.has(norm)) {
        seen.add(norm);
        unique.push(p);
      }
    }
    setParsedParticipants(unique);
    setRawText(
      unique
        .map((p) => [p.name, p.department, p.ticketNumber].filter(Boolean).join(', '))
        .join('\n')
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(null);

    const reader = new FileReader();
    const isExcel =
      file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (isExcel) {
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const csvText = XLSX.utils.sheet_to_csv(firstSheet);
          setRawText((prev) => (prev ? `${prev}\n${csvText}` : csvText));
        } catch {
          setFileError('Failed to parse Excel file. Please paste names directly.');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        setRawText((prev) => (prev ? `${prev}\n${text}` : text));
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  const handleLoadSampleNames = () => {
    const sampleNames = [
      'John Mark Reyes, Sales, BNS-01',
      'Camille Santos, Marketing, BNS-02',
      'Angelo Garcia, IT Operations, BNS-03',
      'Patricia Cruz, Finance, BNS-04',
      'Kenneth Bautista, Logistics, BNS-05',
      'Stephanie Tan, HR, BNS-06',
      'Christian Lopez, Design, BNS-07',
      'Rochelle Dizon, Support, BNS-08',
      'Jericho Morales, Engineering, BNS-09',
      'Bea Alonzo, Executive Office, BNS-10',
    ].join('\n');
    setRawText(sampleNames);
  };

  const handleSave = (startImmediately: boolean) => {
    if (!title.trim()) return;
    if (winnerCount < 1) return;
    if (parsedParticipants.length === 0) return;

    const roundId = editingRound ? editingRound.id : `bonus-${Date.now()}`;
    const roundOrder = editingRound ? editingRound.order : existingRoundCount + 1;

    const newRound: RaffleRound = {
      id: roundId,
      order: roundOrder,
      title: title.trim(),
      prize: prize.trim() || 'Bonus Prize',
      winnerCount: Math.min(winnerCount, parsedParticipants.length),
      defaultBatchSize: Math.min(winnerCount, Math.min(5, parsedParticipants.length)),
      isBonusRound: true,
      bonusPool: parsedParticipants,
    };

    onSaveBonusRound(newRound, { startImmediately });
    onClose();
  };

  if (!open) return null;

  const hasEnoughParticipants = parsedParticipants.length >= winnerCount;
  const canSubmit = title.trim().length > 0 && winnerCount >= 1 && parsedParticipants.length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bonus-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-xs"
    >
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
              <Gift className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                  Special Feature
                </span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs font-semibold text-slate-500">Dedicated Pool</span>
              </div>
              <h2 id="bonus-modal-title" className="text-lg font-bold text-slate-950 sm:text-xl">
                {editingRound ? 'Edit Bonus Round' : 'Create Bonus Round'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Form Body */}
        <div className="max-h-[75vh] space-y-5 overflow-y-auto p-6 text-left">
          {/* Info callout */}
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
            <Sparkles className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Isolated Participant Pool:</span> Names entered here will only be drawn in this Bonus Round. Your Main Raffle Pool remains untouched and safe.
            </div>
          </div>

          {/* Round Title & Prize */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="bonus-title" className="block text-xs font-bold text-slate-800">
                Bonus Round Title
              </label>
              <input
                id="bonus-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Bonus Draw - Cash Surge"
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 focus:border-slate-400 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="bonus-prize" className="block text-xs font-bold text-slate-800">
                Prize Description
              </label>
              <input
                id="bonus-prize"
                type="text"
                value={prize}
                onChange={(e) => setPrize(e.target.value)}
                placeholder="e.g. ₱5,000 Cash / Mystery Gift"
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 focus:border-slate-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Number of Winners */}
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="bonus-winner-count" className="block text-xs font-bold text-slate-800">
                How many winners in this bonus round?
              </label>
              <span className="font-mono text-xs font-semibold text-slate-500">
                {winnerCount} {winnerCount === 1 ? 'Winner' : 'Winners'}
              </span>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {[1, 3, 5, 10, 20].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setWinnerCount(num)}
                  className={`rounded-lg px-3.5 py-1.5 font-mono text-xs font-bold transition-all ${
                    winnerCount === num
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {num} {num === 1 ? 'Winner' : 'Winners'}
                </button>
              ))}

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400">Custom:</span>
                <input
                  id="bonus-winner-count"
                  type="number"
                  min="1"
                  max="1000"
                  value={winnerCount}
                  onChange={(e) => setWinnerCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="h-8 w-20 rounded-lg border border-slate-200 bg-white px-2 text-center font-mono text-xs font-bold text-slate-900 focus:border-slate-400 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Participant Names Input Area */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-600" />
                <label htmlFor="bonus-names" className="text-xs font-bold text-slate-800">
                  Input Names for this Bonus Round
                </label>
              </div>

              <div className="flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
                  <Upload className="h-3 w-3 text-slate-500" />
                  <span>Upload File</span>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleLoadSampleNames}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Paste 10 Samples
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              Type or paste participant names (one per line, or comma-separated: <span className="font-mono text-slate-700">Name, Department, Ticket</span>).
            </p>

            <textarea
              id="bonus-names"
              rows={6}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={`Juan Dela Cruz\nMaria Santos, Finance, BNS-01\nPedro Penduko, IT, BNS-02\nElena Gomez`}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none"
            />

            {fileError && <p className="text-xs text-rose-600">{fileError}</p>}

            {/* Duplicate names warning & deduplicate button */}
            {duplicateCount > 0 && (
              <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <span className="flex items-center gap-1.5 font-medium">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  {duplicateCount} duplicate {duplicateCount === 1 ? 'name' : 'names'} detected in list.
                </span>
                <button
                  type="button"
                  onClick={handleDeduplicate}
                  className="rounded-md bg-amber-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-amber-700 transition-colors shadow-2xs"
                >
                  Remove Duplicates
                </button>
              </div>
            )}

            {/* Validation / Entry counter status */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 font-mono font-bold tabular-nums ${
                    parsedParticipants.length > 0
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {parsedParticipants.length > 0 && <Check className="h-3 w-3 text-emerald-600" />}
                  {parsedParticipants.length.toLocaleString()} Entries Ready
                </span>

                {parsedParticipants.length > 0 && !hasEnoughParticipants && (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-amber-700">
                    <AlertCircle className="h-3 w-3" />
                    Enter at least {winnerCount} names to draw {winnerCount} winners.
                  </span>
                )}
              </div>

              {rawText && (
                <button
                  type="button"
                  onClick={() => setRawText('')}
                  className="text-xs text-slate-400 hover:text-slate-600 underline"
                >
                  Clear list
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => handleSave(false)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100 disabled:opacity-40"
            >
              Add to Draw Sequence
            </button>

            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => handleSave(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-600 disabled:opacity-40 transition-colors"
            >
              <Gift className="h-3.5 w-3.5" />
              Start Bonus Draw Now
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
