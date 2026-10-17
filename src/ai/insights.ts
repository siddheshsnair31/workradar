import type { ScoredItem } from '../types';
import { PEOPLE, ME } from '../data/mockData';
import { dueLabel, personName } from '../format';

export function suggestNextStep(s: ScoredItem, all: ScoredItem[], now: number): string {
  const it = s.item;
  if (it.status === 'done') return 'Completed — no action needed.';
  const related = it.related.map((id) => all.find((x) => x.item.id === id)).filter(Boolean) as ScoredItem[];
  const pr = related.find((r) => r.item.source === 'github' && r.item.status === 'review');

  if (it.kind === 'Incident') {
    return pr
      ? `Make the rollback-vs-hotfix call now. ${pr.item.ref} is ready — ask ${personName(pr.item.reviewers?.[0], true)} to review it immediately, then update the customer escalation.`
      : `Confirm an incident owner and a next update time in ${it.channel}.`;
  }
  if (s.blocker?.kind === 'blocked' && it.waitingOn) {
    return `Nudge ${personName(it.waitingOn, true)} about “${it.waitingReason || 'the blocker'}”. If there is no movement within 4h, escalate or reassign.`;
  }
  if (s.blocker?.kind === 'review') {
    const r = it.reviewers?.[0];
    return r ? `Ask ${personName(r, true)} to review today, or reassign the review to someone with lighter load.` : 'Assign a reviewer — this PR has none.';
  }
  if (s.blocker?.kind === 'stale') return `Check in with ${personName(it.assignee, true)}: confirm it is still on track or move it to the next release.`;
  if (it.source === 'email' && it.customerImpact) return `Reply with an acknowledgement and an ETA${related[0] ? `, referencing ${related[0].item.ref}` : ''}. Loop in the incident owner.`;
  if (it.mentionsManager && it.labels.includes('decision')) return `Make the call today and reply in the thread so ${personName(it.author, true)} can proceed.`;
  if (it.mentionsManager) return `This is waiting on you — ${dueLabel(it.dueAt, now)?.toLowerCase() || 'respond when you can'}.`;
  if (it.ciFailing) return `Ask ${personName(it.assignee, true)} for an ETA on the failing CI checks.`;
  if (it.dueAt && it.dueAt - now < 24 * 3600_000) return `Confirm ${personName(it.assignee, true)} is on track — ${dueLabel(it.dueAt, now)?.toLowerCase()}.`;
  return 'No action needed from you right now — keep an eye on it.';
}

export function threadSummary(s: ScoredItem): string {
  const t = s.item.thread;
  if (!t.length) return 'No discussion yet.';
  const people = [...new Set(t.map((m) => personName(m.author, true)))];
  const last = t[t.length - 1];
  const short = last.text.length > 110 ? last.text.slice(0, 107) + '…' : last.text;
  return `${t.length} message${t.length > 1 ? 's' : ''} from ${people.join(', ')}. Latest from ${personName(last.author, true)}: “${short}”`;
}

const SKILL: Record<string, string[]> = {
  'u-arjun': ['review', 'release-3.8', 'backend', 'frontend', 'decision'],
  'u-sneha': ['refunds', 'backend', 'docs'],
  'u-karan': ['frontend', 'checkout-redesign', 'a11y', 'reports'],
  'u-divya': ['qa', 'environment', 'release-3.8'],
  'u-rahul': ['incident', 'production', 'compliance', 'cost', 'maintenance', 'environment'],
  'u-ananya': ['ios', 'android', 'apple-pay', 'loyalty'],
  'u-vikram': ['webhooks', 'fraud', 'backend', 'dependencies', 'incident'],
};

/** Suggest an assignee: skill match on labels + involvement in related items, penalised by current load. */
export function suggestAssignee(s: ScoredItem, all: ScoredItem[], load: Map<string, number>): { personId: string; reason: string } | undefined {
  const team = PEOPLE.filter((p) => !p.external && p.id !== ME && p.id !== s.item.assignee);
  let best: { personId: string; score: number; reason: string } | undefined;
  for (const p of team) {
    if (p.role.startsWith('QA') && !s.item.labels.includes('qa')) continue;
    const skills = SKILL[p.id] || [];
    const matches = s.item.labels.filter((l) => skills.includes(l));
    const involved = s.item.related.some((id) => {
      const r = all.find((x) => x.item.id === id)?.item;
      return r && (r.assignee === p.id || r.reviewers?.includes(p.id));
    });
    const l = load.get(p.id) || 0;
    const score = matches.length * 3 + (involved ? 4 : 0) - l * 1.2;
    const reason = [matches.length ? `knows ${matches.slice(0, 2).join(', ')}` : '', involved ? 'already on a related item' : '', `${l} open item${l === 1 ? '' : 's'}`]
      .filter(Boolean).join(' · ');
    if (!best || score > best.score) best = { personId: p.id, score, reason };
  }
  return best && { personId: best.personId, reason: best.reason };
}
