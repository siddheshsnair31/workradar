import type { Blocker, Priority, WorkItem } from '../types';
import { duration, personName } from '../format';

/**
 * Priority engine (explainable): every point added to the score carries a
 * human-readable reason, so the UI can always answer "why is this ranked here?".
 * The LLM layer summarises and narrates; ranking stays deterministic and auditable.
 */
const SEVERITY_POINTS = { critical: 45, high: 28, medium: 14, low: 5 } as const;
const H = 3600_000;

export function scoreItem(item: WorkItem, now: number): { score: number; priority: Priority; reasons: string[] } {
  if (item.status === 'done') return { score: 0, priority: 'P3', reasons: ['Completed'] };

  const reasons: string[] = [];
  let score: number = SEVERITY_POINTS[item.severity];
  if (item.severity === 'critical') reasons.push('Critical severity');
  else if (item.severity === 'high') reasons.push('High severity');

  if (item.customerImpact) { score += 15; reasons.push('Customer impact'); }
  if (item.mentionsManager) { score += 10; reasons.push('Needs your input'); }

  if (item.dueAt) {
    const left = item.dueAt - now;
    if (left < 0) { score += 25; reasons.push(`Overdue by ${duration(-left)}`); }
    else if (left <= 24 * H) { score += 18; reasons.push(`Due in ${duration(left)}`); }
    else if (left <= 72 * H) { score += 8; reasons.push(`Due in ${duration(left)}`); }
  }

  if (item.status === 'blocked') {
    score += 12;
    reasons.push(item.waitingOn ? `Blocked on ${personName(item.waitingOn, true)}` : 'Blocked');
  }

  const age = now - item.createdAt;
  const idle = now - item.updatedAt;
  if (item.status === 'review' && age > 48 * H) { score += 10; reasons.push(`Waiting ${duration(age)} for review`); }
  if (item.status === 'review' && item.reviewers && item.reviewers.length === 0) { score += 3; reasons.push('No reviewer assigned'); }
  if (item.status === 'in_progress' && idle > 72 * H) { score += 10; reasons.push(`No update in ${duration(idle)}`); }
  if (item.ciFailing) { score += 5; reasons.push('CI failing'); }
  if (age < 3 * H) { score += 5; reasons.push('New in the last 3h'); }
  if (item.labels.includes('release-blocker') || item.labels.includes('release-3.8')) { score += 4; reasons.push('On release 3.8 path'); }

  score = Math.min(100, Math.round(score));
  const priority: Priority = score >= 70 ? 'P0' : score >= 45 ? 'P1' : score >= 25 ? 'P2' : 'P3';
  return { score, priority, reasons };
}

const BLOCKED_TEXT = /\b(blocked|waiting on|stuck|can'?t proceed|need access|waiting for)\b/i;

/** Blocker detection: explicit status, language cues, review bottlenecks and silent staleness. */
export function detectBlocker(item: WorkItem, now: number): Blocker | undefined {
  if (item.status === 'done') return undefined;
  const owner = item.assignee || item.author;

  if (item.status === 'blocked' || (item.waitingOn && BLOCKED_TEXT.test(item.body))) {
    return {
      itemId: item.id, personId: owner, kind: 'blocked',
      cause: item.waitingReason || 'Marked as blocked',
      since: item.blockedSince || item.updatedAt, waitingOn: item.waitingOn,
    };
  }
  if (item.source === 'github' && item.status === 'review' && now - item.createdAt > 48 * H) {
    return {
      itemId: item.id, personId: item.author, kind: 'review',
      cause: item.reviewers && item.reviewers.length ? `${item.ref} waiting for review` : `${item.ref} has no reviewer`,
      since: item.createdAt, waitingOn: item.reviewers?.[0],
    };
  }
  if (item.status === 'in_progress' && now - item.updatedAt > 72 * H) {
    return {
      itemId: item.id, personId: owner, kind: 'stale',
      cause: `${item.ref} has had no update in ${duration(now - item.updatedAt)}`,
      since: item.updatedAt,
    };
  }
  return undefined;
}
