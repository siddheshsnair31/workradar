# WorkRadar

**AI-powered daily command center for engineering managers.** WorkRadar pulls work signals from Slack, Jira, GitHub and Email into one ranked view that answers four questions in under two minutes:

1. What is the **top work** for today?
2. What **happened** today?
3. What needs my **immediate attention**?
4. **Who is blocked**?

> This MVP runs entirely on realistic **mock data** for an 8-person payments team. No backend or real integrations are required.

---

## Quick start

**Zero install:** open `dist/workradar-standalone.html` in any modern browser.

**Run from source** (Node 18+):

```bash
npm install
npm run dev        # http://localhost:5173 with live rebuild
npm run build      # writes dist/index.html + dist/workradar-standalone.html
npm run preview    # serves the production build
```

## Features

| Area | What it does |
|---|---|
| **Dashboard** | AI Daily Brief, four KPI tiles (needs attention, people blocked, top work today, happened today), attention queue, Who's Blocked panel, today's timeline and team snapshot. |
| **AI Daily Brief** | Headline plus four sections. Every bullet cites its source items (click to open). Related items across tools are merged into one bullet. Regenerate on demand. |
| **Priority feed** | Every item ranked 0–100 with the *reasons* shown. Tabs: All open, Needs attention, Today, Blocked, Happened, Snoozed, Done. Filter by source, priority and person; sort by priority, recency or due date. |
| **Item detail** | Full context, explainable score, AI suggested next step, conversation summary, blocker callout, activity log including your actions, and items linked across tools. |
| **Search** | Natural-language search ("blocked items for Sneha", "github prs waiting for review", "critical today", "what is waiting on me"). Shows how the query was understood as removable filter chips, plus a one-line AI answer. |
| **Actions** | **Assign** (with AI-suggested assignee based on skills, involvement and workload), **Mark done / Reopen**, **Snooze** (1h, 4h, tomorrow, next week). Every action has Undo and persists in localStorage. |
| **States** | Loading skeletons, empty workspace, inbox zero, no search results, partial sync error (banner + retry), full outage (error page + retry). Switch them in **Settings → Demo states**. |

## How the AI works

WorkRadar splits AI into two layers so ranking stays **explainable and auditable** while summaries stay **readable**:

1. **Local AI engine** (`src/ai/`) runs in the browser:
   - `scoring.ts`: weighted priority score from severity, customer impact, manager mentions, due date, blocked status, review age, staleness, CI and release path. Each point carries a human-readable reason.
   - `scoring.ts → detectBlocker`: explicit "Blocked" status, language cues ("waiting on", "stuck"), PRs waiting >48h for review, and in-progress items silent for >72h.
   - `selectors.ts`: de-duplicates the same blocker reported in several tools (e.g. a Jira ticket and a Slack message).
   - `brief.ts`: builds the structured daily brief from the ranked, de-duplicated signals.
   - `insights.ts`: suggested next step, thread summary and assignee suggestion.
   - `search.ts`: natural-language query parsing and relevance ranking.
2. **Claude (optional)** (`src/ai/claude.ts`): with an Anthropic API key in **Settings → AI engine**, the brief and search answers are written by Claude from the already-ranked context. Claude must cite item ids, which are validated before display. Any failure falls back to the local engine automatically.

> The browser-direct API call is for demo purposes only. A production build would route it through a backend so the key never reaches the client.

## Project structure

```
src/
  data/mockData.ts      Team + 30 work items in a unified event schema (relative timestamps)
  types.ts              WorkItem / ScoredItem / Blocker / DailyBrief types
  store.tsx             State, actions (assign / done / snooze / undo), sync + brief lifecycle
  ai/                   scoring, blockers, brief, insights, search, Claude client
  components/           Layout (sidebar, top bar, banners), shared UI, icons
  pages/                Dashboard, Feed, ItemDetail, Search, Settings
  styles.css            Design tokens (light + dark), components, responsive rules
scripts/                esbuild build + dev server, screenshot capture
```

## Unified event schema

Each source adapter maps into one `WorkItem` shape (`source`, `kind`, `ref`, `title`, `body`, `author`, `assignee`, `status`, `severity`, `dueAt`, `waitingOn`, `thread`, `related`, …). Replacing the mock data with real Slack, Jira, GitHub or Gmail adapters requires no UI changes.

## Tech

React 19 + TypeScript, bundled with esbuild. No UI or icon libraries, plain CSS with design tokens. State persists in localStorage.
