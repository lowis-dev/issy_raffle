import React from 'react';
import { Menu, Upload, X } from 'lucide-react';
import type { ActiveTab } from '../types/raffle';
import type { ThemePalette } from '../utils/theme';

interface TopBarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenDriveModal: () => void;
  isDriveConnected: boolean;
  palette: ThemePalette;
  mobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
}

const NAV_ITEMS: Array<{ id: ActiveTab; label: string }> = [
  { id: 'stage', label: 'Live Draw' },
  { id: 'participants', label: 'Main List' },
  { id: 'winners', label: 'Winners' },
  { id: 'customize', label: 'Customize' },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  onOpenDriveModal,
  isDriveConnected,
  palette,
  mobileMenuOpen,
  onToggleMobileMenu,
}) => {
  return (
    <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-3 px-4 sm:gap-8 sm:px-6">
        {/* Zone 1: Single-line brand title */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={onToggleMobileMenu}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 md:hidden"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <a
            href="#stage"
            onClick={(e) => {
              e.preventDefault();
              onSelectTab('stage');
            }}
            className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 sm:text-lg"
          >
            Raffle Studio 2026
          </a>
        </div>

        {/* Zone 2: 4 concise single-line navigation links */}
        <nav aria-label="Main navigation" className="hidden md:flex items-center gap-7">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 rounded-sm ${
                  palette.ring
                } ${
                  isActive
                    ? 'text-slate-950 font-semibold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    className={`absolute inset-x-0 -bottom-[17px] h-0.5 ${palette.barFill}`}
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenDriveModal}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0 sm:px-4 sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 shadow-sm ${palette.primaryBg} ${palette.primaryHover} ${palette.ring}`}
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            <span className="sm:hidden">{isDriveConnected ? 'Entries' : 'Import'}</span>
            <span className="hidden sm:inline">
              {isDriveConnected ? 'Google Drive Connected' : 'Import Entries (RAFFLE 2026)'}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile navigation strip */}
      {mobileMenuOpen && (
        <nav
          aria-label="Mobile navigation"
          className="border-t border-slate-200 bg-white px-4 py-2 md:hidden"
        >
          <div className="flex items-center gap-1 overflow-x-auto">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectTab(item.id);
                    onToggleMobileMenu();
                  }}
                  className={`rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
                    isActive
                      ? `${palette.softBg} ${palette.softText} font-semibold`
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
};
