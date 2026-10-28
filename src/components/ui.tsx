import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Confidence, Role, Source } from '../types';
import { CONF_GLYPH, Glyph } from './Glyph';
import { useT } from '../i18n';
import { fmtPct } from '../engine/reconcile';
import { useStore } from '../store';

export function StatusBadge({ c, label, small }: { c: Confidence; label?: string; small?: boolean }) {
  const t = useT();
  return (
    <span className={`badge c-${c}${small ? ' sm' : ''}`}>
      <span aria-hidden="true">{CONF_GLYPH[c]}</span>
      <span>{label ?? t(`status.${c}`)}</span>
    </span>
  );
}

export function TrustChip({ s }: { s: Source }) {
  return <span className={`chip trust-${s.toLowerCase()}`}>{s}</span>;
}

export function VarianceChip({ pct, tol, label }: { pct: number | null; tol: number; label?: string }) {
  if (pct == null) return <span className="chip mute">—</span>;
  const bad = Math.abs(pct) > tol;
  return (
    <span className={`chip var ${bad ? 'bad' : 'ok'}`} title={`Tolerance ±${tol}%`}>
      {bad ? '◆ ' : ''}{label ? label + ' ' : ''}{fmtPct(pct)}
    </span>
  );
}

export function Panel({
  title, right, children, hero, className = '', pad = true,
}: { title?: ReactNode; right?: ReactNode; children: ReactNode; hero?: boolean; className?: string; pad?: boolean }) {
  return (
    <section className={`panel${hero ? ' hero' : ''} ${className}`}>
      {hero && <span className="brk" aria-hidden="true"><i /><i /><i /><i /></span>}
      {(title || right) && (
        <header className="panel-h">
          <h3>{title}</h3>
          <div>{right}</div>
        </header>
      )}
      <div className={pad ? 'panel-b' : ''}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="page-h">
      <div>
        <h1>{title}</h1>
        {sub && <p className="mute small">{sub}</p>}
      </div>
      <div className="row gap8 wrap">{right}</div>
    </div>
  );
}

export function SegmentedBar({ parts, total }: { parts: { c: Confidence; n: number }[]; total: number }) {
  return (
    <div>
      <div className="seg" role="img" aria-label={parts.map((p) => `${p.n} ${p.c}`).join(', ')}>
        {parts.map((p) => (
          <span key={p.c} className={`seg-p c-${p.c}`} style={{ flexGrow: Math.max(p.n, 0.0001) }} />
        ))}
      </div>
      <div className="seg-legend mono">
        {parts.map((p) => (
          <span key={p.c} className={`k-${p.c}`}>{CONF_GLYPH[p.c]} {p.n}</span>
        ))}
        <span className="mute">of {total}</span>
      </div>
    </div>
  );
}

export function Empty({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <p>{text}</p>
      {action}
    </div>
  );
}

export function fmtAge(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60_000));
  if (m < 1) return 'now';
  if (m < 60) return `${m} min`;
  const h = m / 60;
  if (h < 48) return `${h.toFixed(h < 10 ? 1 : 0)} h`;
  return `${Math.round(h / 24)} d`;
}

export function Age({ iso, now }: { iso: string | null; now: number }) {
  if (!iso) return <span className="mute">—</span>;
  return <span className="mono" title={new Date(iso).toLocaleString('en-IN')}>{fmtAge(now - Date.parse(iso))} ago</span>;
}

export function fmtDT(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
}

export function Modal({ title, onClose, children, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useTrap(onClose);
  return (
    <div className="scrim modal-z" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={String(title)} ref={ref}>
        <header className="panel-h">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Glyph name="close" /></button>
        </header>
        <div className="panel-b">{children}</div>
      </div>
    </div>
  );
}

export function Drawer({ title, onClose, children, z = 'drawer-z' }: { title: ReactNode; onClose: () => void; children: ReactNode; z?: string }) {
  const ref = useTrap(onClose);
  return (
    <div className={`scrim ${z}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={String(title)} ref={ref}>
        <header className="panel-h">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Glyph name="close" /></button>
        </header>
        <div className="drawer-b">{children}</div>
      </aside>
    </div>
  );
}

function useTrap(onClose: () => void) {
  const ref = useRef<HTMLDivElement & HTMLElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const focusables = () =>
      Array.from(el?.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []);
    (focusables()[0] ?? el)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab') {
        const f = focusables();
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}

export function ConfirmDialog({
  title, body, confirm, danger, onYes, onNo,
}: { title: string; body: ReactNode; confirm: string; danger?: boolean; onYes: () => void; onNo: () => void }) {
  return (
    <Modal title={title} onClose={onNo}>
      <div className="stack">
        <div>{body}</div>
        <div className="row gap8 end">
          <button className="btn ghost" onClick={onNo}>Cancel</button>
          <button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={onYes}>{confirm}</button>
        </div>
      </div>
    </Modal>
  );
}

export function PermissionGate({ allow, children }: { allow: Role[]; children: ReactNode }) {
  const role = useStore((s) => s.role);
  if (role && allow.includes(role)) return <>{children}</>;
  return (
    <div className="panel hero denied">
      <span className="brk" aria-hidden="true"><i /><i /><i /><i /></span>
      <div className="panel-b stack">
        <span className="label">ACCESS DENIED</span>
        <h2 className="display">This screen is not in your scope.</h2>
        <p className="mute">Your role ({role}) cannot open it. Ask an institution admin if you need access.</p>
        <Link className="btn primary" to="/">Back to home</Link>
      </div>
    </div>
  );
}

export function KV({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="kv">
      <span className="label">{k}</span>
      <span>{v}</span>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; n?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} className={value === t.id ? 'on' : ''} onClick={() => onChange(t.id)}>
          {t.label}{t.n != null && <span className="mono mute"> {t.n}</span>}
        </button>
      ))}
    </div>
  );
}
