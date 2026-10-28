import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store';
import { Drawer, Empty, KV, PageHeader, Panel, fmtDT } from '../components/ui';
import type { AuditEvent } from '../types';

const PAGE = 25;

export default function Audit() {
  const audit = useStore((s) => s.audit);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [type, setType] = useState('');
  const [src, setSrc] = useState('');
  const [from, setFrom] = useState('');
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<AuditEvent | null>(null);
  const types = useMemo(() => Array.from(new Set(audit.map((a) => a.type))).sort(), [audit]);
  const list = useMemo(() => audit.filter((a) =>
    (!q || (a.entity + a.batchId + a.discId + a.actor).toLowerCase().includes(q.toLowerCase())) &&
    (!role || a.role === role) && (!type || a.type === type) && (!src || a.source === src) && (!from || Date.parse(a.at) >= Date.parse(from)),
  ).reverse(), [audit, q, role, type, src, from]);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const p = Math.min(page, pages - 1);
  return (
    <div>
      <PageHeader title="Audit log" sub="Append-only. A correction is a new event; nothing here can be edited or deleted." />
      <div className="filters">
        <div className="field"><label htmlFor="aq">Batch, disc or actor</label><input id="aq" className="input" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} /></div>
        <div className="field"><label htmlFor="ar">Role</label><select id="ar" className="select" value={role} onChange={(e) => { setRole(e.target.value); setPage(0); }}><option value="">All</option>{['admin', 'collector', 'transporter', 'treatment', 'pibo', 'system', 'anonymous'].map((r) => <option key={r}>{r}</option>)}</select></div>
        <div className="field"><label htmlFor="at">Event type</label><select id="at" className="select" value={type} onChange={(e) => { setType(e.target.value); setPage(0); }}><option value="">All</option>{types.map((r) => <option key={r}>{r}</option>)}</select></div>
        <div className="field"><label htmlFor="as">Origin</label><select id="as" className="select" value={src} onChange={(e) => { setSrc(e.target.value); setPage(0); }}><option value="">All</option><option value="manual">Manual</option><option value="auto">Automated</option></select></div>
        <div className="field"><label htmlFor="af">From</label><input id="af" type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
      </div>
      <Panel pad={false}>
        {list.length === 0 ? <Empty text="No audit events match." /> : (
          <>
            <div className="tbl-wrap"><table className="t">
              <thead><tr><th>Time</th><th>Actor</th><th>Event</th><th>Entity</th><th className="hide-tab">Change</th><th>Origin</th></tr></thead>
              <tbody>{list.slice(p * PAGE, p * PAGE + PAGE).map((a) => (
                <tr key={a.id} className="click" tabIndex={0} onClick={() => setOpen(a)} onKeyDown={(e) => e.key === 'Enter' && setOpen(a)}>
                  <td className="mono small">{fmtDT(a.at)}</td><td>{a.actor}<span className="mute small"> · {a.role}</span></td><td className="mono small">{a.type}</td><td className="id">{a.entity}</td>
                  <td className="hide-tab small mute">{(a.prev ? a.prev.slice(0, 24) + ' → ' : '') + (a.next ?? '').slice(0, 56)}</td><td className="small">{a.source}</td>
                </tr>
              ))}</tbody>
            </table></div>
            <div className="row between" style={{ padding: '10px 16px' }}>
              <span className="small mute mono">{list.length} events · hash chain not implemented</span>
              <div className="row gap8"><button className="btn sm" disabled={p === 0} onClick={() => setPage(p - 1)}>Prev</button><span className="mono small">{p + 1}/{pages}</span><button className="btn sm" disabled={p >= pages - 1} onClick={() => setPage(p + 1)}>Next</button></div>
            </div>
          </>
        )}
      </Panel>
      {open && (
        <Drawer title="Audit event" onClose={() => setOpen(null)}>
          <div className="stack">
            <KV k="ID" v={<span className="mono">{open.id}</span>} /><KV k="Time" v={<span className="mono">{open.at}</span>} /><KV k="Actor" v={`${open.actor} (${open.role})`} />
            <KV k="Event" v={<span className="mono">{open.type}</span>} /><KV k="Entity" v={open.entity} /><KV k="Previous" v={open.prev ?? '—'} /><KV k="New" v={open.next ?? '—'} /><KV k="Origin" v={open.source} />
            {open.batchId && <Link to={`/batch/${open.batchId}`} onClick={() => setOpen(null)}>Open {open.batchId}</Link>}
            {open.discId && <Link to={`/discrepancies/${open.discId}`} onClick={() => setOpen(null)}>Open {open.discId}</Link>}
            <p className="small mute">Read-only. Chain integrity is not claimed: this prototype does not hash-chain entries.</p>
          </div>
        </Drawer>
      )}
    </div>
  );
}
