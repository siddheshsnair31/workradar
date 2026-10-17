import { useEffect, useMemo, useRef, useState } from 'react';
import { Layout } from '../components/Layout';
import { EmptyState, ItemRow } from '../components/ui';
import { Icon } from '../components/Icon';
import { useStore } from '../store';
import { navigate, useRoute } from '../router';
import { answerFor, parseQuery, runSearch, SUGGESTED_QUERIES } from '../ai/search';
import { askClaude } from '../ai/claude';
import { SOURCE_LABEL } from '../format';
import type { Source } from '../types';

let recent: string[] = [];

export function Search() {
  const { scored, now, settings } = useStore();
  const { params } = useRoute();
  const q = params.get('q') || '';
  const [input, setInput] = useState(q);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [llm, setLlm] = useState<{ text?: string; loading: boolean; error?: string }>({ loading: false });
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { setInput(q); setRemoved(new Set()); if (q) recent = [q, ...recent.filter((r) => r !== q)].slice(0, 5); ref.current?.focus(); }, [q]);

  const parsed = useMemo(() => parseQuery(q), [q]);
  const results = useMemo(() => (q.trim() ? runSearch(scored, parsed, now, removed) : []), [q, parsed, scored, now, removed]);
  const localAnswer = useMemo(() => (q.trim() ? answerFor(results, parsed, now) : ''), [q, results, parsed, now]);

  useEffect(() => {
    if (!q.trim() || settings.engine !== 'claude' || !settings.apiKey || !results.length) { setLlm({ loading: false }); return; }
    let cancelled = false;
    setLlm({ loading: true });
    askClaude(q, results, settings, now)
      .then((text) => !cancelled && setLlm({ text, loading: false }))
      .catch((e) => !cancelled && setLlm({ loading: false, error: e instanceof Error ? e.message : String(e) }));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, settings.engine, settings.apiKey]);

  const submit = (value: string) => navigate(`/search?q=${encodeURIComponent(value.trim())}`);
  const counts = results.reduce<Record<string, number>>((m, r) => ({ ...m, [r.item.source]: (m[r.item.source] || 0) + 1 }), {});

  return (
    <Layout title="Search" subtitle="Search across Slack, Jira, GitHub and Email — in plain English">
      <form className="search-hero" role="search" onSubmit={(e) => { e.preventDefault(); submit(input); }}>
        <Icon name="search" size={20} />
        <input ref={ref} value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. “blocked items for Sneha” or “github prs waiting for review”" aria-label="Search" />
        {input && <button type="button" className="btn btn-icon btn-ghost" onClick={() => { setInput(''); navigate('/search'); }} aria-label="Clear"><Icon name="x" /></button>}
        <button className="btn btn-primary" type="submit"><Icon name="sparkles" />Search</button>
      </form>

      {!q.trim() ? (
        <div className="search-start">
          <div className="card">
            <h3 className="mini-head">Try asking</h3>
            <div className="suggestions">
              {SUGGESTED_QUERIES.map((s) => <button key={s} className="chip" onClick={() => submit(s)}><Icon name="sparkles" size={12} />{s}</button>)}
            </div>
            {recent.length > 0 && <>
              <h3 className="mini-head">Recent</h3>
              <ul className="recent">{recent.map((r) => <li key={r}><button onClick={() => submit(r)}><Icon name="clock" size={14} />{r}</button></li>)}</ul>
            </>}
          </div>
          <div className="card tips">
            <h3 className="mini-head">How search understands you</h3>
            <ul>
              <li><b>Tools:</b> slack, jira, github / prs, email</li>
              <li><b>States:</b> blocked, done, snoozed, review</li>
              <li><b>Priority:</b> critical, urgent, high, low</li>
              <li><b>People:</b> any teammate’s first name</li>
              <li><b>Time:</b> today, this week · <b>You:</b> “waiting on me”</li>
            </ul>
          </div>
        </div>
      ) : (
        <>
          {parsed.chips.length > 0 && (
            <div className="interpreted">
              <span className="muted small"><Icon name="sparkles" size={12} /> Understood as:</span>
              {parsed.chips.map((c) => (
                <button key={c.key} className={`chip ${removed.has(c.key) ? 'off' : 'on'}`} onClick={() => setRemoved((r) => { const n = new Set(r); if (n.has(c.key)) n.delete(c.key); else n.add(c.key); return n; })}
                  title={removed.has(c.key) ? 'Re-apply filter' : 'Remove filter'}>
                  {c.label}{!removed.has(c.key) && <Icon name="x" size={12} />}
                </button>
              ))}
              {parsed.text.length > 0 && <span className="muted small">+ keywords: “{parsed.text.join(' ')}”</span>}
            </div>
          )}

          <div className="answer">
            <span className="brief-badge sm"><Icon name="sparkles" size={14} /></span>
            <div className="grow">
              <p>{llm.loading ? 'Asking Claude…' : llm.text || localAnswer}</p>
              <small className="muted">{llm.text ? `Answered by Claude (${settings.model})` : llm.error ? `Claude unavailable — local answer shown` : 'Local AI answer'} · {Object.entries(counts).map(([s, n]) => `${n} ${SOURCE_LABEL[s as Source]}`).join(' · ')}</small>
            </div>
          </div>

          <div className="card card-flush">
            {results.length ? (
              <div className="rows">{results.map((s) => <ItemRow key={s.item.id} s={s} />)}</div>
            ) : (
              <EmptyState icon="search" title={`No results for “${q}”`}
                action={<>{SUGGESTED_QUERIES.slice(0, 3).map((s) => <button key={s} className="chip" onClick={() => submit(s)}>{s}</button>)}</>}>
                Try fewer words, a teammate’s name, or a tool like “jira”. Snoozed and completed items are included in search.
              </EmptyState>
            )}
          </div>
        </>
      )}
    </Layout>
  );
}
