import { PEOPLE } from './data/mockData';
import type { Person } from './types';

export function person(id?: string): Person | undefined {
  if (!id) return undefined;
  return PEOPLE.find((p) => p.id === id);
}

export function personName(id?: string, first = false): string {
  const p = person(id);
  if (!p) return id || 'Unassigned';
  return first ? p.name.split(' ')[0] : p.name;
}

export function relTime(ts: number, now = Date.now()): string {
  const diff = now - ts;
  const abs = Math.abs(diff);
  const m = Math.round(abs / 60000);
  const h = Math.round(abs / 3600000);
  const d = Math.round(abs / 86400000);
  let s: string;
  if (m < 1) s = 'just now';
  else if (m < 60) s = `${m}m`;
  else if (h < 24) s = `${h}h`;
  else s = `${d}d`;
  if (s === 'just now') return s;
  return diff >= 0 ? `${s} ago` : `in ${s}`;
}

export function duration(ms: number): string {
  const h = ms / 3600000;
  if (h < 1) return `${Math.max(1, Math.round(ms / 60000))}m`;
  if (h < 24) return `${Math.round(h)}h`;
  const d = h / 24;
  return d < 10 ? `${Math.round(d * 10) / 10}d`.replace('.0d', 'd') : `${Math.round(d)}d`;
}

export function dueLabel(dueAt?: number, now = Date.now()): string | undefined {
  if (!dueAt) return undefined;
  const diff = dueAt - now;
  if (diff < 0) return `Overdue ${duration(-diff)}`;
  if (diff < 24 * 3600000) return `Due in ${duration(diff)}`;
  return `Due in ${duration(diff)}`;
}

export function fullDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export const SOURCE_LABEL = { slack: 'Slack', jira: 'Jira', github: 'GitHub', email: 'Email' } as const;
export const STATUS_LABEL = { todo: 'To do', in_progress: 'In progress', review: 'In review', blocked: 'Blocked', done: 'Done' } as const;
export const PRIORITY_LABEL = { P0: 'Critical', P1: 'High', P2: 'Medium', P3: 'Low' } as const;
