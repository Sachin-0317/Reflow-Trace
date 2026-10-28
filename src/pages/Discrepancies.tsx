import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../store';
import { Age, ConfirmDialog, Empty, KV, PageHeader, Panel, Tabs, fmtDT } from '../components/ui';
import { fmtKg, fmtPct } from '../engine/reconcile';
import { Glyph } from '../components/Glyph';

const OWNERS = ['Institution admin', 'Facility manager', 'Transport supervisor', 'Sustainability officer'];
type Tab = 'new' | 'investigating' | 'resolved';

export function DiscrepancyList() {
  const { discrepancies, now, assignDisc } = useStore();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>('new');
  const [q, setQ] = useState('');
  const [rule, setRule] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const [owner, setOwner] = useState(OWNERS[0]);
  const list = useMemo(() => discrepancies
    .filter((d) => d.status === tab && (!rule || d.rule === rule) && (!q || (d.batchId + d.id).toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => Date.parse(b.detectedAt) - Date.parse(a.detectedAt)), [discrepancies, tab, q, rule]);
  const n = (s: Tab) => discrepancies.filter((d) => d.status === s).length;
  return (
    <div>
      <PageHeader title="Discrepancies" sub="Rule breaches on batches. Repeated triggers merge into one record." />
      <Tabs<Tab> value={tab} onChange={(t) => { setTab(t); setSel([]); }} tabs={[{ id: 'new', label: 'New', n: n('new') }, { id: 'investigating', label: 'Investigating', n: n('investigating') }, { id: 'resolved', label: 'Resolved', n: n('resolved') }]} />
      <div className="filters">
        <div className="field"><label htmlFor="dq">Search</label><input id="dq" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="BATCH-2217" /></div>
        <div className="field"><label htmlFor="dr">Rule</label><select id="dr" className="select" value={rule} onChange={(e) => setRule(e.target.value)}><option value="">All</option><option>quantity</option><option>timing</option><option>location</option><option>custody</option></select></div>
        {sel.length > 0 && (
          <div className="row gap8">
            <select className="select" style={{ height: 36, width: 190 }} value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Owner">{OWNERS.map((o) => <option key={o}>{o}</option>)}</select>
            <button className="btn sm primary" onClick={() => { sel.forEach((id) => assignDisc(id, owner)); setSel([]); }}>Assign {sel.length}</button>
          </div>
        )}
      </div>
      <Panel pad={false}>
        {list.length === 0 ? <Empty text="No discrepancies. Quiet floor." /> : (
          <div className="tbl-wrap"><table className="t">
            <thead><tr><th></th><th>ID</th><th>Batch</th><th>Rule</th><th>Numbers</th><th>Detected</th><th>Owner</th><th>Status</th></tr></thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id} className="click" tabIndex={0} onClick={() => nav(`/discrepancies/${d.id}`)} onKeyDown={(e) => e.key === 'Enter' && nav(`/discrepancies/${d.id}`)}>
                  <td onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Select ${d.id}`} checked={sel.includes(d.id)} onChange={(e) => setSel(e.target.checked ? [...sel, d.id] : sel.filter((x) => x !== d.id))} disabled={d.status === 'resolved'} /></td>
                  <td className="id">{d.id}{d.count > 1 && <span className="chip" style={{ marginLeft: 6 }}>×{d.count} merged</span>}</td>
                  <td className="id">{d.batchId}</td><td>{d.rule}</td>
                  <td className="mono">{d.fromKg != null ? `${d.fromKg.toFixed(1)} → ${d.toKg?.toFixed(1)} kg ${fmtPct(d.variancePct)}` : <span className="mute">{d.detail.slice(0, 40)}</span>}</td>
                  <td><Age iso={d.detectedAt} now={now} /></td><td>{d.owner ?? <span className="mute">unassigned</span>}</td>
                  <td><span className={d.status === 'resolved' ? 'k-verified' : 'k-discrepancy'}>{d.status === 'resolved' ? '● resolved' : `◆ ${d.status}`}</span></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Panel>
    </div>
  );
}

const KINDS = ['Measurement error corrected', 'Loss confirmed', 'Fraud suspected'];

export function DiscrepancyDetail() {
  const { id } = useParams();
  const { discrepancies, batches, assignDisc, noteDisc, resolveDisc, startInvestigating, logAudit, toast, audit } = useStore();
  const d = discrepancies.find((x) => x.id === id);
  const [owner, setOwner] = useState(OWNERS[0]);
  const [note, setNote] = useState('');
  const [kind, setKind] = useState(KINDS[0]);
  const [text, setText] = useState('');
  const [dismiss, setDismiss] = useState(false);
  const [confirmDismiss, setConfirmDismiss] = useState(false);
  const [err, setErr] = useState('');
  if (!d) return <Empty text={`${id} not found.`} action={<Link to="/discrepancies" className="btn">Queue</Link>} />;
  const b = batches.find((x) => x.id === d.batchId);
  const events = audit.filter((a) => a.discId === d.id || (a.batchId === d.batchId && a.type !== 'READING_RECORDED')).slice(-8).reverse();
  const open = d.status !== 'resolved';
  const submit = () => {
    if (text.trim().length < 5) return setErr('Explain the resolution in at least a few words.');
    setErr('');
    resolveDisc(d.id, kind, text.trim());
    setText('');
    toast('ok', `${d.id} resolved: ${kind}.`);
  };
  return (
    <div className="stack16">
      <div className="row gap16 wrap">
        <Link to="/discrepancies" className="icon-btn" aria-label="Back"><Glyph name="back" /></Link>
        <h1 className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 28 }}>{d.id}</h1>
        <span className={`badge ${open ? 'c-discrepancy' : 'c-verified'}`}>{open ? `◆ ${d.status}` : '● resolved'}</span>
      </div>
      <div className="two">
        <div className="stack16">
          <Panel hero title="Rule fired">
            <div className="grid2">
              <KV k="Rule" v={<b>{d.rule}</b>} />
              <KV k="Breach at step" v={d.stepAt} />
              <KV k="Numbers" v={<span className="mono">{d.fromKg != null ? `${fmtKg(d.fromKg)} → ${fmtKg(d.toKg)} (${fmtPct(d.variancePct)})` : '—'}</span>} />
              <KV k="Detected" v={<span className="mono">{fmtDT(d.detectedAt)}</span>} />
            </div>
            <p style={{ marginTop: 12 }}>{d.detail}</p>
            {d.count > 1 && <p className="small mute">×{d.count} events merged into this record.</p>}
            <p style={{ marginTop: 8 }}>Batch <Link to={`/batch/${d.batchId}`} className="mono">{d.batchId}</Link> {b && <span className="mute small"> · {b.pointId}</span>}</p>
          </Panel>
          <Panel title="Timeline">
            <div className="timeline">
              {events.map((a) => <div key={a.id}><span className="mono small">{a.type}</span><br /><span className="small mute">{fmtDT(a.at)} · {a.actor}{a.next ? ` · ${a.next.slice(0, 80)}` : ''}</span></div>)}
              {d.notes.map((n, i) => <div key={i}><span className="mono small">NOTE</span><br /><span className="small">{n.text}</span><br /><span className="small mute">{fmtDT(n.at)} · {n.by}</span></div>)}
            </div>
          </Panel>
        </div>
        <div className="stack16">
          {d.resolution && (
            <Panel title="Resolution"><p><b>{d.resolution.kind}</b>{d.resolution.dismissed ? ' (dismissed)' : ''}</p><p>{d.resolution.text}</p><p className="small mute mono">{fmtDT(d.resolution.at)}</p></Panel>
          )}
          {open && (
            <>
              <Panel title="Work it">
                <div className="stack">
                  <div className="row gap8"><select className="select" value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Owner">{OWNERS.map((o) => <option key={o}>{o}</option>)}</select>
                    <button className="btn" onClick={() => assignDisc(d.id, owner)}>Assign</button></div>
                  <p className="small mute">Owner: {d.owner ?? 'unassigned'}</p>
                  <div className="row gap8 wrap">
                    {d.status === 'new' && <button className="btn sm" onClick={() => startInvestigating(d.id)}>Start investigating</button>}
                    <button className="btn sm" onClick={() => { logAudit({ actor: 'Institution admin', role: 'admin', type: 'REWEIGH_REQUESTED', entity: d.batchId, source: 'manual', batchId: d.batchId, discId: d.id }); toast('ok', 'Re-weigh requested.'); }}>Request re-weigh</button>
                    <button className="btn sm" onClick={() => { logAudit({ actor: 'Institution admin', role: 'admin', type: 'EVIDENCE_REQUESTED', entity: d.batchId, source: 'manual', batchId: d.batchId, discId: d.id }); toast('ok', 'Evidence requested.'); }}>Request evidence</button>
                    <button className="btn sm" onClick={() => { logAudit({ actor: 'Institution admin', role: 'admin', type: 'ESCALATED', entity: d.id, source: 'manual', discId: d.id }); toast('warn', `${d.id} escalated.`); }}>Escalate</button>
                  </div>
                  <div className="field"><label htmlFor="dn">Add note</label><div className="row gap8"><input id="dn" className="input" value={note} onChange={(e) => setNote(e.target.value)} />
                    <button className="btn" disabled={!note.trim()} onClick={() => { noteDisc(d.id, note.trim()); setNote(''); }}>Add</button></div></div>
                </div>
              </Panel>
              <Panel title="Resolve">
                <div className="stack">
                  <div className="field"><label htmlFor="rk">Resolution</label><select id="rk" className="select" value={kind} onChange={(e) => setKind(e.target.value)}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select></div>
                  <div className="field"><label htmlFor="rt">Reason (required)</label><textarea id="rt" className="textarea" value={text} onChange={(e) => setText(e.target.value)} aria-invalid={!!err} />{err && <span className="err" role="alert">{err}</span>}</div>
                  <div className="row gap8">
                    <button className="btn primary" onClick={() => { setDismiss(false); submit(); }}>Resolve with reason</button>
                    <button className="btn ghost sm" onClick={() => text.trim().length < 5 ? setErr('Dismissal needs a reason too.') : setConfirmDismiss(true)}>Dismiss…</button>
                  </div>
                </div>
              </Panel>
            </>
          )}
        </div>
      </div>
      {confirmDismiss && (
        <ConfirmDialog title="Dismiss discrepancy?" danger confirm="Dismiss and log" body={<p>Dismissal is restricted and logged to the audit trail with your reason. It does not correct the batch masses. {dismiss ? '' : ''}</p>}
          onNo={() => setConfirmDismiss(false)} onYes={() => { resolveDisc(d.id, 'Dismissed', text.trim(), true); setConfirmDismiss(false); setText(''); }} />
      )}
    </div>
  );
}
