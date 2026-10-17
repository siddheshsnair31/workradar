import { useState } from 'react';
import { Layout } from '../components/Layout';
import { Card } from '../components/ui';
import { Icon } from '../components/Icon';
import { useStore } from '../store';
import type { DemoMode } from '../types';
import { BRIEF_SYSTEM_PROMPT } from '../ai/claude';

const DEMO: { key: DemoMode; label: string; desc: string }[] = [
  { key: 'normal', label: 'Normal', desc: 'All four sources synced with mock data.' },
  { key: 'empty', label: 'Empty workspace', desc: 'First-run state before any source is connected.' },
  { key: 'partial_error', label: 'Slack sync error', desc: 'One source fails; banner + retry, partial data.' },
  { key: 'outage', label: 'Full outage', desc: 'Sync service unreachable; full error state.' },
];

export function Settings() {
  const { settings, updateSettings, resetDemo, regenerateBrief, sync } = useStore();
  const [key, setKey] = useState(settings.apiKey);
  const [showPrompt, setShowPrompt] = useState(false);

  return (
    <Layout title="Settings" subtitle="AI engine, data sources and demo states">
      <div className="settings">
        <Card title="AI engine" icon="sparkles">
          <div className="pad">
            <div className="radio-cards">
              <label className={settings.engine === 'local' ? 'on' : ''}>
                <input type="radio" name="engine" checked={settings.engine === 'local'} onChange={() => updateSettings({ engine: 'local' })} />
                <strong>Local AI engine</strong>
                <small>Explainable scoring, blocker detection and templated summaries. Runs in the browser, no data leaves the device.</small>
              </label>
              <label className={settings.engine === 'claude' ? 'on' : ''}>
                <input type="radio" name="engine" checked={settings.engine === 'claude'} onChange={() => updateSettings({ engine: 'claude' })} />
                <strong>Claude (Anthropic API)</strong>
                <small>LLM-written brief and search answers on top of the same ranking. Falls back to local if the call fails.</small>
              </label>
            </div>
            {settings.engine === 'claude' && (
              <form className="api-form" onSubmit={(e) => { e.preventDefault(); updateSettings({ apiKey: key.trim() }); setTimeout(regenerateBrief, 50); }}>
                <label>API key<input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-…" autoComplete="off" /></label>
                <label>Model<input value={settings.model} onChange={(e) => updateSettings({ model: e.target.value })} /></label>
                <button className="btn btn-primary" type="submit">Save & generate brief</button>
                <p className="muted small">Demo only: the key is stored in this browser’s localStorage and sent directly to api.anthropic.com. In production the call goes through a backend.</p>
              </form>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => setShowPrompt((s) => !s)}><Icon name="info" size={14} />{showPrompt ? 'Hide' : 'Show'} the brief system prompt</button>
            {showPrompt && <pre className="prompt">{BRIEF_SYSTEM_PROMPT}</pre>}
          </div>
        </Card>

        <Card title="Demo states" icon="zap">
          <div className="pad">
            <p className="muted small">Switch states to review the empty, partial-error and outage designs.</p>
            <div className="radio-cards cols-2">
              {DEMO.map((d) => (
                <label key={d.key} className={settings.demoMode === d.key ? 'on' : ''}>
                  <input type="radio" name="demo" checked={settings.demoMode === d.key} onChange={() => updateSettings({ demoMode: d.key })} />
                  <strong>{d.label}</strong><small>{d.desc}</small>
                </label>
              ))}
            </div>
            <button className="btn" onClick={resetDemo}><Icon name="undo" />Reset all demo data & actions</button>
          </div>
        </Card>

        <Card title="Sources" icon="plug">
          <ul className="source-settings">
            {(['slack', 'jira', 'github', 'email'] as const).map((s) => (
              <li key={s}>
                <Icon name={s} size={18} />
                <div className="grow"><strong>{s === 'github' ? 'GitHub' : s.charAt(0).toUpperCase() + s.slice(1)}</strong>
                  <small>{sync.failing.includes(s) ? 'Sync failed · will retry' : 'Mock adapter · read-only'}</small></div>
                <span className={`pill ${sync.failing.includes(s) ? 'status-blocked' : 'status-done'}`}>{sync.failing.includes(s) ? 'Error' : 'Connected'}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </Layout>
  );
}
