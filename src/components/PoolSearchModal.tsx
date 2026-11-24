import React, { useMemo, useState } from 'react';
import { CheckCircle2, Search, Ticket, Users, X, XCircle } from 'lucide-react';
import type { Participant } from '../types/raffle';

export interface PoolSearchModalProps {
  open: boolean;
  onClose: () => void;
  pool: Participant[];
  roundTitle: string;
}

export const PoolSearchModal: React.FC<PoolSearchModalProps> = ({
  open,
  onClose,
  pool,
  roundTitle,
}) => {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return pool.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.ticketNumber?.toLowerCase().includes(q) ?? false) ||
        (p.department?.toLowerCase().includes(q) ?? false)
    );
  }, [pool, query]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search Participant in Pool"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Ticket className="h-5 w-5 text-emerald-600" />
            <div>
              <h3 className="text-base font-bold text-slate-900">Check Ticket / Entry</h3>
              <p className="text-xs text-slate-500">Checking against {pool.length} active entries in {roundTitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search input */}
        <div className="mt-4 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type your name, ticket #, or department..."
            className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        {/* Results List */}
        <div className="mt-4 max-h-[300px] overflow-y-auto space-y-2">
          {query.trim().length > 0 ? (
            results.length > 0 ? (
              results.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/50 p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{p.name}</p>
                    <p className="text-xs text-slate-500">
                      {[p.ticketNumber && `Ticket #${p.ticketNumber}`, p.department]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Eligible in Drum
                  </span>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-slate-500">
                <XCircle className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-sm font-semibold text-slate-700">No matching ticket found</p>
                <p className="text-xs text-slate-400">
                  Double-check spelling or ask the event organizer to check the master entries.
                </p>
              </div>
            )
          ) : (
            <div className="py-8 text-center text-slate-400">
              <Users className="mx-auto h-7 w-7 opacity-40" />
              <p className="mt-1 text-xs">Enter your name or ticket number above to verify</p>
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
