import { useMemo, useState } from 'react';
import { Layout } from '../components/Layout';
import { EmptyState, ItemRow } from '../components/ui';
import { Icon } from '../components/Icon';
import { useStore } from '../store';
import { navigate, useRoute } from '../router';
import { happenedToday, isActive, topToday } from '../ai/selectors';
import { SOURCE_LABEL } from '../format';
import { PEOPLE } from '../data/mockData';
import type { Priority, ScoredItem, Source } from '../types';

const TABS = [
  { key: 'all', label: 'All open' },
  { key: 'attention', label: 'Needs attention' },
  { key: 'today', label: 'Today' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'happened', label: 'Happened' },
  { key: 'snoozed', label: 'Snoozed' },
  { key: 'done', label: 'Done' },
] as const;
type TabKey = typeof TABS[number]['key'];

export function Feed() {
  const { scored, now } = useStore();
  const { params } = useRoute();
  const tab = (TABS.find((t) => t.key === params.get('tab'))?.key || 'all') as TabKey;
  const [sources, setSources] = useState<Source[]>([]);
  const [prio, setPrio] = useState<Priority | ''>('');
  const [personId, setPersonId] = useState('');
  const [sort, setSort] = useState<'priority' | 'recent' | 'due'>('priority');

  const byTab = useMemo(() => {
    const h = happenedToday(scored, now);
    const map: Record<TabKey, ScoredItem[]> = {
      all: scored.filter(isActive),
      attention: scored.filter((s) => isActive(s) && (s.priority === 'P0' || s.priority === 'P1')),
      today: topToday(scored, now),
      blocked: scored.filter((s) => isActive(s) && s.blocker),
      happened: h.all,
      snoozed: scored.filter((s) => s.isSnoozed && s.item.status !== 'done'),
      done: scored.filter((s) => s.item.status === 'done'),
    };
    return map;
  }, [scored, now]);

  const list = useMemo(() => {
    let l = byTab[tab].filter((s) =>
      (!sources.length || sources.includes(s.item.source)) &&
      (!prio || s.priority === prio) &&
      (!personId || s.item.assignee === personId || s.blocker?.personId === personId));
    if (sort === 'recent') l = [...l].sort((a, b) => Math.max(b.item.updatedAt, b.item.createdAt) - Math.max(a.item.updatedAt, a.item.createdAt));
    else if (sort === 'due') l = [...l].sort((a, b) => (a.item.dueAt ?? Infinity) - (b.item.dueAt ?? Infinity));
    else if (tab !== 'today' && tab !== 'happened') l = [...l].sort((a, b) => b.score - a.score);
    return l;
  }, [byTab, tab, sources, prio, personId, sort]);

  const filtered = sources.length > 0 || !!prio || !!personId;
  const clear = () => { setSources([]); setPrio(''); setPersonId(''); };
  const toggleSource = (s: Source) => setSources((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  return (
    <Layout title="Priority feed" subtitle="Every signal from Slack, Jira, GitHub and Email — ranked by AI, with the reason shown">
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'active' : ''} onClick={() => navigate(`/feed?tab=${t.key}`)}>
            {t.label}<span className="tab-count">{byTab[t.key].length}</span>
          </button>
        ))}
      </div>

      <div className="filters">
        <div className="chips" aria-label="Filter by source">
          {(['slack', 'jira', 'github', 'email'] as Source[]).map((s) => (
            <button key={s} className={`chip ${sources.includes(s) ? 'on' : ''}`} onClick={() => toggleSource(s)} aria-pressed={sources.includes(s)}>
              <Icon name={s} size={13} />{SOURCE_LABEL[s]}
            </button>
          ))}
        </div>
        <div className="selects">
          <label className="select"><span className="sr-only">Priority</span>
            <select value={prio} onChange={(e) => setPrio(e.target.value as Priority | '')}>
              <option value="">All priorities</option><option value="P0">P0 · Critical</option><option value="P1">P1 · High</option><option value="P2">P2 · Medium</option><option value="P3">P3 · Low</option>
            </select>
          </label>
          <label className="select"><span className="sr-only">Person</span>
            <select value={personId} onChange={(e) => setPersonId(e.target.value)}>
              <option value="">Everyone</option>
              {PEOPLE.filter((p) => !p.external).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="select"><span className="sr-only">Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              <option value="priority">Sort: AI priority</option><option value="recent">Sort: Most recent</option><option value="due">Sort: Due date</option>
            </select>
          </label>
          {filtered && <button className="btn btn-ghost btn-sm" onClick={clear}><Icon name="x" size={14} />Clear</button>}
        </div>
      </div>

      <div className="card card-flush">
        {list.length ? (
          <>
            <div className="list-head"><span>{list.length} item{list.length === 1 ? '' : 's'}</span><span className="muted small">Click any item for details · Assign, Snooze or Mark done inline</span></div>
            <div className="rows">{list.map((s) => <ItemRow key={s.item.id} s={s} />)}</div>
          </>
        ) : filtered ? (
          <EmptyState icon="search" title="No items match these filters" action={<button className="btn" onClick={clear}>Clear filters</button>}>
            Try removing a source or choosing “Everyone”.
          </EmptyState>
        ) : tab === 'snoozed' ? (
          <EmptyState icon="clock" title="Nothing snoozed">Snooze an item to hide it until later — it returns to your feed automatically.</EmptyState>
        ) : tab === 'done' ? (
          <EmptyState icon="check" title="Nothing completed yet" />
        ) : (
          <EmptyState icon="circleCheck" tone="success" title="Inbox zero">Nothing here right now. WorkRadar will surface new items as they come in.</EmptyState>
        )}
      </div>
    </Layout>
  );
}
