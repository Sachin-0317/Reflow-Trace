import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ROLE_LABEL, evalAll, useStore } from '../store';
import { Glyph } from './Glyph';
import { Drawer, Modal, StatusBadge, fmtAge, fmtDT } from './ui';
import { useT } from '../i18n';
import { forecastHours } from '../engine/reconcile';
import type { Role } from '../types';

export interface Note { id: string; glyph: string; cls: string; text: string; to: string; at: number }

export function useNotes(): Note[] {
  const { discrepancies, points, config, batches, now } = useStore();
  return useMemo(() => {
    const out: Note[] = [];
    for (const d of discrepancies) {
      if (d.status === 'resolved') continue;
      out.push({ id: `n-${d.id}`, glyph: '◆', cls: 'k-discrepancy', text: `${d.batchId}: ${d.detail}`, to: `/discrepancies/${d.id}`, at: Date.parse(d.detectedAt) });
    }
    for (const p of points) {
      if (p.disabled) continue;
      if (p.deviceState === 'offline') out.push({ id: `n-off-${p.id}`, glyph: '⊘', cls: 'k-unknown', text: `${p.id} sensor offline. Fill level unknown.`, to: `/points/${p.id}`, at: Date.parse(p.fillAt ?? new Date(now).toISOString()) });
      else if (p.fillPct != null && p.fillPct >= config.fillCrit) out.push({ id: `n-full-${p.id}`, glyph: '▲', cls: 'k-attested', text: `${p.id} at ${p.fillPct}%. Collection due.`, to: `/points/${p.id}`, at: now });
      else if (p.fillPct != null && p.fillPct >= config.fillWarn) {
        const f = forecastHours(p.history, config.fillCrit);
        out.push({ id: `n-warn-${p.id}`, glyph: '▲', cls: 'k-attested', text: `${p.id} at ${p.fillPct}%${f.hours != null ? `, ≈${f.hours.toFixed(1)} h to ${config.fillCrit}%` : ''}.`, to: `/points/${p.id}`, at: now - 60_000 });
      }
    }
    for (const { b, ev } of evalAll(batches, config, now)) {
      if (ev.confidence === 'pending' && ev.timers.some((t) => !t.done && t.elapsedH > t.limitH * 0.75 && !t.breached)) {
        out.push({ id: `n-late-${b.id}`, glyph: '◌', cls: 'k-pending', text: `${b.id} nearing its time window.`, to: `/batch/${b.id}`, at: now - 120_000 });
      }
    }
    return out.sort((a, b) => b.at - a.at);
  }, [discrepancies, points, config, batches, now]);
}

const ADMIN_NAV: [string, string, string][] = [
  ['/', 'map', 'nav.map'], ['/batches', 'bin', 'nav.batches'], ['/discrepancies', 'point', 'nav.discrepancies'],
  ['/points', 'sensor', 'nav.points'], ['/network', 'route', 'nav.network'], ['/evidence', 'doc', 'nav.evidence'],
  ['/audit', 'lock', 'nav.audit'], ['/qr', 'scan', 'nav.qr'], ['/control', 'shield', 'nav.control'],
];
const NAV: Record<Role, [string, string, string][]> = {
  admin: ADMIN_NAV,
  pibo: ADMIN_NAV.filter(([to]) => ['/', '/batches', '/network', '/evidence', '/audit'].includes(to)),
  collector: [['/handoff', 'scan', 'nav.handoff'], ['/batches', 'bin', 'nav.batches']],
  transporter: [['/handoff', 'scan', 'nav.handoff'], ['/batches', 'bin', 'nav.batches']],
  treatment: [['/handoff', 'scan', 'nav.handoff'], ['/batches', 'bin', 'nav.batches']],
};

export function homeFor(role: Role): string {
  return role === 'admin' ? '/' : role === 'pibo' ? '/evidence' : '/handoff';
}

function Logo() {
  return (
    <svg className="logo-mark" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" aria-hidden="true">
      <path d="M3 5h22v18H3z" /><path d="M3 14h6l3-6 4 12 3-6h6" />
    </svg>
  );
}

function Rail() {
  const { role, signOut, discrepancies } = useStore();
  const t = useT();
  const nav = useNavigate();
  const open = discrepancies.filter((d) => d.status !== 'resolved').length;
  if (!role) return null;
  return (
    <aside className="rail" aria-label="Primary">
      <div className="logo"><Logo /><b>TRACE</b></div>
      <nav>
        {NAV[role].map(([to, g, k]) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav${isActive ? ' active' : ''}`} title={t(k)}>
            <Glyph name={g} size={20} />
            <span>{t(k)}</span>
            {to === '/discrepancies' && open > 0 && <em className="cnt" style={{ opacity: 1, fontStyle: 'normal' }}>◆{open}</em>}
          </NavLink>
        ))}
      </nav>
      <div className="foot">
        <div className="role-tag label"><span>{ROLE_LABEL[role]}</span></div>
        <button onClick={() => { signOut(); nav('/login'); }}><Glyph name="logout" size={20} /><span>Sign out</span></button>
      </div>
    </aside>
  );
}

function crumbOf(path: string) {
  const parts = path.split('/').filter(Boolean);
  return parts.length ? parts : ['map'];
}

function TopBar() {
  const { role, theme, setTheme, lang, setLang, mode, syncedAt, now, refreshSync, queue, setDrawer, offline, setOffline, readNotes } = useStore();
  const loc = useLocation();
  const notes = useNotes();
  const unread = notes.filter((n) => !readNotes.includes(n.id)).length;
  const crumbs = crumbOf(loc.pathname);
  const [menu, setMenu] = useState(false);
  return (
    <header className="top">
      <div className="crumb">
        {crumbs.map((c, i) => <span key={i}>{i > 0 && ' / '}{i === crumbs.length - 1 ? <b>{c}</b> : c}</span>)}
      </div>
      <div className="sp" />
      <span className="mono small mute hide-mob" title="Institution">CIT · Chennai</span>
      <button className="icon-btn hide-mob" onClick={refreshSync} aria-label="Refresh and sync" title="Refresh">
        <Glyph name="refresh" size={14} /> SYNC {fmtAge(now - syncedAt)}
      </button>
      <button className={`icon-btn hide-mob2`} onClick={() => setOffline(!offline)} title="Toggle simulated connection" aria-pressed={offline}>
        <Glyph name={offline ? 'offline' : 'signal'} size={14} />{offline ? 'OFFLINE' : 'ONLINE'}
      </button>
      <span className={`mode ${mode}`} title={mode === 'LIVE' ? 'Live backend' : mode === 'SIM' ? 'Simulated data. No backend connected.' : 'Scenario Director has injected demo data.'}>{mode}</span>
      <button className="icon-btn" onClick={() => setDrawer('queue')} aria-label={`Offline queue, ${queue.length} held`}>
        ◌ {queue.length}
      </button>
      <div className="toggle hide-mob2" role="group" aria-label="Theme">
        <button className={theme === 'night' ? 'on' : ''} onClick={() => setTheme('night')} aria-label="Night"><Glyph name="moon" size={14} /></button>
        <button className={theme === 'day' ? 'on' : ''} onClick={() => setTheme('day')} aria-label="Day"><Glyph name="sun" size={14} /></button>
      </div>
      <div className="toggle hide-mob2" role="group" aria-label="Language">
        <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
        <button className={lang === 'ta' ? 'on' : ''} onClick={() => setLang('ta')}>தமிழ்</button>
      </div>
      <button className="icon-btn" onClick={() => setDrawer('bell')} aria-label={`Notifications, ${unread} unread`}>
        <Glyph name="bell" size={16} />{unread > 0 && <span className="dot">{unread}</span>}
      </button>
      <div style={{ position: 'relative' }}>
        <button className="icon-btn" onClick={() => setMenu(!menu)} aria-haspopup="menu" aria-expanded={menu}>{role?.slice(0, 3).toUpperCase()}</button>
        {menu && <RoleMenu onClose={() => setMenu(false)} />}
      </div>
    </header>
  );
}

function RoleMenu({ onClose }: { onClose: () => void }) {
  const { role, signIn, setDrawer, signOut } = useStore();
  const nav = useNavigate();
  return (
    <div className="panel" role="menu" style={{ position: 'absolute', right: 0, top: 42, width: 230, zIndex: 40, boxShadow: '0 12px 32px rgba(0,0,0,.5)' }}>
      <div className="panel-b stack" style={{ gap: 4 }}>
        <span className="label">Switch role (demo)</span>
        {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
          <button key={r} role="menuitem" className="btn ghost sm" style={{ justifyContent: 'flex-start', color: r === role ? 'var(--bone)' : undefined }}
            onClick={() => { signIn(r); onClose(); nav(homeFor(r)); }}>{r === role ? '● ' : '  '}{ROLE_LABEL[r]}</button>
        ))}
        <hr style={{ border: 0, borderTop: '1px solid var(--line)', width: '100%' }} />
        <button role="menuitem" className="btn ghost sm" style={{ justifyContent: 'flex-start' }} onClick={() => { setDrawer('judge'); onClose(); }}>Judge Q&A</button>
        <button role="menuitem" className="btn ghost sm" style={{ justifyContent: 'flex-start' }} onClick={() => { setDrawer('director'); onClose(); }}>Scenario Director</button>
        <button role="menuitem" className="btn ghost sm" style={{ justifyContent: 'flex-start' }} onClick={() => { signOut(); nav('/login'); }}>Sign out</button>
      </div>
    </div>
  );
}

function MobileBar() {
  const { role, setDrawer, discrepancies } = useStore();
  const t = useT();
  const open = discrepancies.filter((d) => d.status !== 'resolved').length;
  if (!role) return null;
  const staff = role !== 'admin' && role !== 'pibo';
  const items = staff
    ? [['/handoff', 'scan', 'nav.scan', true], ['/batches', 'bin', 'nav.batches', false]]
    : [['/', 'map', 'nav.map', false], ['/batches', 'bin', 'nav.batches', false], ['/handoff', 'scan', 'nav.scan', true], ['/discrepancies', 'point', 'nav.issues', false]];
  return (
    <nav className="mbar" style={{ gridTemplateColumns: `repeat(${items.length + 1}, 1fr)` }} aria-label="Mobile">
      {items.map(([to, g, k, scan]) => (
        <NavLink key={String(to)} to={String(to)} end={to === '/'} className={({ isActive }) => `${isActive ? 'active' : ''}${scan ? ' scan' : ''}`}>
          {scan ? <i><Glyph name={String(g)} size={24} /></i> : <Glyph name={String(g)} size={20} />}
          <span>{t(String(k))}{to === '/discrepancies' && open > 0 ? ` ${open}` : ''}</span>
        </NavLink>
      ))}
      <button onClick={() => setDrawer('palette')}><Glyph name="more" size={20} /><span>{t('nav.more')}</span></button>
    </nav>
  );
}

function BellDrawer() {
  const { setDrawer, markRead, readNotes, now } = useStore();
  const notes = useNotes();
  const nav = useNavigate();
  const close = () => setDrawer(null);
  return (
    <Drawer title="Notifications" onClose={close}>
      <div className="row between" style={{ marginBottom: 8 }}>
        <span className="label">{notes.length} active</span>
        <button className="btn ghost sm" onClick={() => markRead(notes.map((n) => n.id))}>Mark all read</button>
      </div>
      {notes.length === 0 && <p className="mute">Nothing needs attention. Quiet floor.</p>}
      {notes.map((n) => (
        <a key={n.id} href={n.to} className={`bell-item${readNotes.includes(n.id) ? '' : ' unread'}`}
          onClick={(e) => { e.preventDefault(); markRead([n.id]); close(); nav(n.to); }}>
          <span className={`${n.cls} mono`}>{n.glyph}</span>
          <span><span>{n.text}</span><br /><span className="small mute mono">{fmtAge(now - n.at)} ago</span></span>
        </a>
      ))}
    </Drawer>
  );
}

function QueueDrawer() {
  const { queue, setDrawer, syncQueue, discardQueued, offline } = useStore();
  const [confirm, setConfirm] = useState<string | null>(null);
  return (
    <Drawer title="Held on this device" onClose={() => setDrawer(null)}>
      <p className="small mute">Events recorded while offline keep their original timestamp. Until they sync, their batches stay ◌ pending.</p>
      <div className="row between" style={{ margin: '12px 0' }}>
        <span className={`badge ${offline ? 'c-unknown' : 'c-verified'} sm`}>{offline ? '⊘ OFFLINE' : '● ONLINE'}</span>
        <button className="btn sm primary" onClick={syncQueue} disabled={!queue.length}>Sync {queue.length}</button>
      </div>
      {queue.length === 0 && <p className="mute">No events held. Quiet floor.</p>}
      {queue.map((q) => (
        <div key={q.id} className="row between" style={{ borderBottom: '1px solid var(--line)', padding: '10px 0' }}>
          <div><span className="k-pending">◌ </span><span className="mono">{q.batchId}</span> · {q.step} · {q.massKg.toFixed(2)} kg<br /><span className="small mute mono">{fmtDT(q.at)}</span></div>
          <button className="btn ghost sm" onClick={() => setConfirm(q.id)}>Discard</button>
        </div>
      ))}
      {confirm && (
        <Modal title="Discard held event?" onClose={() => setConfirm(null)}>
          <div className="stack">
            <p>The event is removed from this device and never reaches the record. The discard is logged.</p>
            <div className="row gap8 end">
              <button className="btn ghost" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="btn danger" onClick={() => { discardQueued(confirm); setConfirm(null); }}>Discard</button>
            </div>
          </div>
        </Modal>
      )}
    </Drawer>
  );
}

const QA: [string, string, string][] = [
  ['How do you prove treatment actually happened?', '/batches', 'A scan record alone is attested at best. ● needs digital steps by independent actors at a registered facility, with matching mass.'],
  ['What if someone fakes a confirmation?', '/discrepancies', 'Independent confirmations must reconcile in mass. An unmatched one opens a ◆ discrepancy.'],
  ['Where is the privacy boundary?', '/p/DP-B-01', 'Disposers have no account. The QR holds a bin ID only. See the public page and the Control privacy panel.'],
  ['What if there is no connectivity?', '/handoff', 'Events queue on the device with original timestamps. Unsynced batches stay ◌ and sync later as ▲.'],
  ['Is the sensor data real?', '/points', 'This build is SIM mode. The mode chip says so. A reading is a bin condition, never proof of custody.'],
  ['Why 5% tolerance?', '/control', 'It separates ordinary handling loss (moisture, weighing variance) from genuine breaks. It is configurable and is not proof a gap is harmless.'],
  ['Show me a failure.', '/batch/BATCH-2217', 'BATCH-2217 was collected at 4.8 kg and received at 2.1 kg. That is −56.3%, so ◆.'],
];

function JudgeDrawer() {
  const { setDrawer } = useStore();
  const nav = useNavigate();
  return (
    <Drawer title="Judge Q&A" onClose={() => setDrawer(null)}>
      <div className="stack">
        {QA.map(([q, to, a]) => (
          <div key={q} style={{ borderBottom: '1px solid var(--line)', paddingBottom: 12 }}>
            <b>{q}</b>
            <p className="small mute" style={{ margin: '4px 0 8px' }}>{a}</p>
            <button className="btn sm" onClick={() => { setDrawer(null); nav(to); }}>Show me</button>
          </div>
        ))}
      </div>
    </Drawer>
  );
}

export function DirectorPanel() {
  const { runScenario, reset, advanceClock } = useStore();
  const items: [string, string, string][] = [
    ['clean', '● Clean batch', 'Full chain within tolerance, becomes verified.'],
    ['drop', '◆ Quantity drop', '9.8 kg dispatched, about 5.1 kg received.'],
    ['offline-site', '▲ Offline treatment site', 'Confirmed offline. Attested, not verified.'],
    ['dropout', '⊘ Sensor dropout', 'DP-D-01 loses its heartbeat. Fill becomes unknown.'],
    ['stuck', '◌ Stuck in transit', 'A batch leaves the gate. Advance the clock to breach.'],
  ];
  return (
    <div className="stack">
      <p className="small mute">Everything the Director creates is labelled SIM and flips the mode chip to DEMO.</p>
      {items.map(([k, t, d]) => (
        <div key={k} className="row between gap12" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
          <div><b>{t}</b><br /><span className="small mute">{d}</span></div>
          <button className="btn sm" onClick={() => runScenario(k)}><Glyph name="play" size={12} /> Run</button>
        </div>
      ))}
      <div className="row gap8 wrap">
        <button className="btn sm" onClick={() => advanceClock(1)}>Clock +1 h</button>
        <button className="btn sm" onClick={() => advanceClock(3)}>Clock +3 h</button>
        <button className="btn sm" onClick={() => advanceClock(12)}>Clock +12 h</button>
        <button className="btn sm danger" onClick={reset}>Reset</button>
      </div>
    </div>
  );
}

function Palette() {
  const { batches, points, discrepancies, setDrawer, runScenario, role } = useStore();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const items = useMemo(() => {
    const base: { label: string; hint: string; go: () => void }[] = [];
    if (role) for (const [to, , k] of NAV[role]) base.push({ label: k.replace('nav.', '').toUpperCase(), hint: 'screen', go: () => nav(to) });
    for (const b of batches.slice(-80)) base.push({ label: b.id, hint: `batch · ${b.pointId}`, go: () => nav(`/batch/${b.id}`) });
    for (const p of points) base.push({ label: p.id, hint: `point · ${p.site}`, go: () => nav(`/points/${p.id}`) });
    for (const d of discrepancies) base.push({ label: d.id, hint: `discrepancy · ${d.batchId}`, go: () => nav(`/discrepancies/${d.id}`) });
    if (role === 'admin' || role === 'pibo') {
      for (const [k, l] of [['clean', 'Run: clean batch'], ['drop', 'Run: quantity drop'], ['offline-site', 'Run: offline treatment'], ['dropout', 'Run: sensor dropout'], ['stuck', 'Run: stuck in transit']])
        base.push({ label: l, hint: 'director · DEMO', go: () => runScenario(k) });
    }
    const s = q.trim().toLowerCase();
    return (s ? base.filter((i) => (i.label + ' ' + i.hint).toLowerCase().includes(s)) : base).slice(0, 30);
  }, [q, batches, points, discrepancies, role, nav, runScenario]);
  const pick = (i: number) => { const it = items[i]; if (it) { setDrawer(null); it.go(); } };
  return (
    <div className="scrim pal-z" onMouseDown={(e) => e.target === e.currentTarget && setDrawer(null)}>
      <div className="pal" role="dialog" aria-modal="true" aria-label="Command palette">
        <input autoFocus placeholder="Search batches, points, discrepancies, screens…" value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setDrawer(null);
            if (e.key === 'ArrowDown') { e.preventDefault(); setSel((x) => Math.min(x + 1, items.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setSel((x) => Math.max(x - 1, 0)); }
            if (e.key === 'Enter') pick(sel);
          }} />
        <ul>
          {items.length === 0 && <li className="mute" style={{ padding: 12 }}>No match.</li>}
          {items.map((it, i) => (
            <li key={it.label + i}><button className={i === sel ? 'sel' : ''} onClick={() => pick(i)}><span className="mono">{it.label}</span><span className="mute small">{it.hint}</span></button></li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function EvidenceViewer() {
  const { evidenceViewer, setEvidence, batches } = useStore();
  if (!evidenceViewer) return null;
  let found: { b: string; step: string; at: string; actor: string; loc: string; src: string } | null = null;
  for (const b of batches) for (const [k, s] of Object.entries(b.steps)) if (s?.evidenceIds.includes(evidenceViewer)) found = { b: b.id, step: k, at: s.at, actor: s.actor, loc: s.location, src: s.source };
  return (
    <Modal title={`Evidence ${evidenceViewer}`} onClose={() => setEvidence(null)}>
      <div className="stack">
        <div style={{ height: 200, border: '1px solid var(--line-strong)', display: 'grid', placeItems: 'center', background: 'repeating-linear-gradient(135deg, var(--panel-2) 0 10px, var(--panel) 10px 20px)' }}>
          <div style={{ textAlign: 'center' }}><Glyph name="camera" size={32} /><p className="small mute mono">Placeholder. No real photo in the prototype.</p></div>
        </div>
        {found ? (
          <div className="grid2">
            <div className="kv"><span className="label">Batch</span><Link to={`/batch/${found.b}`} onClick={() => setEvidence(null)} className="mono">{found.b}</Link></div>
            <div className="kv"><span className="label">Step</span><span>{found.step}</span></div>
            <div className="kv"><span className="label">Recorded</span><span className="mono">{fmtDT(found.at)}</span></div>
            <div className="kv"><span className="label">Actor role</span><span>{found.actor}</span></div>
            <div className="kv"><span className="label">Location</span><span>{found.loc}</span></div>
            <div className="kv"><span className="label">Source</span><span className="mono">{found.src}</span></div>
          </div>
        ) : <p className="mute">Evidence item not linked to a step.</p>}
      </div>
    </Modal>
  );
}

export function Shell() {
  const { role, drawer, setDrawer, toasts, offline, tick, queue } = useStore();
  const loc = useLocation();
  const nav = useNavigate();
  useEffect(() => { if (!role) nav('/login', { replace: true }); }, [role, nav]);
  useEffect(() => { tick(); }, [tick]);
  useEffect(() => {
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [tick]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setDrawer('palette'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setDrawer]);
  const notes = useNotes();
  const live = notes.filter((n) => n.glyph === '◆').length;
  void loc;
  if (!role) return null;
  return (
    <div className="app">
      <a href="#main" className="sr">Skip to content</a>
      <Rail />
      <div className="main">
        <TopBar />
        {offline && (
          <div className="offline-banner" role="status">⊘ Offline. New handoffs are held on this device ({queue.length} held). Batches stay ◌ until sync.</div>
        )}
        <main id="main" className="page"><Outlet /></main>
      </div>
      <MobileBar />
      <div className="sr" aria-live="polite">{live} open discrepancies</div>
      {drawer === 'bell' && <BellDrawer />}
      {drawer === 'queue' && <QueueDrawer />}
      {drawer === 'judge' && <JudgeDrawer />}
      {drawer === 'director' && <Drawer title="Scenario Director" onClose={() => setDrawer(null)}><DirectorPanel /></Drawer>}
      {drawer === 'palette' && <Palette />}
      <EvidenceViewer />
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}
      </div>
    </div>
  );
}

export { StatusBadge };
