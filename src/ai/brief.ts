import type { BriefBullet, BriefSection, DailyBrief, ScoredItem } from '../types';
import { duration, dueLabel, personName, SOURCE_LABEL } from '../format';
import { blockedPeople, happenedToday, needsAttention, topToday } from './selectors';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * Local brief generator ("offline AI mode"). Produces the same structured
 * output the LLM is asked for, from ranked + de-duplicated signals, so the
 * dashboard works without an API key and acts as the fallback if the LLM fails.
 */
export function generateLocalBrief(items: ScoredItem[], now: number): DailyBrief {
  const byId = new Map(items.map((s) => [s.item.id, s]));
  const attention = needsAttention(items);
  const blocked = blockedPeople(items);
  const today = topToday(items, now);
  const happened = happenedToday(items, now);
  const covered = new Set<string>();

  // 1. Needs attention - cluster related items (incident + bug + PR) into one bullet.
  const attentionBullets: BriefBullet[] = [];
  for (const s of attention) {
    if (attentionBullets.length >= 3) break;
    if (covered.has(s.item.id)) continue;
    const linked = s.item.related.map((id) => byId.get(id)).filter((r): r is ScoredItem => !!r && r.item.status !== 'done' && !r.isSnoozed);
    const ids = [s.item.id, ...linked.map((l) => l.item.id)];
    ids.forEach((id) => covered.add(id));
    const why = s.reasons.filter((r) => !r.startsWith('New in')).slice(0, 2).map(lc).join(', ');
    const link = linked.length ? ` Also tracked in ${linked.length} other item${linked.length > 1 ? 's' : ''}.` : '';
    attentionBullets.push({ text: `${s.item.title} (${SOURCE_LABEL[s.item.source]}) — ${why}.${link}`, itemIds: ids });
  }

  // 2. Who's blocked
  const blockedBullets: BriefBullet[] = blocked.slice(0, 4).map((bp) => {
    const b = bp.blockers[0];
    const wait = b.waitingOn ? `, waiting on ${personName(b.waitingOn, true)}` : '';
    const label = b.kind === 'stale' ? 'has gone quiet' : b.kind === 'review' ? 'is waiting on review' : 'is blocked';
    const extra = bp.blockers.length > 1 ? ` (+${bp.blockers.length - 1} more)` : '';
    return { text: `${personName(bp.personId, true)} ${label} for ${duration(now - b.since)} — ${b.cause}${wait}${extra}.`, itemIds: bp.blockers.map((x) => x.itemId) };
  });

  // 3. Top work today (not already covered above)
  const todayBullets: BriefBullet[] = today
    .filter((s) => !covered.has(s.item.id))
    .slice(0, 3)
    .map((s) => {
      covered.add(s.item.id);
      const who = s.item.assignee ? personName(s.item.assignee, true) : 'you';
      return { text: `${s.item.title} — ${lc(dueLabel(s.item.dueAt, now) || 'today')}, owner: ${who}.`, itemIds: [s.item.id] };
    });

  // 4. What happened
  const happenedBullets: BriefBullet[] = [];
  if (happened.shipped.length) {
    const merged = happened.shipped.filter((s) => s.item.source === 'github').length;
    const parts = [
      merged ? plural(merged, 'PR') + ' merged' : '',
      ...happened.shipped.filter((s) => s.item.kind === 'Release').map((s) => lc(s.item.title.replace(' to production', ''))),
      ...happened.shipped.filter((s) => s.item.kind === 'Alert').map(() => '1 production alert resolved'),
    ].filter(Boolean);
    const other = happened.shipped.length - merged - happened.shipped.filter((s) => s.item.kind === 'Release' || s.item.kind === 'Alert').length;
    if (other > 0) parts.push(plural(other, 'other task') + ' completed');
    happenedBullets.push({ text: `Shipped: ${parts.join(', ')}.`, itemIds: happened.shipped.map((s) => s.item.id) });
  }
  if (happened.created.length) {
    const top = happened.created.slice().sort((a, b) => b.score - a.score).slice(0, 3);
    happenedBullets.push({
      text: `New since yesterday: ${plural(happened.created.length, 'notable item')}, including ${top.map((s) => `${lc(s.item.title)} (${SOURCE_LABEL[s.item.source]})`).join('; ')}.`,
      itemIds: top.map((s) => s.item.id),
    });
  }

  const sections: BriefSection[] = [
    { key: 'attention', label: 'Needs your attention', bullets: attentionBullets },
    { key: 'blocked', label: "Who's blocked", bullets: blockedBullets },
    { key: 'today', label: 'Top work today', bullets: todayBullets },
    { key: 'happened', label: 'What happened', bullets: happenedBullets },
  ].filter((s) => s.bullets.length > 0) as BriefSection[];

  const critical = attention.filter((s) => s.priority === 'P0').length;
  const blockedCount = blocked.filter((b) => b.worstKind !== 'stale').length;
  let headline: string;
  if (!attention.length && !blocked.length) headline = 'All clear — nothing needs your attention right now.';
  else {
    const a = attention.length ? `${plural(attention.length, 'item')} need${attention.length === 1 ? 's' : ''} your attention${critical ? ` (${critical} critical)` : ''}` : 'Nothing urgent';
    const b = blockedCount ? ` and ${plural(blockedCount, 'teammate')} ${blockedCount === 1 ? 'is' : 'are'} blocked` : '';
    headline = `${a}${b}.` + (attention[0] ? ` Start with “${attention[0].item.title}”.` : '');
  }

  return { headline, sections, generatedAt: now, engine: 'local' };
}
