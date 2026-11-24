/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { CheckCircle2, X } from 'lucide-react';
import type {
  ActiveTab,
  DataSourceInfo,
  Participant,
  RaffleRound,
  RaffleSettings,
  WinnerRecord,
} from './types/raffle';
import {
  DEFAULT_ROUNDS,
  DEFAULT_SETTINGS,
  createDemoParticipants,
  deduplicateParticipants,
  drawWinnersFromPool,
  getNextIncompleteRoundId,
  redrawSingleWinner,
  secureShuffle,
} from './utils/raffleEngine';
import { THEME_PALETTES } from './utils/theme';
import { googleSignIn, initAuth, logout, setManualAccessToken } from './services/googleAuth';
import { TopBar } from './components/TopBar';
import { RoundSidebar } from './components/RoundSidebar';
import { DrawStage } from './components/DrawStage';
import { ParticipantsView } from './components/ParticipantsView';
import { WinnersView } from './components/WinnersView';
import { CustomizeView } from './components/CustomizeView';
import { DriveImportModal, type ImportModalTab } from './components/DriveImportModal';
import { ConfirmModal } from './components/ConfirmModal';
import { BonusRoundModal } from './components/BonusRoundModal';

const STORAGE_KEY = 'raffle_studio_2026_state_v1';

interface PersistedRaffleState {
  originalPool: Participant[];
  pool: Participant[];
  rounds: RaffleRound[];
  winners: WinnerRecord[];
  settings: RaffleSettings;
  dataSource: DataSourceInfo;
}

function loadInitialState(): PersistedRaffleState {
  const fallbackPool = createDemoParticipants(300);
  const fallback: PersistedRaffleState = {
    originalPool: fallbackPool,
    pool: fallbackPool,
    rounds: DEFAULT_ROUNDS,
    winners: [],
    settings: DEFAULT_SETTINGS,
    dataSource: {
      type: 'demo',
      label: 'Demo Pool (300 Entries)',
      loadedAt: new Date().toISOString(),
      originalCount: fallbackPool.length,
    },
  };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PersistedRaffleState>;
    if (!Array.isArray(parsed.pool) || !Array.isArray(parsed.rounds) || parsed.rounds.length === 0) {
      return fallback;
    }
    return {
      originalPool: Array.isArray(parsed.originalPool) ? parsed.originalPool : parsed.pool,
      pool: parsed.pool,
      rounds: parsed.rounds,
      winners: Array.isArray(parsed.winners) ? parsed.winners : [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
      dataSource: parsed.dataSource ?? fallback.dataSource,
    };
  } catch {
    return fallback;
  }
}

export default function App() {
  const [initial] = useState<PersistedRaffleState>(() => loadInitialState());

  const [originalPool, setOriginalPool] = useState<Participant[]>(initial.originalPool);
  const [pool, setPool] = useState<Participant[]>(initial.pool);
  const [rounds, setRounds] = useState<RaffleRound[]>(initial.rounds);
  const [winners, setWinners] = useState<WinnerRecord[]>(initial.winners);
  const [settings, setSettings] = useState<RaffleSettings>(initial.settings);
  const [dataSource, setDataSource] = useState<DataSourceInfo>(initial.dataSource);

  const [activeTab, setActiveTab] = useState<ActiveTab>('stage');
  const [activeRoundId, setActiveRoundId] = useState<string>(
    () => getNextIncompleteRoundId(initial.rounds, initial.winners) ?? initial.rounds[0].id
  );
  const [latestBatchWinners, setLatestBatchWinners] = useState<WinnerRecord[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Google Workspace Auth state (access token is kept strictly in memory via googleAuth.ts)
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [driveModalOpen, setDriveModalOpen] = useState(false);
  const [driveModalInitialTab, setDriveModalInitialTab] = useState<ImportModalTab>('upload');
  const [bonusModalOpen, setBonusModalOpen] = useState(false);
  const [editingBonusRound, setEditingBonusRound] = useState<RaffleRound | null>(null);

  const openImportModal = (tab: ImportModalTab = 'upload') => {
    setDriveModalInitialTab(tab);
    setDriveModalOpen(true);
  };

  const handleOpenBonusModal = (round?: RaffleRound) => {
    setEditingBonusRound(round ?? null);
    setBonusModalOpen(true);
  };

  const handleSaveBonusRound = (
    round: RaffleRound,
    options: { startImmediately: boolean }
  ) => {
    if (editingBonusRound) {
      setRounds((prev) => prev.map((r) => (r.id === round.id ? round : r)));
      showToast(`Updated ${round.title} with ${round.winnerCount} winners.`);
    } else {
      setRounds((prev) => [...prev, round]);
      if (options.startImmediately) {
        setActiveRoundId(round.id);
        setLatestBatchWinners([]);
        setActiveTab('stage');
        showToast(
          `Started ${round.title} with ${round.winnerCount} winners from ${round.bonusPool?.length ?? 0} entries.`
        );
      } else {
        showToast(`Added ${round.title} to Draw Sequence.`);
      }
    }
  };

  // Toast feedback & Confirm modal
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    destructive?: boolean;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    description: '',
    confirmLabel: 'Confirm',
    onConfirm: () => {},
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 4000);
    return () => clearTimeout(t);
  }, [toastMessage]);

  // Persist raffle state locally (never stores OAuth tokens)
  useEffect(() => {
    try {
      const payload: PersistedRaffleState = {
        originalPool,
        pool,
        rounds,
        winners,
        settings,
        dataSource,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [originalPool, pool, rounds, winners, settings, dataSource]);

  // Initialize Firebase Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setAccessToken(token);
      },
      () => {
        setGoogleUser(null);
        setAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const palette = THEME_PALETTES[settings.accentTheme] ?? THEME_PALETTES.emerald;

  const sortedRounds = useMemo(
    () => [...rounds].sort((a, b) => a.order - b.order),
    [rounds]
  );

  const activeRound = useMemo(
    () => sortedRounds.find((r) => r.id === activeRoundId) ?? sortedRounds[0],
    [sortedRounds, activeRoundId]
  );

  const nextRound = useMemo(() => {
    const idx = sortedRounds.findIndex((r) => r.id === activeRound.id);
    return idx >= 0 && idx + 1 < sortedRounds.length ? sortedRounds[idx + 1] : null;
  }, [sortedRounds, activeRound]);

  const activeRoundWinners = useMemo(
    () => winners.filter((w) => w.roundId === activeRound.id),
    [winners, activeRound.id]
  );

  const handleGoogleSignIn = async (): Promise<string | null> => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      const result = await googleSignIn();
      setGoogleUser(result.user);
      setAccessToken(result.accessToken);
      showToast('Connected to Google Drive.');
      return result.accessToken;
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Google sign-in was cancelled or blocked. Please allow popups and try again.';
      setAuthError(msg);
      return null;
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGoogleSignOut = async () => {
    await logout();
    setGoogleUser(null);
    setAccessToken(null);
    showToast('Disconnected from Google Drive.');
  };

  const handleExecuteDraw = (requestedCount: number): WinnerRecord[] => {
    const isBonus = Boolean(activeRound.isBonusRound);
    const poolToUse = isBonus ? (activeRound.bonusPool ?? []) : pool;

    const result = drawWinnersFromPool({
      pool: poolToUse,
      round: activeRound,
      existingRoundWinners: winners,
      requestedCount,
      removeWinnerFromPool: settings.removeWinnerFromPool,
      removeAllEntriesByName: settings.removeAllEntriesByName,
    });

    if (result.drawnCount === 0) return [];

    if (isBonus) {
      setRounds((prev) =>
        prev.map((r) =>
          r.id === activeRound.id ? { ...r, bonusPool: result.remainingPool } : r
        )
      );
    } else {
      setPool(result.remainingPool);
    }

    setWinners((prev) => [...prev, ...result.newWinners]);
    setLatestBatchWinners(result.newWinners);

    showToast(
      `Drew ${result.drawnCount} ${result.drawnCount === 1 ? 'winner' : 'winners'} for ${
        activeRound.title
      }${isBonus ? ' (Bonus Round)' : settings.removeWinnerFromPool ? ' and removed from Main List' : ''}.`
    );

    return result.newWinners;
  };

  const performRedraw = (winnerId: string) => {
    const winner = winners.find((w) => w.id === winnerId);
    const round = rounds.find((r) => r.id === winner?.roundId) ?? activeRound;
    const isBonus = Boolean(round.isBonusRound);
    const poolToUse = isBonus ? (round.bonusPool ?? []) : pool;

    if (poolToUse.length === 0) {
      showToast(
        `Cannot redraw because the ${isBonus ? 'Bonus' : 'Main'} Pool has no remaining participants.`
      );
      return;
    }

    const res = redrawSingleWinner({
      winnerId,
      winners,
      pool: poolToUse,
      removeWinnerFromPool: settings.removeWinnerFromPool,
      removeAllEntriesByName: settings.removeAllEntriesByName,
    });

    if (!res.replacementWinner) return;

    setWinners(res.updatedWinners);
    if (isBonus) {
      setRounds((prev) =>
        prev.map((r) =>
          r.id === round.id ? { ...r, bonusPool: res.remainingPool } : r
        )
      );
    } else {
      setPool(res.remainingPool);
    }

    setLatestBatchWinners((prev) =>
      prev.map((w) => (w.id === winnerId ? res.replacementWinner! : w))
    );
    showToast(
      `Slot #${res.replacementWinner.slotNumber} redrawn: ${res.replacementWinner.participant.name}`
    );
  };

  const requestRedrawConfirmation = (winner: WinnerRecord) => {
    setConfirmState({
      open: true,
      title: `Redraw Slot #${winner.slotNumber}?`,
      description: `${winner.participant.name} will be marked as voided/no-show and 1 new random winner will be immediately drawn from the remaining Main List.`,
      confirmLabel: 'Redraw Replacement',
      destructive: true,
      onConfirm: () => {
        setConfirmState((prev) => ({ ...prev, open: false }));
        performRedraw(winner.id);
      },
    });
  };

  const handleImportParticipants = (
    imported: Participant[],
    mode: 'replace' | 'append',
    source: {
      type: 'gdrive' | 'upload' | 'manual' | 'demo';
      label: string;
      fileId?: string;
      sheetName?: string;
    }
  ) => {
    if (mode === 'replace') {
      setOriginalPool(imported);
      setPool(imported);
      setWinners([]);
      setLatestBatchWinners([]);
      setActiveRoundId(sortedRounds[0].id);
      setDataSource({
        type: source.type,
        label: source.label,
        fileId: source.fileId,
        sheetName: source.sheetName,
        loadedAt: new Date().toISOString(),
        originalCount: imported.length,
      });
      showToast(`Loaded ${imported.length.toLocaleString()} entries from ${source.label}.`);
    } else {
      setOriginalPool((prev) => [...prev, ...imported]);
      setPool((prev) => [...prev, ...imported]);
      setDataSource((prev) => ({
        ...prev,
        originalCount: prev.originalCount + imported.length,
      }));
      showToast(`Added ${imported.length.toLocaleString()} entries to the Main List.`);
    }
  };

  const handleAddSingleParticipant = (entry: {
    name: string;
    ticketNumber?: string;
    department?: string;
  }) => {
    const nextNum = originalPool.length + 1;
    const participant: Participant = {
      id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: entry.name,
      ticketNumber: entry.ticketNumber || `RF26-${String(nextNum).padStart(4, '0')}`,
      department: entry.department,
      source: 'Manual Entry',
    };
    setOriginalPool((prev) => [participant, ...prev]);
    setPool((prev) => [participant, ...prev]);
    showToast(`Added ${participant.name} to the Main List.`);
  };

  const handleRemoveParticipant = (id: string) => {
    setPool((prev) => prev.filter((p) => p.id !== id));
    setOriginalPool((prev) => prev.filter((p) => p.id !== id));
  };

  const handleDeduplicate = () => {
    const res = deduplicateParticipants(pool);
    if (res.removedCount === 0) {
      showToast('No duplicate names found in the Main List.');
      return;
    }
    const keptIds = new Set(res.unique.map((p) => p.id));
    const droppedIds = new Set(pool.filter((p) => !keptIds.has(p.id)).map((p) => p.id));
    setPool(res.unique);
    setOriginalPool((prev) => prev.filter((p) => !droppedIds.has(p.id)));
    showToast(`Removed ${res.removedCount} duplicate name(s) from the Main List.`);
  };

  const handleShufflePool = () => {
    setPool((prev) => secureShuffle(prev));
    showToast('Main List order shuffled randomly.');
  };

  const handleRequestLoadDemo = () => {
    setConfirmState({
      open: true,
      title: 'Load 300 Demo Entries?',
      description:
        'This replaces the current Main List and clears existing drawn winners so you can test the full 150 -> 50 -> 35 -> 25 draw sequence.',
      confirmLabel: 'Load Demo Pool',
      destructive: false,
      onConfirm: () => {
        setConfirmState((prev) => ({ ...prev, open: false }));
        const demo = createDemoParticipants(300);
        handleImportParticipants(demo, 'replace', {
          type: 'demo',
          label: 'Demo Pool (300 Entries)',
        });
      },
    });
  };

  const handleRequestResetDraws = () => {
    setConfirmState({
      open: true,
      title: 'Reset All Draws & Restore Pool?',
      description: `All ${winners.filter((w) => w.status === 'active').length} drawn winners will be cleared and all ${originalPool.length.toLocaleString()} original entries will be returned to the Main List.`,
      confirmLabel: 'Reset All Draws',
      destructive: true,
      onConfirm: () => {
        setConfirmState((prev) => ({ ...prev, open: false }));
        setPool([...originalPool]);
        setWinners([]);
        setLatestBatchWinners([]);
        setActiveRoundId(sortedRounds[0].id);
        showToast('All draws reset and Main List restored.');
      },
    });
  };

  const handleUpdateRound = (roundId: string, patch: Partial<RaffleRound>) => {
    setRounds((prev) => prev.map((r) => (r.id === roundId ? { ...r, ...patch } : r)));
    if (patch.title !== undefined || patch.prize !== undefined) {
      setWinners((prev) =>
        prev.map((w) =>
          w.roundId === roundId
            ? {
                ...w,
                ...(patch.title !== undefined ? { roundTitle: patch.title } : {}),
                ...(patch.prize !== undefined ? { prize: patch.prize } : {}),
              }
            : w
        )
      );
      setLatestBatchWinners((prev) =>
        prev.map((w) =>
          w.roundId === roundId
            ? {
                ...w,
                ...(patch.title !== undefined ? { roundTitle: patch.title } : {}),
                ...(patch.prize !== undefined ? { prize: patch.prize } : {}),
              }
            : w
        )
      );
    }
  };

  const handleMoveRound = (roundId: string, direction: 'up' | 'down') => {
    const ordered = [...rounds].sort((a, b) => a.order - b.order);
    const idx = ordered.findIndex((r) => r.id === roundId);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || targetIdx < 0 || targetIdx >= ordered.length) return;
    const swapped = [...ordered];
    const temp = swapped[idx];
    swapped[idx] = swapped[targetIdx];
    swapped[targetIdx] = temp;
    const reordered = swapped.map((r, i) => ({ ...r, order: i + 1 }));
    const orderById = new Map(reordered.map((r) => [r.id, r.order]));
    setRounds(reordered);
    setWinners((prev) =>
      prev.map((w) => {
        const nextOrder = orderById.get(w.roundId);
        return nextOrder !== undefined ? { ...w, roundOrder: nextOrder } : w;
      })
    );
    setLatestBatchWinners((prev) =>
      prev.map((w) => {
        const nextOrder = orderById.get(w.roundId);
        return nextOrder !== undefined ? { ...w, roundOrder: nextOrder } : w;
      })
    );
  };

  const handleAddRound = () => {
    const nextOrder = rounds.length + 1;
    const newRound: RaffleRound = {
      id: `round-${Date.now()}`,
      order: nextOrder,
      title: `Round ${nextOrder} — 10 Winners`,
      prize: 'Bonus Prize',
      winnerCount: 10,
      defaultBatchSize: 5,
    };
    setRounds((prev) => [...prev, newRound]);
    showToast(`Added Round ${nextOrder} to the draw sequence.`);
  };

  const handleDeleteRound = (roundId: string) => {
    const remaining = rounds
      .filter((r) => r.id !== roundId)
      .sort((a, b) => a.order - b.order)
      .map((r, i) => ({ ...r, order: i + 1 }));
    if (remaining.length === 0) return;
    const orderById = new Map(remaining.map((r) => [r.id, r.order]));
    setRounds(remaining);
    if (activeRoundId === roundId) {
      setActiveRoundId(remaining[0].id);
    }
    setWinners((prev) =>
      prev
        .filter((w) => w.roundId !== roundId)
        .map((w) => {
          const nextOrder = orderById.get(w.roundId);
          return nextOrder !== undefined ? { ...w, roundOrder: nextOrder } : w;
        })
    );
    setLatestBatchWinners((prev) =>
      prev
        .filter((w) => w.roundId !== roundId)
        .map((w) => {
          const nextOrder = orderById.get(w.roundId);
          return nextOrder !== undefined ? { ...w, roundOrder: nextOrder } : w;
        })
    );
  };

  const handleRestoreDefaultSequence = () => {
    if (winners.length > 0) {
      setConfirmState({
        open: true,
        title: 'Restore Default 150 → 50 → 35 → 25 Sequence?',
        description:
          'Restoring the default draw sequence will also reset current drawn winners and restore your Main List.',
        confirmLabel: 'Restore Default Sequence',
        destructive: true,
        onConfirm: () => {
          setConfirmState((prev) => ({ ...prev, open: false }));
          setRounds(DEFAULT_ROUNDS);
          setWinners([]);
          setLatestBatchWinners([]);
          setPool([...originalPool]);
          setActiveRoundId(DEFAULT_ROUNDS[0].id);
          showToast('Restored default 150 → 50 → 35 → 25 sequence.');
        },
      });
      return;
    }
    setRounds(DEFAULT_ROUNDS);
    setActiveRoundId(DEFAULT_ROUNDS[0].id);
    showToast('Restored default 150 → 50 → 35 → 25 sequence.');
  };

  const handleToggleClaimed = (winnerId: string) => {
    setWinners((prev) =>
      prev.map((w) => (w.id === winnerId ? { ...w, claimed: !w.claimed } : w))
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenDriveModal={() => openImportModal('upload')}
        onOpenBonusModal={() => handleOpenBonusModal()}
        isDriveConnected={Boolean(accessToken)}
        palette={palette}
        mobileMenuOpen={mobileMenuOpen}
        onToggleMobileMenu={() => setMobileMenuOpen((v) => !v)}
      />

      {/* Main Workspace Canvas */}
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col lg:flex-row">
        <RoundSidebar
          rounds={sortedRounds}
          winners={winners}
          activeRoundId={activeRound.id}
          remainingPoolCount={activeRound.isBonusRound ? (activeRound.bonusPool?.length ?? 0) : pool.length}
          removeWinnerFromPool={settings.removeWinnerFromPool}
          dataSource={activeRound.isBonusRound ? { type: 'manual', label: `Bonus Pool (${activeRound.bonusPool?.length ?? 0} entries)`, loadedAt: new Date().toISOString(), originalCount: activeRound.bonusPool?.length ?? 0 } : dataSource}
          palette={palette}
          onSelectRound={(id) => {
            setActiveRoundId(id);
            setActiveTab('stage');
          }}
          onOpenCustomize={() => setActiveTab('customize')}
          onOpenBonusModal={() => handleOpenBonusModal()}
        />

        <main className="flex-1 min-w-0 px-4 py-6 sm:px-8 sm:py-8">
          {toastMessage && (
            <div
              role="status"
              aria-live="polite"
              className="no-print mb-6 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-xs"
            >
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className={`h-4 w-4 shrink-0 ${palette.primaryText}`} aria-hidden="true" />
                <span>{toastMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                aria-label="Dismiss notification"
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {activeTab === 'stage' && (
            <DrawStage
              activeRound={activeRound}
              nextRound={nextRound}
              pool={activeRound.isBonusRound ? (activeRound.bonusPool ?? []) : pool}
              roundWinners={activeRoundWinners}
              latestBatchWinners={latestBatchWinners}
              settings={settings}
              palette={palette}
              onExecuteDraw={handleExecuteDraw}
              onRedrawWinner={(winnerId) => {
                const found = winners.find((w) => w.id === winnerId);
                if (found) requestRedrawConfirmation(found);
              }}
              onSelectRound={(id) => {
                setActiveRoundId(id);
                setLatestBatchWinners([]);
              }}
              onToggleSound={() =>
                setSettings((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }))
              }
              onToggleConfetti={() =>
                setSettings((prev) => ({ ...prev, confettiEnabled: !prev.confettiEnabled }))
              }
              onViewAllWinners={() => setActiveTab('winners')}
              onOpenBonusModal={(round) => handleOpenBonusModal(round)}
            />
          )}

          {activeTab === 'participants' && (
            <ParticipantsView
              pool={pool}
              totalWinnersCount={winners.filter((w) => w.status === 'active').length}
              dataSource={dataSource}
              palette={palette}
              onOpenDriveModal={(tab) => openImportModal(tab || 'upload')}
              onAddSingleParticipant={handleAddSingleParticipant}
              onRemoveParticipant={handleRemoveParticipant}
              onImportParticipants={(list, mode, src) =>
                handleImportParticipants(list, mode, src)
              }
              onDeduplicate={handleDeduplicate}
              onShufflePool={handleShufflePool}
              onRequestLoadDemo={handleRequestLoadDemo}
              onRequestResetDraws={handleRequestResetDraws}
            />
          )}

          {activeTab === 'winners' && (
            <WinnersView
              rounds={sortedRounds}
              winners={winners}
              settings={settings}
              palette={palette}
              onToggleClaimed={handleToggleClaimed}
              onRequestRedraw={requestRedrawConfirmation}
              onGoToDrawStage={() => setActiveTab('stage')}
            />
          )}

          {activeTab === 'customize' && (
            <CustomizeView
              rounds={sortedRounds}
              winners={winners}
              settings={settings}
              palette={palette}
              onUpdateSettings={(patch) => setSettings((prev) => ({ ...prev, ...patch }))}
              onUpdateRound={handleUpdateRound}
              onMoveRound={handleMoveRound}
              onAddRound={handleAddRound}
              onDeleteRound={handleDeleteRound}
              onRestoreDefaultSequence={handleRestoreDefaultSequence}
              onOpenBonusModal={() => handleOpenBonusModal()}
            />
          )}
        </main>
      </div>

      {/* Google Drive & File Importer Modal */}
      <DriveImportModal
        open={driveModalOpen}
        onClose={() => setDriveModalOpen(false)}
        user={googleUser}
        accessToken={accessToken}
        isSigningIn={isSigningIn}
        authError={authError}
        onSignIn={handleGoogleSignIn}
        onSignOut={handleGoogleSignOut}
        onSetManualToken={(token) => {
          const res = setManualAccessToken(token);
          setGoogleUser(res.user);
          setAccessToken(res.accessToken);
          showToast('Applied Google OAuth token.');
        }}
        onImportParticipants={(list, mode, meta) =>
          handleImportParticipants(list, mode, {
            type: meta.type || 'upload',
            label: meta.label,
            fileId: meta.fileId,
            sheetName: meta.sheetName,
          })
        }
        palette={palette}
        initialTab={driveModalInitialTab}
      />

      {/* Bonus Round Creator & Manager Modal */}
      <BonusRoundModal
        open={bonusModalOpen}
        onClose={() => {
          setBonusModalOpen(false);
          setEditingBonusRound(null);
        }}
        existingRoundCount={rounds.length}
        editingRound={editingBonusRound}
        onSaveBonusRound={handleSaveBonusRound}
        palette={palette}
      />

      {/* Reusable Confirmation Modal */}
      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel={confirmState.confirmLabel}
        destructive={confirmState.destructive}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
