import type {
  AuditEvent, Batch, Discrepancy, Facility, Point, Reading, StepKey, StepRec, Transporter,
} from '../types';
import { ORDER } from '../engine/reconcile';

const H = 3600_000;
const D = 24 * H;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const INSTITUTION = { id: 'inst_01', name: 'Chennai Institute of Technology' };

export const FACILITIES: Facility[] = [
  { id: 'fac_1', name: 'Incinerator, Ambattur', location: 'Ambattur Industrial Estate', pathway: 'Incineration (850°C+)', authRef: 'TNPCB/AMB/2291', digital: true, status: 'active' },
  { id: 'fac_2', name: 'Treatment Unit, Perungudi', location: 'Perungudi', pathway: 'Incineration (850°C+)', authRef: 'TNPCB/PER/1174', digital: false, status: 'active' },
  { id: 'fac_3', name: 'Biomedical CWTF, Guindy', location: 'Guindy', pathway: 'Autoclave + shred', authRef: 'TNPCB/GUI/0830', digital: true, status: 'active' },
];

export const TRANSPORTERS: Transporter[] = [
  { id: 'org_07', name: 'Kaveri Waste Logistics', vehicles: 4, routes: 'Kancheepuram – Ambattur' },
  { id: 'org_09', name: 'Marina Green Carriers', vehicles: 2, routes: 'OMR – Perungudi' },
];

const SITES = ['Hostel Block A', 'Hostel Block B', 'Hostel Block C', 'Hostel Block D', 'Admin Block'];
const POINT_DEFS: [string, string, number][] = [
  ['DP-A-01', 'Hostel Block A, Ground floor', 0],
  ['DP-A-02', 'Hostel Block A, 2nd floor', 0],
  ['DP-A-03', 'Hostel Block A, 3rd floor', 0],
  ['DP-B-01', 'Hostel Block B, Ground floor', 1],
  ['DP-B-02', 'Hostel Block B, 2nd floor', 1],
  ['DP-B-03', 'Hostel Block B, 3rd floor', 1],
  ['DP-C-01', 'Hostel Block C, Ground floor', 2],
  ['DP-C-02', 'Hostel Block C, 2nd floor', 2],
  ['DP-C-03', 'Hostel Block C, 3rd floor', 2],
  ['DP-D-01', 'Hostel Block D, Ground floor', 3],
  ['DP-D-02', 'Hostel Block D, 2nd floor', 3],
  ['DP-D-03', 'Hostel Block D, Annexe', 3],
  ['DP-E-01', 'Admin Block, Women’s restroom', 4],
  ['DP-E-02', 'Admin Block, Library wing', 4],
];

export function buildPoints(now: number): Point[] {
  const r = rng(11);
  const fills: Record<string, number> = {
    'DP-D-01': 84, 'DP-B-01': 61, 'DP-C-02': 47, 'DP-A-01': 23, 'DP-E-01': 72,
  };
  return POINT_DEFS.map(([id, name, si], i) => {
    const hasDevice = i % 3 !== 2 || id === 'DP-D-01';
    const fill = fills[id] ?? Math.round(8 + r() * 62);
    const history: Reading[] = [];
    const rate = 1 + r() * 2.2; // % per hour
    for (let k = 11; k >= 0; k--) {
      history.push({ t: now - k * 0.5 * H, pct: Math.max(2, Math.round((fill - rate * k * 0.5) * 10) / 10) });
    }
    let state: Point['deviceState'] = hasDevice ? 'online' : 'disabled';
    let calibration: Point['calibration'] = hasDevice ? 'ok' : null;
    let lastError: string | null = null;
    let fillPct: number | null = fill;
    let fillAt: string | null = new Date(now - (2 + Math.floor(r() * 9)) * 60_000).toISOString();
    if (!hasDevice) {
      fillAt = new Date(now - (6 + Math.floor(r() * 10)) * H).toISOString();
    }
    if (id === 'DP-C-03') { state = 'offline'; fillPct = null; fillAt = new Date(now - 7 * H).toISOString(); lastError = 'No heartbeat for 7 h'; }
    if (id === 'DP-A-03') { state = 'calibration'; calibration = 'due'; }
    if (id === 'DP-B-03') { state = 'error'; lastError = 'HX711 read timeout'; }
    return {
      id, name, site: SITES[si], fillPct, fillSource: hasDevice ? 'sensor' : 'manual', fillAt,
      deviceId: hasDevice ? `NODE-${String(i + 1).padStart(4, '0')}` : null,
      deviceState: state,
      history: hasDevice && state === 'online' ? history : history.map((h) => ({ ...h })),
      lastCollectionAt: new Date(now - (1 + Math.floor(r() * 6)) * D).toISOString(),
      battery: hasDevice ? Math.round(40 + r() * 58) : null,
      firmware: hasDevice ? 'trace-fw 0.4.2' : null,
      calibration, lastError, disabled: false, inspection: false, qrVersion: 1,
    };
  });
}

let evSeq = 88000;
export function nextEvidence(): string {
  evSeq += 1 + Math.floor(Math.random() * 3);
  return `EV-${evSeq}`;
}

function step(
  at: number, massKg: number | null, actor: string, org: string, location: string,
  source: StepRec['source'] = 'SCAN', extra: Partial<StepRec> = {},
): StepRec {
  return {
    massKg, at: new Date(at).toISOString(), actor, org, source, location,
    evidenceIds: source === 'SENSOR' ? [] : [nextEvidence()],
    ...extra,
  };
}

const collectorOf = (pid: string) => ({ actor: 'Collector team ' + (pid.includes('-A-') || pid.includes('-B-') ? 'A' : 'B'), org: INSTITUTION.name });

interface Opt {
  upTo?: StepKey;
  facility?: string;
  r1?: number; r2?: number; r3?: number;
  attestAt?: StepKey;
  genKg?: number | null;
}

function makeBatch(num: number, pid: string, createdAt: number, collectKg: number, o: Opt = {}): Batch {
  const fac = o.facility ?? 'fac_1';
  const facName = FACILITIES.find((f) => f.id === fac)!.name;
  const col = collectorOf(pid);
  const pointName = POINT_DEFS.find((p) => p[0] === pid)![1];
  const upTo = o.upTo ?? 'treat';
  const idx = ORDER.indexOf(upTo);
  const steps: Batch['steps'] = {};
  const transportKg = +(collectKg * (o.r1 ?? 0.992)).toFixed(2);
  const receiveKg = +(transportKg * (o.r2 ?? 0.985)).toFixed(2);
  const treatKg = +(receiveKg * (o.r3 ?? 0.997)).toFixed(2);

  steps.generate = step(createdAt - 20 * 60_000, o.genKg ?? null, 'ESP32 node', 'Sensor', pointName, 'SENSOR');
  if (idx >= 1) steps.collect = step(createdAt, collectKg, col.actor, col.org, pointName);
  if (idx >= 2) steps.transport = step(createdAt + 55 * 60_000, transportKg, 'Driver, KWL-04', 'Kaveri Waste Logistics', 'Campus gate');
  if (idx >= 3) steps.receive = step(createdAt + 3.2 * H, receiveKg, 'Weighbridge operator', facName, facName);
  if (idx >= 4) steps.treat = step(createdAt + 7.5 * H, treatKg, 'Treatment operator', facName, facName, 'SCAN', { method: 'Incineration, 850°C+' });
  if (o.attestAt && steps[o.attestAt]) {
    steps[o.attestAt] = { ...steps[o.attestAt]!, source: 'ATTESTED', offline: true, synced: true };
  }
  if (idx >= 4) steps.verify = { massKg: null, at: steps.treat!.at, actor: 'TRACE engine', org: 'System', source: 'SIM', evidenceIds: [], location: 'n/a' };
  return {
    id: `BATCH-${num}`, pointId: pid, institutionId: INSTITUTION.id,
    createdAt: new Date(createdAt).toISOString(), facilityId: fac, steps, notes: [],
  };
}

export function buildBatches(now: number): Batch[] {
  const r = rng(42);
  const out: Batch[] = [];
  const ids = POINT_DEFS.map((p) => p[0]);
  for (let i = 0; i < 44; i++) {
    const n = 2170 + i;
    const created = now - (30 * D * (1 - i / 46)) - Math.floor(r() * 6) * H - 3 * D;
    const pid = ids[Math.floor(r() * ids.length)];
    const kg = +(3 + r() * 9).toFixed(2);
    const fac = r() < 0.14 ? 'fac_3' : 'fac_1';
    out.push(makeBatch(n, pid, created, kg, {
      facility: fac, r1: 0.985 + r() * 0.012, r2: 0.972 + r() * 0.02, r3: 0.992 + r() * 0.008,
      genKg: r() < 0.3 ? +(kg * 1.04).toFixed(1) : null,
    }));
  }
  // Specials, created relative to now so timers read honestly.
  out.push(makeBatch(2214, 'DP-C-01', now - 2.2 * D, 9.8, { r1: 0.99, r2: 0.99, r3: 1, genKg: 10.1 }));
  out.push(makeBatch(2215, 'DP-A-02', now - 1.6 * D, 6.4, { attestAt: 'receive', facility: 'fac_1' }));
  out.push(makeBatch(2216, 'DP-E-02', now - 1.1 * D, 5.2, { facility: 'fac_2' }));
  out.push(makeBatch(2217, 'DP-B-01', now - 0.9 * D, 4.8, { upTo: 'receive', r1: 1, r2: 2.1 / 4.8 }));
  out.push(makeBatch(2218, 'DP-D-02', now - 10 * H, 8.1, { upTo: 'transport' }));
  out.push(makeBatch(2219, 'DP-C-02', now - 0.6 * D, 7.0, { r1: 1, r2: 1, r3: 6.1 / 7.0 }));
  out.push(makeBatch(2220, 'DP-D-01', now - 1.2 * H, 9.84, { upTo: 'collect', genKg: 10.2 }));
  out.push(makeBatch(2221, 'DP-B-02', now - 3.4 * H, 5.9, { upTo: 'transport' }));
  // the 2218 batch departed 9 h ago, so shift its transport step back to match.
  const b18 = out.find((b) => b.id === 'BATCH-2218')!;
  b18.steps.transport!.at = new Date(now - 9 * H).toISOString();
  b18.steps.collect!.at = new Date(now - 10 * H).toISOString();
  out.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  return out;
}

export function buildResolvedDiscrepancies(now: number): Discrepancy[] {
  const mk = (n: number, batchId: string, kind: string, text: string, ago: number, from: number, to: number): Discrepancy => ({
    id: `DISC-${n}`, batchId, rule: 'quantity', stepAt: 'receive',
    detail: `transport ${from.toFixed(2)} kg → receive ${to.toFixed(2)} kg`, fromKg: from, toKg: to,
    variancePct: ((to - from) / from) * 100, status: 'resolved', owner: 'Institution admin',
    detectedAt: new Date(now - (ago + 0.5) * D).toISOString(), count: 1,
    resolution: { kind, text, at: new Date(now - ago * D).toISOString() }, notes: [],
  });
  return [
    mk(101, 'BATCH-2188', 'Measurement error corrected', 'Weighbridge was not tared. Re-weighed on site, 7.38 kg confirmed.', 18, 7.4, 6.8),
    mk(106, 'BATCH-2201', 'Measurement error corrected', 'Container lid weight included at dispatch. Corrected with new photo.', 9, 5.6, 5.0),
  ];
}

export function buildAudit(batches: Batch[], now: number): AuditEvent[] {
  const ev: AuditEvent[] = [];
  let n = 1;
  const roleOf: Record<StepKey, AuditEvent['role']> = {
    generate: 'system', collect: 'collector', transport: 'transporter', receive: 'treatment', treat: 'treatment', verify: 'system',
  };
  for (const b of batches) {
    for (const s of ORDER) {
      const rec = b.steps[s];
      if (!rec) continue;
      ev.push({
        id: `AUD-${n++}`, at: rec.at, actor: rec.actor, role: roleOf[s],
        type: s === 'generate' ? 'READING_RECORDED' : s === 'verify' ? 'CONFIDENCE_SET' : 'HANDOFF_CREATED',
        entity: b.id, next: rec.massKg != null ? `${rec.massKg.toFixed(2)} kg · ${s}` : s,
        source: rec.source === 'SCAN' || rec.source === 'ATTESTED' ? 'manual' : 'auto', batchId: b.id,
      });
    }
  }
  ev.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  ev.forEach((e, i) => (e.id = `AUD-${String(i + 1).padStart(5, '0')}`));
  void now;
  return ev;
}
