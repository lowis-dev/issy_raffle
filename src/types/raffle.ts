export type ThemeAccent = 'emerald' | 'blue' | 'crimson' | 'amber' | 'slate';

export type ActiveTab = 'stage' | 'participants' | 'winners' | 'customize';

export interface Participant {
  id: string;
  name: string;
  ticketNumber?: string;
  department?: string;
  contact?: string;
  source?: string;
}

export interface RaffleRound {
  id: string;
  order: number;
  title: string;
  prize: string;
  winnerCount: number;
  defaultBatchSize: number;
  isBonusRound?: boolean;
  bonusPool?: Participant[];
}

export interface WinnerRecord {
  id: string;
  participant: Participant;
  roundId: string;
  roundOrder: number;
  roundTitle: string;
  prize: string;
  slotNumber: number;
  batchNumber: number;
  drawnAt: string;
  claimed: boolean;
  status: 'active' | 'voided';
  replacedByWinnerId?: string;
  voidReason?: string;
}

export interface RaffleSettings {
  eventTitle: string;
  eventSubtitle: string;
  accentTheme: ThemeAccent;
  removeWinnerFromPool: boolean;
  removeAllEntriesByName: boolean;
  animationDurationMs: number;
  soundEnabled: boolean;
  confettiEnabled: boolean;
  voiceAnnounceEnabled?: boolean;
  showTicketNumber: boolean;
  showDepartment: boolean;
}

export interface DataSourceInfo {
  type: 'demo' | 'gdrive' | 'upload' | 'manual';
  label: string;
  fileId?: string;
  sheetName?: string;
  loadedAt: string;
  originalCount: number;
}

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface SheetTabInfo {
  sheetId: number;
  title: string;
  rowCount?: number;
}

export interface ParsedTable {
  headers: string[];
  rows: string[][];
}

export interface ColumnMapping {
  nameCol: number;
  ticketCol: number; // -1 if unused
  departmentCol: number; // -1 if unused
  contactCol: number; // -1 if unused
  hasHeaderRow: boolean;
}
