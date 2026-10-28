export type Role = 'admin' | 'collector' | 'transporter' | 'treatment' | 'pibo';
export type StepKey = 'generate' | 'collect' | 'transport' | 'receive' | 'treat' | 'verify';
export type Confidence = 'verified' | 'attested' | 'discrepancy' | 'pending' | 'unknown';
export type Source = 'SENSOR' | 'SCAN' | 'ATTESTED' | 'SIM';
export type DeviceState = 'online' | 'offline' | 'connecting' | 'error' | 'calibration' | 'disabled';
export type Mode = 'LIVE' | 'SIM' | 'DEMO';

export interface StepRec {
  massKg: number | null;
  at: string;
  actor: string;
  org: string;
  source: Source;
  offline?: boolean;
  synced?: boolean;
  evidenceIds: string[];
  location: string;
  note?: string;
  method?: string;
}

export interface Batch {
  id: string;
  pointId: string;
  institutionId: string;
  createdAt: string;
  facilityId: string;
  steps: Partial<Record<StepKey, StepRec>>;
  notes: { at: string; by: string; text: string }[];
}

export interface Reading {
  t: number;
  pct: number;
}

export interface Point {
  id: string;
  name: string;
  site: string;
  fillPct: number | null;
  fillSource: 'sensor' | 'manual';
  fillAt: string | null;
  deviceId: string | null;
  deviceState: DeviceState;
  history: Reading[];
  lastCollectionAt: string | null;
  battery: number | null;
  firmware: string | null;
  calibration: 'ok' | 'due' | null;
  lastError: string | null;
  disabled: boolean;
  inspection: boolean;
  qrVersion: number;
}

export interface Facility {
  id: string;
  name: string;
  location: string;
  pathway: string;
  authRef: string;
  digital: boolean;
  status: 'active' | 'suspended';
}

export interface Transporter {
  id: string;
  name: string;
  vehicles: number;
  routes: string;
}

export type Rule = 'quantity' | 'timing' | 'location' | 'custody';

export interface Discrepancy {
  id: string;
  batchId: string;
  rule: Rule;
  stepAt: StepKey;
  detail: string;
  fromKg: number | null;
  toKg: number | null;
  variancePct: number | null;
  status: 'new' | 'investigating' | 'resolved';
  owner: string | null;
  detectedAt: string;
  count: number;
  resolution?: { kind: string; text: string; at: string; dismissed?: boolean };
  notes: { at: string; by: string; text: string }[];
}

export interface AuditEvent {
  id: string;
  at: string;
  actor: string;
  role: Role | 'system' | 'anonymous';
  type: string;
  entity: string;
  prev?: string;
  next?: string;
  source: 'manual' | 'auto';
  batchId?: string;
  discId?: string;
}

export interface QueueEvent {
  id: string;
  at: string;
  batchId: string;
  step: StepKey;
  massKg: number;
}

export interface Config {
  tolerancePct: number;
  fillWarn: number;
  fillCrit: number;
  staleMin: number;
  windows: { inTransitH: number; toTreatmentH: number; toCollectH: number };
}
