import { useMemo, useState } from 'react';
import { FACILITIES, INSTITUTION, TRANSPORTERS, evalAll, useStore } from '../store';
import { Glyph } from '../components/Glyph';
import { PageHeader, Panel, Tabs } from '../components/ui';

type Tab = 'inst' | 'fac' | 'trans' | 'scale';

export default function Network() {
  const { batches, config, now } = useStore();
  const [tab, setTab] = useState<Tab>('inst');
  const [zoom, setZoom] = useState(0);
  const ev = useMemo(() => evalAll(batches, config, now), [batches, config, now]);
  const v = ev.filter((e) => e.ev.confidence === 'verified').length;
  const d = ev.filter((e) => e.ev.confidence === 'discrepancy').length;
  const levels = [
    { n: '1 institution', d: 'This prototype. One campus, 14 disposal points.', c: 1 },
    { n: 'Multiple institutions', d: 'Several campuses share transporters and facilities.', c: 4 },
    { n: 'District', d: 'A district authority sees facility load and verified share.', c: 12 },
    { n: 'Network', d: 'PIBO and regulators read evidence sheets across districts.', c: 40 },
  ];
  return (
    <div>
      <PageHeader title="Network" sub="Who holds the waste at each step, and what each can prove." />
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: 'inst', label: 'Institutions' }, { id: 'fac', label: 'Treatment facilities' }, { id: 'trans', label: 'Transporters' }, { id: 'scale', label: 'Scale path' }]} />
      {tab === 'inst' && (
        <Panel pad={false}><table className="t"><thead><tr><th>Institution</th><th className="num">Batches</th><th className="num">Verified %</th><th className="num">◆</th></tr></thead>
          <tbody><tr><td>{INSTITUTION.name}</td><td className="num">{ev.length}</td><td className="num">{ev.length ? ((v / ev.length) * 100).toFixed(1) : '—'}%</td><td className="num k-discrepancy">{d}</td></tr></tbody></table>
          <p className="small mute" style={{ padding: 12 }}>One institution in this prototype. Others would appear here once onboarded.</p></Panel>
      )}
      {tab === 'fac' && (
        <Panel pad={false}><div className="tbl-wrap"><table className="t"><thead><tr><th>Facility</th><th>Location</th><th>Recognised pathway</th><th>Authorisation ref</th><th>Digital records</th><th>Ceiling</th><th>Status</th></tr></thead>
          <tbody>{FACILITIES.map((f) => (
            <tr key={f.id}><td>{f.name}</td><td>{f.location}</td><td>{f.pathway}</td><td className="id">{f.authRef}</td><td>{f.digital ? 'Yes' : 'No'}</td>
              <td>{f.digital ? <span className="k-verified">● verified</span> : <span className="k-attested">▲ attested</span>}</td><td>{f.status}</td></tr>
          ))}</tbody></table></div>
          <p className="small mute" style={{ padding: 12 }}>The ceiling is what a batch can reach if it ends here. Authorisation refs are sample values, not real registrations.</p></Panel>
      )}
      {tab === 'trans' && (
        <Panel pad={false}><table className="t"><thead><tr><th>Transporter</th><th className="num">Vehicles</th><th>Routes</th><th className="num">Handoffs</th></tr></thead>
          <tbody>{TRANSPORTERS.map((t, i) => (
            <tr key={t.id}><td>{t.name}</td><td className="num">{t.vehicles}</td><td>{t.routes}</td><td className="num">{batches.filter((b) => b.steps.transport && (i === 0 ? b.facilityId !== 'fac_2' : b.facilityId === 'fac_2')).length}</td></tr>
          ))}</tbody></table></Panel>
      )}
      {tab === 'scale' && (
        <Panel title="From one campus to a network">
          <div className="row gap8" style={{ marginBottom: 12 }}>{levels.map((l, i) => <button key={l.n} className={`btn sm ${zoom === i ? 'primary' : ''}`} onClick={() => setZoom(i)}>{l.n}</button>)}</div>
          <svg viewBox="0 0 640 220" style={{ width: '100%' }} role="img" aria-label={levels[zoom].n}>
            {Array.from({ length: Math.min(levels[zoom].c, 12) }).map((_, i) => {
              const x = 40 + (i % 6) * 100, y = 40 + Math.floor(i / 6) * 40;
              return <g key={i}><rect x={x - 8} y={y - 8} width="16" height="16" fill="none" stroke="var(--bone)" /><path d={`M${x} ${y + 8}V150`} stroke="var(--line-strong)" /></g>;
            })}
            <rect x="120" y="150" width="140" height="22" fill="none" stroke="var(--info)" /><text x="190" y="165" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="10" fill="var(--info)">TRANSPORTERS</text>
            <rect x="380" y="150" width="140" height="22" fill="none" stroke="var(--ok)" /><text x="450" y="165" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="10" fill="var(--ok)">FACILITIES</text>
            <path d="M260 161H380" stroke="var(--line-strong)" />
            <text x="20" y="205" fontFamily="IBM Plex Mono" fontSize="11" fill="var(--mute)">{levels[zoom].c > 12 ? `${levels[zoom].c}+ institutions (drawn: 12)` : `${levels[zoom].c} institution${levels[zoom].c > 1 ? 's' : ''}`}</text>
          </svg>
          <p className="mute">{levels[zoom].d}</p>
          <Glyph name="route" />
        </Panel>
      )}
    </div>
  );
}
