import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FACILITIES, ROLE_LABEL, ROLE_STEPS, useStore, type HandoffResult } from '../store';
import { Glyph } from '../components/Glyph';
import { Empty, PageHeader, Panel, VarianceChip } from '../components/ui';
import { MASS_STEPS, fmtKg, fmtPct, variancePct } from '../engine/reconcile';
import type { Batch, Role, StepKey } from '../types';

function nextStep(b: Batch): StepKey | null {
  for (const s of MASS_STEPS) if (!b.steps[s]) return s;
  return null;
}
const STEP_WORD: Record<string, string> = { collect: 'Collect', transport: 'Dispatch', receive: 'Receive', treat: 'Treat' };
const LABELS = ['Scan', 'Context', 'Weigh', 'Evidence', 'Review', 'Result'];

export default function Handoff() {
  const { role, batches, points, config, offline, submitHandoff, createBatch, queue, audit, signIn, setOffline } = useStore();
  const [stage, setStage] = useState(0);
  const [mode, setMode] = useState<'existing' | 'create'>('existing');
  const [batchId, setBatchId] = useState('');
  const [pointId, setPointId] = useState(points[0]?.id ?? '');
  const [mass, setMass] = useState('');
  const [photo, setPhoto] = useState(false);
  const [note, setNote] = useState('');
  const [facility, setFacility] = useState('fac_1');
  const [method, setMethod] = useState('Incineration, 850°C+');
  const [err, setErr] = useState('');
  const [result, setResult] = useState<(HandoffResult & { step?: StepKey; kg?: number; prev?: number | null }) | null>(null);
  const [saving, setSaving] = useState(false);

  const allowed = role ? ROLE_STEPS[role] : [];
  const eligible = useMemo(() => batches.filter((b) => { const n = nextStep(b); return !!n && allowed.includes(n); }), [batches, allowed]);
  const batch = batches.find((b) => b.id === batchId.trim().toUpperCase());
  const step = mode === 'create' ? 'collect' : batch ? nextStep(batch) : null;
  const prevKg = batch && step ? batch.steps[MASS_STEPS[MASS_STEPS.indexOf(step) - 1]]?.massKg ?? null : null;

  if (!role) return null;
  if (role === 'admin' || role === 'pibo') {
    return (
      <div className="phone"><Panel hero title="Handoff is for field roles">
        <div className="stack">
          <p>{ROLE_LABEL[role]} cannot create handoffs. Custody events must come from the people who hold the waste. Switch to a field role to try the flow.</p>
          <div className="roles">{(['collector', 'transporter', 'treatment'] as Role[]).map((r) => <button key={r} className="btn" onClick={() => signIn(r)}>{ROLE_LABEL[r]}</button>)}</div>
        </div>
      </Panel></div>
    );
  }

  const reset = () => { setStage(0); setBatchId(''); setMass(''); setPhoto(false); setNote(''); setErr(''); setResult(null); setMode('existing'); };
  const kg = Number(mass);
  const live = prevKg && kg > 0 ? variancePct(prevKg, kg) : null;

  const next = () => {
    setErr('');
    if (stage === 0) {
      if (mode === 'create') { if (!pointId) return setErr('Pick a disposal point.'); if (!allowed.includes('collect')) return setErr('Only collectors create batches.'); return setStage(1); }
      if (!batch) return setErr(batchId ? `${batchId.toUpperCase()} not found. Check the tag.` : 'Scan or enter a batch ID.');
      if (!step) return setErr(`${batch.id} has no further steps. Duplicate scan ignored.`);
      if (!allowed.includes(step)) return setErr(`${batch.id} is waiting for ${step}. ${ROLE_LABEL[role]} cannot record that.`);
    }
    if (stage === 2) { if (!(kg > 0)) return setErr('Mass must be above zero.'); }
    if (stage === 3 && offline && !photo) return setErr('Offline entries need a photo so both parties can attest later.');
    setStage(stage + 1);
  };

  const confirm = () => {
    setSaving(true);
    setTimeout(() => {
      const r = mode === 'create'
        ? createBatch(pointId, kg, photo, note || undefined)
        : submitHandoff({ batchId: batch!.id, step: step!, massKg: kg, photo, note: note || undefined, method: step === 'treat' ? method : undefined, facilityId: step === 'receive' || step === 'treat' ? facility : undefined });
      setSaving(false);
      if (!r.ok) { setErr(r.error ?? 'Failed.'); return; }
      setResult({ ...r, step: step!, kg, prev: prevKg });
      setStage(5);
    }, 250);
  };

  const mine = audit.filter((a) => (a.type === 'HANDOFF_CREATED' || a.type === 'BATCH_CREATED') && a.id.startsWith('AUD-9') && a.role === role).slice(-5).reverse();
  const heldCount = queue.length;

  return (
    <div className="phone">
      <PageHeader title="Handoff" sub={`${ROLE_LABEL[role]} · ${allowed.map((s) => STEP_WORD[s]).join(' / ')}`}
        right={<button className={`btn sm ${offline ? 'danger' : ''}`} onClick={() => setOffline(!offline)} aria-pressed={offline}>{offline ? '⊘ Offline' : 'Online'}</button>} />
      <div className="prog" aria-label={`Step ${stage + 1} of 6, ${LABELS[stage]}`}>{LABELS.map((l, i) => <i key={l} className={i <= stage ? 'on' : ''} />)}</div>
      <p className="label" style={{ marginBottom: 12 }}>{stage + 1}/6 · {LABELS[stage]}</p>

      {offline && stage < 5 && <div className="offline-banner" style={{ margin: '0 0 12px', padding: '8px 12px' }} role="status">⊘ Offline. This event will be held on the device as ◌ and sync later.</div>}

      {stage === 0 && (
        <Panel hero>
          <div className="stack">
            <div className="toggle" role="group" aria-label="Mode">
              <button className={mode === 'existing' ? 'on' : ''} onClick={() => setMode('existing')}>EXISTING BATCH</button>
              {allowed.includes('collect') && <button className={mode === 'create' ? 'on' : ''} onClick={() => setMode('create')}>CREATE BATCH</button>}
            </div>
            {mode === 'existing' ? (
              <>
                <div className="field"><label htmlFor="bid">Batch ID (type if the camera is unavailable)</label><input id="bid" className="input mono" placeholder="BATCH-2220" value={batchId} onChange={(e) => setBatchId(e.target.value)} autoComplete="off" /></div>
                <div className="small mute">Camera scanning needs a device build. This prototype has manual entry and simulated scan.</div>
                <span className="label">Simulate scan · waiting for you</span>
                {eligible.length === 0 ? <Empty text="Nothing waiting for this role. Quiet floor." /> : (
                  <div className="row gap8 wrap">{eligible.slice(-8).reverse().map((b) => <button key={b.id} className="btn sm" onClick={() => setBatchId(b.id)}><Glyph name="scan" size={14} /> {b.id}</button>)}</div>
                )}
              </>
            ) : (
              <div className="field"><label htmlFor="pid">Disposal point (scan its tag)</label>
                <select id="pid" className="select" value={pointId} onChange={(e) => setPointId(e.target.value)}>{points.filter((p) => !p.disabled).map((p) => <option key={p.id} value={p.id}>{p.id} · {p.site}{p.fillPct != null ? ` · ${p.fillPct}%` : ''}</option>)}</select></div>
            )}
            {err && <p className="err" role="alert">{err}</p>}
          </div>
        </Panel>
      )}

      {stage === 1 && (
        <Panel hero>
          <div className="stack">
            <h2 className="display" style={{ fontSize: 30 }}>{STEP_WORD[step!]} {mode === 'create' ? 'new batch' : batch?.id}</h2>
            <p className="mute">{mode === 'create' ? `At ${pointId}. A new batch ID is issued on confirm.` : `From ${batch?.pointId}. Location is filled from the batch and can be corrected.`}</p>
            <div className="field"><label htmlFor="loc">Location</label><input id="loc" className="input" defaultValue={mode === 'create' ? points.find((p) => p.id === pointId)?.name : step === 'transport' ? 'Campus gate' : FACILITIES.find((f) => f.id === facility)?.name} /></div>
            {(step === 'receive' || step === 'treat') && (
              <div className="field"><label htmlFor="fac">Treatment facility (registry)</label>
                <select id="fac" className="select" value={facility} onChange={(e) => setFacility(e.target.value)}>{FACILITIES.map((f) => <option key={f.id} value={f.id}>{f.name}{f.digital ? '' : ' · no digital record'}</option>)}</select>
                {!FACILITIES.find((f) => f.id === facility)?.digital && <span className="hint k-attested">▲ This facility cannot record digitally, so the batch can reach attested at most.</span>}</div>
            )}
            {step === 'treat' && <div className="field"><label htmlFor="mt">Treatment method</label><select id="mt" className="select" value={method} onChange={(e) => setMethod(e.target.value)}><option>Incineration, 850°C+</option><option>Autoclave + shred</option></select></div>}
          </div>
        </Panel>
      )}

      {stage === 2 && (
        <Panel hero>
          <div className="stack">
            <div className="field"><label htmlFor="ms">Mass (kg)</label><input id="ms" className="input mono" style={{ fontSize: 28, height: 64 }} type="number" step="0.01" min="0" inputMode="decimal" value={mass} onChange={(e) => setMass(e.target.value)} autoFocus aria-invalid={!!err} /></div>
            {prevKg != null && <p className="small mute">Expected: about <span className="mono">{fmtKg(prevKg)}</span> from the previous step.</p>}
            {live != null && (
              <p>Preview <VarianceChip pct={live} tol={config.tolerancePct} /> {Math.abs(live) > config.tolerancePct ? <span className="k-discrepancy">Will flag a discrepancy.</span> : <span className="k-verified">OK</span>}</p>
            )}
            {err && <p className="err" role="alert">{err}</p>}
          </div>
        </Panel>
      )}

      {stage === 3 && (
        <Panel hero>
          <div className="stack">
            <button className={`btn ${photo ? 'primary' : ''} block`} onClick={() => setPhoto(!photo)} aria-pressed={photo}><Glyph name="camera" /> {photo ? 'Photo attached (simulated)' : 'Attach photo'}</button>
            <p className="small mute">Prototype: no camera. The photo is a placeholder evidence item. Photo is required for any attested (offline) entry.</p>
            <div className="field"><label htmlFor="nt">Note (optional)</label><textarea id="nt" className="textarea" value={note} onChange={(e) => setNote(e.target.value)} /></div>
            {err && <p className="err" role="alert">{err}</p>}
          </div>
        </Panel>
      )}

      {stage === 4 && (
        <Panel hero title="Review">
          <div className="stack">
            <div className="grid2">
              <div className="kv"><span className="label">Action</span><b>{STEP_WORD[step!]}</b></div>
              <div className="kv"><span className="label">Batch</span><span className="mono">{mode === 'create' ? 'new' : batch?.id}</span></div>
              <div className="kv"><span className="label">Mass</span><span className="mono bigmass">{fmtKg(kg)}</span></div>
              <div className="kv"><span className="label">Variance</span>{live != null ? <VarianceChip pct={live} tol={config.tolerancePct} /> : <span className="mute">n/a</span>}</div>
            </div>
            <p className="small mute">Evidence: {photo ? 'photo attached' : 'none'} · {offline ? '◌ will be held on this device' : 'syncs now'}</p>
            {err && <p className="err" role="alert">{err}</p>}
          </div>
        </Panel>
      )}

      {stage === 5 && result && (
        <Panel hero>
          <div className="stack">
            {result.discrepancy ? (
              <><span className="badge c-discrepancy">◆ DISCREPANCY FLAGGED</span>
                <p>{STEP_WORD[result.step ?? 'receive']} {fmtKg(result.kg)}. Previous step {fmtKg(result.prev)} ({fmtPct(result.variancePct)}). Investigate.</p></>
            ) : result.held ? (
              <><span className="badge c-pending">◌ HELD ON DEVICE</span><p>Saved with its original timestamp. It stays pending until it syncs, then shows as attested.</p></>
            ) : (
              <><span className="badge c-verified">● RECORDED</span><p>{fmtKg(result.kg)} recorded{result.variancePct != null ? `, ${fmtPct(result.variancePct)} within tolerance` : ''}.</p></>
            )}
            {result.batchId && <Link className="mono" to={`/batch/${result.batchId}`}>{result.batchId} · open dossier</Link>}
            <button className="btn primary block" onClick={reset}>Next scan</button>
          </div>
        </Panel>
      )}

      {stage < 5 && (
        <div className="sticky-act">
          {stage > 0 && <button className="btn" onClick={() => { setErr(''); setStage(stage - 1); }}>Back</button>}
          {stage < 4 ? <button className="btn primary grow" onClick={next}>Continue</button> : <button className="btn primary grow" onClick={confirm} disabled={saving}>{saving ? 'Saving…' : 'Confirm handoff'}</button>}
        </div>
      )}

      <Panel title="My handoffs" right={<span className="mono small mute">{heldCount} held ◌</span>}>
        {mine.length === 0 ? <Empty text="No handoffs this session." /> : mine.map((a) => (
          <div key={a.id} className="row between" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
            <Link className="mono" to={`/batch/${a.batchId}`}>{a.entity}</Link><span className="small mute">{a.next}</span>
          </div>
        ))}
      </Panel>
    </div>
  );
}
