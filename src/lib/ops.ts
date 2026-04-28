import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | string | null | undefined, opts?: { cents?: boolean }) {
  const numeric = Number(value ?? 0);
  const normalized = Number.isFinite(numeric) ? numeric : 0;
  const amount = opts?.cents ? normalized / 100 : normalized;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function formatDateLabel(
  value: string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    ...options,
  }).format(date);
}

export function formatDateTimeLabel(value: string | number | Date | null | undefined) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatTimeLabel(value: string | number | Date | null | undefined) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function humanizeToken(value: string | null | undefined) {
  if (!value) return '—';
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function parseJsonSafely<T>(value: string | null | undefined) {
  if (!value?.trim()) return null as T | null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null as T | null;
  }
}

export function buildDateFromParts(datePart?: string | null, timePart?: string | null) {
  if (!datePart) return null;
  const normalizedTime = timePart?.trim() ? timePart.trim() : '09:00';
  const parsed = new Date(`${datePart}T${normalizedTime}`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function isSameLocalDay(value: string | Date | null | undefined, reference = new Date()) {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  );
}

export function isWithinDays(value: string | Date | null | undefined, days: number, reference = new Date()) {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const start = new Date(reference);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  return date >= start && date <= end;
}
