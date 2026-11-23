import type { ThemeAccent } from '../types/raffle';

export interface ThemePalette {
  id: ThemeAccent;
  label: string;
  swatch: string;
  primaryBg: string;
  primaryHover: string;
  primaryText: string;
  softBg: string;
  softText: string;
  softBorder: string;
  ring: string;
  barFill: string;
  confettiColors: string[];
}

export const THEME_PALETTES: Record<ThemeAccent, ThemePalette> = {
  emerald: {
    id: 'emerald',
    label: 'Emerald Green',
    swatch: '#059669',
    primaryBg: 'bg-emerald-700',
    primaryHover: 'hover:bg-emerald-800',
    primaryText: 'text-emerald-700',
    softBg: 'bg-emerald-50',
    softText: 'text-emerald-800',
    softBorder: 'border-emerald-200',
    ring: 'focus-visible:ring-emerald-600',
    barFill: 'bg-emerald-600',
    confettiColors: ['#059669', '#10b981', '#f59e0b', '#0f172a'],
  },
  blue: {
    id: 'blue',
    label: 'Royal Blue',
    swatch: '#1d4ed8',
    primaryBg: 'bg-blue-700',
    primaryHover: 'hover:bg-blue-800',
    primaryText: 'text-blue-700',
    softBg: 'bg-blue-50',
    softText: 'text-blue-800',
    softBorder: 'border-blue-200',
    ring: 'focus-visible:ring-blue-600',
    barFill: 'bg-blue-600',
    confettiColors: ['#1d4ed8', '#3b82f6', '#f59e0b', '#0f172a'],
  },
  crimson: {
    id: 'crimson',
    label: 'Festive Crimson',
    swatch: '#be123c',
    primaryBg: 'bg-rose-700',
    primaryHover: 'hover:bg-rose-800',
    primaryText: 'text-rose-700',
    softBg: 'bg-rose-50',
    softText: 'text-rose-800',
    softBorder: 'border-rose-200',
    ring: 'focus-visible:ring-rose-600',
    barFill: 'bg-rose-600',
    confettiColors: ['#be123c', '#f43f5e', '#f59e0b', '#0f172a'],
  },
  amber: {
    id: 'amber',
    label: 'Grand Gold',
    swatch: '#b45309',
    primaryBg: 'bg-amber-700',
    primaryHover: 'hover:bg-amber-800',
    primaryText: 'text-amber-700',
    softBg: 'bg-amber-50',
    softText: 'text-amber-900',
    softBorder: 'border-amber-200',
    ring: 'focus-visible:ring-amber-600',
    barFill: 'bg-amber-600',
    confettiColors: ['#b45309', '#f59e0b', '#fbbf24', '#0f172a'],
  },
  slate: {
    id: 'slate',
    label: 'Obsidian Slate',
    swatch: '#0f172a',
    primaryBg: 'bg-slate-900',
    primaryHover: 'hover:bg-slate-800',
    primaryText: 'text-slate-900',
    softBg: 'bg-slate-100',
    softText: 'text-slate-800',
    softBorder: 'border-slate-300',
    ring: 'focus-visible:ring-slate-700',
    barFill: 'bg-slate-900',
    confettiColors: ['#0f172a', '#475569', '#f59e0b', '#10b981'],
  },
};
