import { Layout } from '../components/Layout';
import { AssignButton, Avatar, Card, EmptyState, ItemRow, PriorityPill, SnoozeMenu, SourceIcon, StatusPill } from '../components/ui';
import { Icon } from '../components/Icon';
import { useStore } from '../store';
import { href } from '../router';
import { suggestNextStep, threadSummary } from '../ai/insights';
import { dueLabel, duration, fullDate, personName, relTime, SOURCE_LABEL } from '../format';

export function ItemDetail({ id }: { id: string }) {
  const { byId, scored, now, markDone, reopen } = useStore();
  const s = byId.get(id);

  if (!s) {
    return (
      <Layout title="Item not found">
        <div className="card">
          <EmptyState icon="search" title="This item isn’t available" action={<a className="btn btn-primary" href={href('/feed')}>Back to priority feed</a>}>
            It may have been removed from its source, or that source is not syncing right now.
          </EmptyState>
        </div>
      </Layout>
    );
  }

  const it = s.item;
  const done = it.status === 'done';
  const related = it.related.map((r) => byId.get(r)).filter(Boolean) as typeof scored;

  return (
    <Layout title={it.ref} subtitle={<a className="link" href={href('/feed')}><Icon name="chevronLeft" size={14} /> Priority feed</a>}>
      <div className="detail">
        <div className="detail-main">
          <section className="card detail-head">
            <div className="detail-top">
              <SourceIcon source={it.source} size={42} />
              <div className="grow">
                <div className="row-meta">
                  {!done && <PriorityPill p={s.priority} score={s.score} />}
                  <StatusPill s={it.status} />
                  {s.isSnoozed && <span className="pill snoozed"><Icon name="clock" size={12} />Snoozed until {new Date(s.snoozedUntil!).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
                  <span className="muted small">{SOURCE_LABEL[it.source]} · {it.kind}{it.channel ? ` · ${it.channel}` : ''}</span>
                </div>
                <h2 className="detail-title">{it.title}</h2>
              </div>
            </div>
            <p className="detail-body">{it.body}</p>
            <div className="action-bar">
              {!done && <AssignButton id={it.id} />}
              {!done && <SnoozeMenu id={it.id} />}
              {done
                ? <button className="btn" onClick={() => reopen(it.id)}><Icon name="undo" />Reopen</button>
                : <button className="btn btn-primary" onClick={() => markDone(it.id)}><Icon name="check" />Mark done</button>}
              <span className="grow" />
              <button className="btn btn-ghost" title="Opens the original item in its source tool (disabled for mock data)" disabled>
                <Icon name="external" />Open in {SOURCE_LABEL[it.source]}
              </button>
            </div>
          </section>

          <section className="card ai-card">
            <header className="card-head"><h2><Icon name="sparkles" size={16} />AI insight</h2><span className="muted small">Explainable ranking</span></header>
            <div className="ai-grid">
              <div>
                <h4>Why it’s ranked {done ? '' : s.priority}</h4>
                {done ? <p className="muted">Completed — no longer ranked.</p> : (
                  <ul className="reasons">{s.reasons.map((r) => <li key={r}><Icon name="check" size={13} />{r}</li>)}</ul>
                )}
                {!done && <div className="score-bar" aria-label={`Priority score ${s.score} of 100`}><span style={{ width: `${s.score}%` }} className={`prio-bg-${s.priority}`} /><em>{s.score}/100</em></div>}
              </div>
              <div>
                <h4>Suggested next step</h4>
                <p className="next-step">{suggestNextStep(s, scored, now)}</p>
                <h4>Conversation summary</h4>
                <p className="muted">{threadSummary(s)}</p>
              </div>
            </div>
            {s.blocker && !done && (
              <div className="blocker-callout">
                <Icon name="alert" />
                <div><strong>{personName(s.blocker.personId)} {s.blocker.kind === 'stale' ? 'may be stuck' : 'is blocked'}</strong> for {duration(now - s.blocker.since)} — {s.blocker.cause}{s.blocker.waitingOn ? `, waiting on ${personName(s.blocker.waitingOn)}` : ''}.</div>
              </div>
            )}
          </section>

          <Card title={`Activity (${it.thread.length + s.log.length})`} icon="message">
            {it.thread.length + s.log.length === 0 ? <p className="muted pad">No activity yet.</p> : (
              <ol className="thread">
                {[...it.thread.map((t) => ({ ...t, mine: false })), ...s.log.map((l) => ({ author: 'u-priya', at: l.at, text: l.text, mine: true }))]
                  .sort((a, b) => a.at - b.at)
                  .map((t, i) => (
                    <li key={i} className={t.mine ? 'mine' : ''}>
                      <Avatar id={t.author} size={28} />
                      <div className="grow">
                        <div className="thread-meta"><strong>{personName(t.author)}</strong><span title={fullDate(t.at)}>{relTime(t.at, now)}</span>{t.mine && <span className="pill tiny">WorkRadar action</span>}</div>
                        <p>{t.text}</p>
                      </div>
                    </li>
                  ))}
              </ol>
            )}
          </Card>
        </div>

        <aside className="detail-side">
          <Card title="Details">
            <dl className="facts">
              <dt>Assignee</dt><dd><Avatar id={it.assignee} size={22} />{it.assignee ? personName(it.assignee) : 'Unassigned'}</dd>
              <dt>Reported by</dt><dd><Avatar id={it.author} size={22} />{personName(it.author)}</dd>
              {it.reviewers && <><dt>Reviewers</dt><dd>{it.reviewers.length ? it.reviewers.map((r) => personName(r)).join(', ') : 'None'}</dd></>}
              {it.dueAt && <><dt>Due</dt><dd className={it.dueAt - now < 86400_000 && !done ? 'danger' : ''}>{dueLabel(it.dueAt, now)}</dd></>}
              <dt>Created</dt><dd title={fullDate(it.createdAt)}>{relTime(it.createdAt, now)}</dd>
              <dt>Last update</dt><dd title={fullDate(it.updatedAt)}>{relTime(it.updatedAt, now)}</dd>
              <dt>Severity</dt><dd className="cap">{it.severity}</dd>
              {it.customerImpact && <><dt>Impact</dt><dd className="danger">Customer-facing</dd></>}
            </dl>
            {it.labels.length > 0 && <div className="labels">{it.labels.map((l) => <span key={l} className="label">{l}</span>)}</div>}
          </Card>
          {related.length > 0 && (
            <Card title="Linked across tools" icon="merge">
              <div className="rows">{related.map((r) => <ItemRow key={r.item.id} s={r} dense showActions={false} />)}</div>
            </Card>
          )}
        </aside>
      </div>
    </Layout>
  );
}
