import type { DailyBrief, ScoredItem, Settings } from '../types';
import { dueLabel, duration, personName, SOURCE_LABEL } from '../format';

/**
 * Optional live LLM layer (Claude Messages API). The ranked, de-duplicated items
 * from the local engine are sent as compact context; the model only writes the
 * narrative and must cite item ids, which are validated before display.
 * Without an API key, or on any failure, the app falls back to the local brief.
 */
export const BRIEF_SYSTEM_PROMPT = `You are WorkRadar, a chief-of-staff assistant for an engineering manager.
You receive a JSON list of work items from Slack, Jira, GitHub and Email that have ALREADY been ranked by an explainable priority engine (score 0-100, P0 highest) with blocker detection.
Write the manager's morning brief.
Rules:
- Be specific and concise: name the item, the person and the consequence. Max 22 words per bullet.
- Merge items that describe the same issue across tools into one bullet (e.g. a Slack incident, its Jira bug and the hotfix PR).
- Never invent facts, people, numbers or items. Use only the provided data.
- Every bullet must cite the ids of the items it is based on in "itemIds".
- Sections, in this order, omit a section if empty: "attention" (Needs your attention, max 3), "blocked" (Who's blocked, max 4), "today" (Top work today, max 3, not repeating attention items), "happened" (What happened in the last 24h, max 2).
- "headline": one sentence (max 25 words) telling the manager what matters most and where to start.
Respond with JSON only, no markdown, matching:
{"headline": string, "sections": [{"key": "attention"|"blocked"|"today"|"happened", "label": string, "bullets": [{"text": string, "itemIds": string[]}]}]}`;

export function buildContext(items: ScoredItem[], now: number) {
  return items
    .filter((s) => !s.isSnoozed && (s.item.status !== 'done' || now - s.item.updatedAt < 24 * 3600_000))
    .sort((a, b) => b.score - a.score)
    .slice(0, 30)
    .map((s) => ({
      id: s.item.id,
      source: SOURCE_LABEL[s.item.source],
      ref: s.item.ref,
      kind: s.item.kind,
      title: s.item.title,
      summary: s.item.body,
      status: s.item.status,
      priority: s.priority,
      score: s.score,
      why: s.reasons,
      assignee: s.item.assignee ? personName(s.item.assignee) : null,
      due: dueLabel(s.item.dueAt, now) || null,
      blocker: s.blocker ? { person: personName(s.blocker.personId), cause: s.blocker.cause, for: duration(now - s.blocker.since), waitingOn: s.blocker.waitingOn ? personName(s.blocker.waitingOn) : null } : null,
      updated: duration(now - s.item.updatedAt) + ' ago',
      related: s.item.related,
    }));
}

async function callClaude(settings: Settings, system: string, user: string, maxTokens = 1200): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': settings.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: settings.model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Claude API ${res.status}${detail ? ': ' + detail.slice(0, 160) : ''}`);
  }
  const data = await res.json();
  const text = (data.content || []).filter((c: { type: string }) => c.type === 'text').map((c: { text: string }) => c.text).join('');
  if (!text) throw new Error('Empty response from Claude');
  return text;
}

function parseJson<T>(text: string): T {
  const cleaned = text.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

export async function generateClaudeBrief(items: ScoredItem[], settings: Settings, now: number): Promise<DailyBrief> {
  const ctx = buildContext(items, now);
  const text = await callClaude(settings, BRIEF_SYSTEM_PROMPT, `Team: Payments Squad. Manager: Siddhesh S Nair.\nItems:\n${JSON.stringify(ctx)}`);
  const raw = parseJson<{ headline: string; sections: DailyBrief['sections'] }>(text);
  const valid = new Set(items.map((s) => s.item.id));
  const sections = (raw.sections || [])
    .filter((s) => ['attention', 'blocked', 'today', 'happened'].includes(s.key))
    .map((s) => ({ ...s, bullets: (s.bullets || []).filter((b) => typeof b.text === 'string').map((b) => ({ text: b.text, itemIds: (b.itemIds || []).filter((id) => valid.has(id)) })) }))
    .filter((s) => s.bullets.length);
  if (!raw.headline || !sections.length) throw new Error('Claude returned an unexpected format');
  return { headline: raw.headline, sections, generatedAt: Date.now(), engine: 'claude', model: settings.model };
}

export async function askClaude(question: string, results: ScoredItem[], settings: Settings, now: number): Promise<string> {
  const ctx = buildContext(results, now).slice(0, 15);
  return callClaude(
    settings,
    'You are WorkRadar. Answer the engineering manager\'s question in 1-3 sentences using ONLY the provided work items. Cite refs like PAY-482 or PR #405. If the items do not answer it, say so.',
    `Question: ${question}\nMatching items:\n${JSON.stringify(ctx)}`,
    300,
  );
}
