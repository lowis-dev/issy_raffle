# Raffle Studio 2026 (`issy_raffle`)

Automated raffle draw system built with React, TypeScript, Vite, and Tailwind CSS.

## Features

- **Flexible Entry Importing**:
  - **Local File Upload**: Drag-and-drop or browse `.xlsx`, `.xls`, `.csv`, or `.txt` files directly in the browser with sheet tab selection, automatic column mapping, and row previews.
  - **Google Sheets Link**: Import shared Google Sheets (`Anyone with the link can view`) directly by URL or Spreadsheet ID without signing in.
  - **Google Drive (OAuth)**: Browse Drive files and folders via Firebase Google Sign-In or a manual OAuth Bearer token.
  - **Paste List & Manual Entry**: Copy-paste rows directly from Excel/Google Sheets or add individual participants.
- **Sequenced Multi-Round Draws**: Pre-configured `150 -> 50 -> 35 -> 25` draw sequence with customizable rounds, prizes, batch sizes, and order.
- **Cryptographic Random Selection**: Unbiased winner picking via `crypto.getRandomValues` rejection sampling, optional auto-removal of winners (or all entries sharing a winner's name), and single-slot no-show redraws.
- **Live Draw Stage & Fullscreen Mode**: Decelerating reel reveal, synthesized Web Audio sound effects, confetti celebrations, and Spacebar shortcut in Stage View.
- **Winners Master List**: Filter by round, search, track prize claims, print, copy, or export to CSV and Excel (`.xlsx`).

## Local Development

Prerequisites: Node.js 20+ and npm.

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` — Start the Vite development server
- `npm run lint` — Run TypeScript type checking (`tsc --noEmit`)
- `npm test` — Run unit tests for the raffle engine and CSV parser
- `npm run build` — Build the production bundle into `dist/`
<!-- Verified push Tue Nov 24 16:42:06 PST 2026 -->
