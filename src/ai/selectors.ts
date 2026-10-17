import type { Blocker, ScoredItem } from '../types';

const DAY = 24 * 3600_000;

export const isActive = (s: ScoredItem) => s.item.status !== 'done' && !s.isSnoozed;

export function needsAttention(items: ScoredItem[]): ScoredItem[] {
  return items.filter((s) => isActive(s) && (s.priority === 'P0' || s.priority === 'P1')).sort((a, b) => b.score - a.score);
}

export function topToday(items: ScoredItem[], now: number): ScoredItem[] {
  return items
    .filter((s) => isActive(s) && ((s.item.dueAt && s.item.dueAt - now <= DAY) || s.priority === 'P0'))
    .sort((a, b) => (a.item.dueAt ?? Infinity) - (b.item.dueAt ?? Infinity) || b.score - a.score);
}

export function happenedToday(items: ScoredItem[], now: number) {
  const shipped = items.filter((s) => s.item.status === 'done' && now - s.item.updatedAt <= DAY)
    .sort((a, b) => b.item.updatedAt - a.item.updatedAt);
  const created = items.filter((s) => s.item.status !== 'done' && now - s.item.createdAt <= DAY && s.item.severity !== 'low')
    .sort((a, b) => b.item.createdAt - a.item.createdAt);
  return { shipped, created, all: [...shipped, ...created].sort((a, b) => Math.max(b.item.updatedAt, b.item.createdAt) - Math.max(a.item.updatedAt, a.item.createdAt)) };
}

export interface BlockedPerson {
  personId: string;
  blockers: Blocker[];
  longestSince: number;
  worstKind: Blocker['kind'];
}

/** Groups blockers per person and de-duplicates the same blocker reported in several tools. */
export function blockedPeople(items: ScoredItem[]): BlockedPerson[] {
  const byPerson = new Map<string, Blocker[]>();
  for (const s of items) {
    if (!s.blocker || s.isSnoozed) continue;
    const list = byPerson.get(s.blocker.personId) || [];
    const dup = list.find((b) => (b.waitingOn && b.waitingOn === s.blocker!.waitingOn) || b.cause === s.blocker!.cause);
    if (dup) {
      // keep the earliest "since" and prefer the system-of-record item (Jira/GitHub) over chat
      if (s.blocker.since < dup.since) dup.since = s.blocker.since;
      if (s.item.source === 'jira' || s.item.source === 'github') { dup.itemId = s.item.id; if (s.blocker.kind === 'blocked') dup.kind = 'blocked'; }
      if (s.blocker.kind === 'blocked' && dup.kind !== 'blocked') { dup.kind = 'blocked'; dup.cause = s.blocker.cause; }
    } else list.push({ ...s.blocker });
    byPerson.set(s.blocker.personId, list);
  }
  const rank = { blocked: 0, review: 1, stale: 2 } as const;
  return [...byPerson.entries()]
    .map(([personId, blockers]) => ({
      personId,
      blockers: blockers.sort((a, b) => rank[a.kind] - rank[b.kind] || a.since - b.since),
      longestSince: Math.min(...blockers.map((b) => b.since)),
      worstKind: blockers.reduce<Blocker['kind']>((w, b) => (rank[b.kind] < rank[w] ? b.kind : w), 'stale'),
    }))
    .sort((a, b) => rank[a.worstKind] - rank[b.worstKind] || a.longestSince - b.longestSince);
}

export function workload(items: ScoredItem[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of items) {
    if (s.item.status === 'done' || !s.item.assignee) continue;
    m.set(s.item.assignee, (m.get(s.item.assignee) || 0) + 1);
  }
  return m;
}
