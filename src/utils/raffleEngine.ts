import type {
  ColumnMapping,
  ParsedTable,
  Participant,
  RaffleRound,
  RaffleSettings,
  WinnerRecord,
} from '../types/raffle';

export const DEFAULT_ROUNDS: RaffleRound[] = [
  {
    id: 'round-1',
    order: 1,
    title: 'First Draw — 150 Winners',
    prize: 'Consolation & Early Bird Prize Pack',
    winnerCount: 150,
    defaultBatchSize: 10,
  },
  {
    id: 'round-2',
    order: 2,
    title: 'Second Draw — 50 Winners',
    prize: 'Special Tier Prize',
    winnerCount: 50,
    defaultBatchSize: 10,
  },
  {
    id: 'round-3',
    order: 3,
    title: 'Third Draw — 35 Winners',
    prize: 'Major Prize Package',
    winnerCount: 35,
    defaultBatchSize: 5,
  },
  {
    id: 'round-4',
    order: 4,
    title: 'Grand Draw — 25 Winners',
    prize: 'Grand Prize Winner',
    winnerCount: 25,
    defaultBatchSize: 1,
  },
];

export const DEFAULT_SETTINGS: RaffleSettings = {
  eventTitle: 'Raffle Draw 2026',
  eventSubtitle: 'Official Automated Draw Sequence (150 · 50 · 35 · 25)',
  accentTheme: 'emerald',
  removeWinnerFromPool: true,
  removeAllEntriesByName: false,
  animationDurationMs: 2600,
  soundEnabled: true,
  confettiEnabled: true,
  showTicketNumber: true,
  showDepartment: true,
};

/**
 * Cryptographically unbiased random integer in [0, max).
 * Uses rejection sampling over crypto.getRandomValues to avoid modulo bias.
 */
export function secureRandomInt(max: number, rng?: () => number): number {
  if (!Number.isInteger(max) || max <= 0) {
    throw new Error('max must be a positive integer');
  }
  if (max === 1) return 0;

  if (rng) {
    const raw = Math.floor(rng() * max);
    return Math.min(max - 1, Math.max(0, raw));
  }

  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const maxUint32 = 0xffffffff;
    const limit = maxUint32 - ((maxUint32 + 1) % max);
    const buffer = new Uint32Array(1);
    let value = 0;
    do {
      cryptoObj.getRandomValues(buffer);
      value = buffer[0];
    } while (value > limit);
    return value % max;
  }

  return Math.floor(Math.random() * max);
}

/**
 * Cryptographic Fisher-Yates shuffle returning a new shuffled array.
 */
export function secureShuffle<T>(items: readonly T[], rng?: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1, rng);
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export interface DrawBatchInput {
  pool: readonly Participant[];
  round: RaffleRound;
  existingRoundWinners: readonly WinnerRecord[];
  requestedCount: number;
  removeWinnerFromPool: boolean;
  removeAllEntriesByName: boolean;
  nowIso?: string;
  rng?: () => number;
}

export interface DrawBatchResult {
  newWinners: WinnerRecord[];
  remainingPool: Participant[];
  drawnCount: number;
  batchNumber: number;
}

/**
 * Draws random winners for the current round and automatically removes them
 * from the active main pool when removeWinnerFromPool is enabled.
 */
export function drawWinnersFromPool(input: DrawBatchInput): DrawBatchResult {
  const {
    pool,
    round,
    existingRoundWinners,
    requestedCount,
    removeWinnerFromPool,
    removeAllEntriesByName,
    nowIso = new Date().toISOString(),
    rng,
  } = input;

  const activeRoundWinners = existingRoundWinners.filter(
    (w) => w.roundId === round.id && w.status === 'active'
  );
  const slotsLeft = Math.max(0, round.winnerCount - activeRoundWinners.length);
  const targetCount = Math.min(Math.max(0, requestedCount), slotsLeft, pool.length);

  if (targetCount === 0) {
    return {
      newWinners: [],
      remainingPool: [...pool],
      drawnCount: 0,
      batchNumber: 0,
    };
  }

  const maxBatch = existingRoundWinners
    .filter((w) => w.roundId === round.id)
    .reduce((acc, w) => Math.max(acc, w.batchNumber), 0);
  const nextBatchNumber = maxBatch + 1;

  // Find next available slot numbers so redraws/slots remain sequential
  const usedSlots = new Set(activeRoundWinners.map((w) => w.slotNumber));
  const nextSlots: number[] = [];
  for (let s = 1; s <= round.winnerCount && nextSlots.length < targetCount; s++) {
    if (!usedSlots.has(s)) {
      nextSlots.push(s);
    }
  }

  let workingPool = [...pool];
  const newWinners: WinnerRecord[] = [];

  for (let i = 0; i < targetCount; i++) {
    if (workingPool.length === 0) break;

    const pickIndex = secureRandomInt(workingPool.length, rng);
    const chosen = workingPool[pickIndex];

    const winnerId = `win-${round.id}-${nextSlots[i]}-${Date.now()}-${i}-${secureRandomInt(99999, rng)}`;
    newWinners.push({
      id: winnerId,
      participant: chosen,
      roundId: round.id,
      roundOrder: round.order,
      roundTitle: round.title,
      prize: round.prize,
      slotNumber: nextSlots[i],
      batchNumber: nextBatchNumber,
      drawnAt: nowIso,
      claimed: false,
      status: 'active',
    });

    if (removeWinnerFromPool) {
      if (removeAllEntriesByName) {
        const chosenNorm = normalizeName(chosen.name);
        workingPool = workingPool.filter((p) => normalizeName(p.name) !== chosenNorm);
      } else {
        workingPool.splice(pickIndex, 1);
      }
    } else {
      // Prevent selecting the exact same entry twice within the same single batch draw
      workingPool.splice(pickIndex, 1);
    }
  }

  const remainingPool = removeWinnerFromPool ? workingPool : [...pool];

  return {
    newWinners,
    remainingPool,
    drawnCount: newWinners.length,
    batchNumber: nextBatchNumber,
  };
}

export interface RedrawResult {
  updatedWinners: WinnerRecord[];
  replacementWinner: WinnerRecord | null;
  remainingPool: Participant[];
}

/**
 * Marks a specific winner as voided (e.g., absent / no-show) and immediately draws
 * 1 replacement winner from the remaining active pool for the exact same slot.
 */
export function redrawSingleWinner(params: {
  winnerId: string;
  winners: readonly WinnerRecord[];
  pool: readonly Participant[];
  removeWinnerFromPool: boolean;
  removeAllEntriesByName: boolean;
  nowIso?: string;
  rng?: () => number;
  voidReason?: string;
}): RedrawResult {
  const {
    winnerId,
    winners,
    pool,
    removeWinnerFromPool,
    removeAllEntriesByName,
    nowIso = new Date().toISOString(),
    rng,
    voidReason = 'Absent / Redrawn',
  } = params;

  const target = winners.find((w) => w.id === winnerId && w.status === 'active');
  if (!target || pool.length === 0) {
    return {
      updatedWinners: [...winners],
      replacementWinner: null,
      remainingPool: [...pool],
    };
  }

  // Avoid re-picking the voided winner when removeWinnerFromPool is disabled and alternatives exist
  const targetNorm = normalizeName(target.participant.name);
  const eligibleIndices: number[] = [];
  for (let i = 0; i < pool.length; i++) {
    const candidate = pool[i];
    if (candidate.id === target.participant.id) continue;
    if (removeAllEntriesByName && normalizeName(candidate.name) === targetNorm) continue;
    eligibleIndices.push(i);
  }
  const pickIndex =
    eligibleIndices.length > 0
      ? eligibleIndices[secureRandomInt(eligibleIndices.length, rng)]
      : secureRandomInt(pool.length, rng);
  const replacementParticipant = pool[pickIndex];
  const replacementId = `win-redraw-${target.roundId}-${target.slotNumber}-${Date.now()}-${secureRandomInt(99999, rng)}`;

  const replacementWinner: WinnerRecord = {
    id: replacementId,
    participant: replacementParticipant,
    roundId: target.roundId,
    roundOrder: target.roundOrder,
    roundTitle: target.roundTitle,
    prize: target.prize,
    slotNumber: target.slotNumber,
    batchNumber: target.batchNumber,
    drawnAt: nowIso,
    claimed: false,
    status: 'active',
  };

  let remainingPool = [...pool];
  if (removeWinnerFromPool) {
    if (removeAllEntriesByName) {
      const norm = normalizeName(replacementParticipant.name);
      remainingPool = remainingPool.filter((p) => normalizeName(p.name) !== norm);
    } else {
      remainingPool.splice(pickIndex, 1);
    }
  }

  const updatedWinners = winners.map((w) =>
    w.id === winnerId
      ? { ...w, status: 'voided' as const, replacedByWinnerId: replacementId, voidReason }
      : w
  );
  updatedWinners.push(replacementWinner);

  return {
    updatedWinners,
    replacementWinner,
    remainingPool,
  };
}

/**
 * Computes active winner counts per round and identifies the next incomplete round
 * following the configured draw sequence (e.g., 150 -> 50 -> 35 -> 25).
 */
export function getRoundProgress(
  rounds: readonly RaffleRound[],
  winners: readonly WinnerRecord[]
): Array<{
  round: RaffleRound;
  drawn: number;
  remaining: number;
  isComplete: boolean;
}> {
  const sorted = [...rounds].sort((a, b) => a.order - b.order);
  return sorted.map((round) => {
    const drawn = winners.filter((w) => w.roundId === round.id && w.status === 'active').length;
    const remaining = Math.max(0, round.winnerCount - drawn);
    return {
      round,
      drawn,
      remaining,
      isComplete: drawn >= round.winnerCount,
    };
  });
}

export function getNextIncompleteRoundId(
  rounds: readonly RaffleRound[],
  winners: readonly WinnerRecord[]
): string | null {
  const progress = getRoundProgress(rounds, winners);
  const next = progress.find((p) => !p.isComplete);
  return next ? next.round.id : progress[progress.length - 1]?.round.id ?? null;
}

function countUnquotedDelimiter(line: string, delimiter: string): number {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && char === delimiter) {
      count++;
    }
  }
  return count;
}

/**
 * Parses CSV, TSV, or newline-separated text into a 2D array of strings.
 */
export function parseDelimitedText(text: string): string[][] {
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (!trimmed) return [];

  const lines = trimmed.split(/\r?\n/);
  const firstLine = lines[0] ?? '';

  // Detect delimiter outside quotes: tab > comma > semicolon > single column
  const tabCount = countUnquotedDelimiter(firstLine, '\t');
  const commaCount = countUnquotedDelimiter(firstLine, ',');
  const semiCount = countUnquotedDelimiter(firstLine, ';');

  let delimiter = ',';
  if (tabCount > 0 && tabCount >= commaCount && tabCount >= semiCount) {
    delimiter = '\t';
  } else if (semiCount > commaCount) {
    delimiter = ';';
  } else if (commaCount === 0 && tabCount === 0 && semiCount === 0) {
    // Single-column list (unwrap RFC-4180 enclosing quotes e.g. from Google Sheets gviz CSV)
    return lines
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        if (line.startsWith('"') && line.endsWith('"') && line.length >= 2) {
          return [line.slice(1, -1).replace(/""/g, '"').trim()];
        }
        return [line];
      });
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    const nextChar = trimmed[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if (char === '\r' && nextChar === '\n') {
      currentRow.push(currentField.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
      i++;
    } else if (char === '\n' || char === '\r') {
      currentRow.push(currentField.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  currentRow.push(currentField.trim());
  if (currentRow.some((cell) => cell.length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Inspects a 2D array from Google Sheets / Excel / CSV and guesses the column mapping.
 */
export function buildParsedTableAndMapping(rawRows: string[][]): {
  table: ParsedTable;
  mapping: ColumnMapping;
} {
  const nonEmptyRows = rawRows.filter((r) => r.some((cell) => String(cell ?? '').trim().length > 0));
  if (nonEmptyRows.length === 0) {
    return {
      table: { headers: [], rows: [] },
      mapping: { nameCol: 0, ticketCol: -1, departmentCol: -1, contactCol: -1, hasHeaderRow: false },
    };
  }

  const maxCols = nonEmptyRows.reduce((m, r) => Math.max(m, r.length), 0);
  const normalizedRows = nonEmptyRows.map((r) =>
    Array.from({ length: maxCols }, (_, idx) => String(r[idx] ?? '').trim())
  );

  const firstRow = normalizedRows[0];
  const headerPattern =
    /^(name|full\s*name|participant|employee|member|entry|ticket|raffle|code|id|no\.?|#|branch|dept|department|team|company|office|store|email|phone|mobile|contact|timestamp)$/i;
  const hasHeaderRow =
    normalizedRows.length > 1 &&
    firstRow.some((cell) => headerPattern.test(cell.trim()) || /name|ticket|entry|email|dept|branch|number/i.test(cell));

  const headers = hasHeaderRow
    ? firstRow.map((h, i) => h || `Column ${i + 1}`)
    : Array.from({ length: maxCols }, (_, i) => `Column ${i + 1}`);

  const findCol = (regex: RegExp, exclude: number[] = []): number => {
    if (!hasHeaderRow) return -1;
    return headers.findIndex((h, idx) => !exclude.includes(idx) && regex.test(h));
  };

  let nameCol = findCol(/full\s*name|^name$|participant|employee|member|winner|entrant/i);
  if (nameCol === -1) {
    // If column 0 looks like a timestamp or pure number and column 1 looks like text, pick column 1
    const sampleRow = hasHeaderRow ? normalizedRows[1] : normalizedRows[0];
    if (
      maxCols > 1 &&
      sampleRow &&
      (/^(\d+|rf-|#|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})/i.test(sampleRow[0]) ||
        /timestamp|date|no\.?|#|id/i.test(headers[0]))
    ) {
      nameCol = 1;
    } else {
      nameCol = 0;
    }
  }

  const ticketCol = findCol(/ticket|raffle|stub|entry\s*(id|no|#)|^code$|^id$|^no\.?$|^#$/i, [nameCol]);
  const departmentCol = findCol(/dept|department|branch|team|division|unit|office|store|company|location|group|category/i, [
    nameCol,
    ticketCol,
  ]);
  const contactCol = findCol(/email|e-mail|phone|mobile|contact|cell/i, [
    nameCol,
    ticketCol,
    departmentCol,
  ]);

  return {
    table: {
      headers,
      rows: normalizedRows,
    },
    mapping: {
      nameCol,
      ticketCol,
      departmentCol,
      contactCol,
      hasHeaderRow,
    },
  };
}

export function mapTableToParticipants(
  table: ParsedTable,
  mapping: ColumnMapping,
  sourceLabel = 'Imported List'
): Participant[] {
  const startIdx = mapping.hasHeaderRow ? 1 : 0;
  const participants: Participant[] = [];

  for (let i = startIdx; i < table.rows.length; i++) {
    const row = table.rows[i];
    const name = (row[mapping.nameCol] ?? '').trim();
    if (!name) continue;

    const ticketNumber =
      mapping.ticketCol >= 0 ? (row[mapping.ticketCol] ?? '').trim() || undefined : undefined;
    const department =
      mapping.departmentCol >= 0 ? (row[mapping.departmentCol] ?? '').trim() || undefined : undefined;
    const contact =
      mapping.contactCol >= 0 ? (row[mapping.contactCol] ?? '').trim() || undefined : undefined;

    participants.push({
      id: `p-${i}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      ticketNumber: ticketNumber || `ENTRY-${String(participants.length + 1).padStart(4, '0')}`,
      department,
      contact,
      source: sourceLabel,
    });
  }

  return participants;
}

export function deduplicateParticipants(participants: readonly Participant[]): {
  unique: Participant[];
  removedCount: number;
} {
  const seen = new Set<string>();
  const unique: Participant[] = [];
  let removedCount = 0;

  for (const p of participants) {
    const key = normalizeName(p.name);
    if (seen.has(key)) {
      removedCount++;
    } else {
      seen.add(key);
      unique.push(p);
    }
  }

  return { unique, removedCount };
}

function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportWinnersToCsv(
  winners: readonly WinnerRecord[],
  rounds: readonly RaffleRound[]
): string {
  const roundMap = new Map(rounds.map((r) => [r.id, r]));
  const sorted = [...winners].sort((a, b) => {
    const ra = roundMap.get(a.roundId)?.order ?? a.roundOrder;
    const rb = roundMap.get(b.roundId)?.order ?? b.roundOrder;
    if (ra !== rb) return ra - rb;
    if (a.slotNumber !== b.slotNumber) return a.slotNumber - b.slotNumber;
    return a.drawnAt.localeCompare(b.drawnAt);
  });

  const headers = [
    'Round Order',
    'Round Title',
    'Prize',
    'Winner Slot #',
    'Participant Name',
    'Ticket / Entry #',
    'Department / Branch',
    'Contact',
    'Status',
    'Void Reason',
    'Claimed',
    'Drawn Timestamp',
  ];

  const lines = [headers.map(escapeCsvCell).join(',')];

  for (const w of sorted) {
    const round = roundMap.get(w.roundId);
    const roundOrder = round?.order ?? w.roundOrder;
    const roundTitle = round?.title ?? w.roundTitle;
    const prize = round?.prize ?? w.prize;
    lines.push(
      [
        String(roundOrder),
        roundTitle,
        prize,
        String(w.slotNumber),
        w.participant.name,
        w.participant.ticketNumber ?? '',
        w.participant.department ?? '',
        w.participant.contact ?? '',
        w.status === 'active' ? 'Winner' : 'Voided / Redrawn',
        w.status === 'voided' ? w.voidReason ?? 'Redrawn' : '',
        w.claimed ? 'Yes' : 'No',
        w.drawnAt,
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  }

  return lines.join('\r\n');
}

const FIRST_NAMES = [
  'Maria', 'Juan', 'Jose', 'Angela', 'Mark', 'Carlo', 'Patricia', 'Joshua', 'Camille', 'Rafael',
  'Bianca', 'Miguel', 'Andrea', 'Gabriel', 'Clarissa', 'Daniel', 'Sofia', 'Christian', 'Katrina', 'Paolo',
  'Mikaela', 'Kenneth', 'Nicole', 'Jerome', 'Bea', 'Vincent', 'Rica', 'Adrian', 'Trisha', 'Francis',
  'Jasmine', 'Alvin', 'Danica', 'Kevin', 'Aileen', 'Dennis', 'Shiela', 'Raymond', 'Hannah', 'Lorenzo',
  'Elena', 'Marco', 'Celine', 'Nathan', 'Grace', 'Bryan', 'Joy', 'Edward', 'Marisol', 'Victor',
];

const LAST_NAMES = [
  'Santos', 'Reyes', 'Cruz', 'Bautista', 'Ocampo', 'Garcia', 'Mendoza', 'Torres', 'Tomas', 'Andrada',
  'Castillo', 'Flores', 'Villanueva', 'Ramos', 'Aquino', 'Navarro', 'Salazar', 'Mercado', 'Del Rosario', 'Dizon',
  'Soriano', 'Pascual', 'Rivera', 'Perez', 'Gomez', 'Fernandez', 'Morales', 'Valdez', 'Aguilar', 'Velasco',
];

const BRANCHES = [
  'Makati HQ', 'BGC Operations', 'Quezon City Branch', 'Cebu Hub', 'Davao Regional',
  'Pasig Logistics', 'Alabang South', 'Iloilo Office', 'Ortigas Finance', 'Clark Support',
];

/**
 * Deterministic 300-entry realistic pool so users can test all 260 winners
 * (150 + 50 + 35 + 25) immediately before or after connecting Google Drive.
 */
export function createDemoParticipants(count = 300): Participant[] {
  const list: Participant[] = [];
  for (let i = 0; i < count; i++) {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_NAMES[(Math.floor(i / FIRST_NAMES.length) * 5 + (i % 7) * 3) % LAST_NAMES.length];
    const middleInitial = String.fromCharCode(65 + ((i * 7) % 26));
    const branch = BRANCHES[i % BRANCHES.length];
    const ticketNum = `RF26-${String(i + 1).padStart(4, '0')}`;
    list.push({
      id: `demo-${i + 1}`,
      name: `${first} ${middleInitial}. ${last}`,
      ticketNumber: ticketNum,
      department: branch,
      contact: `${first.toLowerCase()}.${last.toLowerCase().replace(/\s+/g, '')}${i + 1}@example.com`,
      source: 'Demo Pool (300 Entries)',
    });
  }
  return list;
}
