import type { Batch, Config, Confidence, Facility, Rule, StepKey, StepRec } from '../types';

export const ORDER: StepKey[] = ['generate', 'collect', 'transport', 'receive', 'treat', 'verify'];
export const MASS_STEPS: StepKey[] = ['collect', 'transport', 'receive', 'treat'];

export const DEFAULT_CONFIG: Config = {
  tolerancePct: 5,
  fillWarn: 70,
  fillCrit: 90,
  staleMin: 45,
  windows: { toCollectH: 24, inTransitH: 6, toTreatmentH: 48 },
};

/** Signed change from the previous mass. Negative means mass was lost between steps. */
export function variancePct(prev: number, cur: number): number {
  return ((cur - prev) / prev) * 100;
}

export interface ReconRow {
  from: StepKey;
  to: StepKey;
  fromKg: number;
  toKg: number;
  pct: number;
  breach: boolean;
}

export interface Breach {
  rule: Rule;
  stepAt: StepKey;
  detail: string;
  fromKg: number | null;
  toKg: number | null;
  pct: number | null;
}

export interface Timer {
  key: 'inTransit' | 'toTreatment';
  label: string;
  elapsedH: number;
  limitH: number;
  done: boolean;
  breached: boolean;
}

export interface Evaluation {
  confidence: Confidence;
  reasons: string[];
  breaches: Breach[];
  rows: ReconRow[];
  endToEnd: ReconRow | null;
  timers: Timer[];
  lastStep: StepKey;
  lastAt: string;
}

const HOUR = 3600_000;

function massOf(rec?: StepRec): number | null {
  return rec && rec.massKg != null && rec.massKg > 0 ? rec.massKg : null;
}

export function reconcile(b: Batch, cfg: Config): { rows: ReconRow[]; endToEnd: ReconRow | null } {
  const present = MASS_STEPS.filter((s) => massOf(b.steps[s]) != null);
  const rows: ReconRow[] = [];
  for (let i = 1; i < present.length; i++) {
    const from = present[i - 1];
    const to = present[i];
    const fromKg = massOf(b.steps[from])!;
    const toKg = massOf(b.steps[to])!;
    const pct = variancePct(fromKg, toKg);
    rows.push({ from, to, fromKg, toKg, pct, breach: Math.abs(pct) > cfg.tolerancePct });
  }
  let endToEnd: ReconRow | null = null;
  if (present.length >= 2) {
    const from = present[0];
    const to = present[present.length - 1];
    const fromKg = massOf(b.steps[from])!;
    const toKg = massOf(b.steps[to])!;
    const pct = variancePct(fromKg, toKg);
    endToEnd = { from, to, fromKg, toKg, pct, breach: Math.abs(pct) > cfg.tolerancePct };
  }
  return { rows, endToEnd };
}

export function lastStepOf(b: Batch): { step: StepKey; at: string } {
  let last: StepKey = 'generate';
  for (const s of ORDER) if (b.steps[s]) last = s;
  return { step: last, at: b.steps[last]?.at ?? b.createdAt };
}

export function evaluate(
  b: Batch,
  cfg: Config,
  now: number,
  facilities: Facility[],
): Evaluation {
  const { rows, endToEnd } = reconcile(b, cfg);
  const breaches: Breach[] = [];
  const reasons: string[] = [];

  for (const r of rows) {
    if (r.breach) {
      breaches.push({
        rule: 'quantity',
        stepAt: r.to,
        detail: `${r.from} ${fmtKg(r.fromKg)} → ${r.to} ${fmtKg(r.toKg)} (${fmtPct(r.pct)}), tolerance ±${cfg.tolerancePct}%`,
        fromKg: r.fromKg,
        toKg: r.toKg,
        pct: r.pct,
      });
    }
  }
  if (!rows.some((r) => r.breach) && endToEnd?.breach) {
    breaches.push({
      rule: 'quantity',
      stepAt: endToEnd.to,
      detail: `end-to-end ${fmtKg(endToEnd.fromKg)} → ${fmtKg(endToEnd.toKg)} (${fmtPct(endToEnd.pct)}), tolerance ±${cfg.tolerancePct}%`,
      fromKg: endToEnd.fromKg,
      toKg: endToEnd.toKg,
      pct: endToEnd.pct,
    });
  }

  const timers: Timer[] = [];
  const tr = b.steps.transport;
  if (tr) {
    const end = b.steps.receive ? Date.parse(b.steps.receive.at) : now;
    const elapsedH = (end - Date.parse(tr.at)) / HOUR;
    const limitH = cfg.windows.inTransitH;
    timers.push({
      key: 'inTransit',
      label: 'Transport → receipt',
      elapsedH,
      limitH,
      done: !!b.steps.receive,
      breached: elapsedH > limitH,
    });
  }
  const co = b.steps.collect;
  if (co) {
    const end = b.steps.treat ? Date.parse(b.steps.treat.at) : now;
    const elapsedH = (end - Date.parse(co.at)) / HOUR;
    const limitH = cfg.windows.toTreatmentH;
    timers.push({
      key: 'toTreatment',
      label: 'Collection → treatment',
      elapsedH,
      limitH,
      done: !!b.steps.treat,
      breached: elapsedH > limitH,
    });
  }
  for (const t of timers) {
    if (t.breached) {
      const stepAt: StepKey = t.key === 'inTransit' ? 'transport' : 'collect';
      breaches.push({
        rule: 'timing',
        stepAt,
        detail: `${t.label}: ${t.elapsedH.toFixed(1)} h elapsed, limit ${t.limitH} h${t.done ? '' : ', still open'}`,
        fromKg: null,
        toKg: null,
        pct: null,
      });
    }
  }

  const last = lastStepOf(b);
  const base = { breaches, rows, endToEnd, timers, lastStep: last.step, lastAt: last.at };

  if (breaches.length) {
    for (const x of breaches) reasons.push(x.detail);
    return { ...base, confidence: 'discrepancy', reasons };
  }

  const unsynced = ORDER.filter((s) => b.steps[s]?.offline && b.steps[s]?.synced === false);
  if (unsynced.length) {
    reasons.push(`${unsynced.join(', ')} held on device, not synced yet`);
    return { ...base, confidence: 'pending', reasons };
  }

  const missing = MASS_STEPS.filter((s) => !b.steps[s]);
  if (missing.length) {
    reasons.push(`waiting for ${missing.join(', ')}`);
    return { ...base, confidence: 'pending', reasons };
  }

  const fac = facilities.find((f) => f.id === b.facilityId);
  const attestedSteps = ORDER.filter(
    (s) => b.steps[s] && (b.steps[s]!.source === 'ATTESTED' || b.steps[s]!.offline),
  );
  if (attestedSteps.length) {
    reasons.push(
      `${attestedSteps.join(', ')} confirmed offline by both parties with photo and timestamp. Not equal to verified.`,
    );
    return { ...base, confidence: 'attested', reasons };
  }
  if (!fac || !fac.digital) {
    reasons.push(`${fac?.name ?? 'Facility'} cannot record digitally, so the batch tops out at attested.`);
    return { ...base, confidence: 'attested', reasons };
  }
  reasons.push('All steps recorded digitally by independent actors at a registered facility. Variance and timing within limits.');
  return { ...base, confidence: 'verified', reasons };
}

/** A point counts as monitored when it has a non-null reading that is still fresh. Manual points get 12 h. */
export function coverage(
  points: { disabled: boolean; fillPct: number | null; fillAt: string | null; fillSource: 'sensor' | 'manual' }[],
  cfg: Config,
  now: number,
): { monitored: number; total: number; pct: number } {
  const live = points.filter((p) => !p.disabled);
  const monitored = live.filter((p) => {
    if (p.fillPct == null || !p.fillAt) return false;
    const mins = (now - Date.parse(p.fillAt)) / 60000;
    return mins <= (p.fillSource === 'sensor' ? cfg.staleMin : 12 * 60);
  }).length;
  return { monitored, total: live.length, pct: live.length ? Math.round((monitored / live.length) * 100) : 0 };
}

export function fmtKg(n: number | null | undefined): string {
  return n == null ? '—' : `${n.toFixed(2)} kg`;
}

export function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—';
  const s = Math.abs(n).toFixed(1);
  return `${n < 0 ? '−' : n > 0 ? '+' : ''}${s}%`;
}

/** Linear fill rate over the last N readings. Returns hours until `target` or null. */
export function forecastHours(
  history: { t: number; pct: number }[],
  target: number,
  n = 6,
): { hours: number | null; basis: string } {
  const h = history.slice(-n);
  if (h.length < 3) return { hours: null, basis: 'fewer than 3 readings' };
  const dt = (h[h.length - 1].t - h[0].t) / HOUR;
  const dp = h[h.length - 1].pct - h[0].pct;
  if (dt <= 0 || dp <= 0) return { hours: null, basis: `flat or falling over last ${h.length} readings` };
  const rate = dp / dt;
  const cur = h[h.length - 1].pct;
  if (cur >= target) return { hours: 0, basis: `already at or above ${target}%` };
  return { hours: (target - cur) / rate, basis: `linear rate, last ${h.length} readings` };
}
