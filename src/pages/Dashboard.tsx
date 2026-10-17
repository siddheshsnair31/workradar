import { Layout } from '../components/Layout';
import { Avatar, Card, EmptyState, ItemRow, Skeleton } from '../components/ui';
import { Icon } from '../components/Icon';
import { useStore } from '../store';
import { href, navigate } from '../router';
import { blockedPeople, happenedToday, needsAttention, topToday } from '../ai/selectors';
import { duration, greeting, personName, relTime } from '../format';
import { ME, PEOPLE } from '../data/mockData';
import type { BriefSection } from '../types';

const SECTION_ICON: Record<BriefSection['key'], string> = { attention: 'alert', blocked: 'users', today: 'flag', happened: 'activity' };

export function Dashboard() {
  const { scored, now, sync } = useStore();
  const me = PEOPLE.find((p) => p.id === ME)!;
  const date = new Date(now).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  if (sync.empty) {
    return (
      <Layout title={`${greeting()}, ${me.name.split(' ')[0]}`} subtitle={date}>
        <div className="card">
          <EmptyState icon="plug" title="No work to show yet"
            action={<><a className="btn btn-primary" href={href('/settings')}><Icon name="plug" />Connect a source</a><a className="btn" href={href('/settings')}>Load demo data</a></>}>
            Connect Slack, Jira, GitHub or Email and WorkRadar will build your first AI brief within a few minutes.
            Nothing is shared with your team until you choose to.
          </EmptyState>
        </div>
      </Layout>
    );
  }

  const attention = needsAttention(scored);
  const blocked = blockedPeople(scored);
  const today = topToday(scored, now);
  const happened = happenedToday(scored, now);

  return (
    <Layout title={`${greeting()}, ${me.name.split(' ')[0]}`} subtitle={`${date} · Here’s your team at a glance`}>
      <BriefCard />

      <div className="stats">
        <Stat icon="alert" tone="red" label="Needs attention" value={attention.length} hint={`${attention.filter((a) => a.priority === 'P0').length} critical`} to="/feed?tab=attention" />
        <Stat icon="users" tone="amber" label="People blocked" value={blocked.filter((b) => b.worstKind !== 'stale').length} hint={`${blocked.filter((b) => b.worstKind === 'stale').length} more at risk`} to="/feed?tab=blocked" />
        <Stat icon="flag" tone="blue" label="Top work today" value={today.length} hint="due ≤ 24h or critical" to="/feed?tab=today" />
        <Stat icon="activity" tone="green" label="Happened today" value={happened.all.length} hint={`${happened.shipped.length} shipped · ${happened.created.length} new`} to="/feed?tab=happened" />
      </div>

      <div className="grid-2">
        <Card title="Needs your attention" icon="alert" className="span-main"
          action={<a className="link" href={href('/feed?tab=attention')}>View all <Icon name="arrowRight" size={14} /></a>}>
          {attention.length ? (
            <div className="rows">{attention.slice(0, 5).map((s) => <ItemRow key={s.item.id} s={s} />)}</div>
          ) : (
            <EmptyState icon="circleCheck" tone="success" title="Nothing urgent">You’re all caught up. New critical items will appear here.</EmptyState>
          )}
        </Card>

        <div className="stack">
          <Card title="Who’s blocked" icon="users" action={<a className="link" href={href('/feed?tab=blocked')}>Feed <Icon name="arrowRight" size={14} /></a>}>
            {blocked.length ? (
              <ul className="blocked-list">
                {blocked.map((bp) => {
                  const b = bp.blockers[0];
                  return (
                    <li key={bp.personId} onClick={() => navigate(`/item/${b.itemId}`)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate(`/item/${b.itemId}`)}>
                      <Avatar id={bp.personId} size={34} />
                      <div className="grow">
                        <div className="bl-top">
                          <strong>{personName(bp.personId)}</strong>
                          <span className={`kind kind-${bp.worstKind}`}>{bp.worstKind === 'blocked' ? 'Blocked' : bp.worstKind === 'review' ? 'Waiting review' : 'At risk'}</span>
                        </div>
                        <p>{b.cause}{b.waitingOn ? <> · on <b>{personName(b.waitingOn, true)}</b></> : null}</p>
                        {bp.blockers.length > 1 && <p className="muted small">+{bp.blockers.length - 1} more</p>}
                      </div>
                      <span className="age" title="Blocked for">{duration(now - b.since)}</span>
                    </li>
                  );
                })}
              </ul>
            ) : <EmptyState icon="circleCheck" tone="success" title="No one is blocked" />}
          </Card>

          <Card title="What happened today" icon="activity">
            {happened.all.length ? (
              <ol className="timeline">
                {happened.all.slice(0, 7).map((s) => (
                  <li key={s.item.id} onClick={() => navigate(`/item/${s.item.id}`)}>
                    <span className={`tl-dot ${s.item.status === 'done' ? 'tl-done' : 'tl-new'}`}><Icon name={s.item.status === 'done' ? 'check' : s.item.source} size={11} /></span>
                    <div className="grow">
                      <p className="clamp1">{s.item.title}</p>
                      <small>{s.item.status === 'done' ? 'Completed' : 'New'} · {s.item.ref} · {relTime(s.item.status === 'done' ? s.item.updatedAt : s.item.createdAt, now)}</small>
                    </div>
                  </li>
                ))}
              </ol>
            ) : <EmptyState icon="activity" title="Quiet day so far" />}
          </Card>
        </div>
      </div>

      <Card title="Top work today" icon="flag" action={<a className="link" href={href('/feed?tab=today')}>View all <Icon name="arrowRight" size={14} /></a>}>
        {today.length ? <div className="rows">{today.slice(0, 4).map((s) => <ItemRow key={s.item.id} s={s} />)}</div>
          : <EmptyState icon="calendar" title="Nothing due today" />}
      </Card>

      <TeamSnapshot />
    </Layout>
  );
}

function Stat({ icon, tone, label, value, hint, to }: { icon: string; tone: string; label: string; value: number; hint: string; to: string }) {
  return (
    <a className={`stat stat-${tone}`} href={href(to)}>
      <span className="stat-icon"><Icon name={icon} size={18} /></span>
      <span className="stat-body">
        <span className="stat-label">{label}</span>
        <span className="stat-value">{value}</span>
        <span className="stat-hint">{hint}</span>
      </span>
      <Icon name="chevronRight" className="stat-go" />
    </a>
  );
}

function BriefCard() {
  const { brief, regenerateBrief, now, settings, byId } = useStore();
  const data = brief.data;
  return (
    <section className="brief" aria-labelledby="brief-title">
      <header className="brief-head">
        <div className="brief-title">
          <span className="brief-badge"><Icon name="sparkles" size={16} /></span>
          <div>
            <h2 id="brief-title">AI Daily Brief</h2>
            <p>
              {data ? `Generated ${relTime(data.generatedAt, now)}` : 'Generating…'}
              {' · '}{data?.engine === 'claude' ? `Claude (${data.model})` : 'Local AI engine'}
              {brief.stale && <span className="stale"> · Work changed since this brief</span>}
            </p>
          </div>
        </div>
        <button className="btn btn-ghost-light" onClick={regenerateBrief} disabled={brief.loading}>
          <Icon name="refresh" className={brief.loading ? 'spin' : ''} />{brief.loading ? 'Thinking…' : 'Regenerate'}
        </button>
      </header>
      {brief.loading && !data ? <Skeleton lines={4} /> : data ? (
        <>
          <p className="headline">{data.headline}</p>
          <div className="brief-grid">
            {data.sections.map((sec) => (
              <div key={sec.key} className={`brief-sec sec-${sec.key}`}>
                <h3><Icon name={SECTION_ICON[sec.key]} size={14} />{sec.label}</h3>
                <ul>
                  {sec.bullets.map((b, i) => (
                    <li key={i}>
                      <span>{b.text}</span>
                      {b.itemIds.length > 0 && (
                        <span className="cites">
                          {b.itemIds.slice(0, 3).map((id) => byId.get(id) && (
                            <a key={id} href={href(`/item/${id}`)} className="cite"><Icon name={byId.get(id)!.item.source} size={11} />{byId.get(id)!.item.ref}</a>
                          ))}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {brief.error && <p className="brief-error"><Icon name="alert" size={13} /> Claude was unavailable ({brief.error.slice(0, 80)}). Showing the local brief.</p>}
          {settings.engine === 'local' && <p className="brief-foot">Every bullet links to its source. Connect Claude in Settings for an LLM-written brief.</p>}
        </>
      ) : <p className="headline">Nothing to summarise yet.</p>}
    </section>
  );
}

function TeamSnapshot() {
  const { scored, now } = useStore();
  const team = PEOPLE.filter((p) => !p.external && p.id !== ME);
  const blocked = blockedPeople(scored);
  return (
    <Card title="Team snapshot" icon="users">
      <div className="team-grid">
        {team.map((p) => {
          const mine = scored.filter((s) => s.item.assignee === p.id && s.item.status !== 'done');
          const bp = blocked.find((b) => b.personId === p.id);
          const doneToday = scored.filter((s) => s.item.assignee === p.id && s.item.status === 'done' && now - s.item.updatedAt < 86400_000).length;
          const state = bp?.worstKind === 'blocked' ? 'blocked' : bp ? 'risk' : 'ok';
          return (
            <div key={p.id} className={`member member-${state}`}>
              <div className="member-top">
                <Avatar id={p.id} size={34} />
                <div className="grow"><strong>{p.name}</strong><small>{p.role}</small></div>
                <span className={`state state-${state}`}>{state === 'blocked' ? 'Blocked' : state === 'risk' ? 'At risk' : 'On track'}</span>
              </div>
              <p className="focus"><Icon name="zap" size={12} />{p.focus}</p>
              <div className="member-stats"><span><b>{mine.length}</b> open</span><span><b>{mine.filter((m) => m.priority === 'P0' || m.priority === 'P1').length}</b> high-pri</span><span><b>{doneToday}</b> done today</span></div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
