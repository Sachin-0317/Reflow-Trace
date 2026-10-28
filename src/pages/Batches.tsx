import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { evalAll, useStore } from '../store';
import { Age, Empty, PageHeader, Panel, StatusBadge, VarianceChip } from '../components/ui';
import { fmtKg } from '../engine/reconcile';
import type { Confidence, StepKey } from '../types';

type SortKey = 'id' | 'mass' | 'age' | 'conf';
const PAGE = 15;
const CONF_ORDER: Record<Confidence, number> = { discrepancy: 0, pending: 1, attested: 2, verified: 3, unknown: 4 };

export default function Batches() {
  const { batches, config, now, role, points } = useStore();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [q, setQ] = useState('');
  const [conf, setConf] = useState<'' | Confidence>('');
  const [stage, setStage] = useState(sp.get('stage') ?? '');
  const [point, setPoint] = useState('');
  const [onlyDisc, setOnlyDisc] = useState(false);
  const [onlyPending, setOnlyPending] = useState(false);
  const [from, setFrom] = useState('');
  const [minKg, setMinKg] = useState('');
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: 'age', dir: 1 });
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    const all = evalAll(batches, config, now).map(({ b, ev }) => {
      const mass = b.steps[ev.lastStep]?.massKg ?? b.steps.collect?.massKg ?? null;
      const last = ev.endToEnd ?? null;
      return { b, ev, mass, pct: last?.pct ?? null, age: now - Date.parse(ev.lastAt) };
    });
    const s = q.trim().toLowerCase();
    let out = all.filter((r) =>
      (!s || r.b.id.toLowerCase().includes(s) || r.b.pointId.toLowerCase().includes(s)) &&
      (!conf || r.ev.confidence === conf) &&
      (!stage || r.ev.lastStep === (stage as StepKey)) &&
      (!point || r.b.pointId === point) &&
      (!onlyDisc || r.ev.breaches.length > 0) &&
      (!onlyPending || r.b.steps && Object.values(r.b.steps).some((x) => x?.offline && x.synced === false)) &&
      (!from || Date.parse(r.b.createdAt) >= Date.parse(from)) &&
      (!minKg || (r.mass ?? 0) >= Number(minKg)),
    );
    out = out.sort((a, b) => {
      const d = sort.dir;
      switch (sort.k) {
        case 'id': return a.b.id.localeCompare(b.b.id) * d;
        case 'mass': return ((a.mass ?? -1) - (b.mass ?? -1)) * d;
        case 'conf': return (CONF_ORDER[a.ev.confidence] - CONF_ORDER[b.ev.confidence]) * d;
        default: return (a.age - b.age) * d;
      }
    });
    return out;
  }, [batches, config, now, q, conf, stage, point, onlyDisc, onlyPending, from, minKg, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const p = Math.min(page, pages - 1);
  const slice = rows.slice(p * PAGE, p * PAGE + PAGE);
  const head = (k: SortKey, label: string, cls = '') => (
    <th className={`sort ${cls}`} onClick={() => setSort((s) => ({ k, dir: s.k === k ? (s.dir === 1 ? -1 : 1) : 1 }))} aria-sort={sort.k === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      {label}{sort.k === k ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
    </th>
  );

  const exportCsv = () => {
    const lines = ['batch,point,stage,mass_kg,variance_pct,confidence,last_event'];
    for (const r of rows) lines.push([r.b.id, r.b.pointId, r.ev.lastStep, r.mass ?? '', r.pct?.toFixed(1) ?? '', r.ev.confidence, r.ev.lastAt].join(','));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    a.download = 'trace-batches.csv';
    a.click();
  };

  return (
    <div>
      <PageHeader title={<>Batch register <span className="mono mute" style={{ fontSize: 16 }}>{rows.length}</span></>} sub="Anonymous batches in custody. No record here identifies a disposer."
        right={(role === 'admin' || role === 'pibo') && <button className="btn" onClick={exportCsv}>Export CSV</button>} />
      <div className="filters">
        <div className="field"><label htmlFor="q">Search</label><input id="q" className="input" placeholder="BATCH-2217, DP-B-01" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} /></div>
        <div className="field"><label htmlFor="cf">Confidence</label>
          <select id="cf" className="select" value={conf} onChange={(e) => { setConf(e.target.value as Confidence | ''); setPage(0); }}>
            <option value="">All</option><option value="verified">● Verified</option><option value="attested">▲ Attested</option><option value="discrepancy">◆ Discrepancy</option><option value="pending">◌ Pending</option>
          </select></div>
        <div className="field"><label htmlFor="sg">Stage</label>
          <select id="sg" className="select" value={stage} onChange={(e) => { setStage(e.target.value); setPage(0); }}>
            <option value="">All</option>{['generate', 'collect', 'transport', 'receive', 'treat', 'verify'].map((s) => <option key={s}>{s}</option>)}
          </select></div>
        <div className="field"><label htmlFor="pt">Point</label>
          <select id="pt" className="select" value={point} onChange={(e) => { setPoint(e.target.value); setPage(0); }}>
            <option value="">All</option>{points.map((x) => <option key={x.id}>{x.id}</option>)}
          </select></div>
        <div className="field"><label htmlFor="fr">From</label><input id="fr" type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="field" style={{ minWidth: 90 }}><label htmlFor="mk">Min kg</label><input id="mk" type="number" min="0" step="0.1" className="input mono" value={minKg} onChange={(e) => setMinKg(e.target.value)} /></div>
        <label className="check"><input type="checkbox" checked={onlyDisc} onChange={(e) => setOnlyDisc(e.target.checked)} /> Has discrepancy</label>
        <label className="check"><input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} /> Unsynced</label>
      </div>
      <Panel pad={false}>
        {rows.length === 0 ? <Empty text="No batches match. Clear a filter." action={<button className="btn sm" onClick={() => { setQ(''); setConf(''); setStage(''); setPoint(''); setOnlyDisc(false); setOnlyPending(false); setFrom(''); setMinKg(''); }}>Clear filters</button>} /> : (
          <>
            <div className="cards-mob">
              {slice.map((r) => (
                <a key={r.b.id} href={`/batch/${r.b.id}`} className="card" onClick={(e) => { e.preventDefault(); nav(`/batch/${r.b.id}`); }}>
                  <div className="row between"><StatusBadge c={r.ev.confidence} small /><Age iso={r.ev.lastAt} now={now} /></div>
                  <div className="row between" style={{ marginTop: 8 }}><b className="mono">{r.b.id}</b><span className="mono">{fmtKg(r.mass)}</span></div>
                  <div className="row between small mute" style={{ marginTop: 4 }}><span>{r.b.pointId} · {r.ev.lastStep}</span><VarianceChip pct={r.pct} tol={config.tolerancePct} /></div>
                </a>
              ))}
            </div>
            <div className="tbl-wrap hide-cards">
              <table className="t">
                <thead><tr>
                  {head('id', 'Batch')}<th>Source</th><th>Stage</th>{head('mass', 'Mass', 'num')}<th className="num">Variance</th>{head('conf', 'Confidence')}<th className="hide-tab">Last handoff</th>{head('age', 'Age')}
                </tr></thead>
                <tbody>
                  {slice.map((r) => (
                    <tr key={r.b.id} className="click" tabIndex={0} onClick={() => nav(`/batch/${r.b.id}`)} onKeyDown={(e) => e.key === 'Enter' && nav(`/batch/${r.b.id}`)}>
                      <td className="id">{r.b.id}</td><td className="id">{r.b.pointId}</td><td>{r.ev.lastStep}</td>
                      <td className="num">{fmtKg(r.mass)}</td>
                      <td className="num"><VarianceChip pct={r.pct} tol={config.tolerancePct} /></td>
                      <td><StatusBadge c={r.ev.confidence} small /></td>
                      <td className="hide-tab small">{r.b.steps[r.ev.lastStep]?.actor}</td>
                      <td><Age iso={r.ev.lastAt} now={now} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="row between" style={{ padding: '10px 16px' }}>
              <span className="small mute mono">{p * PAGE + 1}–{Math.min(rows.length, p * PAGE + PAGE)} of {rows.length}</span>
              <div className="row gap8">
                <button className="btn sm" disabled={p === 0} onClick={() => setPage(p - 1)}>Prev</button>
                <span className="mono small">{p + 1}/{pages}</span>
                <button className="btn sm" disabled={p >= pages - 1} onClick={() => setPage(p + 1)}>Next</button>
              </div>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
