import * as XLSX from 'xlsx';
import type { DriveFileItem, SheetTabInfo } from '../types/raffle';
import { parseDelimitedText } from '../utils/raffleEngine';

export const DEFAULT_RAFFLE_SEARCH = 'RAFFLE ENTRIES 2026';

export const MIME_TYPES = {
  FOLDER: 'application/vnd.google-apps.folder',
  SPREADSHEET: 'application/vnd.google-apps.spreadsheet',
  DOCUMENT: 'application/vnd.google-apps.document',
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  XLS: 'application/vnd.ms-excel',
  CSV: 'text/csv',
  PLAIN: 'text/plain',
} as const;

export function getFriendlyFileType(mimeType: string): string {
  switch (mimeType) {
    case MIME_TYPES.FOLDER:
      return 'Folder';
    case MIME_TYPES.SPREADSHEET:
      return 'Google Sheet';
    case MIME_TYPES.DOCUMENT:
      return 'Google Doc';
    case MIME_TYPES.XLSX:
    case MIME_TYPES.XLS:
      return 'Excel Workbook';
    case MIME_TYPES.CSV:
      return 'CSV File';
    case MIME_TYPES.PLAIN:
      return 'Text List';
    default:
      return 'Drive File';
  }
}

async function fetchJson<T>(url: string, accessToken: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (res.status === 401) {
    throw new Error('AUTH_EXPIRED');
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Google API error (${res.status}): ${errBody || res.statusText}`);
  }

  return (await res.json()) as T;
}

/**
 * Searches Google Drive for files/folders matching the query (defaults to "RAFFLE ENTRIES 2026").
 * Also supports listing recent spreadsheets/CSV/Excel files when query is empty.
 */
export async function searchRaffleFiles(
  accessToken: string,
  queryText: string = DEFAULT_RAFFLE_SEARCH
): Promise<DriveFileItem[]> {
  const trimmed = queryText.trim();
  const escaped = trimmed.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  const supportedMimeFilter = [
    `mimeType = '${MIME_TYPES.SPREADSHEET}'`,
    `mimeType = '${MIME_TYPES.FOLDER}'`,
    `mimeType = '${MIME_TYPES.XLSX}'`,
    `mimeType = '${MIME_TYPES.XLS}'`,
    `mimeType = '${MIME_TYPES.CSV}'`,
    `mimeType = '${MIME_TYPES.PLAIN}'`,
    `mimeType = '${MIME_TYPES.DOCUMENT}'`,
  ].join(' or ');

  const q = trimmed
    ? `trashed = false and name contains '${escaped}' and (${supportedMimeFilter})`
    : `trashed = false and (${supportedMimeFilter})`;

  const params = new URLSearchParams({
    q,
    fields: 'files(id, name, mimeType, modifiedTime, webViewLink)',
    orderBy: 'modifiedTime desc',
    pageSize: '25',
    includeItemsFromAllDrives: 'true',
    supportsAllDrives: 'true',
  });

  const data = await fetchJson<{ files?: DriveFileItem[] }>(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    accessToken
  );

  return data.files ?? [];
}

/**
 * Lists files inside a Google Drive folder (for when "RAFFLE ENTRIES 2026" is a folder).
 */
export async function listFolderFiles(
  accessToken: string,
  folderId: string
): Promise<DriveFileItem[]> {
  const escapedId = folderId.replace(/'/g, "\\'");
  const q = `'${escapedId}' in parents and trashed = false`;
  const params = new URLSearchParams({
    q,
    fields: 'files(id, name, mimeType, modifiedTime, webViewLink)',
    orderBy: 'modifiedTime desc',
    pageSize: '50',
    includeItemsFromAllDrives: 'true',
    supportsAllDrives: 'true',
  });

  const data = await fetchJson<{ files?: DriveFileItem[] }>(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    accessToken
  );

  return data.files ?? [];
}

/**
 * Reads all actual tab names from a Google Spreadsheet (never hardcoding "Sheet1").
 */
export async function getSpreadsheetTabs(
  accessToken: string,
  spreadsheetId: string
): Promise<SheetTabInfo[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}?fields=sheets(properties(sheetId,title,gridProperties(rowCount)))`;

  const data = await fetchJson<{
    sheets?: Array<{
      properties: {
        sheetId: number;
        title: string;
        gridProperties?: { rowCount?: number };
      };
    }>;
  }>(url, accessToken);

  return (data.sheets ?? []).map((s) => ({
    sheetId: s.properties.sheetId,
    title: s.properties.title,
    rowCount: s.properties.gridProperties?.rowCount,
  }));
}

/**
 * Reads all values from a specific tab of a Google Spreadsheet.
 */
export async function fetchGoogleSheetRows(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string
): Promise<string[][]> {
  const safeRange = `'${sheetTitle.replace(/'/g, "''")}'`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${encodeURIComponent(safeRange)}?majorDimension=ROWS`;

  const data = await fetchJson<{ values?: unknown[][] }>(url, accessToken);
  return (data.values ?? []).map((row) => row.map((cell) => String(cell ?? '').trim()));
}

/**
 * Downloads and parses a non-Google-Sheet Drive file (Excel .xlsx/.xls, CSV, TXT, or Google Doc).
 */
export async function fetchNonSheetDriveFile(
  accessToken: string,
  file: DriveFileItem
): Promise<{
  tabs: string[];
  rowsByTab: Record<string, string[][]>;
}> {
  if (file.mimeType === MIME_TYPES.DOCUMENT) {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        file.id
      )}/export?mimeType=text/plain`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (res.status === 401) throw new Error('AUTH_EXPIRED');
    if (!res.ok) throw new Error(`Unable to read Google Doc (${res.status})`);
    const text = await res.text();
    const rows = parseDelimitedText(text);
    return { tabs: ['Document'], rowsByTab: { Document: rows } };
  }

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (res.status === 401) throw new Error('AUTH_EXPIRED');
  if (!res.ok) throw new Error(`Unable to download Drive file (${res.status})`);

  if (
    file.mimeType === MIME_TYPES.XLSX ||
    file.mimeType === MIME_TYPES.XLS ||
    /\.xlsx?$/i.test(file.name)
  ) {
    const buffer = await res.arrayBuffer();
    return parseWorkbookArrayBuffer(buffer);
  }

  const text = await res.text();
  const rows = parseDelimitedText(text);
  return { tabs: ['Entries'], rowsByTab: { Entries: rows } };
}

export function parseWorkbookArrayBuffer(buffer: ArrayBuffer): {
  tabs: string[];
  rowsByTab: Record<string, string[][]>;
} {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const tabs = workbook.SheetNames;
  const rowsByTab: Record<string, string[][]> = {};

  for (const name of tabs) {
    const sheet = workbook.Sheets[name];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      blankrows: false,
    });
    rowsByTab[name] = aoa.map((row) =>
      Array.isArray(row) ? row.map((cell) => String(cell ?? '').trim()) : []
    );
  }

  return { tabs, rowsByTab };
}

export async function parseLocalFile(file: File): Promise<{
  tabs: string[];
  rowsByTab: Record<string, string[][]>;
}> {
  if (/\.xlsx?$/i.test(file.name)) {
    const buffer = await file.arrayBuffer();
    return parseWorkbookArrayBuffer(buffer);
  }
  const text = await file.text();
  const rows = parseDelimitedText(text);
  return { tabs: ['Entries'], rowsByTab: { Entries: rows } };
}

export async function fetchGoogleSheetByUrl(
  urlOrId: string,
  sheetTitle?: string
): Promise<{
  title: string;
  tabs: string[];
  rowsByTab: Record<string, string[][]>;
}> {
  const trimmedInput = urlOrId.trim();
  const pubMatch = trimmedInput.match(/\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)/);
  const stdMatch = trimmedInput.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const gidMatch = trimmedInput.match(/[#?&]gid=(\d+)/);
  const gid = gidMatch?.[1];
  const cleanSheetTitle = sheetTitle?.trim();

  const isPublished = Boolean(pubMatch);
  const id = pubMatch?.[1] ?? stdMatch?.[1] ?? trimmedInput;
  if (!id) {
    throw new Error('Please enter a valid Google Sheets URL or Spreadsheet ID.');
  }

  const isHtmlResponse = (text: string) => /^\s*<(?:!doctype\s+html|html)\b/i.test(text);

  let csvText = '';
  let responseOk = false;

  if (isPublished) {
    const pubUrl = `https://docs.google.com/spreadsheets/d/e/${id}/pub?output=csv${
      gid ? `&gid=${gid}` : ''
    }`;
    try {
      const res = await fetch(pubUrl);
      if (res.ok) {
        csvText = await res.text();
        if (!isHtmlResponse(csvText)) {
          responseOk = true;
        }
      }
    } catch {
      // handled below
    }
  } else {
    // Google Visualization API gives open CORS for spreadsheets shared to "Anyone with the link"
    const sheetParam = cleanSheetTitle
      ? `&sheet=${encodeURIComponent(cleanSheetTitle)}`
      : gid
      ? `&gid=${gid}`
      : '';
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv${sheetParam}`;

    try {
      const res = await fetch(gvizUrl);
      if (res.ok) {
        csvText = await res.text();
        if (!isHtmlResponse(csvText)) {
          responseOk = true;
        }
      }
    } catch {
      // try fallback
    }

    if (!responseOk) {
      try {
        const exportUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${
          gid ? `&gid=${gid}` : ''
        }`;
        const res = await fetch(exportUrl);
        if (res.ok) {
          csvText = await res.text();
          if (!isHtmlResponse(csvText)) {
            responseOk = true;
          }
        }
      } catch {
        // both failed
      }
    }
  }

  if (!responseOk || !csvText.trim()) {
    throw new Error(
      'Could not access Google Sheet. Please make sure the sheet is shared as "Anyone with the link can view", or download it via File > Download > Microsoft Excel (.xlsx) / CSV and upload it directly.'
    );
  }

  const rows = parseDelimitedText(csvText);
  if (rows.length === 0) {
    throw new Error('The spreadsheet appears to have no data rows.');
  }

  const tab = cleanSheetTitle || (gid ? `Tab (${gid})` : 'Sheet1');
  return {
    title: `Google Sheet (${id.slice(0, 10)}...)`,
    tabs: [tab],
    rowsByTab: { [tab]: rows },
  };
}
