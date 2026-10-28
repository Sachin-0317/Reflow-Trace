import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FACILITIES, ROLE_LABEL, useEval, useStore } from '../store';
import { Glyph } from '../components/Glyph';
import { BatchSheet } from '../components/EvidenceSheet';
import { Empty, KV, Modal, Panel, StatusBadge, TrustChip, VarianceChip, fmtDT, fmtAge } from '../components/ui';
import { ORDER, fmtKg, fmtPct, variancePct } from '../engine/reconcile';
import type { Batch, StepKey } from '../types';

const NAME: Record<StepKey, string> = { generate: 'Generate', collect: 'Collect', transport: 'Transport', receive: 'Receive', treat: 'Treat', verify: 'Verify' };

export default function Dossier() {
  const { id } = useParams();
  const batch = useStore((s) => s.batches.find((b) => b.id === id));
  if (!batch) return <Empty text={`${id} not found. No such record.`} action={<Link to="/batches" className="btn">Batch register</Link>} />;
  return <DossierBody batch={batch} />;
}

function DossierBody({ batch }: { batch: Batch }) {
  const ev = useEval(batch);
  const { config, now, points, discrepancies, audit, setEvidence, role, addBatchNote, toast, logAudit } = useStore();
  const [sheet, setSheet] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const point = points.find((p) => p.id === batch.pointId);
  const fac = FACILITIES.find((f) => f.id === batch.facilityId);
  const discs = discrepancies.filter((d) => d.batchId === batch.id);
  const events = audit.filter((a) => a.batchId === batch.id).slice(-6).reverse();
  const canExport = role === 'admin' || role === 'pibo';

  const rungStatus = (s: StepKey) => {
    const r = batch.steps[s];
    if (ev.breaches.some((b) => b.stepAt === s)) return 'breach';
    if (r?.offline && r.synced === false) return 'offl';
    if (r?.offline) return 'offl';
    return r ? 'done' : 'wait';
  };
  const stepWord: Record<string, string> = { done: 'COMPLETE', wait: 'WAITING', breach: 'BREACHED', offl: 'OFFLINE' };

  let prevKg: number | null = null;
  const ladder = ORDER.map((s, i) => {
    const r = batch.steps[s];
    let v: number | null = null;
    if (r?.massKg && prevKg && s !== 'generate') v = variancePct(prevKg, r.massKg);
    if (r?.massKg && s !== 'generate') prevKg = r.massKg;
    return { s, r, v, i };
  });

  return (
    <div className="stack16">
      <div className="row between wrap gap12">
        <div className="row gap16 wrap">
          <Link to="/batches" className="icon-btn" aria-label="Back"><Glyph name="back" /></Link>
          <h1 className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 28 }}>{batch.id}</h1>
          <StatusBadge c={ev.confidence} />
        </div>
        <div className="row gap8 wrap">
          {canExport && <button className="btn" onClick={() => setSheet(true)}><Glyph name="doc" /> Evidence sheet</button>}
          <button className="btn" onClick={() => setNoteOpen(true)}>Add note</button>
          {role === 'admin' && <button className="btn" onClick={() => { logAudit({ actor: 'Institution admin', role: 'admin', type: 'REWEIGH_REQUESTED', entity: batch.id, source: 'manual', batchId: batch.id }); toast('ok', `Re-weigh requested for ${batch.id}.`); }}>Request re-weigh</button>}
        </div>
      </div>
      <div className="row gap16 wrap small mute">
        <span>Source <Link to={`/points/${batch.pointId}`} className="mono">{batch.pointId}</Link> {point?.site}</span>
        <span>Created <span className="mono">{fmtDT(batch.createdAt)}</span></span>
        <span>Facility {fac?.name}{fac && !fac.digital ? ' (no digital record)' : ''}</span>
      </div>

      <div className="two">
        <div className="stack16">
          <Panel title="Custody ladder" hero>
            <ol className="ladder">
              {ladder.map(({ s, r, v }) => {
                const st = s === 'verify' ? (ev.confidence === 'verified' ? 'done' : ev.confidence === 'discrepancy' ? 'breach' : 'wait') : rungStatus(s);
                return (
                  <li key={s} className={`rung ${st}`}>
                    <span className="pip">{st === 'done' ? '✓' : st === 'breach' ? '◆' : st === 'offl' ? '▲' : '◌'}</span>
                    <div>
                      <div className="row between wrap gap8">
                        <h4>{NAME[s]}</h4>
                        <span className="row gap8">
                          {r && s !== 'verify' && <TrustChip s={r.source} />}
                          <span className="label">{stepWord[st]}</span>
                        </span>
                      </div>
                      {r && s !== 'verify' ? (
                        <div className="small" style={{ marginTop: 4 }}>
                          <div className="row gap12 wrap">
                            <span className="mono">{fmtDT(r.at)}</span>
                            {r.massKg != null ? <span className="mono"><Glyph name="scale" size={12} /> {fmtKg(r.massKg)}</span> : <span className="mute mono">mass null · sensor estimate unavailable</span>}
                            {v != null && <VarianceChip pct={v} tol={config.tolerancePct} />}
                          </div>
                          <div className="mute">{r.actor} · {r.org}{r.location !== r.org ? ` · ${r.location}` : ''}{r.method ? ` · ${r.method}` : ''}</div>
                          {r.offline && <div className={r.synced === false ? 'k-pending' : 'k-attested'}>{r.synced === false ? '◌ held on device, not synced' : '▲ confirmed offline by both parties, then synced'}</div>}
                          {r.evidenceIds.length > 0 && (
                            <div className="row gap8" style={{ marginTop: 6 }}>
                              {r.evidenceIds.map((e) => <button key={e} className="evthumb" onClick={() => setEvidence(e)} title={e} aria-label={`Open evidence ${e}`}><Glyph name="camera" size={14} /></button>)}
                              <span className="mono small mute">{r.evidenceIds.join(' ')}</span>
                            </div>
                          )}
                          {r.note && <div className="mute">Note: {r.note}</div>}
                        </div>
                      ) : s === 'verify' ? (
                        <p className="small mute" style={{ marginTop: 4 }}>{ev.confidence === 'verified' ? 'Policy satisfied. Verified automatically by the rules engine.' : 'Not verified. See verdict.'}</p>
                      ) : (
                        <p className="small mute" style={{ marginTop: 4 }}>Not recorded yet.</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </Panel>

          <Panel title="Reconciliation" right={<span className="chip">TOLERANCE ±{config.tolerancePct}%</span>}>
            {ev.rows.length === 0 ? <Empty text="Fewer than two masses recorded. Nothing to reconcile yet." /> : (
              <div className="tbl-wrap"><table className="t">
                <thead><tr><th>Step pair</th><th className="num">From</th><th className="num">To</th><th className="num">Variance</th><th>Result</th></tr></thead>
                <tbody>
                  {ev.rows.map((r) => (
                    <tr key={r.from}><td>{r.from} → {r.to}</td><td className="num">{fmtKg(r.fromKg)}</td><td className="num">{fmtKg(r.toKg)}</td><td className="num">{fmtPct(r.pct)}</td><td>{r.breach ? <span className="k-discrepancy">◆ FAIL</span> : <span className="k-verified">● PASS</span>}</td></tr>
                  ))}
                  {ev.endToEnd && <tr style={{ fontWeight: 600 }}><td>End to end</td><td className="num">{fmtKg(ev.endToEnd.fromKg)}</td><td className="num">{fmtKg(ev.endToEnd.toKg)}</td><td className="num">{fmtPct(ev.endToEnd.pct)}</td><td>{ev.endToEnd.breach ? <span className="k-discrepancy">◆ FAIL</span> : <span className="k-verified">● PASS</span>}</td></tr>}
                </tbody>
              </table></div>
            )}
            <p className="small mute" style={{ marginTop: 10 }}>Rule: variance = (current − previous) ÷ previous. 5% separates normal handling loss (moisture, weighing variance) from a genuine break. It is a rule, not proof a smaller gap is harmless.</p>
          </Panel>
        </div>

        <div className="stack16">
          <Panel title="Verdict">
            <div className={`verdict ${ev.confidence}`}>
              <StatusBadge c={ev.confidence} />
              <ul style={{ margin: '10px 0 0', paddingLeft: 18 }}>{ev.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
            </div>
            {ev.confidence === 'attested' && <p className="small k-attested" style={{ marginTop: 8 }}>Attested is not equal to verified.</p>}
          </Panel>

          <Panel title="Timing windows">
            {ev.timers.length === 0 ? <p className="mute small">No window running yet.</p> : ev.timers.map((t) => {
              const ratio = t.elapsedH / t.limitH;
              const cls = t.breached ? 'crit' : ratio > 0.75 && !t.done ? 'warn' : '';
              return (
                <div key={t.key} style={{ marginBottom: 12 }}>
                  <div className="row between"><span className="small">{t.label}</span>
                    <span className={`timer ${cls}`}>{fmtAge(t.elapsedH * 3600_000)} / {t.limitH} h {t.done ? '· done' : t.breached ? '· over' : `· ${Math.max(0, t.limitH - t.elapsedH).toFixed(1)} h left`}</span></div>
                  <div className={`tbar ${cls}`}><i style={{ width: `${Math.min(100, ratio * 100)}%` }} /></div>
                </div>
              );
            })}
          </Panel>

          <Panel title="Linked discrepancies">
            {discs.length === 0 ? <p className="mute small">None. Quiet floor.</p> : discs.map((d) => (
              <Link key={d.id} to={`/discrepancies/${d.id}`} className="row between" style={{ color: 'var(--bone)', padding: '6px 0' }}>
                <span className="mono">{d.id}</span><span className="small mute">{d.rule}</span>
                <span className={d.status === 'resolved' ? 'k-verified' : 'k-discrepancy'}>{d.status === 'resolved' ? 'resolved' : '◆ ' + d.status}</span>
              </Link>
            ))}
          </Panel>

          <Panel title="Recent audit events">
            {events.length === 0 ? <p className="mute small">No events.</p> : (
              <div className="timeline">
                {events.map((a) => <div key={a.id}><span className="mono small">{a.type}</span><br /><span className="small mute">{fmtDT(a.at)} · {a.actor}{a.next ? ` · ${a.next.slice(0, 50)}` : ''}</span></div>)}
              </div>
            )}
            {batch.notes.map((n, i) => <p key={i} className="small" style={{ marginTop: 8 }}><span className="mono mute">{fmtDT(n.at)}</span> {n.by}: {n.text}</p>)}
          </Panel>

          <KV k="Roles that wrote this batch" v={<span className="small">{Array.from(new Set(Object.values(batch.steps).map((s) => s!.actor))).join(' · ')}</span>} />
          <p className="small mute">No field on this page identifies a disposer. Viewing as {role ? ROLE_LABEL[role] : '—'}.</p>
        </div>
      </div>

      {sheet && <BatchSheet batch={batch} onClose={() => setSheet(false)} />}
      {noteOpen && (
        <Modal title="Add note" onClose={() => setNoteOpen(false)}>
          <form className="stack" onSubmit={(e) => { e.preventDefault(); if (note.trim()) { addBatchNote(batch.id, note.trim()); setNote(''); setNoteOpen(false); } }}>
            <div className="field"><label htmlFor="nt">Note (logged to audit)</label><textarea id="nt" className="textarea" value={note} onChange={(e) => setNote(e.target.value)} required /></div>
            <div className="row gap8 end"><button type="button" className="btn ghost" onClick={() => setNoteOpen(false)}>Cancel</button><button className="btn primary">Save note</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}
