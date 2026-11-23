import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  ClipboardList,
  FileSpreadsheet,
  Folder,
  Link,
  LogOut,
  RefreshCw,
  Search,
  Upload,
  X,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type {
  ColumnMapping,
  DriveFileItem,
  ParsedTable,
  Participant,
  SheetTabInfo,
} from '../types/raffle';
import {
  DEFAULT_RAFFLE_SEARCH,
  MIME_TYPES,
  fetchGoogleSheetByUrl,
  fetchGoogleSheetRows,
  fetchNonSheetDriveFile,
  getFriendlyFileType,
  getSpreadsheetTabs,
  listFolderFiles,
  parseLocalFile,
  searchRaffleFiles,
} from '../services/googleDrive';
import {
  buildParsedTableAndMapping,
  mapTableToParticipants,
  parseDelimitedText,
} from '../utils/raffleEngine';
import type { ThemePalette } from '../utils/theme';
import { GoogleSignInButton } from './GoogleSignInButton';

export type ImportModalTab = 'upload' | 'sheets' | 'drive' | 'paste';

interface DriveImportModalProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
  accessToken: string | null;
  isSigningIn: boolean;
  authError: string | null;
  onSignIn: () => Promise<string | null>;
  onSignOut: () => Promise<void>;
  onSetManualToken?: (token: string) => void;
  onImportParticipants: (
    participants: Participant[],
    mode: 'replace' | 'append',
    sourceMeta: {
      type: 'demo' | 'gdrive' | 'upload' | 'manual';
      label: string;
      fileId?: string;
      sheetName?: string;
    }
  ) => void;
  palette: ThemePalette;
  initialTab?: ImportModalTab;
}

export const DriveImportModal: React.FC<DriveImportModalProps> = ({
  open,
  onClose,
  user,
  accessToken,
  isSigningIn,
  authError,
  onSignIn,
  onSignOut,
  onSetManualToken,
  onImportParticipants,
  palette,
  initialTab = 'upload',
}) => {
  const [activeTab, setActiveTab] = useState<ImportModalTab>(initialTab);

  // Search & Drive file browser
  const [searchQuery, setSearchQuery] = useState(DEFAULT_RAFFLE_SEARCH);
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [folderStack, setFolderStack] = useState<DriveFileItem[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manual token input state
  const [showManualToken, setShowManualToken] = useState(false);
  const [manualTokenInput, setManualTokenInput] = useState('');

  // Local File Upload state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isReadingLocalFile, setIsReadingLocalFile] = useState(false);

  // Google Sheet URL state
  const [sheetUrlInput, setSheetUrlInput] = useState('');
  const [sheetTabInput, setSheetTabInput] = useState('');
  const [isFetchingSheet, setIsFetchingSheet] = useState(false);

  // Paste text state
  const [pastedText, setPastedText] = useState('');

  // Step 2: Mapping & Preview state
  const [selectedFile, setSelectedFile] = useState<DriveFileItem | null>(null);
  const [sourceType, setSourceType] = useState<'upload' | 'sheets' | 'drive' | 'paste'>('upload');
  const [sheetTabs, setSheetTabs] = useState<SheetTabInfo[]>([]);
  const [workbookCache, setWorkbookCache] = useState<Record<string, string[][]> | null>(null);
  const [selectedTab, setSelectedTab] = useState<string>('');
  const [isLoadingRows, setIsLoadingRows] = useState(false);
  const [parsedTable, setParsedTable] = useState<ParsedTable | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({
    nameCol: 0,
    ticketCol: -1,
    departmentCol: -1,
    contactCol: -1,
    hasHeaderRow: true,
  });
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');

  const hasAutoSearchedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Sync initial tab when opened and reset transient state when closed
  useEffect(() => {
    if (open) {
      if (accessToken && initialTab === 'drive') {
        setActiveTab('drive');
      } else {
        setActiveTab(initialTab);
      }
      setError(null);
    } else {
      setSelectedFile(null);
      setParsedTable(null);
      setSheetTabs([]);
      setWorkbookCache(null);
      setError(null);
      setIsDragging(false);
      hasAutoSearchedRef.current = false;
    }
  }, [open, initialTab, accessToken]);

  // Reset auto-search guard when token changes
  useEffect(() => {
    hasAutoSearchedRef.current = false;
  }, [accessToken]);

  // Close modal on Escape
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const runSearch = async (token: string, query: string) => {
    setIsLoadingFiles(true);
    setError(null);
    setFolderStack([]);
    try {
      const results = await searchRaffleFiles(token, query);
      setFiles(results);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to search Google Drive.';
      setError(
        msg === 'AUTH_EXPIRED'
          ? 'Your Google session expired. Please sign in again.'
          : msg
      );
    } finally {
      setIsLoadingFiles(false);
    }
  };

  useEffect(() => {
    if (open && activeTab === 'drive' && accessToken && !selectedFile && !hasAutoSearchedRef.current) {
      hasAutoSearchedRef.current = true;
      runSearch(accessToken, DEFAULT_RAFFLE_SEARCH);
    }
  }, [open, activeTab, accessToken, selectedFile]);

  if (!open) return null;

  // 1. Local File Handler
  const processUploadedFile = async (file: File) => {
    setIsReadingLocalFile(true);
    setError(null);
    try {
      const parsed = await parseLocalFile(file);
      const tabs = parsed.tabs.map((t, idx) => ({ sheetId: idx, title: t }));
      setSheetTabs(tabs);
      setWorkbookCache(parsed.rowsByTab);
      const firstTab = tabs[0]?.title ?? 'Entries';
      setSelectedTab(firstTab);

      const rows = parsed.rowsByTab[firstTab] ?? [];
      if (rows.length === 0) {
        throw new Error('This file appears to be empty. Please choose a file with entries.');
      }

      const built = buildParsedTableAndMapping(rows);
      setParsedTable(built.table);
      setMapping(built.mapping);
      setSelectedFile({
        id: `local-${Date.now()}`,
        name: file.name,
        mimeType: file.name.endsWith('.csv') ? MIME_TYPES.CSV : MIME_TYPES.XLSX,
      });
      setSourceType('upload');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to read this file.');
    } finally {
      setIsReadingLocalFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  // 2. Google Sheet URL Handler
  const handleFetchSheetUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetUrlInput.trim()) {
      setError('Please paste a Google Sheets URL or ID.');
      return;
    }
    setIsFetchingSheet(true);
    setError(null);
    try {
      const parsed = await fetchGoogleSheetByUrl(
        sheetUrlInput.trim(),
        sheetTabInput.trim() || undefined
      );
      const tabs = parsed.tabs.map((t, idx) => ({ sheetId: idx, title: t }));
      setSheetTabs(tabs);
      setWorkbookCache(parsed.rowsByTab);
      const firstTab = tabs[0]?.title ?? 'Sheet1';
      setSelectedTab(firstTab);

      const rows = parsed.rowsByTab[firstTab] ?? [];
      const built = buildParsedTableAndMapping(rows);
      setParsedTable(built.table);
      setMapping(built.mapping);
      setSelectedFile({
        id: `url-sheet-${Date.now()}`,
        name: parsed.title,
        mimeType: MIME_TYPES.SPREADSHEET,
      });
      setSourceType('sheets');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch Google Sheet.');
    } finally {
      setIsFetchingSheet(false);
    }
  };

  // 3. Pasted Text Handler
  const handleProcessPastedText = () => {
    if (!pastedText.trim()) {
      setError('Please enter or paste at least one name.');
      return;
    }
    setError(null);
    const rows = parseDelimitedText(pastedText);
    if (rows.length === 0) {
      setError('Could not detect any rows in pasted text.');
      return;
    }
    const built = buildParsedTableAndMapping(rows);
    setParsedTable(built.table);
    setMapping(built.mapping);
    setSheetTabs([{ sheetId: 0, title: 'Pasted List' }]);
    setSelectedTab('Pasted List');
    setSelectedFile({
      id: `paste-${Date.now()}`,
      name: `Pasted List (${rows.length} rows)`,
      mimeType: MIME_TYPES.PLAIN,
    });
    setSourceType('paste');
  };

  // 4. Google Sign-In & Drive Browser Handlers
  const handleSignInClick = async () => {
    setError(null);
    const token = await onSignIn();
    if (token) {
      await runSearch(token, DEFAULT_RAFFLE_SEARCH);
    }
  };

  const handleManualTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const token = manualTokenInput.trim();
    if (!token) return;
    onSetManualToken?.(token);
    runSearch(token, DEFAULT_RAFFLE_SEARCH);
  };

  const handleOpenFile = async (file: DriveFileItem) => {
    if (!accessToken) return;
    setError(null);

    if (file.mimeType === MIME_TYPES.FOLDER) {
      setIsLoadingFiles(true);
      try {
        const children = await listFolderFiles(accessToken, file.id);
        setFolderStack((prev) => [...prev, file]);
        setFiles(children);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to open folder.');
      } finally {
        setIsLoadingFiles(false);
      }
      return;
    }

    setSelectedFile(file);
    setSourceType('drive');
    setIsLoadingRows(true);
    setParsedTable(null);
    setSheetTabs([]);
    setWorkbookCache(null);

    try {
      if (file.mimeType === MIME_TYPES.SPREADSHEET) {
        const tabs = await getSpreadsheetTabs(accessToken, file.id);
        setSheetTabs(tabs);
        const firstTab = tabs[0]?.title;
        if (!firstTab) {
          throw new Error('This Google Sheet has no visible tabs.');
        }
        setSelectedTab(firstTab);
        const rows = await fetchGoogleSheetRows(accessToken, file.id, firstTab);
        const built = buildParsedTableAndMapping(rows);
        setParsedTable(built.table);
        setMapping(built.mapping);
      } else {
        const parsed = await fetchNonSheetDriveFile(accessToken, file);
        setWorkbookCache(parsed.rowsByTab);
        const tabs = parsed.tabs.map((title, idx) => ({ sheetId: idx, title }));
        setSheetTabs(tabs);
        const firstTab = tabs[0]?.title ?? 'Entries';
        setSelectedTab(firstTab);
        const rows = parsed.rowsByTab[firstTab] ?? [];
        const built = buildParsedTableAndMapping(rows);
        setParsedTable(built.table);
        setMapping(built.mapping);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load file rows.';
      setError(
        msg === 'AUTH_EXPIRED'
          ? 'Your Google session expired. Please sign in again.'
          : msg
      );
      setSelectedFile(null);
    } finally {
      setIsLoadingRows(false);
    }
  };

  const handleSelectTab = async (tabTitle: string) => {
    if (!selectedFile) return;
    setSelectedTab(tabTitle);
    setIsLoadingRows(true);
    setError(null);

    try {
      let rows: string[][] = [];
      if (sourceType === 'drive' && accessToken && selectedFile.mimeType === MIME_TYPES.SPREADSHEET) {
        rows = await fetchGoogleSheetRows(accessToken, selectedFile.id, tabTitle);
      } else if (workbookCache) {
        rows = workbookCache[tabTitle] ?? [];
      }
      const built = buildParsedTableAndMapping(rows);
      setParsedTable(built.table);
      setMapping(built.mapping);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to read that sheet tab.');
    } finally {
      setIsLoadingRows(false);
    }
  };

  const handleConfirmImport = () => {
    if (!parsedTable || !selectedFile) return;
    const label = selectedTab ? `${selectedFile.name} (${selectedTab})` : selectedFile.name;
    const participants = mapTableToParticipants(parsedTable, mapping, label);
    if (participants.length === 0) {
      setError('No participant names were found in the selected column. Please choose another column.');
      return;
    }

    const finalSourceType =
      sourceType === 'drive'
        ? 'gdrive'
        : sourceType === 'paste'
        ? 'manual'
        : 'upload';

    onImportParticipants(participants, importMode, {
      type: finalSourceType,
      label,
      fileId: selectedFile.id,
      sheetName: selectedTab || undefined,
    });
    setSelectedFile(null);
    onClose();
  };

  const previewStart = mapping.hasHeaderRow ? 1 : 0;
  const previewRows = parsedTable ? parsedTable.rows.slice(previewStart, previewStart + 5) : [];
  const totalEstimatedCount = parsedTable
    ? parsedTable.rows
        .slice(previewStart)
        .filter((r) => (r[mapping.nameCol] ?? '').trim().length > 0).length
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drive-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 id="drive-modal-title" className="text-lg font-bold text-slate-900">
              Load Raffle Entries
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Import your <span className="font-semibold text-slate-800">RAFFLE ENTRIES 2026</span> list from Excel, CSV, Google Sheets, or Drive.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Source Navigation Tabs (Only visible when no file is currently selected for mapping) */}
        {!selectedFile && (
          <div className="flex overflow-x-auto border-b border-slate-200 bg-slate-50/75 px-6">
            <button
              type="button"
              onClick={() => {
                setActiveTab('upload');
                setError(null);
              }}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'upload'
                  ? `border-slate-900 ${palette.primaryText} bg-white`
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload className="h-4 w-4" />
              Upload File (.xlsx / .csv)
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${palette.softBg} ${palette.softText}`}>
                Fastest
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('sheets');
                setError(null);
              }}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'sheets'
                  ? `border-slate-900 ${palette.primaryText} bg-white`
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Link className="h-4 w-4" />
              Google Sheets Link
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('drive');
                setError(null);
              }}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'drive'
                  ? `border-slate-900 ${palette.primaryText} bg-white`
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Google Drive
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('paste');
                setError(null);
              }}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'paste'
                  ? `border-slate-900 ${palette.primaryText} bg-white`
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <ClipboardList className="h-4 w-4" />
              Paste List
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* STEP 1: SOURCE SELECTION */}
          {!selectedFile ? (
            <div>
              {/* TAB 1: FILE UPLOAD */}
              {activeTab === 'upload' && (
                <div className="py-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv,.txt"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition-all ${
                      isDragging
                        ? 'border-emerald-500 bg-emerald-50/50 scale-[0.99]'
                        : 'border-slate-300 bg-slate-50/50 hover:border-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm border border-slate-200 ${palette.primaryText}`}
                    >
                      {isReadingLocalFile ? (
                        <RefreshCw className={`h-7 w-7 animate-spin ${palette.primaryText}`} />
                      ) : (
                        <Upload className="h-7 w-7" />
                      )}
                    </div>
                    <h3 className="mt-4 text-base font-bold text-slate-900">
                      Upload your RAFFLE ENTRIES 2026 file
                    </h3>
                    <p className="mt-1 text-sm text-slate-500 max-w-sm">
                      Drag and drop your spreadsheet here, or click to browse from your computer.
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-mono font-medium text-slate-700">
                        .xlsx
                      </span>
                      <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-mono font-medium text-slate-700">
                        .csv
                      </span>
                      <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-mono font-medium text-slate-700">
                        .xls
                      </span>
                      <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-mono font-medium text-slate-700">
                        .txt
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-xs text-slate-600">
                    <p className="font-semibold text-slate-800">💡 Tip for Google Sheets:</p>
                    <p className="mt-1">
                      If your entries are in Google Sheets, open the sheet, click{' '}
                      <strong>File &gt; Download &gt; Microsoft Excel (.xlsx)</strong> or <strong>Comma Separated Values (.csv)</strong>, then drop the file here. It loads in under 1 second without any sign-in!
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 2: GOOGLE SHEETS LINK */}
              {activeTab === 'sheets' && (
                <div className="py-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-6">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl border ${palette.softBg} ${palette.primaryText} ${palette.softBorder}`}
                      >
                        <Link className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Direct Google Sheet URL Import
                        </h3>
                        <p className="text-xs text-slate-500">
                          Import directly without Google login if the sheet is shared as "Anyone with the link can view".
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handleFetchSheetUrl} className="mt-5 space-y-4">
                      <div>
                        <label
                          htmlFor="sheet-url-input"
                          className="block text-xs font-semibold text-slate-700"
                        >
                          Google Sheets Link or Spreadsheet ID
                        </label>
                        <input
                          id="sheet-url-input"
                          type="text"
                          value={sheetUrlInput}
                          onChange={(e) => setSheetUrlInput(e.target.value)}
                          placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
                          className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="sheet-tab-input"
                          className="block text-xs font-semibold text-slate-700"
                        >
                          Sheet Tab Name (optional)
                        </label>
                        <input
                          id="sheet-tab-input"
                          type="text"
                          value={sheetTabInput}
                          onChange={(e) => setSheetTabInput(e.target.value)}
                          placeholder="Leave blank to use default or URL gid tab"
                          className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <p className="text-[11px] text-slate-500">
                          Requires link sharing: <em>"Anyone with the link can view"</em>
                        </p>
                        <button
                          type="submit"
                          disabled={isFetchingSheet || !sheetUrlInput.trim()}
                          className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50 ${palette.primaryBg} ${palette.primaryHover}`}
                        >
                          {isFetchingSheet ? (
                            <>
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              Fetching Sheet...
                            </>
                          ) : (
                            'Fetch Spreadsheet'
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* TAB 3: GOOGLE DRIVE (OAUTH) */}
              {activeTab === 'drive' && (
                <div>
                  {!accessToken ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
                        <FileSpreadsheet className="h-6 w-6" aria-hidden="true" />
                      </div>
                      <h3 className="mt-4 text-base font-bold text-slate-900">
                        Connect Google Account
                      </h3>
                      <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-600">
                        Sign in to automatically browse <span className="font-semibold text-slate-800">RAFFLE ENTRIES 2026</span> in your Drive.
                      </p>

                      <div className="mt-6">
                        <GoogleSignInButton
                          onClick={handleSignInClick}
                          disabled={isSigningIn}
                          label={isSigningIn ? 'Connecting...' : 'Sign in with Google'}
                        />
                      </div>

                      {(authError || error) && (
                        <div className="mt-5 max-w-lg rounded-xl border border-rose-200 bg-rose-50/80 p-4 text-left">
                          <div className="flex items-start gap-2.5">
                            <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
                            <div className="text-xs text-rose-800">
                              <p className="font-semibold">Google Sign-In Notice</p>
                              <p className="mt-1 leading-relaxed">
                                {authError || error}
                              </p>
                              <div className="mt-3 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setActiveTab('upload')}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                                >
                                  <Upload className="h-3.5 w-3.5" />
                                  Use File Upload Instead (Instant)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setShowManualToken((v) => !v)}
                                  className="text-xs text-rose-700 underline hover:text-rose-900"
                                >
                                  {showManualToken ? 'Hide token option' : 'Enter OAuth Token'}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {showManualToken && (
                        <form
                          onSubmit={handleManualTokenSubmit}
                          className="mt-4 w-full max-w-md text-left rounded-xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <label className="block text-xs font-semibold text-slate-700">
                            Paste Google OAuth Access Token (Bearer Token)
                          </label>
                          <input
                            type="password"
                            value={manualTokenInput}
                            onChange={(e) => setManualTokenInput(e.target.value)}
                            placeholder="ya29.a0..."
                            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-mono"
                          />
                          <button
                            type="submit"
                            disabled={!manualTokenInput.trim()}
                            className="mt-2.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                          >
                            Use Token to Browse Drive
                          </button>
                        </form>
                      )}
                    </div>
                  ) : (
                    /* Step 1: Drive File Browser when signed in */
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                        <div className="text-xs text-slate-600">
                          Signed in as <span className="font-semibold text-slate-900">{user?.email || user?.displayName}</span>
                        </div>
                        <button
                          type="button"
                          onClick={onSignOut}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900"
                        >
                          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                          Switch Account
                        </button>
                      </div>

                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          runSearch(accessToken, searchQuery);
                        }}
                        className="mt-4 flex flex-col gap-2 sm:flex-row"
                      >
                        <div className="relative flex-1">
                          <Search
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                            aria-hidden="true"
                          />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search file or folder name..."
                            aria-label="Search Google Drive files"
                            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={isLoadingFiles}
                          className={`h-10 rounded-lg px-4 text-sm font-semibold text-white transition-colors whitespace-nowrap shrink-0 ${palette.primaryBg} ${palette.primaryHover}`}
                        >
                          Search Drive
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            runSearch(accessToken, '');
                          }}
                          disabled={isLoadingFiles}
                          className="h-10 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                        >
                          Recent Files
                        </button>
                      </form>

                      {folderStack.length > 0 && (
                        <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
                          <button
                            type="button"
                            onClick={() => runSearch(accessToken, searchQuery)}
                            className="font-medium text-slate-800 hover:underline"
                          >
                            Search Results
                          </button>
                          {folderStack.map((folder) => (
                            <React.Fragment key={folder.id}>
                              <span aria-hidden="true">/</span>
                              <span className="font-semibold text-slate-900">{folder.name}</span>
                            </React.Fragment>
                          ))}
                        </div>
                      )}

                      <div className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200">
                        {isLoadingFiles ? (
                          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
                            <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                            Searching Google Drive...
                          </div>
                        ) : files.length === 0 ? (
                          <div className="px-4 py-10 text-center">
                            <p className="text-sm font-medium text-slate-800">
                              No matching files found for "{searchQuery || 'Recent Files'}"
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Try clicking "Recent Files" or use the Upload tab to load your downloaded file directly.
                            </p>
                          </div>
                        ) : (
                          files.map((file) => {
                            const isFolder = file.mimeType === MIME_TYPES.FOLDER;
                            return (
                              <button
                                key={file.id}
                                type="button"
                                onClick={() => handleOpenFile(file)}
                                className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                              >
                                <div className="flex min-w-0 items-center gap-3">
                                  {isFolder ? (
                                    <Folder className="h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
                                  ) : (
                                    <FileSpreadsheet
                                      className="h-5 w-5 shrink-0 text-emerald-700"
                                      aria-hidden="true"
                                    />
                                  )}
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-900">
                                      {file.name}
                                    </p>
                                    <p className="mt-0.5 text-xs text-slate-500">
                                      {getFriendlyFileType(file.mimeType)}
                                      {file.modifiedTime && (
                                        <>
                                          {' · '}
                                          Updated {new Date(file.modifiedTime).toLocaleDateString()}
                                        </>
                                      )}
                                    </p>
                                  </div>
                                </div>
                                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: PASTE LIST */}
              {activeTab === 'paste' && (
                <div className="py-4">
                  <label htmlFor="modal-paste-box" className="block text-xs font-semibold text-slate-700">
                    Paste participant names or table data (one name per line, or tab/comma separated)
                  </label>
                  <textarea
                    id="modal-paste-box"
                    rows={8}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder={"Maria Santos\nJuan Dela Cruz\nAngela Reyes"}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
                  />
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={handleProcessPastedText}
                      disabled={!pastedText.trim()}
                      className={`rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50 ${palette.primaryBg} ${palette.primaryHover}`}
                    >
                      Process & Map Columns
                    </button>
                  </div>
                </div>
              )}

              {/* General Error alert */}
              {error && (
                <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-700">
                  {error}
                </p>
              )}
            </div>
          ) : (
            /* STEP 2: SHEET TAB & COLUMN MAPPING */
            <div>
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setParsedTable(null);
                  setError(null);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Back to source selection
              </button>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                      {sourceType === 'upload'
                        ? 'Local File'
                        : sourceType === 'sheets'
                        ? 'Google Sheet Link'
                        : sourceType === 'drive'
                        ? 'Google Drive'
                        : 'Pasted List'}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 truncate max-w-md">
                      {selectedFile.name}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Verify which column represents the participant name, then confirm import.
                  </p>
                </div>

                {sheetTabs.length > 1 && (
                  <div className="flex items-center gap-2">
                    <label htmlFor="drive-sheet-tab" className="text-xs font-medium text-slate-600">
                      Sheet Tab:
                    </label>
                    <select
                      id="drive-sheet-tab"
                      value={selectedTab}
                      onChange={(e) => handleSelectTab(e.target.value)}
                      className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
                    >
                      {sheetTabs.map((t) => (
                        <option key={t.sheetId} value={t.title}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {error && (
                <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-700">
                  {error}
                </p>
              )}

              {isLoadingRows ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
                  <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Reading entries from {selectedFile.name}...
                </div>
              ) : parsedTable && parsedTable.rows.length > 0 ? (
                <div className="mt-4 space-y-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="map-name-col" className="block text-xs font-semibold text-slate-700">
                        Participant Name Column (Required)
                      </label>
                      <select
                        id="map-name-col"
                        value={mapping.nameCol}
                        onChange={(e) =>
                          setMapping((prev) => ({ ...prev, nameCol: Number(e.target.value) }))
                        }
                        className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
                      >
                        {parsedTable.headers.map((h, i) => (
                          <option key={i} value={i}>
                            {h || `Column ${i + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="map-ticket-col" className="block text-xs font-semibold text-slate-700">
                        Ticket / Entry # Column (Optional)
                      </label>
                      <select
                        id="map-ticket-col"
                        value={mapping.ticketCol}
                        onChange={(e) =>
                          setMapping((prev) => ({ ...prev, ticketCol: Number(e.target.value) }))
                        }
                        className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
                      >
                        <option value={-1}>Auto-generate ticket numbers</option>
                        {parsedTable.headers.map((h, i) => (
                          <option key={i} value={i}>
                            {h || `Column ${i + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="map-dept-col" className="block text-xs font-semibold text-slate-700">
                        Branch / Department Column (Optional)
                      </label>
                      <select
                        id="map-dept-col"
                        value={mapping.departmentCol}
                        onChange={(e) =>
                          setMapping((prev) => ({ ...prev, departmentCol: Number(e.target.value) }))
                        }
                        className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
                      >
                        <option value={-1}>None</option>
                        {parsedTable.headers.map((h, i) => (
                          <option key={i} value={i}>
                            {h || `Column ${i + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="map-contact-col" className="block text-xs font-semibold text-slate-700">
                        Contact / Email Column (Optional)
                      </label>
                      <select
                        id="map-contact-col"
                        value={mapping.contactCol}
                        onChange={(e) =>
                          setMapping((prev) => ({ ...prev, contactCol: Number(e.target.value) }))
                        }
                        className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
                      >
                        <option value={-1}>None</option>
                        {parsedTable.headers.map((h, i) => (
                          <option key={i} value={i}>
                            {h || `Column ${i + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-3">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={mapping.hasHeaderRow}
                        onChange={(e) =>
                          setMapping((prev) => ({ ...prev, hasHeaderRow: e.target.checked }))
                        }
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      First row is a header row (skip during import)
                    </label>

                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-2 rounded-lg bg-slate-100 p-1">
                        <button
                          type="button"
                          onClick={() => setImportMode('replace')}
                          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                            importMode === 'replace'
                              ? 'bg-white text-slate-900 shadow-sm font-semibold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Replace Current Pool
                        </button>
                        <button
                          type="button"
                          onClick={() => setImportMode('append')}
                          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                            importMode === 'append'
                              ? 'bg-white text-slate-900 shadow-sm font-semibold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Add to Current Pool
                        </button>
                      </div>
                      {importMode === 'replace' && (
                        <p className="text-[11px] text-slate-500">
                          Replacing the pool also clears existing drawn winners.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Preview Table */}
                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                      <span>Preview (first 5 rows with selected columns)</span>
                      <span className="font-mono font-semibold text-slate-800 tabular-nums">
                        {totalEstimatedCount.toLocaleString()} valid entries detected
                      </span>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-3.5 py-2.5 font-semibold">Name</th>
                            <th className="px-3.5 py-2.5 font-semibold">Ticket / Entry #</th>
                            <th className="px-3.5 py-2.5 font-semibold">Branch / Dept</th>
                            <th className="px-3.5 py-2.5 font-semibold">Contact</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-800">
                          {previewRows.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="px-3.5 py-2.5 font-medium">{row[mapping.nameCol] || '—'}</td>
                              <td className="px-3.5 py-2.5 font-mono text-slate-500">
                                {mapping.ticketCol >= 0
                                  ? row[mapping.ticketCol] || '—'
                                  : `ENTRY-${String(idx + 1).padStart(4, '0')}`}
                              </td>
                              <td className="px-3.5 py-2.5 text-slate-600">
                                {mapping.departmentCol >= 0 ? row[mapping.departmentCol] || '—' : '—'}
                              </td>
                              <td className="px-3.5 py-2.5 text-slate-500">
                                {mapping.contactCol >= 0 ? row[mapping.contactCol] || '—' : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="py-10 text-center text-sm text-slate-500">
                  No data rows found in this sheet. Try selecting another sheet tab.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer (for mapping confirmation) */}
        {selectedFile && parsedTable && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
            <span className="text-xs text-slate-600 tabular-nums">
              Ready to import{' '}
              <strong className="font-mono text-slate-900 font-bold">
                {totalEstimatedCount.toLocaleString()}
              </strong>{' '}
              participants into raffle
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={totalEstimatedCount === 0}
                className={`rounded-lg px-6 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50 ${palette.primaryBg} ${palette.primaryHover}`}
              >
                Load {totalEstimatedCount.toLocaleString()} Entries
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};