import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { DailyBrief, DemoMode, ItemState, ScoredItem, Settings, Source, Status } from './types';
import { ITEMS } from './data/mockData';
import { detectBlocker, scoreItem } from './ai/scoring';
import { generateLocalBrief } from './ai/brief';
import { generateClaudeBrief } from './ai/claude';
import { personName } from './format';

const STORAGE_KEY = 'workradar:v1';

interface Persisted { overlays: Record<string, ItemState>; settings: Settings }
interface Toast { id: number; text: string; undo?: () => void; tone?: 'default' | 'error' | 'success' }

const DEFAULT_SETTINGS: Settings = { engine: 'local', apiKey: '', model: 'claude-sonnet-5-5', demoMode: 'normal' };

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return { overlays: p.overlays || {}, settings: { ...DEFAULT_SETTINGS, ...(p.settings || {}) } };
    }
  } catch { /* storage unavailable - fall back to defaults */ }
  return { overlays: {}, settings: DEFAULT_SETTINGS };
}

function save(p: Persisted) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

interface BriefState { data?: DailyBrief; loading: boolean; error?: string; stale: boolean }

interface Store {
  now: number;
  scored: ScoredItem[];
  byId: Map<string, ScoredItem>;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  assign: (id: string, personId: string) => void;
  markDone: (id: string) => void;
  reopen: (id: string) => void;
  snooze: (id: string, until: number, label: string) => void;
  unsnooze: (id: string) => void;
  resetDemo: () => void;
  toasts: Toast[];
  toast: (text: string, opts?: { undo?: () => void; tone?: Toast['tone'] }) => void;
  dismissToast: (id: number) => void;
  brief: BriefState;
  regenerateBrief: () => void;
  sync: { lastSynced: number; failing: Source[]; syncing: boolean; outage: boolean; empty: boolean };
  retrySync: () => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(load, []);
  const [overlays, setOverlays] = useState<Record<string, ItemState>>(initial.overlays);
  const [settings, setSettings] = useState<Settings>(initial.settings);
  const [now, setNow] = useState(Date.now());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(Date.now() - 2 * 60_000);
  const [brief, setBrief] = useState<BriefState>({ loading: true, stale: false });
  const toastId = useRef(1);

  useEffect(() => { save({ overlays, settings }); }, [overlays, settings]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);

  const demo: DemoMode = settings.demoMode;

  const scored = useMemo<ScoredItem[]>(() => {
    if (demo === 'empty' || demo === 'outage') return [];
    return ITEMS
      .filter((it) => !(demo === 'partial_error' && it.source === 'slack'))
      .map((base) => {
        const ov = overlays[base.id];
        const item = { ...base, status: (ov?.status ?? base.status) as Status, assignee: ov?.assignee ?? base.assignee };
        if (ov?.status && ov.status !== 'blocked' && base.status === 'blocked') item.waitingOn = undefined;
        const { score, priority, reasons } = scoreItem(item, now);
        const snoozedUntil = ov?.snoozedUntil && ov.snoozedUntil > now ? ov.snoozedUntil : undefined;
        return { item, score, priority, reasons, blocker: detectBlocker(item, now), snoozedUntil, isSnoozed: !!snoozedUntil, log: ov?.log || [] };
      })
      .sort((a, b) => b.score - a.score);
  }, [overlays, now, demo]);

  const byId = useMemo(() => new Map(scored.map((s) => [s.item.id, s])), [scored]);

  const toast = useCallback((text: string, opts?: { undo?: () => void; tone?: Toast['tone'] }) => {
    const id = toastId.current++;
    setToasts((t) => [...t.slice(-2), { id, text, ...opts }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts?.undo ? 6000 : 3800);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  /** Applies an overlay change and offers Undo by restoring the previous overlay. */
  const mutate = useCallback((id: string, patch: (prev: ItemState) => ItemState, message: string) => {
    let previous: ItemState | undefined;
    setOverlays((o) => {
      previous = o[id];
      return { ...o, [id]: patch(o[id] || { log: [] }) };
    });
    toast(message, {
      tone: 'success',
      undo: () => setOverlays((o) => {
        const next = { ...o };
        if (previous) next[id] = previous; else delete next[id];
        return next;
      }),
    });
  }, [toast]);

  const assign = useCallback((id: string, personId: string) => {
    const it = ITEMS.find((x) => x.id === id);
    mutate(id, (p) => ({ ...p, assignee: personId, log: [...p.log, { at: Date.now(), text: `You assigned this to ${personName(personId)}` }] }),
      `Assigned ${it?.ref || 'item'} to ${personName(personId, true)}`);
  }, [mutate]);

  const markDone = useCallback((id: string) => {
    const it = ITEMS.find((x) => x.id === id);
    mutate(id, (p) => ({ ...p, status: 'done', snoozedUntil: undefined, log: [...p.log, { at: Date.now(), text: 'You marked this as done' }] }),
      `Marked “${it?.title.slice(0, 40)}${(it?.title.length || 0) > 40 ? '…' : ''}” as done`);
  }, [mutate]);

  const reopen = useCallback((id: string) => {
    const base = ITEMS.find((x) => x.id === id);
    const st: Status = base && base.status !== 'done' ? base.status : 'todo';
    mutate(id, (p) => ({ ...p, status: st, log: [...p.log, { at: Date.now(), text: 'You reopened this' }] }), `Reopened ${base?.ref || 'item'}`);
  }, [mutate]);

  const snooze = useCallback((id: string, until: number, label: string) => {
    const it = ITEMS.find((x) => x.id === id);
    mutate(id, (p) => ({ ...p, snoozedUntil: until, log: [...p.log, { at: Date.now(), text: `You snoozed this until ${label.toLowerCase()}` }] }),
      `Snoozed ${it?.ref || 'item'} until ${label.toLowerCase()}`);
  }, [mutate]);

  const unsnooze = useCallback((id: string) => {
    mutate(id, (p) => ({ ...p, snoozedUntil: undefined, log: [...p.log, { at: Date.now(), text: 'You un-snoozed this' }] }), 'Back in your feed');
  }, [mutate]);

  const resetDemo = useCallback(() => {
    setOverlays({});
    setSettings((s) => ({ ...s, demoMode: 'normal' }));
    toast('Demo data reset');
  }, [toast]);

  const updateSettings = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), []);

  // ---- AI brief ----
  const briefReq = useRef(0);
  const runBrief = useCallback(async (force: boolean) => {
    const req = ++briefReq.current;
    if (!scored.length) { setBrief({ loading: false, stale: false, data: undefined }); return; }
    setBrief((b) => ({ ...b, loading: true, error: undefined }));
    const t = Date.now();
    if (settings.engine === 'claude' && settings.apiKey) {
      try {
        const data = await generateClaudeBrief(scored, settings, t);
        if (req === briefReq.current) setBrief({ data, loading: false, stale: false });
      } catch (e) {
        if (req !== briefReq.current) return;
        const msg = e instanceof Error ? e.message : String(e);
        setBrief({ data: generateLocalBrief(scored, t), loading: false, stale: false, error: msg });
        toast('Claude brief failed — showing the local AI brief instead', { tone: 'error' });
      }
    } else {
      await new Promise((r) => setTimeout(r, force ? 700 : 450));
      if (req === briefReq.current) setBrief({ data: generateLocalBrief(scored, Date.now()), loading: false, stale: false });
    }
  }, [scored, settings, toast]);

  // Local engine re-summarises automatically when work changes; Claude briefs are marked stale instead (to save API calls).
  const useLocal = settings.engine === 'local' || !settings.apiKey;
  useEffect(() => {
    if (!brief.data || !scored.length) { runBrief(false); return; }
    if (useLocal) setBrief((b) => ({ ...b, data: generateLocalBrief(scored, Date.now()), loading: false, stale: false }));
    else setBrief((b) => ({ ...b, stale: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scored]);

  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) runBrief(true); // engine switched
    mounted.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.engine]);

  const retrySync = useCallback(() => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      setLastSynced(Date.now());
      if (settings.demoMode === 'partial_error' || settings.demoMode === 'outage') {
        setSettings((s) => ({ ...s, demoMode: 'normal' }));
        toast('Reconnected — all sources synced', { tone: 'success' });
      } else toast('All sources up to date');
    }, 1100);
  }, [settings.demoMode, toast]);

  const sync = useMemo(() => ({
    lastSynced: demo === 'partial_error' ? lastSynced - 2 * 3600_000 : lastSynced,
    failing: (demo === 'partial_error' ? ['slack'] : demo === 'outage' ? ['slack', 'jira', 'github', 'email'] : []) as Source[],
    syncing, outage: demo === 'outage', empty: demo === 'empty',
  }), [demo, lastSynced, syncing]);

  const value: Store = {
    now, scored, byId, settings, updateSettings, assign, markDone, reopen, snooze, unsnooze, resetDemo,
    toasts, toast, dismissToast, brief, regenerateBrief: () => runBrief(true), sync, retrySync,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside provider');
  return s;
}
