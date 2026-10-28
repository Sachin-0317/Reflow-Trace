import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../store';
import { Glyph } from '../components/Glyph';
import { Age, ConfirmDialog, Empty, KV, PageHeader, Panel, StatusBadge, Tabs, fmtAge } from '../components/ui';
import { forecastHours } from '../engine/reconcile';
import type { Point } from '../types';

const DEV_LABEL: Record<Point['deviceState'], string> = { online: 'Online', offline: 'Offline', connecting: 'Connecting', error: 'Error', calibration: 'Calibration due', disabled: 'No device' };

function fillCls(p: Point, warn: number, crit: number) {
  if (p.fillPct == null) return 'unk';
  return p.fillPct >= crit ? 'crit' : p.fillPct >= warn ? 'warn' : '';
}

export function PointList() {
  const { points, config, now } = useStore();
  const nav = useNavigate();
  const [view, setView] = useState<'list' | 'map'>('list');
  return (
    <div>
      <PageHeader title="Disposal points" sub="Fill readings describe a bin. They never count as proof of custody."
        right={<div className="toggle"><button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>LIST</button><button className={view === 'map' ? 'on' : ''} onClick={() => setView('map')}>MAP</button></div>} />
      {view === 'list' ? (
        <Panel pad={false}><div className="tbl-wrap"><table className="t">
          <thead><tr><th>Point</th><th>Site</th><th>Fill</th><th>Forecast</th><th>Device</th><th className="hide-tab">Last collection</th><th>Status</th></tr></thead>
          <tbody>
            {points.map((p) => {
              const f = forecastHours(p.history, config.fillCrit);
              return (
                <tr key={p.id} className="click" tabIndex={0} onClick={() => nav(`/points/${p.id}`)} onKeyDown={(e) => e.key === 'Enter' && nav(`/points/${p.id}`)}>
                  <td className="id">{p.id}</td><td>{p.site}</td>
                  <td style={{ minWidth: 130 }}>
                    <div className="row gap8"><span className="mono" style={{ width: 40 }}>{p.fillPct == null ? '⊘' : `${p.fillPct}%`}</span><div className={`fillbar ${fillCls(p, config.fillWarn, config.fillCrit)}`}><i style={{ width: `${p.fillPct ?? 0}%` }} /></div></div>
                  </td>
                  <td className="mono small">{p.fillPct == null ? <span className="mute">unknown</span> : f.hours == null ? '—' : f.hours === 0 ? 'now' : `≈${f.hours.toFixed(1)} h`}</td>
                  <td className="small">{DEV_LABEL[p.deviceState]}{p.deviceId && <span className="mono mute"> {p.deviceId}</span>}</td>
                  <td className="hide-tab"><Age iso={p.lastCollectionAt} now={now} /></td>
                  <td><StatusBadge c={p.fillPct == null ? 'unknown' : p.fillSource === 'manual' ? 'pending' : p.fillPct >= config.fillCrit ? 'discrepancy' : p.fillPct >= config.fillWarn ? 'attested' : 'verified'} label={p.fillPct == null ? 'UNKNOWN' : p.fillSource === 'manual' ? 'MANUAL' : p.fillPct >= config.fillCrit ? 'FULL' : p.fillPct >= config.fillWarn ? 'FILLING' : 'OK'} small /></td>
                </tr>
              );
            })}
          </tbody>
        </table></div></Panel>
      ) : (
        <Panel title="Site layout (schematic, not to scale)">
          <svg viewBox="0 0 800 260" style={{ width: '100%' }} role="img" aria-label="Schematic of disposal points by block">
            {['Hostel Block A', 'Hostel Block B', 'Hostel Block C', 'Hostel Block D', 'Admin Block'].map((site, i) => {
              const ps = points.filter((p) => p.site === site);
              return (
                <g key={site} transform={`translate(${12 + i * 158},10)`}>
                  <rect width="146" height="240" fill="none" stroke="var(--line-strong)" />
                  <text x="8" y="18" fontFamily="IBM Plex Mono" fontSize="10" fill="var(--mute)">{site.toUpperCase()}</text>
                  {ps.map((p, k) => (
                    <g key={p.id} transform={`translate(12,${34 + k * 66})`} onClick={() => nav(`/points/${p.id}`)} style={{ cursor: 'pointer' }} tabIndex={0} role="link" aria-label={p.id} onKeyDown={(e) => e.key === 'Enter' && nav(`/points/${p.id}`)}>
                      <rect width="122" height="54" fill="var(--panel-2)" stroke={fillCls(p, config.fillWarn, config.fillCrit) === 'crit' ? 'var(--crit)' : 'var(--line-strong)'} strokeWidth={fillCls(p, config.fillWarn, config.fillCrit) === 'crit' ? 2 : 1} />
                      <text x="8" y="18" fontFamily="IBM Plex Mono" fontSize="11" fill="var(--bone)">{p.id}</text>
                      <text x="114" y="18" textAnchor="end" fontFamily="IBM Plex Mono" fontSize="11" fill="var(--mute)">{p.fillPct == null ? '⊘' : p.fillPct + '%'}</text>
                      <rect x="8" y="30" width="106" height="6" fill={p.fillPct == null ? 'url(#hh)' : 'none'} stroke="var(--line-strong)" />
                      {p.fillPct != null && <rect x="8" y="30" width={106 * p.fillPct / 100} height="6" fill={p.fillPct >= config.fillCrit ? 'var(--crit)' : p.fillPct >= config.fillWarn ? 'var(--warn)' : 'var(--bone)'} />}
                      <text x="8" y="49" fontFamily="IBM Plex Mono" fontSize="9" fill="var(--faint)">{DEV_LABEL[p.deviceState].toUpperCase()}</text>
                    </g>
                  ))}
                </g>
              );
            })}
            <defs><pattern id="hh" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="var(--stale)" /></pattern></defs>
          </svg>
        </Panel>
      )}
    </div>
  );
}

function FillChart({ history, warn, crit }: { history: { t: number; pct: number }[]; warn: number; crit: number }) {
  const W = 560, H = 160, pad = 28;
  if (history.length < 2) return <Empty text="No readings." />;
  const t0 = history[0].t, t1 = history[history.length - 1].t;
  const x = (t: number) => pad + ((t - t0) / (t1 - t0 || 1)) * (W - pad - 8);
  const y = (v: number) => H - 20 - (v / 100) * (H - 30);
  const d = history.map((h, i) => `${i ? 'L' : 'M'}${x(h.t).toFixed(1)} ${y(h.pct).toFixed(1)}`).join('');
  const last = history[history.length - 1];
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%' }} role="img" aria-label={`Fill history, latest ${last.pct}%`}>
        {[0, 50, 100].map((v) => <g key={v}><line x1={pad} x2={W - 8} y1={y(v)} y2={y(v)} stroke="var(--line)" /><text x="2" y={y(v) + 3} fontFamily="IBM Plex Mono" fontSize="9" fill="var(--faint)">{v}</text></g>)}
        <line x1={pad} x2={W - 8} y1={y(warn)} y2={y(warn)} stroke="var(--warn)" strokeDasharray="3 3" />
        <line x1={pad} x2={W - 8} y1={y(crit)} y2={y(crit)} stroke="var(--crit)" strokeDasharray="3 3" />
        <path d={d} fill="none" stroke="var(--bone)" strokeWidth="1.5" />
        {history.map((h, i) => <rect key={i} x={x(h.t) - 2} y={y(h.pct) - 2} width="4" height="4" fill="var(--bone)" />)}
      </svg>
      <figcaption className="small mute">Last {history.length} readings, 30 min apart. Latest {last.pct}%. Dashed lines are the warning and critical thresholds. SIM data.</figcaption>
    </figure>
  );
}

export function PointDetail() {
  const { id } = useParams();
  const { points, config, batches, now, requestCollection, patchPoint, regenerateQr } = useStore();
  const p = points.find((x) => x.id === id);
  const nav = useNavigate();
  const [range, setRange] = useState<'24h' | '7d'>('24h');
  const [confirm, setConfirm] = useState<null | 'disable' | 'cal'>(null);
  if (!p) return <Empty text={`${id} not found.`} action={<Link to="/points" className="btn">Points</Link>} />;
  const f = forecastHours(p.history, config.fillCrit);
  const hist = batches.filter((b) => b.pointId === p.id).slice(-8).reverse();
  const stale = p.fillAt ? (now - Date.parse(p.fillAt)) / 60000 > config.staleMin : true;
  const hist7 = range === '7d';
  return (
    <div className="stack16">
      <div className="row gap16 wrap">
        <Link to="/points" className="icon-btn" aria-label="Back"><Glyph name="back" /></Link>
        <h1 className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 28 }}>{p.id}</h1>
        <span className="mute">{p.name}</span>
        {p.disabled && <span className="chip">DISABLED</span>}{p.inspection && <span className="chip">INSPECTION</span>}
      </div>
      <div className="two">
        <div className="stack16">
          <Panel hero title="Fill level" right={<Tabs<'24h' | '7d'> value={range} onChange={setRange} tabs={[{ id: '24h', label: '24 h' }, { id: '7d', label: '7 d' }]} />}>
            <div className="row gap16 wrap" style={{ alignItems: 'flex-end' }}>
              <div className="hero-n" style={{ fontSize: 72, lineHeight: 64 + 'px' }}>{p.fillPct == null ? '⊘' : `${p.fillPct}%`}</div>
              <div className="small mute"><div>Source <span className="mono">{p.fillSource.toUpperCase()}</span></div><div>Updated <Age iso={p.fillAt} now={now} /> {stale && <span className="k-pending">· stale</span>}</div>
                <div>Forecast {p.fillPct == null ? 'unknown' : f.hours == null ? '—' : f.hours === 0 ? 'now' : `≈${f.hours.toFixed(1)} h to ${config.fillCrit}%`} <span className="mute">({f.basis}, rule-based, not AI)</span></div></div>
            </div>
            {p.fillPct == null && <p className="k-unknown" style={{ marginTop: 8 }}>⊘ Sensor offline. The last value is not shown as current.</p>}
            <div style={{ marginTop: 12 }}>{hist7 ? <p className="mute small">7-day history is not stored in the prototype. 24 h shown from the simulator.</p> : null}<FillChart history={p.history} warn={config.fillWarn} crit={config.fillCrit} /></div>
          </Panel>
          <Panel title="Collection history">
            {hist.length === 0 ? <Empty text="No batches from this point." /> : hist.map((b) => (
              <Link key={b.id} to={`/batch/${b.id}`} className="row between" style={{ color: 'var(--bone)', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                <span className="mono">{b.id}</span><span className="mono small mute">{b.steps.collect?.massKg?.toFixed(2)} kg</span><Age iso={b.createdAt} now={now} />
              </Link>
            ))}
          </Panel>
        </div>
        <div className="stack16">
          <Panel title="Device">
            {p.deviceId ? (
              <div className="grid2">
                <KV k="Node" v={<span className="mono">{p.deviceId}</span>} />
                <KV k="State" v={DEV_LABEL[p.deviceState]} />
                <KV k="Battery" v={<span className="mono"><Glyph name="battery" size={12} /> {p.battery}%</span>} />
                <KV k="Firmware" v={<span className="mono">{p.firmware}</span>} />
                <KV k="Calibration" v={p.calibration === 'due' ? <span className="k-attested">▲ due</span> : 'ok'} />
                <KV k="Last error" v={p.lastError ?? 'none'} />
              </div>
            ) : <p className="mute">No device. Fill is entered by hand, so it is labelled MANUAL.</p>}
            <p className="small mute" style={{ marginTop: 10 }}>Heartbeat, battery and firmware here are simulated until an ESP32 node is connected.</p>
          </Panel>
          <Panel title="Actions">
            <div className="stack">
              <button className="btn" onClick={() => requestCollection(p.id)} disabled={p.disabled}>Request collection</button>
              <button className="btn" onClick={() => patchPoint(p.id, { inspection: !p.inspection }, 'INSPECTION_FLAG')}>{p.inspection ? 'Clear inspection mark' : 'Mark for inspection'}</button>
              {p.deviceId && <button className="btn" onClick={() => setConfirm('cal')}>Record calibration</button>}
              <button className="btn" onClick={() => nav(`/qr?point=${p.id}`)}>Print QR</button>
              <button className="btn" onClick={() => regenerateQr(p.id)}>Regenerate QR (v{p.qrVersion})</button>
              <button className="btn danger" onClick={() => setConfirm('disable')}>{p.disabled ? 'Re-enable point' : 'Disable point'}</button>
              <Link to={`/p/${p.id}`} className="small">Open public page</Link>
            </div>
          </Panel>
        </div>
      </div>
      {confirm === 'disable' && <ConfirmDialog title={p.disabled ? 'Re-enable point?' : 'Disable point?'} danger confirm={p.disabled ? 'Re-enable' : 'Disable'} body={<p>A disabled point drops out of coverage and collection forecasts. This is logged.</p>} onNo={() => setConfirm(null)} onYes={() => { patchPoint(p.id, { disabled: !p.disabled }, p.disabled ? 'POINT_ENABLED' : 'POINT_DISABLED'); setConfirm(null); }} />}
      {confirm === 'cal' && <ConfirmDialog title="Record calibration?" confirm="Record" body={<p>Marks calibration ok for {p.deviceId} and logs who did it. Only confirm after a real calibration.</p>} onNo={() => setConfirm(null)} onYes={() => { patchPoint(p.id, { calibration: 'ok', deviceState: p.deviceState === 'calibration' ? 'online' : p.deviceState }, 'CALIBRATION_RECORDED'); setConfirm(null); }} />}
      <span className="sr">{fmtAge(0)}</span>
    </div>
  );
}
