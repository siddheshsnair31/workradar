import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, Logo } from './Icon';
import { Avatar, EmptyState } from './ui';
import { useStore } from '../store';
import { href, navigate, useRoute } from '../router';
import { needsAttention } from '../ai/selectors';
import { relTime, SOURCE_LABEL } from '../format';
import { ME, PEOPLE, TEAM_NAME } from '../data/mockData';
import type { Source } from '../types';

const NAV = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', match: (p: string) => p === '/' },
  { to: '/feed', label: 'Priority feed', icon: 'feed', match: (p: string) => p.startsWith('/feed') || p.startsWith('/item') },
  { to: '/search', label: 'Search', icon: 'search', match: (p: string) => p.startsWith('/search') },
  { to: '/settings', label: 'Settings', icon: 'settings', match: (p: string) => p.startsWith('/settings') },
];

export function Layout({ title, subtitle, actions, children }: { title: string; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  const { scored, sync, retrySync, now } = useStore();
  const { path } = useRoute();
  const [drawer, setDrawer] = useState(false);
  const attention = needsAttention(scored).length;
  const me = PEOPLE.find((p) => p.id === ME)!;
  useEffect(() => setDrawer(false), [path]);

  return (
    <div className="shell">
      <aside className={`sidebar ${drawer ? 'open' : ''}`}>
        <div className="brand"><Logo /><span>WorkRadar</span></div>
        <div className="team-chip"><Icon name="users" size={14} /><span className="grow">{TEAM_NAME}</span><small>{PEOPLE.filter((p) => !p.external).length - 1} people</small></div>
        <nav aria-label="Main">
          {NAV.map((n) => (
            <a key={n.to} href={href(n.to)} className={n.match(path) ? 'active' : ''}>
              <Icon name={n.icon} size={17} /><span className="grow">{n.label}</span>
              {n.to === '/feed' && attention > 0 && <span className="count">{attention}</span>}
            </a>
          ))}
        </nav>
        <div className="side-section">
          <div className="side-label">Connected sources</div>
          {(['slack', 'jira', 'github', 'email'] as Source[]).map((s) => {
            const failing = sync.failing.includes(s);
            return (
              <div key={s} className={`source-line ${failing ? 'failing' : ''}`}>
                <Icon name={s} size={15} /><span className="grow">{SOURCE_LABEL[s]}</span>
                <span className={`status-dot ${failing ? 'bad' : 'ok'}`} title={failing ? 'Sync failed' : 'Synced'} />
              </div>
            );
          })}
          <div className="side-note">Mock data · read-only</div>
        </div>
        <div className="me">
          <Avatar id={ME} size={32} />
          <div className="grow"><strong>{me.name}</strong><small>{me.role}</small></div>
        </div>
      </aside>
      {drawer && <div className="scrim" onClick={() => setDrawer(false)} />}

      <main className="main">
        <header className="topbar">
          <button className="btn btn-icon btn-ghost menu-btn" onClick={() => setDrawer(true)} aria-label="Open menu"><Icon name="menu" /></button>
          <div className="page-title">
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <div className="topbar-right">
            {!path.startsWith('/search') && <QuickSearch />}
            <button className={`sync-btn ${sync.failing.length ? 'warn' : ''}`} onClick={retrySync} disabled={sync.syncing} title="Sync now">
              <Icon name="refresh" size={14} className={sync.syncing ? 'spin' : ''} />
              <span>{sync.syncing ? 'Syncing…' : sync.failing.length ? 'Sync issue' : `Synced ${relTime(sync.lastSynced, now)}`}</span>
            </button>
            {actions}
          </div>
        </header>

        {sync.failing.length > 0 && !sync.outage && (
          <div className="banner banner-warn" role="status">
            <Icon name="wifiOff" />
            <span className="grow"><strong>Couldn’t sync {sync.failing.map((s) => SOURCE_LABEL[s]).join(', ')}.</strong> Last successful sync {relTime(sync.lastSynced, now)}. Slack items are hidden, so the brief may be incomplete.</span>
            <button className="btn btn-sm" onClick={retrySync} disabled={sync.syncing}>{sync.syncing ? 'Retrying…' : 'Retry now'}</button>
          </div>
        )}

        <div className="content">
          {sync.outage ? <OutageState /> : children}
        </div>
      </main>
    </div>
  );
}

function QuickSearch() {
  const [q, setQ] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') { e.preventDefault(); ref.current?.focus(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  return (
    <form className="quick-search" role="search" onSubmit={(e) => { e.preventDefault(); navigate(`/search?q=${encodeURIComponent(q)}`); }}>
      <Icon name="search" size={15} />
      <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask or search…" aria-label="Search work items" />
      <kbd>/</kbd>
    </form>
  );
}

function OutageState() {
  const { retrySync, sync } = useStore();
  return (
    <div className="card">
      <EmptyState icon="wifiOff" tone="error" title="We couldn’t load your workspace"
        action={<>
          <button className="btn btn-primary" onClick={retrySync} disabled={sync.syncing}><Icon name="refresh" className={sync.syncing ? 'spin' : ''} />{sync.syncing ? 'Retrying…' : 'Try again'}</button>
          <a className="btn" href={href('/settings')}>Check sources</a>
        </>}>
        WorkRadar couldn’t reach Slack, Jira, GitHub or Email (error 503 from the sync service). Your actions are saved locally and nothing was lost.
      </EmptyState>
    </div>
  );
}
