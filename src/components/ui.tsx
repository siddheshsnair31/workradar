import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { person, personName, relTime, dueLabel, PRIORITY_LABEL, SOURCE_LABEL, STATUS_LABEL, duration } from '../format';
import type { Priority, ScoredItem, Source, Status } from '../types';
import { PEOPLE, ME } from '../data/mockData';
import { useStore } from '../store';
import { navigate } from '../router';
import { suggestAssignee } from '../ai/insights';
import { workload } from '../ai/selectors';

export function Avatar({ id, size = 26, ring }: { id?: string; size?: number; ring?: boolean }) {
  const p = person(id);
  if (!p) return <span className="avatar avatar-empty" style={{ width: size, height: size }} title="Unassigned"><Icon name="userPlus" size={size * 0.5} /></span>;
  return (
    <span className={`avatar ${ring ? 'avatar-ring' : ''}`} title={`${p.name} · ${p.role}`}
      style={{ width: size, height: size, background: p.color, fontSize: size * 0.38 }}>{p.initials}</span>
  );
}

export function SourceIcon({ source, size = 32 }: { source: Source; size?: number }) {
  return (
    <span className={`src-icon src-${source}`} style={{ width: size, height: size }} title={SOURCE_LABEL[source]}>
      <Icon name={source} size={size * 0.5} />
    </span>
  );
}

export function PriorityPill({ p, score }: { p: Priority; score?: number }) {
  return <span className={`pill prio prio-${p}`}>{p} · {PRIORITY_LABEL[p]}{score !== undefined ? <em> {score}</em> : null}</span>;
}

export function StatusPill({ s }: { s: Status }) {
  return <span className={`pill status status-${s}`}>{STATUS_LABEL[s]}</span>;
}

export function Card({ title, icon, action, children, className = '' }: { title?: ReactNode; icon?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <header className="card-head">
          <h2>{icon && <Icon name={icon} size={16} />}{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

function useOutside(ref: React.RefObject<HTMLElement | null>, onOut: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onOut(); };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onOut(); };
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [active, onOut, ref]);
}

export function SnoozeMenu({ id, compact }: { id: string; compact?: boolean }) {
  const { snooze, unsnooze, byId } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false), open);
  const s = byId.get(id);
  if (s?.isSnoozed) {
    return <button className={`btn ${compact ? 'btn-icon' : ''}`} onClick={(e) => { e.stopPropagation(); unsnooze(id); }} title="Un-snooze">
      <Icon name="undo" />{!compact && 'Un-snooze'}</button>;
  }
  const t = new Date();
  const tomorrow9 = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1, 9).getTime();
  const nextWeek = new Date(t.getFullYear(), t.getMonth(), t.getDate() + ((8 - t.getDay()) % 7 || 7), 9).getTime();
  const opts: [string, number][] = [['1 hour', Date.now() + 3600_000], ['4 hours', Date.now() + 4 * 3600_000], ['Tomorrow 9:00', tomorrow9], ['Next week', nextWeek]];
  return (
    <div className="menu-wrap" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button className={`btn ${compact ? 'btn-icon' : ''}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} title="Snooze">
        <Icon name="clock" />{!compact && <>Snooze<Icon name="chevronDown" size={14} /></>}
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-label">Snooze until</div>
          {opts.map(([label, until]) => (
            <button key={label} role="menuitem" onClick={() => { snooze(id, until, label); setOpen(false); }}>
              <span>{label}</span><small>{new Date(until).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AssignButton({ id, compact }: { id: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={`btn ${compact ? 'btn-icon' : ''}`} onClick={(e) => { e.stopPropagation(); setOpen(true); }} title="Assign">
        <Icon name="userPlus" />{!compact && 'Assign'}
      </button>
      {open && <AssignModal id={id} onClose={() => setOpen(false)} />}
    </>
  );
}

export function AssignModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { byId, scored, assign } = useStore();
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, onClose, true);
  const s = byId.get(id);
  if (!s) return null;
  const load = workload(scored);
  const suggestion = suggestAssignee(s, scored, load);
  const team = PEOPLE.filter((p) => !p.external);
  return (
    <div className="modal-backdrop" onClick={(e) => e.stopPropagation()}>
      <div className="modal" ref={ref} role="dialog" aria-modal="true" aria-labelledby="assign-title">
        <header className="modal-head">
          <div>
            <h3 id="assign-title">Assign {s.item.ref}</h3>
            <p className="muted small clamp1">{s.item.title}</p>
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </header>
        {suggestion && (
          <button className="suggest" onClick={() => { assign(id, suggestion.personId); onClose(); }}>
            <Icon name="sparkles" className="accent" />
            <Avatar id={suggestion.personId} size={30} />
            <span className="grow">
              <strong>Suggested: {personName(suggestion.personId)}</strong>
              <small>{suggestion.reason}</small>
            </span>
            <span className="btn btn-primary btn-sm">Assign</span>
          </button>
        )}
        <ul className="assign-list">
          {team.map((p) => (
            <li key={p.id}>
              <button onClick={() => { assign(id, p.id); onClose(); }} className={s.item.assignee === p.id ? 'current' : ''}>
                <Avatar id={p.id} size={30} />
                <span className="grow"><strong>{p.name}{p.id === ME ? ' (you)' : ''}</strong><small>{p.role}</small></span>
                <span className="load" title="Open items">{load.get(p.id) || 0} open</span>
                {s.item.assignee === p.id && <Icon name="check" className="accent" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ItemActions({ s, compact }: { s: ScoredItem; compact?: boolean }) {
  const { markDone, reopen } = useStore();
  const done = s.item.status === 'done';
  return (
    <div className="actions" onClick={(e) => e.stopPropagation()}>
      {!done && <AssignButton id={s.item.id} compact={compact} />}
      {!done && <SnoozeMenu id={s.item.id} compact={compact} />}
      {done
        ? <button className={`btn ${compact ? 'btn-icon' : ''}`} onClick={() => reopen(s.item.id)} title="Reopen"><Icon name="undo" />{!compact && 'Reopen'}</button>
        : <button className={`btn btn-done ${compact ? 'btn-icon' : ''}`} onClick={() => markDone(s.item.id)} title="Mark done"><Icon name="check" />{!compact && 'Mark done'}</button>}
    </div>
  );
}

export function ItemRow({ s, showActions = true, dense }: { s: ScoredItem; showActions?: boolean; dense?: boolean }) {
  const { now } = useStore();
  const it = s.item;
  const due = dueLabel(it.dueAt, now);
  const overdueSoon = it.dueAt && it.dueAt - now < 24 * 3600_000;
  return (
    <article className={`row ${dense ? 'row-dense' : ''} ${it.status === 'done' ? 'row-done' : ''}`} onClick={() => navigate(`/item/${it.id}`)}
      tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/item/${it.id}`); }} aria-label={it.title}>
      <span className={`row-bar prio-bg-${s.priority}`} />
      <SourceIcon source={it.source} size={dense ? 30 : 34} />
      <div className="row-main">
        <div className="row-meta">
          {it.status !== 'done' ? <PriorityPill p={s.priority} /> : <StatusPill s="done" />}
          <span className="ref">{it.ref}</span>
          <span className="dot">·</span><span>{it.kind}</span>
          <span className="dot">·</span><span>{relTime(Math.max(it.updatedAt, it.createdAt), now)}</span>
          {s.isSnoozed && <span className="pill snoozed"><Icon name="clock" size={12} /> until {new Date(s.snoozedUntil!).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
        </div>
        <h3 className="row-title">{it.title}</h3>
        {!dense && s.blocker && (
          <p className="row-blocker"><Icon name="alert" size={13} /> {s.blocker.cause}{s.blocker.waitingOn ? ` · waiting on ${personName(s.blocker.waitingOn, true)}` : ''}{s.blocker.kind !== 'stale' ? ` · ${duration(now - s.blocker.since)}` : ''}</p>
        )}
        {!dense && it.status !== 'done' && s.reasons.length > 0 && (
          <div className="why"><Icon name="sparkles" size={12} />{s.reasons.slice(0, 3).map((r) => <span key={r}>{r}</span>)}</div>
        )}
      </div>
      <div className="row-side">
        <div className="row-owner">
          {due && it.status !== 'done' && <span className={`due ${overdueSoon ? 'due-soon' : ''}`}><Icon name="calendar" size={12} />{due}</span>}
          <span className="owner"><Avatar id={it.assignee} size={22} /><span className="owner-name">{it.assignee ? personName(it.assignee, true) : 'Unassigned'}</span></span>
        </div>
        {showActions && <ItemActions s={s} compact />}
      </div>
    </article>
  );
}

export function EmptyState({ icon = 'inbox', title, children, action, tone = 'neutral' }: { icon?: string; title: string; children?: ReactNode; action?: ReactNode; tone?: 'neutral' | 'success' | 'error' }) {
  return (
    <div className={`empty empty-${tone}`} role={tone === 'error' ? 'alert' : undefined}>
      <div className="empty-art"><span className="ring r1" /><span className="ring r2" /><span className="empty-icon"><Icon name={icon} size={26} /></span></div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return <div className="skeleton" aria-busy="true" aria-label="Loading">{Array.from({ length: lines }).map((_, i) => <span key={i} style={{ width: `${92 - i * 13}%` }} />)}</div>;
}

export function Toasts() {
  const { toasts, dismissToast } = useStore();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone || 'default'}`}>
          <Icon name={t.tone === 'error' ? 'alert' : 'circleCheck'} />
          <span className="grow">{t.text}</span>
          {t.undo && <button className="toast-undo" onClick={() => { t.undo!(); dismissToast(t.id); }}>Undo</button>}
          <button className="toast-x" onClick={() => dismissToast(t.id)} aria-label="Dismiss"><Icon name="x" size={14} /></button>
        </div>
      ))}
    </div>
  );
}
