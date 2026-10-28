import { FACILITIES, useStore } from '../store';
import { Modal, fmtDT } from './ui';
import { evaluate, fmtKg, fmtPct } from '../engine/reconcile';
import { CONF_GLYPH } from './Glyph';
import type { Batch } from '../types';

const STEPS = ['generate', 'collect', 'transport', 'receive', 'treat'] as const;

export function BatchSheet({ batch, onClose }: { batch: Batch; onClose: () => void }) {
  const { config, now } = useStore();
  const ev = evaluate(batch, config, now, FACILITIES);
  return (
    <Modal title={`Evidence sheet ${batch.id}`} onClose={onClose} wide>
      <div className="stack" id="sheet">
        <div className="row between wrap"><div><span className="label">RE:FLOW · TRACE EVIDENCE SHEET</span><h2 className="display" style={{ fontSize: 28 }}>{batch.id}</h2></div>
          <button className="btn primary no-print" onClick={() => window.print()}>Print / save PDF</button></div>
        <p><b>{CONF_GLYPH[ev.confidence]} {ev.confidence.toUpperCase()}</b>. {ev.reasons.join(' ')}</p>
        <table className="t">
          <thead><tr><th>Step</th><th>Time</th><th>Role / org</th><th>Source</th><th className="num">Mass</th><th>Evidence</th></tr></thead>
          <tbody>
            {STEPS.map((s) => { const r = batch.steps[s]; return (
              <tr key={s}><td>{s}</td><td className="mono">{r ? fmtDT(r.at) : '—'}</td><td>{r ? `${r.actor}, ${r.org}` : 'not recorded'}</td><td className="mono">{r ? r.source + (r.offline ? ' · offline' : '') : '—'}</td><td className="num">{r ? fmtKg(r.massKg) : '—'}</td><td className="mono">{r?.evidenceIds.join(', ') || '—'}</td></tr>
            ); })}
          </tbody>
        </table>
        <div>
          <span className="label">Reconciliation · tolerance ±{config.tolerancePct}%</span>
          {ev.rows.map((r) => <p key={r.from} className="mono small">{r.from} → {r.to}: {fmtKg(r.fromKg)} → {fmtKg(r.toKg)} ({fmtPct(r.pct)}) {r.breach ? 'OUT OF TOLERANCE' : 'within tolerance'}</p>)}
          {ev.rows.length === 0 && <p className="small mute">Fewer than two masses recorded.</p>}
        </div>
        <p className="small mute">Definitions: variance = (current − previous) ÷ previous. Verified needs digital steps by independent actors at a registered facility. Attested means confirmed offline by both parties and is not equal to verified. This sheet is a record summary, not a certificate of regulatory compliance. Generated {fmtDT(new Date(now).toISOString())} from SIM data.</p>
      </div>
    </Modal>
  );
}
