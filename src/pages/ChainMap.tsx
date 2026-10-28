import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore, evalAll, FACILITIES } from '../store';
import { Glyph } from '../components/Glyph';
import { Empty, Panel, SegmentedBar, StatusBadge, VarianceChip, fmtAge } from '../components/ui';
import { coverage, fmtKg, forecastHours, variancePct } from '../engine/reconcile';
import { useT } from '../i18n';
import type { Batch, Confidence } from '../types';

const COLS = [
  { k: 'points', name: 'Disposal points', g: 'point' },
  { k: 'collect', name: 'Collection', g: 'collector' },
  { k: 'transport', name: 'Transport', g: 'truck' },
  { k: 'treat', name: 'Treatment', g: 'plant' },
  { k: 'verified', name: 'Verified', g: 'shield' },
] as const;

function colOf(b: Batch, c: Confidence): number {
  if (c === 'verified' && b.steps.treat) return 4;
  if (b.steps.receive || b.steps.treat) return 3;
  if (b.steps.transport) return 2;
  if (b.steps.collect) return 1;
  return 0;
}

export default function ChainMap() {
  const { batches, points, config, now, discrepancies, queue, syncedAt } = useStore();
  const t = useT();
  const nav = useNavigate();
  const [layer, setLayer] = useState<'status' | 'mass' | 'time'>('status');
  const [feedF, setFeedF] = useState<'all' | 'disc'>('all');
  const [formula, setFormula] = useState(false);
  const audit = useStore((s) => s.audit);

  const ev = useMemo(() => evalAll(batches, config, now), [batches, config, now]);
  const counts = useMemo(() => {
    const c: Record<Confidence, number> = { verified: 0, attested: 0, discrepancy: 0, pending: 0, unknown: 0 };
    for (const e of ev) c[e.ev.confidence]++;
    return c;
  }, [ev]);
  const total = ev.length;
  const pct = total ? (counts.verified / total) * 100 : null;

  const WINDOW = 7 * 24 * 3600_000;
  const recent = ev.filter(({ b, ev: e }) => e.confidence !== 'verified' || now - Date.parse(e.lastAt) < 12 * 24 * 3600_000 || b.id === 'BATCH-2214');

  const stageMass = (s: 'collect' | 'transport' | 'receive' | 'treat') => {
    let sum = 0, n = 0;
    for (const { b } of ev) { const m = b.steps[s]?.massKg; if (m && now - Date.parse(b.steps[s]!.at) < WINDOW) { sum += m; n++; } }
    return { sum, n };
  };
  const pair = (a: 'collect' | 'transport' | 'receive', z: 'transport' | 'receive' | 'treat') => {
    let sa = 0, sz = 0;
    for (const { b } of ev) {
      const x = b.steps[a]?.massKg, y = b.steps[z]?.massKg;
      if (x && y && now - Date.parse(b.steps[a]!.at) < WINDOW) { sa += x; sz += y; }
    }
    return sa > 0 ? variancePct(sa, sz) : null;
  };
  const sCol = stageMass('collect'), sTr = stageMass('transport'), sRe = stageMass('receive'), sTrt = stageMass('treat');
  const between = [null, pair('collect', 'transport'), pair('transport', 'receive'), pair('receive', 'treat')];
  const colMass = [null, sCol.sum, sTr.sum, sRe.sum, sTrt.sum];
  const colN = [points.filter((p) => !p.disabled).length, sCol.n, sTr.n, sRe.n, ev.filter((e) => e.ev.confidence === 'verified' && now - Date.parse(e.ev.lastAt) < WINDOW).length];

  // nodes per column
  const nodes = useMemo(() => {
    const cols: { b: Batch; c: Confidence; age: number; mass: number }[][] = [[], [], [], [], []];
    for (const { b, ev: e } of recent) {
      const m = b.steps.treat?.massKg ?? b.steps.receive?.massKg ?? b.steps.transport?.massKg ?? b.steps.collect?.massKg ?? 0;
      cols[colOf(b, e.confidence)].push({ b, c: e.confidence, age: (now - Date.parse(e.lastAt)) / 3600_000, mass: m });
    }
    for (const c of cols) c.sort((a, b) => Date.parse(b.b.createdAt) - Date.parse(a.b.createdAt));
    return cols;
  }, [recent, now]);

  const W = 960, H = 380, CW = W / 5;
  const maxMass = Math.max(10, ...nodes.flat().map((n) => n.mass));
  const cov = coverage(points, config, now);
  const unmonitored = cov.total - cov.monitored;

  const activeDisc = discrepancies.filter((d) => d.status !== 'resolved');
  const upcoming = points
    .filter((p) => !p.disabled && p.fillPct != null)
    .map((p) => ({ p, f: forecastHours(p.history, config.fillCrit) }))
    .filter((x) => (x.p.fillPct ?? 0) >= 40)
    .sort((a, b) => (b.p.fillPct ?? 0) - (a.p.fillPct ?? 0))
    .slice(0, 4);

  const feed = audit.slice(-60).reverse().filter((a) => feedF === 'all' || a.type.includes('DISCREPANCY')).slice(0, 14);

  const coveragePct = cov.pct;

  const totals = [
    { k: 'Generated', n: points.length ? ev.filter((e) => e.b.steps.generate).length : 0, kg: null as number | null, v: null as number | null, to: '/batches?stage=generate' },
    { k: 'Collected', n: sCol.n, kg: sCol.sum, v: null, to: '/batches?stage=collect' },
    { k: 'Transported', n: sTr.n, kg: sTr.sum, v: between[1], to: '/batches?stage=transport' },
    { k: 'Treated', n: sTrt.n, kg: sTrt.sum, v: pair('collect', 'treat'), to: '/batches?stage=treat' },
  ];

  if (!batches.length) return <Empty text="No batches in scope." />;

  const nodeFill = (c: Confidence) => c === 'verified' ? 'var(--ok)' : c === 'attested' ? 'var(--warn)' : c === 'discrepancy' ? 'var(--crit)' : 'var(--stale)';

  return (
    <div className="stack16">
      <div className="map-grid">
        <div className="stack16">
          <Panel hero className="">
            <div className="hero-row">
              <div>
                <span className="label">{t('hero.label')}</span>
                <div className="hero-n mono-nums" aria-label={pct != null ? `${pct.toFixed(1)} percent verified` : 'No data'}>{pct != null ? `${pct.toFixed(1)}%` : '—'}</div>
                <button className="btn ghost sm" style={{ padding: 0, height: 24, textTransform: 'none', letterSpacing: 0 }} onClick={() => setFormula(!formula)} aria-expanded={formula}>
                  verified batches ÷ batches in scope {formula ? '▴' : '▾'}
                </button>
                {formula && <p className="small mute" style={{ marginTop: 6, maxWidth: 360 }}>{counts.verified} ÷ {total}. Attested, pending and discrepant batches are not counted. Attested is never promoted to verified.</p>}
              </div>
              <SegmentedBar total={total} parts={[
                { c: 'verified', n: counts.verified }, { c: 'attested', n: counts.attested }, { c: 'discrepancy', n: counts.discrepancy }, { c: 'pending', n: counts.pending },
              ]} />
            </div>
          </Panel>

          <Panel title="Chain of custody" right={
            <div className="toggle" role="group" aria-label="Layer">
              {(['status', 'mass', 'time'] as const).map((l) => <button key={l} className={layer === l ? 'on' : ''} onClick={() => setLayer(l)}>{l.toUpperCase()}</button>)}
            </div>
          } pad={false}>
            <div className="chain-wrap">
              <svg viewBox={`0 0 ${W} ${H}`} className="chain-svg" role="img" aria-label={`Chain map. ${counts.verified} verified, ${counts.attested} attested, ${counts.discrepancy} discrepancy, ${counts.pending} pending of ${total} batches.`} style={{ background: 'none' }}>
                <defs>
                  <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="var(--stale)" strokeWidth="1.5" /></pattern>
                </defs>
                <path d={`M${CW / 2} 150H${W - CW / 2}`} stroke="var(--line-strong)" strokeWidth="1" />
                {COLS.map((c, i) => {
                  const x = i * CW;
                  return (
                    <g key={c.k}>
                      <line x1={x} y1="0" x2={x} y2={H} stroke="var(--line)" />
                      <g transform={`translate(${x + 16},14)`} color="var(--mute)"><Glyph name={c.g} size={16} /></g>
                      <text x={x + 38} y="26" fill="var(--mute)" fontFamily="IBM Plex Mono" fontSize="11" letterSpacing=".08em">{c.name.toUpperCase()}</text>
                      <text x={x + 16} y="62" fill="var(--bone)" fontFamily="Barlow Condensed" fontWeight="700" fontSize="28">{colMass[i] == null ? '—' : fmtKg(colMass[i])}</text>
                      <text x={x + 16} y="80" fill="var(--mute)" fontFamily="IBM Plex Mono" fontSize="11">{colN[i]} {i === 0 ? 'points' : 'batches 7d'}</text>
                      {i === 0 && unmonitored > 0 && <rect x={x + 16} y="94" width={CW - 32} height="8" className="hatch-seg" stroke="var(--stale)" />}
                      {i === 0 && unmonitored > 0 && <text x={x + 16} y="118" fill="var(--stale)" fontFamily="IBM Plex Mono" fontSize="10">⊘ {unmonitored} UNMONITORED</text>}
                    </g>
                  );
                })}
                {between.map((v, i) => i > 0 && (
                  <g key={i} transform={`translate(${i * CW - 36},142)`}>
                    <rect width="72" height="18" fill="var(--panel)" stroke={v != null && Math.abs(v) > config.tolerancePct ? 'var(--crit)' : 'var(--line-strong)'} strokeWidth={v != null && Math.abs(v) > config.tolerancePct ? 2 : 1} />
                    <text x="36" y="13" textAnchor="middle" fill={v != null && Math.abs(v) > config.tolerancePct ? 'var(--crit)' : 'var(--mute)'} fontFamily="IBM Plex Mono" fontSize="10">
                      {v == null ? '—' : `${Math.abs(v) > config.tolerancePct ? '◆ ' : ''}${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(1)}%`}
                    </text>
                  </g>
                ))}
                {nodes.map((col, ci) => col.slice(0, 40).map((n, k) => {
                  const cols = 6;
                  const cx = ci * CW + 22 + (k % cols) * 24;
                  const cy = 190 + Math.floor(k / cols) * 26;
                  const size = layer === 'mass' ? 8 + (n.mass / maxMass) * 12 : 16;
                  const op = layer === 'time' ? Math.max(0.35, 1 - n.age / 72) : 1;
                  const fill = nodeFill(n.c);
                  return (
                    <g key={n.b.id} className="node" tabIndex={0} role="link" aria-label={`${n.b.id} ${n.c}`}
                      onClick={() => nav(`/batch/${n.b.id}`)} onKeyDown={(e) => e.key === 'Enter' && nav(`/batch/${n.b.id}`)} opacity={op}>
                      <title>{`${n.b.id} · ${n.c} · ${fmtKg(n.mass)} · ${fmtAge(n.age * 3600_000)} ago`}</title>
                      <rect className="sq" x={cx - size / 2} y={cy - size / 2} width={size} height={size}
                        fill={n.c === 'verified' || n.c === 'attested' || n.c === 'discrepancy' ? fill : n.c === 'pending' ? 'none' : 'url(#hatch)'}
                        stroke={fill} strokeWidth={n.c === 'discrepancy' ? 2.5 : 1.5} strokeDasharray={n.c === 'pending' ? '3 2' : undefined}
                        transform={n.c === 'discrepancy' ? `rotate(45 ${cx} ${cy})` : undefined} />
                      {n.c === 'attested' && <path d={`M${cx - 4} ${cy + 3}L${cx} ${cy - 4}L${cx + 4} ${cy + 3}Z`} fill="var(--bg)" />}
                      {layer === 'time' && <text x={cx} y={cy + 20} textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="8" fill="var(--mute)">{n.age < 48 ? `${Math.round(n.age)}h` : `${Math.round(n.age / 24)}d`}</text>}
                    </g>
                  );
                }))}
                {nodes[4].length > 40 && <text x={4 * CW + 16} y={H - 8} fill="var(--mute)" fontFamily="IBM Plex Mono" fontSize="10">+{nodes[4].length - 40} more</text>}
              </svg>
            </div>
            <div className="small mute mono" style={{ padding: '8px 16px', borderTop: '1px solid var(--line)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span className="k-verified">● verified</span><span className="k-attested">▲ attested</span><span className="k-discrepancy">◆ discrepancy</span><span className="k-pending">◌ pending</span><span>⊘ unknown</span>
              <span style={{ marginLeft: 'auto' }}>SIM · variance chips use batches collected in the last 7 days</span>
            </div>
          </Panel>

          <div className="totals">
            {totals.map((x) => (
              <Link key={x.k} to={x.to}>
                <span className="label">{x.k}</span>
                <div className="big">{x.kg == null ? x.n : fmtKg(x.kg)}</div>
                <div className="small mute mono">{x.kg == null ? 'batches opened' : `${x.n} batches`} {x.v != null && <VarianceChip pct={x.v} tol={config.tolerancePct} />}</div>
              </Link>
            ))}
          </div>
        </div>

        <div className="stack16">
          <Panel title="Active discrepancies" right={<Link to="/discrepancies" className="small">View all</Link>}>
            {activeDisc.length === 0 ? <Empty text="No discrepancies. Quiet floor." /> : (
              <div className="stack">
                {activeDisc.slice(0, 3).map((d) => (
                  <Link key={d.id} to={`/discrepancies/${d.id}`} style={{ color: 'var(--bone)', borderLeft: '2px solid var(--crit)', paddingLeft: 10 }}>
                    <div className="row between"><span className="mono">{d.batchId}</span><StatusBadge c="discrepancy" small /></div>
                    <div className="small mute">{d.detail}</div>
                  </Link>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Upcoming collections" right={<span className="small mute">rule-based, not AI</span>}>
            {upcoming.length === 0 ? <Empty text="No point near its threshold." /> : (
              <div className="stack">
                {upcoming.map(({ p, f }) => {
                  const cls = (p.fillPct ?? 0) >= config.fillCrit ? 'crit' : (p.fillPct ?? 0) >= config.fillWarn ? 'warn' : '';
                  return (
                    <div key={p.id} style={{ borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
                      <div className="row between"><Link to={`/points/${p.id}`} className="mono">{p.id}</Link>
                        <span className="mono">{p.fillPct}% <span className="mute">· {f.hours == null ? '—' : f.hours === 0 ? 'now' : `≈${f.hours.toFixed(f.hours < 10 ? 1 : 0)} h`}</span></span></div>
                      <div className={`fillbar ${cls}`} style={{ margin: '6px 0' }}><i style={{ width: `${p.fillPct}%` }} /></div>
                      <div className="row between"><span className="small mute">{f.basis}</span>
                        <RequestBtn id={p.id} /></div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel title="Live feed" right={
            <div className="toggle"><button className={feedF === 'all' ? 'on' : ''} onClick={() => setFeedF('all')}>ALL</button><button className={feedF === 'disc' ? 'on' : ''} onClick={() => setFeedF('disc')}>◆ ONLY</button></div>
          }>
            <div className="feed">
              {feed.length === 0 && <Empty text="No events yet." />}
              {feed.map((a) => (
                <Link key={a.id} to={a.batchId ? `/batch/${a.batchId}` : a.discId ? `/discrepancies/${a.discId}` : '#'}>
                  <span className="mono small mute">{new Date(a.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                  <span className={a.type.includes('DISCREPANCY') ? 'k-discrepancy' : 'mute'}>{a.type.includes('DISCREPANCY') ? '◆' : '·'}</span>
                  <span><span className="mono">{a.entity}</span> <span className="small mute">{a.type.replace(/_/g, ' ').toLowerCase()}{a.next ? ` · ${a.next.slice(0, 48)}` : ''}</span></span>
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <div className="strip bleed">
        <span>Monitoring <b>{coveragePct}%</b> of required checkpoints</span>
        <span>Held on device <b>{queue.length}</b></span>
        <span>Last full sync <b>{fmtAge(now - syncedAt)} ago</b></span>
        <span>Facilities <b>{FACILITIES.filter((f) => f.digital).length}/{FACILITIES.length}</b> digital</span>
      </div>
    </div>
  );
}

function RequestBtn({ id }: { id: string }) {
  const req = useStore((s) => s.requestCollection);
  return <button className="btn sm" onClick={() => req(id)}>Request collection</button>;
}
