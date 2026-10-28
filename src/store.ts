import { create } from 'zustand';
import type {
  AuditEvent, Batch, Config, Discrepancy, Mode, Point, QueueEvent, Role, StepKey,
} from './types';
import { DEFAULT_CONFIG, ORDER, evaluate, fmtKg, fmtPct, variancePct, type Evaluation } from './engine/reconcile';
import {
  FACILITIES, INSTITUTION, TRANSPORTERS, buildAudit, buildBatches, buildPoints,
  buildResolvedDiscrepancies, nextEvidence,
} from './data/fixtures';

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Institution admin', collector: 'Collector', transporter: 'Transporter',
  treatment: 'Treatment operator', pibo: 'PIBO / Auditor',
};
export const ROLE_STEPS: Record<Role, StepKey[]> = {
  admin: [], collector: ['collect'], transporter: ['transport'], treatment: ['receive', 'treat'], pibo: [],
};
const ROLE_ACTOR: Record<Role, string> = {
  admin: 'Institution admin', collector: 'Collector team A', transporter: 'Driver, KWL-04',
  treatment: 'Treatment operator', pibo: 'Auditor',
};

export interface Toast { id: number; kind: 'ok' | 'warn' | 'err'; text: string }
export interface HandoffInput {
  batchId: string; step: StepKey; massKg: number; photo: boolean; note?: string; method?: string; facilityId?: string;
}
export interface HandoffResult {
  ok: boolean; error?: string; variancePct?: number | null; discrepancy?: boolean; held?: boolean; batchId?: string;
}

interface State {
  role: Role | null;
  theme: 'night' | 'day';
  lang: 'en' | 'ta';
  mode: Mode;
  offline: boolean;
  clockOffset: number;
  now: number;
  syncedAt: number;
  config: Config;
  points: Point[];
  batches: Batch[];
  discrepancies: Discrepancy[];
  audit: AuditEvent[];
  queue: QueueEvent[];
  toasts: Toast[];
  readNotes: string[];
  drawer: null | 'bell' | 'queue' | 'judge' | 'director' | 'palette';
  evidenceViewer: string | null;
  batchSeq: number;
  discSeq: number;
  anonLast: Record<string, number>;

  signIn: (r: Role) => void;
  signOut: () => void;
  setTheme: (t: 'night' | 'day') => void;
  setLang: (l: 'en' | 'ta') => void;
  setOffline: (v: boolean) => void;
  setDrawer: (d: State['drawer']) => void;
  setEvidence: (id: string | null) => void;
  toast: (kind: Toast['kind'], text: string) => void;
  dismissToast: (id: number) => void;
  tick: () => void;
  refreshSync: () => void;
  markRead: (ids: string[]) => void;
  setConfig: (c: Config) => void;
  createBatch: (pointId: string, massKg: number, photo: boolean, note?: string) => HandoffResult;
  submitHandoff: (h: HandoffInput) => HandoffResult;
  syncQueue: () => void;
  discardQueued: (id: string) => void;
  assignDisc: (id: string, owner: string) => void;
  noteDisc: (id: string, text: string) => void;
  resolveDisc: (id: string, kind: string, text: string, dismissed?: boolean) => void;
  startInvestigating: (id: string) => void;
  addBatchNote: (batchId: string, text: string) => void;
  requestCollection: (pointId: string) => void;
  patchPoint: (id: string, patch: Partial<Point>, auditType: string) => void;
  regenerateQr: (pointId: string) => void;
  anonReport: (pointId: string, kind: string) => boolean;
  logAudit: (e: Omit<AuditEvent, 'id' | 'at'>) => void;
  runScenario: (name: string) => void;
  advanceClock: (hours: number) => void;
  reset: () => void;
}

function seed() {
  const now = Date.now();
  const batches = buildBatches(now);
  return {
    now,
    clockOffset: 0,
    points: buildPoints(now),
    batches,
    discrepancies: buildResolvedDiscrepancies(now),
    audit: buildAudit(batches, now),
    queue: [] as QueueEvent[],
    batchSeq: 2222,
    discSeq: 112,
  };
}

let toastSeq = 1;
let auditSeq = 90000;
let queueSeq = 1;

export const useStore = create<State>((set, get) => {
  const clock = () => Date.now() + get().clockOffset;

  function log(e: Omit<AuditEvent, 'id' | 'at'>) {
    const ev: AuditEvent = { ...e, id: `AUD-${++auditSeq}`, at: new Date(clock()).toISOString() };
    set((s) => ({ audit: [...s.audit, ev] }));
  }

  /** Compare each batch against the rules. Open a record for new breaches, merge repeats. */
  function refreshDiscrepancies() {
    const s = get();
    const now = clock();
    let discs = s.discrepancies.slice();
    let seq = s.discSeq;
    const created: Discrepancy[] = [];
    for (const b of s.batches) {
      const ev = evaluate(b, s.config, now, FACILITIES);
      for (const br of ev.breaches) {
        const existing = discs.find((d) => d.batchId === b.id && d.rule === br.rule && d.status !== 'resolved');
        const resolvedSame = discs.find((d) => d.batchId === b.id && d.rule === br.rule && d.status === 'resolved');
        if (existing) {
          if (existing.detail !== br.detail) {
            discs = discs.map((d) => (d.id === existing.id ? { ...d, detail: br.detail, count: d.count + 1 } : d));
          }
          continue;
        }
        if (resolvedSame) continue;
        const d: Discrepancy = {
          id: `DISC-${seq++}`, batchId: b.id, rule: br.rule, stepAt: br.stepAt, detail: br.detail,
          fromKg: br.fromKg, toKg: br.toKg, variancePct: br.pct, status: 'new', owner: null,
          detectedAt: new Date(now).toISOString(), count: 1, notes: [],
        };
        discs.push(d);
        created.push(d);
      }
    }
    if (created.length || discs.length !== s.discrepancies.length || discs !== s.discrepancies) {
      set({ discrepancies: discs, discSeq: seq });
    }
    for (const d of created) {
      log({ actor: 'TRACE engine', role: 'system', type: 'DISCREPANCY_OPENED', entity: d.id, next: d.detail, source: 'auto', batchId: d.batchId, discId: d.id });
    }
    return created;
  }

  function pushToast(kind: Toast['kind'], text: string) {
    const id = toastSeq++;
    set((s) => ({ toasts: [...s.toasts, { id, kind, text }] }));
    setTimeout(() => get().dismissToast(id), 5200);
  }

  const fresh = seed();

  return {
    role: (() => { try { return (sessionStorage.getItem('trace-role') as Role | null) || null; } catch { return null; } })(),
    theme: 'night',
    lang: 'en',
    mode: 'SIM',
    offline: false,
    config: DEFAULT_CONFIG,
    syncedAt: fresh.now,
    drawer: null,
    evidenceViewer: null,
    toasts: [],
    readNotes: [],
    anonLast: {},
    ...fresh,

    signIn: (role) => {
      try { sessionStorage.setItem('trace-role', role); } catch { /* storage unavailable */ }
      set({ role });
      log({ actor: ROLE_ACTOR[role], role, type: 'SESSION_STARTED', entity: role, source: 'manual' });
    },
    signOut: () => {
      try { sessionStorage.removeItem('trace-role'); } catch { /* storage unavailable */ }
      set({ role: null, drawer: null });
    },
    setTheme: (theme) => {
      document.documentElement.dataset.theme = theme;
      set({ theme });
    },
    setLang: (lang) => {
      document.documentElement.lang = lang;
      set({ lang });
    },
    setOffline: (offline) => {
      set({ offline });
      pushToast(offline ? 'warn' : 'ok', offline ? 'Offline. New handoffs are held on this device.' : 'Back online. Sync the queue to release held events.');
    },
    setDrawer: (drawer) => set({ drawer }),
    setEvidence: (evidenceViewer) => set({ evidenceViewer }),
    toast: pushToast,
    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    tick: () => {
      set({ now: clock() });
      refreshDiscrepancies();
    },
    refreshSync: () => {
      set({ syncedAt: clock(), now: clock() });
      refreshDiscrepancies();
    },
    markRead: (ids) => set((s) => ({ readNotes: Array.from(new Set([...s.readNotes, ...ids])) })),
    setConfig: (config) => {
      const prev = get().config;
      set({ config });
      log({ actor: 'Institution admin', role: 'admin', type: 'CONFIG_CHANGED', entity: 'config', prev: JSON.stringify(prev), next: JSON.stringify(config), source: 'manual' });
      refreshDiscrepancies();
    },

    createBatch: (pointId, massKg, photo, note) => {
      const s = get();
      if (!(massKg > 0)) return { ok: false, error: 'Mass must be above zero.' };
      const point = s.points.find((p) => p.id === pointId);
      if (!point) return { ok: false, error: 'Unknown disposal point.' };
      const id = `BATCH-${s.batchSeq}`;
      const at = new Date(clock()).toISOString();
      const held = s.offline;
      const sensorKg = null;
      const batch: Batch = {
        id, pointId, institutionId: INSTITUTION.id, createdAt: at, facilityId: 'fac_1', notes: [],
        steps: {
          generate: { massKg: sensorKg, at, actor: 'Collector team A', org: INSTITUTION.name, source: 'SCAN', evidenceIds: [], location: point.name },
          collect: {
            massKg, at, actor: 'Collector team A', org: INSTITUTION.name, source: 'SCAN', location: point.name,
            evidenceIds: photo ? [nextEvidence()] : [], offline: held || undefined, synced: held ? false : undefined, note,
          },
        },
      };
      set((st) => ({
        batches: [...st.batches, batch],
        batchSeq: st.batchSeq + 1,
        points: st.points.map((p) => (p.id === pointId ? { ...p, lastCollectionAt: at } : p)),
        queue: held ? [...st.queue, { id: `Q-${queueSeq++}`, at, batchId: id, step: 'collect', massKg }] : st.queue,
      }));
      log({ actor: 'Collector team A', role: 'collector', type: 'BATCH_CREATED', entity: id, next: `${massKg.toFixed(2)} kg at ${pointId}${held ? ' (held on device)' : ''}`, source: 'manual', batchId: id });
      refreshDiscrepancies();
      return { ok: true, batchId: id, held, variancePct: null };
    },

    submitHandoff: (h) => {
      const s = get();
      const b = s.batches.find((x) => x.id === h.batchId);
      if (!b) return { ok: false, error: `${h.batchId} not found.` };
      if (!(h.massKg > 0)) return { ok: false, error: 'Mass must be above zero.' };
      if (b.steps[h.step]) return { ok: false, error: `${h.step} already recorded for ${b.id}. Duplicate scan ignored.` };
      const prevStep = ORDER[ORDER.indexOf(h.step) - 1];
      if (!b.steps[prevStep]) return { ok: false, error: `${b.id} has no ${prevStep} record yet. Wrong order.` };
      const role = s.role ?? 'collector';
      const at = new Date(clock()).toISOString();
      const held = s.offline;
      const facility = FACILITIES.find((f) => f.id === (h.facilityId ?? b.facilityId))!;
      const org =
        h.step === 'transport' ? TRANSPORTERS[0].name : h.step === 'collect' ? INSTITUTION.name : facility.name;
      const prevKg = b.steps[prevStep]?.massKg ?? null;
      const pct = prevKg ? variancePct(prevKg, h.massKg) : null;
      const rec = {
        massKg: h.massKg, at, actor: ROLE_ACTOR[role], org, source: 'SCAN' as const,
        location: h.step === 'transport' ? 'Campus gate' : facility.name,
        evidenceIds: h.photo ? [nextEvidence()] : [], offline: held || undefined,
        synced: held ? false : undefined, note: h.note, method: h.method,
      };
      set((st) => ({
        batches: st.batches.map((x) =>
          x.id === b.id
            ? {
                ...x,
                facilityId: h.step === 'receive' || h.step === 'treat' ? facility.id : x.facilityId,
                steps: { ...x.steps, [h.step]: rec, ...(h.step === 'treat' ? { verify: { massKg: null, at, actor: 'TRACE engine', org: 'System', source: 'SIM' as const, evidenceIds: [], location: 'n/a' } } : {}) },
              }
            : x,
        ),
        queue: held ? [...st.queue, { id: `Q-${queueSeq++}`, at, batchId: b.id, step: h.step, massKg: h.massKg }] : st.queue,
      }));
      log({ actor: ROLE_ACTOR[role], role, type: 'HANDOFF_CREATED', entity: b.id, next: `${h.step} ${fmtKg(h.massKg)}${held ? ' (held on device)' : ''}`, source: 'manual', batchId: b.id });
      const created = refreshDiscrepancies().filter((d) => d.batchId === b.id);
      return { ok: true, variancePct: pct, discrepancy: created.length > 0, held, batchId: b.id };
    },

    syncQueue: () => {
      const s = get();
      if (s.offline) return pushToast('err', 'Sync failed. Still offline. ' + s.queue.length + ' events held on device. Retry.');
      if (!s.queue.length) return pushToast('ok', 'Nothing held on device.');
      const n = s.queue.length;
      set((st) => ({
        queue: [],
        syncedAt: clock(),
        batches: st.batches.map((b) => {
          const steps = { ...b.steps };
          for (const k of ORDER) {
            const r = steps[k];
            if (r && r.offline && r.synced === false) steps[k] = { ...r, synced: true, offline: undefined, source: 'ATTESTED' };
          }
          return { ...b, steps };
        }),
      }));
      log({ actor: 'TRACE sync', role: 'system', type: 'QUEUE_SYNCED', entity: 'queue', next: `${n} events`, source: 'auto' });
      refreshDiscrepancies();
      pushToast('ok', `${n} held events synced. They stay attested, not verified, because they were confirmed offline.`);
    },

    discardQueued: (id) => {
      const q = get().queue.find((x) => x.id === id);
      if (!q) return;
      set((st) => ({
        queue: st.queue.filter((x) => x.id !== id),
        batches: st.batches
          .map((b) => {
            if (b.id !== q.batchId) return b;
            const steps = { ...b.steps };
            delete steps[q.step];
            return { ...b, steps };
          })
          .filter((b) => b.steps.collect || b.steps.transport || b.id !== q.batchId),
      }));
      log({ actor: 'Operator', role: get().role ?? 'collector', type: 'QUEUED_EVENT_DISCARDED', entity: q.batchId, prev: `${q.step} ${q.massKg} kg`, source: 'manual', batchId: q.batchId });
    },

    assignDisc: (id, owner) => {
      const d = get().discrepancies.find((x) => x.id === id);
      set((s) => ({ discrepancies: s.discrepancies.map((x) => (x.id === id ? { ...x, owner, status: x.status === 'new' ? 'investigating' : x.status } : x)) }));
      log({ actor: 'Institution admin', role: 'admin', type: 'DISCREPANCY_ASSIGNED', entity: id, prev: d?.owner ?? 'unassigned', next: owner, source: 'manual', discId: id, batchId: d?.batchId });
    },
    startInvestigating: (id) => {
      set((s) => ({ discrepancies: s.discrepancies.map((x) => (x.id === id ? { ...x, status: 'investigating' } : x)) }));
      log({ actor: 'Institution admin', role: 'admin', type: 'DISCREPANCY_STATUS', entity: id, prev: 'new', next: 'investigating', source: 'manual', discId: id });
    },
    noteDisc: (id, text) => {
      const at = new Date(clock()).toISOString();
      set((s) => ({ discrepancies: s.discrepancies.map((x) => (x.id === id ? { ...x, notes: [...x.notes, { at, by: 'Institution admin', text }] } : x)) }));
      log({ actor: 'Institution admin', role: 'admin', type: 'NOTE_ADDED', entity: id, next: text, source: 'manual', discId: id });
    },
    resolveDisc: (id, kind, text, dismissed) => {
      const at = new Date(clock()).toISOString();
      const d = get().discrepancies.find((x) => x.id === id);
      set((s) => ({ discrepancies: s.discrepancies.map((x) => (x.id === id ? { ...x, status: 'resolved', resolution: { kind, text, at, dismissed } } : x)) }));
      log({ actor: 'Institution admin', role: 'admin', type: dismissed ? 'DISCREPANCY_DISMISSED' : 'DISCREPANCY_RESOLVED', entity: id, prev: d?.status, next: `${kind}: ${text}`, source: 'manual', discId: id, batchId: d?.batchId });
    },
    addBatchNote: (batchId, text) => {
      const at = new Date(clock()).toISOString();
      set((s) => ({ batches: s.batches.map((b) => (b.id === batchId ? { ...b, notes: [...b.notes, { at, by: ROLE_LABEL[s.role ?? 'admin'], text }] } : b)) }));
      log({ actor: ROLE_LABEL[get().role ?? 'admin'], role: get().role ?? 'admin', type: 'NOTE_ADDED', entity: batchId, next: text, source: 'manual', batchId });
    },
    requestCollection: (pointId) => {
      log({ actor: 'Institution admin', role: 'admin', type: 'COLLECTION_REQUESTED', entity: pointId, source: 'manual' });
      pushToast('ok', `Collection requested for ${pointId}.`);
    },
    patchPoint: (id, patch, auditType) => {
      set((s) => ({ points: s.points.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
      log({ actor: 'Institution admin', role: 'admin', type: auditType, entity: id, next: JSON.stringify(patch), source: 'manual' });
    },
    regenerateQr: (pointId) => {
      const p = get().points.find((x) => x.id === pointId);
      set((s) => ({ points: s.points.map((x) => (x.id === pointId ? { ...x, qrVersion: x.qrVersion + 1 } : x)) }));
      log({ actor: 'Institution admin', role: 'admin', type: 'QR_REGENERATED', entity: pointId, prev: `v${p?.qrVersion}`, next: `v${(p?.qrVersion ?? 1) + 1}, old code invalidated`, source: 'manual' });
    },
    anonReport: (pointId, kind) => {
      const key = pointId + kind;
      const last = get().anonLast[key] ?? 0;
      if (Date.now() - last < 60_000) return false;
      set((s) => ({ anonLast: { ...s.anonLast, [key]: Date.now() } }));
      log({ actor: 'Anonymous', role: 'anonymous', type: 'ANON_REPORT', entity: pointId, next: kind, source: 'auto' });
      return true;
    },
    logAudit: log,
    advanceClock: (hours) => {
      set((s) => ({ clockOffset: s.clockOffset + hours * 3600_000 }));
      set({ now: clock() });
      refreshDiscrepancies();
    },

    runScenario: (name) => {
      const s = get();
      const nowMs = clock();
      set({ mode: 'DEMO' });
      const mk = (pid: string, kg: number, o: { upTo: StepKey; r2?: number; r1?: number; r3?: number; fac?: string; attest?: StepKey; ageH?: number }) => {
        const id = `BATCH-${get().batchSeq}`;
        set((st) => ({ batchSeq: st.batchSeq + 1 }));
        const t0 = nowMs - (o.ageH ?? 8) * 3600_000;
        const fac = FACILITIES.find((f) => f.id === (o.fac ?? 'fac_1'))!;
        const idx = ORDER.indexOf(o.upTo);
        const point = get().points.find((p) => p.id === pid)!;
        const iso = (m: number) => new Date(t0 + m * 60_000).toISOString();
        const tKg = +(kg * (o.r1 ?? 0.99)).toFixed(2);
        const rKg = +(tKg * (o.r2 ?? 0.985)).toFixed(2);
        const trKg = +(rKg * (o.r3 ?? 0.997)).toFixed(2);
        const steps: Batch['steps'] = {
          generate: { massKg: null, at: iso(-15), actor: 'Director', org: 'Scenario', source: 'SIM', evidenceIds: [], location: point.name },
          collect: { massKg: kg, at: iso(0), actor: 'Director', org: 'Scenario', source: 'SIM', evidenceIds: [nextEvidence()], location: point.name },
        };
        if (idx >= 2) steps.transport = { massKg: tKg, at: iso(50), actor: 'Director', org: 'Scenario', source: 'SIM', evidenceIds: [nextEvidence()], location: 'Campus gate' };
        if (idx >= 3) steps.receive = { massKg: rKg, at: iso(190), actor: 'Director', org: 'Scenario', source: 'SIM', evidenceIds: [nextEvidence()], location: fac.name };
        if (idx >= 4) steps.treat = { massKg: trKg, at: iso(420), actor: 'Director', org: 'Scenario', source: 'SIM', evidenceIds: [nextEvidence()], location: fac.name, method: 'Incineration, 850°C+' };
        if (o.attest && steps[o.attest]) steps[o.attest] = { ...steps[o.attest]!, offline: true, synced: true, source: 'ATTESTED' };
        const b: Batch = { id, pointId: pid, institutionId: INSTITUTION.id, createdAt: iso(0), facilityId: fac.id, steps, notes: [] };
        set((st) => ({ batches: [...st.batches, b] }));
        log({ actor: 'Scenario Director', role: 'system', type: 'SCENARIO_BATCH', entity: id, next: `SIM · ${name}`, source: 'auto', batchId: id });
        return id;
      };
      let msg = '';
      switch (name) {
        case 'clean': { const id = mk('DP-C-01', 9.8, { upTo: 'treat' }); msg = `${id} created. 9.8 kg through all steps within tolerance. Expect ●.`; break; }
        case 'drop': { const id = mk('DP-B-01', 9.8, { upTo: 'receive', r2: 5.1 / 9.8 / 0.99 }); msg = `${id}: 9.8 kg dispatched, about 5.1 kg received. Expect ◆.`; break; }
        case 'offline-site': { const id = mk('DP-E-02', 6.2, { upTo: 'treat', fac: 'fac_2', attest: 'treat' }); msg = `${id}: treatment site confirmed offline. Expect ▲, not ●.`; break; }
        case 'dropout': {
          const pid = 'DP-D-01';
          set((st) => ({ points: st.points.map((p) => (p.id === pid ? { ...p, deviceState: 'offline', fillPct: null, lastError: 'No heartbeat (scenario)' } : p)) }));
          log({ actor: 'Scenario Director', role: 'system', type: 'DEVICE_OFFLINE', entity: pid, source: 'auto' });
          msg = `${pid} sensor dropped out. Fill shows ⊘ unknown, not a number.`; break;
        }
        case 'stuck': { const id = mk('DP-A-01', 7.3, { upTo: 'transport', ageH: 5 }); msg = `${id} in transit for ~4 h. Advance the clock 3 h to breach the ${s.config.windows.inTransitH} h window.`; break; }
        case 'lapse': { get().advanceClock(3); msg = 'Clock advanced 3 h. Timers re-evaluated.'; break; }
        default: break;
      }
      refreshDiscrepancies();
      pushToast('ok', msg);
    },

    reset: () => {
      const f = seed();
      set({ ...f, mode: 'SIM', offline: false, syncedAt: f.now, readNotes: [], toasts: [], drawer: null });
      pushToast('ok', 'Reset to the baseline simulation.');
    },
  };
});

export function useEval(b: Batch): Evaluation {
  const config = useStore((s) => s.config);
  const now = useStore((s) => s.now);
  return evaluate(b, config, now, FACILITIES);
}

export function evalAll(batches: Batch[], config: Config, now: number) {
  return batches.map((b) => ({ b, ev: evaluate(b, config, now, FACILITIES) }));
}

export { FACILITIES, TRANSPORTERS, INSTITUTION, fmtKg, fmtPct };
