import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FACILITIES, evalAll, useStore } from '../store';
import { Modal, PageHeader, Panel, SegmentedBar, fmtDT } from '../components/ui';
import { coverage as coverageOf, fmtKg } from '../engine/reconcile';
import { BatchSheet } from '../components/EvidenceSheet';
import type { Confidence } from '../types';

function median(a: number[]) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export default function Evidence() {
  const { batches, config, now, points, discrepancies } = useStore();
  const [days, setDays] = useState(30);
  const [sheet, setSheet] = useState<string | null>(null);
  const [period, setPeriod] = useState(false);
  const since = now - days * 24 * 3600_000;
  const ev = useMemo(() => evalAll(batches, config, now).filter((e) => Date.parse(e.b.createdAt) >= since), [batches, config, now, since]);
  const c: Record<Confidence, number> = { verified: 0, attested: 0, discrepancy: 0, pending: 0, unknown: 0 };
  ev.forEach((e) => c[e.ev.confidence]++);
  const kg = (s: 'collect' | 'treat') => ev.reduce((a, e) => a + (e.b.steps[s]?.massKg ?? 0), 0);
  const vp = ev.length ? (c.verified / ev.length) * 100 : null;
  const attShare = ev.length ? (c.attested / ev.length) * 100 : null;
  const tCT = median(ev.filter((e) => e.b.steps.collect && e.b.steps.treat).map((e) => (Date.parse(e.b.steps.treat!.at) - Date.parse(e.b.steps.collect!.at)) / 3600_000));
  const tRes = median(discrepancies.filter((d) => d.status === 'resolved' && d.resolution).map((d) => (Date.parse(d.resolution!.at) - Date.parse(d.detectedAt)) / 3600_000));
  const bad = useMemo(() => {
    const m: Record<string, number> = {};
    discrepancies.forEach((d) => { const b = batches.find((x) => x.id === d.batchId); if (b && Date.parse(d.detectedAt) >= since) m[b.pointId] = (m[b.pointId] ?? 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [ev, discrepancies, batches, since]);

  const weeks = useMemo(() => {
    const out: { label: string; pct: number | null; n: number }[] = [];
    const nW = Math.max(2, Math.ceil(days / 7));
    for (let i = nW - 1; i >= 0; i--) {
      const a = now - (i + 1) * 7 * 24 * 3600_000, z = now - i * 7 * 24 * 3600_000;
      const inW = evalAll(batches, config, now).filter((e) => Date.parse(e.b.createdAt) >= a && Date.parse(e.b.createdAt) < z);
      out.push({ label: `W−${i}`, pct: inW.length ? (inW.filter((e) => e.ev.confidence === 'verified').length / inW.length) * 100 : null, n: inW.length });
    }
    return out;
  }, [batches, config, now, days]);

  const cov = coverageOf(points, config, now);
  const monitored = cov.monitored;
  const coverage = cov.pct;
  const facRows = FACILITIES.map((f) => {
    const mine = ev.filter((e) => e.b.facilityId === f.id && e.b.steps.receive);
    const ok = mine.filter((e) => e.ev.confidence === 'verified').length;
    const dis = mine.filter((e) => e.ev.confidence === 'discrepancy').length;
    return { f, n: mine.length, ok, dis };
  });

  const W = 520, H = 150;
  const pts = weeks.map((w, i) => ({ x: 30 + (i / Math.max(1, weeks.length - 1)) * (W - 50), y: w.pct == null ? null : H - 20 - (w.pct / 100) * (H - 40), w }));
  const line = pts.filter((p) => p.y != null).map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y!.toFixed(1)}`).join('');

  return (
    <div className="stack16">
      <PageHeader title="Evidence and impact" sub="Reports show what was recorded. They never imply compliance where data is missing."
        right={<><select className="select-s" value={days} onChange={(e) => setDays(+e.target.value)} aria-label="Period"><option value={7}>Last 7 days</option><option value={14}>Last 14 days</option><option value={30}>Last 30 days</option></select>
          <button className="btn primary" onClick={() => setPeriod(true)}>Period evidence sheet</button></>} />
      <div className="kpis">
        <div><span className="label">Verified</span><div className="hero-n" style={{ fontSize: 64, lineHeight: '58px' }}>{vp == null ? '—' : `${vp.toFixed(1)}%`}</div><span className="small mute">{c.verified} of {ev.length} batches</span></div>
        <div><span className="label">Generated</span><div className="big">{ev.length}</div><span className="small mute">batches</span></div>
        <div><span className="label">Collected</span><div className="big">{fmtKg(kg('collect'))}</div></div>
        <div><span className="label">Treated</span><div className="big">{fmtKg(kg('treat'))}</div><span className="small mute">sum of recorded treat masses</span></div>
        <div><span className="label">Active ◆</span><div className="big k-discrepancy">{discrepancies.filter((d) => d.status !== 'resolved').length}</div></div>
      </div>
      <div className="grid2">
        <Panel title="Verified share by week" right={<span className="chip trust-sim">SIM DATA</span>}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%' }} role="img" aria-label={`Weekly verified share: ${weeks.map((w) => `${w.label} ${w.pct == null ? 'no data' : w.pct.toFixed(0) + '%'}`).join(', ')}`}>
            {[0, 50, 100].map((v) => <g key={v}><line x1="30" x2={W - 20} y1={H - 20 - (v / 100) * (H - 40)} y2={H - 20 - (v / 100) * (H - 40)} stroke="var(--line)" /><text x="2" y={H - 17 - (v / 100) * (H - 40)} fontFamily="IBM Plex Mono" fontSize="9" fill="var(--faint)">{v}%</text></g>)}
            <path d={line} fill="none" stroke="var(--ok)" strokeWidth="1.5" />
            {pts.map((p, i) => <g key={i}>{p.y != null ? <rect x={p.x - 3} y={p.y - 3} width="6" height="6" fill="var(--ok)" /> : <text x={p.x} y={H - 24} textAnchor="middle" fontSize="9" fill="var(--stale)" fontFamily="IBM Plex Mono">⊘</text>}<text x={p.x} y={H - 5} textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9" fill="var(--mute)">{p.w.label}</text></g>)}
          </svg>
          <p className="small mute">Share of batches created that week that are currently verified. A recent week looks low because its batches are still in flight, not because they failed.</p>
        </Panel>
        <Panel title="Confidence breakdown">
          <SegmentedBar total={ev.length} parts={[{ c: 'verified', n: c.verified }, { c: 'attested', n: c.attested }, { c: 'discrepancy', n: c.discrepancy }, { c: 'pending', n: c.pending }]} />
          <p style={{ marginTop: 12 }}>Attested share <b className="mono">{attShare == null ? '—' : attShare.toFixed(1) + '%'}</b>. Attested batches are listed separately and are never rolled into the verified figure.</p>
          <div className="grid2" style={{ marginTop: 12 }}>
            <div className="kv"><span className="label">Median collection → treatment</span><b className="mono">{tCT == null ? '—' : tCT.toFixed(1) + ' h'}</b></div>
            <div className="kv"><span className="label">Median time to resolve ◆</span><b className="mono">{tRes == null ? '—' : tRes < 48 ? tRes.toFixed(0) + ' h' : (tRes / 24).toFixed(1) + ' d'}</b></div>
          </div>
        </Panel>
      </div>
      <div className="grid2">
        <Panel title="Repeat points">
          {bad.length === 0 ? <p className="mute">No repeat points. Quiet floor.</p> : bad.map(([id, n]) => <div key={id} className="row between" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}><Link className="mono" to={`/points/${id}`}>{id}</Link><span className="mono">{n} breach{n > 1 ? 'es' : ''}</span></div>)}
        </Panel>
        <Panel title="Data coverage">
          <div className="row gap16"><b className="hero-n" style={{ fontSize: 56, lineHeight: '52px' }}>{coverage}%</b><p className="small mute">{monitored} of {points.filter((p) => !p.disabled).length} points reporting a fill level now. Periods and points without data are shown as unknown, not as zero.</p></div>
        </Panel>
      </div>
      <Panel title="Facility comparison" pad={false}>
        <table className="t"><thead><tr><th>Facility</th><th className="num">Batches</th><th className="num">● verified</th><th className="num">◆</th><th>Digital</th></tr></thead>
          <tbody>{facRows.map(({ f, n, ok, dis }) => <tr key={f.id}><td>{f.name}</td><td className="num">{n}</td><td className="num">{ok}</td><td className="num">{dis}</td><td>{f.digital ? 'Yes' : 'No'}</td></tr>)}</tbody></table>
      </Panel>
      <Panel title="Before and after" right={<span className="chip trust-sim">SIMULATED BASELINE</span>}>
        <div className="grid2"><div><span className="label">Before TRACE (assumed)</span><div className="seg" style={{ marginTop: 6 }}><span className="seg-p c-pending" style={{ flexGrow: 6 }} /><span className="seg-p c-unknown" style={{ flexGrow: 4 }} /></div><p className="small mute">Collection logged. Downstream unknown. No reconciliation.</p></div>
          <div><span className="label">With TRACE (this simulation)</span><SegmentedBar total={ev.length} parts={[{ c: 'verified', n: c.verified }, { c: 'attested', n: c.attested }, { c: 'discrepancy', n: c.discrepancy }, { c: 'pending', n: c.pending }]} /></div></div>
        <p className="small mute">The baseline is an illustration, not measured. A pilot would replace it with real before-and-after data.</p>
      </Panel>
      <Panel title="Batch evidence sheets">
        <div className="row gap8 wrap">{batches.slice(-8).reverse().map((b) => <button key={b.id} className="btn sm" onClick={() => setSheet(b.id)}>{b.id}</button>)}</div>
      </Panel>
      {sheet && <BatchSheet batch={batches.find((b) => b.id === sheet)!} onClose={() => setSheet(null)} />}
      {period && (
        <Modal title="Period evidence sheet" wide onClose={() => setPeriod(false)}>
          <div className="stack">
            <div className="row between"><span className="label">RE:FLOW · TRACE · LAST {days} DAYS</span><button className="btn primary no-print" onClick={() => window.print()}>Print / save PDF</button></div>
            <table className="t"><tbody>
              <tr><td>Batches generated</td><td className="num">{ev.length}</td></tr><tr><td>Collected</td><td className="num">{fmtKg(kg('collect'))}</td></tr><tr><td>Treated (recorded)</td><td className="num">{fmtKg(kg('treat'))}</td></tr>
              <tr><td>● Verified</td><td className="num">{c.verified}</td></tr><tr><td>▲ Attested</td><td className="num">{c.attested}</td></tr><tr><td>◆ Discrepancy</td><td className="num">{c.discrepancy}</td></tr><tr><td>◌ Pending</td><td className="num">{c.pending}</td></tr>
              <tr><td>Data coverage (points reporting now)</td><td className="num">{coverage}%</td></tr>
            </tbody></table>
            <p className="small mute">Definitions: verified batches need digital steps by independent actors at a registered facility, variance within ±{config.tolerancePct}% and timing within window. Attested is not verified. This sheet summarises recorded data, from a simulation, and is not a compliance certificate. Generated {fmtDT(new Date(now).toISOString())}.</p>
          </div>
        </Modal>
      )}
    </div>
  );
}
