import type { Priority, ScoredItem, Source, Status } from '../types';
import { PEOPLE, ME } from '../data/mockData';
import { duration, personName, SOURCE_LABEL } from '../format';

export interface ParsedQuery {
  text: string[];
  sources: Source[];
  statuses: (Status | 'snoozed')[];
  priorities: Priority[];
  people: string[];
  withinHours?: number;
  mine?: boolean;
  chips: { key: string; label: string }[];
}

const SOURCE_WORDS: Record<string, Source> = {
  slack: 'slack', chat: 'slack', message: 'slack', messages: 'slack',
  jira: 'jira', ticket: 'jira', tickets: 'jira', story: 'jira', stories: 'jira', bug: 'jira', bugs: 'jira',
  github: 'github', pr: 'github', prs: 'github', pull: 'github', 'pull-request': 'github', review: 'github', reviews: 'github',
  email: 'email', emails: 'email', mail: 'email', inbox: 'email',
};
const STATUS_WORDS: Record<string, Status | 'snoozed'> = {
  blocked: 'blocked', blocker: 'blocked', blockers: 'blocked', stuck: 'blocked',
  done: 'done', completed: 'done', closed: 'done', merged: 'done', shipped: 'done',
  snoozed: 'snoozed', progress: 'in_progress', open: 'todo',
};
const PRIORITY_WORDS: Record<string, Priority[]> = {
  critical: ['P0'], urgent: ['P0', 'P1'], p0: ['P0'], p1: ['P1'], high: ['P1'], important: ['P0', 'P1'], p2: ['P2'], low: ['P3'],
};
const STOP = new Set(['the', 'a', 'an', 'for', 'of', 'to', 'in', 'on', 'with', 'is', 'are', 'what', 'show', 'me', 'all', 'items', 'item', 'from', 'by', 'and', 'any', 'who', 'which', 'about', 'related', 'that', 'than', 'older', 'last', 'requests', 'request', 'waiting', 'need', 'needs', 'has', 'have', 'there']);

export function parseQuery(q: string): ParsedQuery {
  const p: ParsedQuery = { text: [], sources: [], statuses: [], priorities: [], people: [], chips: [] };
  const lower = q.toLowerCase();
  if (/\b(today|last 24 ?h(ours)?)\b/.test(lower)) { p.withinHours = 24; p.chips.push({ key: 'time', label: 'Last 24h' }); }
  else if (/\b(this week|last 7 days)\b/.test(lower)) { p.withinHours = 168; p.chips.push({ key: 'time', label: 'This week' }); }
  if (/\b(mine|my|assigned to me|for me|waiting on me)\b/.test(lower)) { p.mine = true; p.chips.push({ key: 'mine', label: 'Involves you' }); }

  const tokens = lower.replace(/[^\w#\-\s]/g, ' ').split(/\s+/).filter(Boolean);
  for (const tok of tokens) {
    if (['today', 'week', 'this', 'my', 'mine', '24h', 'hours', 'days', '7'].includes(tok)) continue;
    if (SOURCE_WORDS[tok]) {
      const s = SOURCE_WORDS[tok];
      if (!p.sources.includes(s)) { p.sources.push(s); p.chips.push({ key: 'src:' + s, label: SOURCE_LABEL[s] }); }
      if (tok.startsWith('review') && !p.statuses.includes('review')) { p.statuses.push('review'); p.chips.push({ key: 'st:review', label: 'In review' }); }
      continue;
    }
    if (STATUS_WORDS[tok]) { const s = STATUS_WORDS[tok]; if (!p.statuses.includes(s)) { p.statuses.push(s); p.chips.push({ key: 'st:' + s, label: s === 'in_progress' ? 'In progress' : s.charAt(0).toUpperCase() + s.slice(1) }); } continue; }
    if (PRIORITY_WORDS[tok]) { for (const pr of PRIORITY_WORDS[tok]) if (!p.priorities.includes(pr)) p.priorities.push(pr); p.chips.push({ key: 'pr:' + tok, label: tok === 'urgent' || tok === 'important' ? 'P0–P1' : tok.toUpperCase() === tok ? tok : tok.charAt(0).toUpperCase() + tok.slice(1) }); continue; }
    const person = PEOPLE.find((x) => x.name.toLowerCase().split(' ')[0] === tok.replace(/'s$/, ''));
    if (person) { if (!p.people.includes(person.id)) { p.people.push(person.id); p.chips.push({ key: 'p:' + person.id, label: person.name.split(' ')[0] }); } continue; }
    if (STOP.has(tok) || tok.length < 2) continue;
    p.text.push(tok);
  }
  return p;
}

function haystack(s: ScoredItem): string {
  const it = s.item;
  return [it.title, it.body, it.ref, it.channel, it.kind, it.labels.join(' '), ...it.thread.map((t) => t.text), personName(it.assignee), personName(it.author)]
    .join(' ').toLowerCase();
}

export function runSearch(items: ScoredItem[], parsed: ParsedQuery, now: number, removed: Set<string> = new Set()): ScoredItem[] {
  const has = (key: string) => !removed.has(key);
  return items
    .map((s) => {
      const it = s.item;
      if (parsed.sources.length && parsed.sources.some((x) => has('src:' + x)) && !parsed.sources.filter((x) => has('src:' + x)).includes(it.source)) return null;
      const sts = parsed.statuses.filter((x) => has('st:' + x));
      if (sts.length) {
        const ok = sts.some((st) => (st === 'snoozed' ? s.isSnoozed : st === 'blocked' ? it.status === 'blocked' || !!s.blocker : it.status === st));
        if (!ok) return null;
      } else if (s.isSnoozed) {
        // snoozed items still searchable, but ranked lower
      }
      if (parsed.priorities.length && parsed.chips.some((c) => c.key.startsWith('pr:') && has(c.key)) && !parsed.priorities.includes(s.priority)) return null;
      const ppl = parsed.people.filter((x) => has('p:' + x));
      if (ppl.length && !ppl.some((pid) => it.assignee === pid || it.author === pid || it.waitingOn === pid || it.reviewers?.includes(pid) || s.blocker?.personId === pid)) return null;
      if (parsed.withinHours && has('time') && now - Math.max(it.updatedAt, it.createdAt) > parsed.withinHours * 3600_000) return null;
      if (parsed.mine && has('mine') && !(it.mentionsManager || it.assignee === ME || it.author === ME)) return null;

      let rel = 0;
      if (parsed.text.length) {
        const hay = haystack(s);
        const title = it.title.toLowerCase();
        for (const t of parsed.text) {
          const stem = t.length > 4 ? t.replace(/(ing|ed|es|s)$/, '') : t;
          if (title.includes(stem)) rel += 3;
          else if (hay.includes(stem)) rel += 1;
          else return null;
        }
      }
      return { s, rank: rel * 10 + s.score / 10 - (s.isSnoozed ? 5 : 0) - (it.status === 'done' ? 3 : 0) };
    })
    .filter((x): x is { s: ScoredItem; rank: number } => !!x)
    .sort((a, b) => b.rank - a.rank)
    .map((x) => x.s);
}

/** One-sentence natural-language answer over the results (local engine). */
export function answerFor(results: ScoredItem[], parsed: ParsedQuery, now: number): string {
  if (!results.length) return 'No matching work items. Try fewer words, a teammate’s name, or a tool such as “github”.';
  const open = results.filter((r) => r.item.status !== 'done');
  const blockers = results.filter((r) => r.blocker);
  const top = open.slice().sort((a, b) => b.score - a.score)[0];
  const parts: string[] = [`Found ${results.length} item${results.length > 1 ? 's' : ''}${open.length !== results.length ? ` (${open.length} open)` : ''}.`];
  if (blockers.length && (parsed.statuses.includes('blocked') || blockers.length >= 2)) {
    const rank = { blocked: 0, review: 1, stale: 2 } as const;
    const longest = blockers.slice().sort((a, b) => rank[a.blocker!.kind] - rank[b.blocker!.kind] || a.blocker!.since - b.blocker!.since)[0];
    parts.push(`Longest-running blocker: ${longest.item.ref} (${duration(now - longest.blocker!.since)}) — ${longest.blocker!.cause}${longest.blocker!.waitingOn ? `, waiting on ${personName(longest.blocker!.waitingOn, true)}` : ''}.`);
  } else if (top) {
    parts.push(`Highest priority: ${top.item.title} (${top.priority}, ${top.reasons.slice(0, 2).join(', ').toLowerCase() || 'routine'}).`);
  }
  return parts.join(' ');
}

export const SUGGESTED_QUERIES = [
  'blocked items',
  'github prs waiting for review',
  'critical today',
  'what is waiting on me',
  'release 3.8',
  'Sneha',
];
