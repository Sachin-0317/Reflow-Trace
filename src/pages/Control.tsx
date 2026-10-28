import { useState } from 'react';
import { useStore } from '../store';
import { DirectorPanel } from '../components/Shell';
import { PageHeader, Panel, Tabs } from '../components/ui';
import type { Config } from '../types';

type Tab = 'thresholds' | 'rules' | 'users' | 'notify' | 'privacy' | 'look' | 'integ' | 'director';

const USERS = [
  ['Institution admin', 'admin', 'Whole institution', 'active'], ['Collector team A', 'collector', 'Blocks A, B', 'active'],
  ['Collector team B', 'collector', 'Blocks C, D, Admin', 'active'], ['Driver, KWL-04', 'transporter', 'Route Ambattur', 'active'],
  ['Treatment operator', 'treatment', 'Ambattur', 'active'], ['Auditor', 'pibo', 'Read-only', 'active'],
];
const RULES = [
  ['Quantity variance', 'Step-to-step or end-to-end beyond tolerance', 'critical', 'Admin', 'merge repeats', '2 h'],
  ['In-transit window', 'Transport to receipt beyond window', 'critical', 'Admin, Transporter', 'merge repeats', '1 h'],
  ['Collection-to-treatment window', 'Collect to treat beyond window', 'high', 'Admin', 'merge repeats', '4 h'],
  ['Device offline', 'No heartbeat past stale timeout', 'medium', 'Admin', 'one per device', '12 h'],
];

export default function Control() {
  const { config, setConfig, theme, setTheme, lang, setLang, toast, mode, batches, points } = useStore();
  const [tab, setTab] = useState<Tab>('thresholds');
  const [c, setC] = useState<Config>(config);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [notif, setNotif] = useState({ inapp: true, email: false, critical: false, digest: false });
  const [reduce, setReduce] = useState(false);
  const dirty = JSON.stringify(c) !== JSON.stringify(config);

  const save = () => {
    const e: Record<string, string> = {};
    if (!(c.tolerancePct > 0)) e.tol = 'Tolerance must be a positive number.';
    if (!(c.fillWarn < c.fillCrit)) e.fill = 'Warning must be below critical.';
    if (c.fillCrit > 100 || c.fillWarn < 1) e.fill = e.fill ?? 'Fill thresholds must be between 1 and 100.';
    if (!(c.staleMin > 0)) e.stale = 'Timeout must be above zero.';
    for (const k of ['toCollectH', 'inTransitH', 'toTreatmentH'] as const) if (!(c.windows[k] > 0)) e[k] = 'Must be above zero.';
    setErrs(e);
    if (Object.keys(e).length) return toast('err', 'Fix the highlighted fields first.');
    setConfig(c);
    toast('ok', 'Settings saved and logged. Batches re-evaluated.');
  };
  const num = (v: string) => (v === '' ? NaN : Number(v));

  return (
    <div>
      <PageHeader title="Control" sub="Rules, tolerances and demo scenarios." right={dirty && <span className="chip k-attested">UNSAVED CHANGES</span>} />
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[
        { id: 'thresholds', label: 'Thresholds' }, { id: 'rules', label: 'Rules' }, { id: 'users', label: 'Users' }, { id: 'notify', label: 'Notifications' },
        { id: 'privacy', label: 'Privacy' }, { id: 'look', label: 'Appearance' }, { id: 'integ', label: 'Integrations' }, { id: 'director', label: 'Scenario Director' },
      ]} />
      {tab === 'thresholds' && (
        <div className="stack16" style={{ maxWidth: 720 }}>
          <Panel title="Quantity tolerance">
            <div className="field"><label htmlFor="tol">Variance tolerance (±%)</label><input id="tol" className="input mono" type="number" step="0.5" value={Number.isNaN(c.tolerancePct) ? '' : c.tolerancePct} onChange={(e) => setC({ ...c, tolerancePct: num(e.target.value) })} aria-invalid={!!errs.tol} />
              {errs.tol && <span className="err" role="alert">{errs.tol}</span>}
              <span className="hint">Default 5%. It separates normal handling loss (moisture, weighing variance) from a genuine break. A rule, not proof that a smaller gap is harmless.</span></div>
          </Panel>
          <Panel title="Fill thresholds">
            <div className="grid2">
              <div className="field"><label htmlFor="fw">Warning (%)</label><input id="fw" className="input mono" type="number" value={Number.isNaN(c.fillWarn) ? '' : c.fillWarn} onChange={(e) => setC({ ...c, fillWarn: num(e.target.value) })} aria-invalid={!!errs.fill} /></div>
              <div className="field"><label htmlFor="fc">Critical (%)</label><input id="fc" className="input mono" type="number" value={Number.isNaN(c.fillCrit) ? '' : c.fillCrit} onChange={(e) => setC({ ...c, fillCrit: num(e.target.value) })} aria-invalid={!!errs.fill} /></div>
            </div>
            {errs.fill && <span className="err" role="alert">{errs.fill}</span>}
            <div className="field" style={{ marginTop: 12 }}><label htmlFor="st">Stale-data timeout (minutes)</label><input id="st" className="input mono" type="number" value={Number.isNaN(c.staleMin) ? '' : c.staleMin} onChange={(e) => setC({ ...c, staleMin: num(e.target.value) })} aria-invalid={!!errs.stale} />{errs.stale && <span className="err" role="alert">{errs.stale}</span>}</div>
          </Panel>
          <Panel title="Timing windows (illustrative defaults)">
            <div className="grid3">
              {([['toCollectH', 'To collection (h)'], ['inTransitH', 'In transit (h)'], ['toTreatmentH', 'To treatment (h)']] as const).map(([k, l]) => (
                <div className="field" key={k}><label htmlFor={k}>{l}</label><input id={k} className="input mono" type="number" value={Number.isNaN(c.windows[k]) ? '' : c.windows[k]} onChange={(e) => setC({ ...c, windows: { ...c.windows, [k]: num(e.target.value) } })} aria-invalid={!!errs[k]} />{errs[k] && <span className="err">{errs[k]}</span>}</div>
              ))}
            </div>
            <p className="hint" style={{ marginTop: 8 }}>A timer turns amber near its limit and red only after the deadline has passed.</p>
          </Panel>
          <div className="row gap8"><button className="btn primary" onClick={save} disabled={!dirty}>Save</button><button className="btn ghost" onClick={() => { setC(config); setErrs({}); }} disabled={!dirty}>Revert</button></div>
        </div>
      )}
      {tab === 'rules' && (
        <Panel pad={false}><div className="tbl-wrap"><table className="t"><thead><tr><th>Rule</th><th>Trigger</th><th>Severity</th><th>Recipients</th><th>Dedup</th><th>Escalate after</th><th>On</th></tr></thead>
          <tbody>{RULES.map((r) => <tr key={r[0]}><td>{r[0]}</td><td className="small">{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td><td className="small">{r[4]}</td><td className="mono">{r[5]}</td><td><input type="checkbox" defaultChecked aria-label={`${r[0]} enabled`} /></td></tr>)}</tbody></table></div>
          <p className="small mute" style={{ padding: 12 }}>Rule edits are display-only in this prototype. The engine uses the thresholds tab.</p></Panel>
      )}
      {tab === 'users' && (
        <Panel pad={false}><table className="t"><thead><tr><th>Account</th><th>Role</th><th>Scope</th><th>Status</th></tr></thead>
          <tbody>{USERS.map((u) => <tr key={u[0]}><td>{u[0]}</td><td>{u[1]}</td><td>{u[2]}</td><td>{u[3]}</td></tr>)}</tbody></table>
          <p className="small mute" style={{ padding: 12 }}>These are staff or organisation accounts. There is no account type for a disposer.</p></Panel>
      )}
      {tab === 'notify' && (
        <Panel title="Channels" ><div className="stack">
          <label className="check"><input type="checkbox" checked={notif.inapp} onChange={(e) => setNotif({ ...notif, inapp: e.target.checked })} /> In-app</label>
          <label className="check"><input type="checkbox" checked={notif.email} onChange={(e) => setNotif({ ...notif, email: e.target.checked })} /> Email (not configured, no mail server connected)</label>
          <label className="check"><input type="checkbox" checked={notif.critical} onChange={(e) => setNotif({ ...notif, critical: e.target.checked })} /> Critical only</label>
          <label className="check"><input type="checkbox" checked={notif.digest} onChange={(e) => setNotif({ ...notif, digest: e.target.checked })} /> Daily digest</label>
        </div></Panel>
      )}
      {tab === 'privacy' && (
        <Panel hero title="Privacy"><div className="stack">
          <p className="display" style={{ fontSize: 30 }}>The waste is traceable. The person isn’t.</p>
          {['No names stored on batches or points', 'No phone numbers', 'No disposer login or account', 'No menstrual data or history', 'No cameras or per-person tracking at disposal points', 'QR codes carry an ID only', 'Public page sets no cookies and runs no analytics on individuals'].map((x) => <div key={x} className="row gap8"><span className="k-verified">●</span>{x}</div>)}
          <p className="small mute">Checklist reflects this prototype's data model. A deployment would need an independent review.</p>
        </div></Panel>
      )}
      {tab === 'look' && (
        <Panel title="Appearance"><div className="stack">
          <div className="row gap12"><span className="label" style={{ width: 90 }}>Theme</span><div className="toggle"><button className={theme === 'night' ? 'on' : ''} onClick={() => setTheme('night')}>NIGHT OPS</button><button className={theme === 'day' ? 'on' : ''} onClick={() => setTheme('day')}>DAY / PROJECTOR</button></div></div>
          <div className="row gap12"><span className="label" style={{ width: 90 }}>Language</span><div className="toggle"><button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button><button className={lang === 'ta' ? 'on' : ''} onClick={() => setLang('ta')}>தமிழ்</button></div></div>
          <label className="check"><input type="checkbox" checked={reduce} onChange={(e) => { setReduce(e.target.checked); document.documentElement.style.setProperty('--motion', e.target.checked ? '0' : '1'); }} /> Reduced motion (the system setting is always honoured)</label>
          <p className="hint">Tamil covers navigation, status labels and the public page. Remaining screens are English.</p>
        </div></Panel>
      )}
      {tab === 'integ' && (
        <Panel title="Integrations"><div className="grid2">
          <div className="kv"><span className="label">Mode</span><span className={`mode ${mode}`} style={{ height: 24 }}>{mode}</span></div>
          <div className="kv"><span className="label">Backend</span><span className="k-unknown">⊘ not connected</span></div>
          <div className="kv"><span className="label">ESP32 ingest</span><span className="k-unknown">⊘ no devices reporting. Sensors are simulated.</span></div>
          <div className="kv"><span className="label">Store</span><span>{batches.length} batches · {points.length} points · in memory only</span></div>
          <div className="kv"><span className="label">LIVE mode</span><span className="mute">Unavailable until a backend exists. The chip will not claim it.</span></div>
        </div></Panel>
      )}
      {tab === 'director' && <Panel title="Scenario Director"><DirectorPanel /></Panel>}
    </div>
  );
}
