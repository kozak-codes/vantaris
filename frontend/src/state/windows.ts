import { signal, computed } from '@preact/signals';
import type { FunctionalComponent } from 'preact';

export interface WindowContentDescriptor {
  component: FunctionalComponent<any>;
  props: Record<string, any>;
}

export interface GameWindowState {
  id: string;
  title: string;
  content: WindowContentDescriptor;
  x: number;
  y: number;
  pinned: boolean;
  zIndex: number;
}

export const openWindows = signal<GameWindowState[]>([]);
export const favorites = signal<string[]>([]);

let nextZ = 100;

export function openWindow(
  id: string,
  title: string,
  content: WindowContentDescriptor,
): void {
  // If already open, just focus it.
  const existing = openWindows.value.find((w) => w.id === id);
  if (existing) {
    focusWindow(existing.id);
    return;
  }
  // Close all unpinned windows.
  openWindows.value = openWindows.value.filter((w) => w.pinned);
  const offset = openWindows.value.length * 30;
  const win: GameWindowState = {
    id,
    title,
    content,
    x: window.innerWidth - 360 - offset,
    y: 80 + offset,
    pinned: false,
    zIndex: ++nextZ,
  };
  openWindows.value = [...openWindows.value, win];
}

export function closeWindow(id: string): void {
  openWindows.value = openWindows.value.filter((w) => w.id !== id);
}

export function focusWindow(id: string): void {
  openWindows.value = openWindows.value.map((w) =>
    w.id === id ? { ...w, zIndex: ++nextZ } : w,
  );
}

export function setPinned(id: string, pinned: boolean): void {
  openWindows.value = openWindows.value.map((w) =>
    w.id === id ? { ...w, pinned } : w,
  );
}

export function togglePin(id: string): void {
  openWindows.value = openWindows.value.map((w) =>
    w.id === id ? { ...w, pinned: !w.pinned } : w,
  );
}

export function toggleFavorite(id: string): void {
  if (favorites.value.includes(id)) {
    favorites.value = favorites.value.filter((f) => f !== id);
  } else {
    favorites.value = [...favorites.value, id];
  }
}

export function isFavorite(id: string): boolean {
  return favorites.value.includes(id);
}

export function moveWindow(id: string, x: number, y: number): void {
  openWindows.value = openWindows.value.map((w) =>
    w.id === id ? { ...w, x, y } : w,
  );
}