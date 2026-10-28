import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROLE_LABEL, useStore } from '../store';
import { homeFor } from '../components/Shell';
import { useT } from '../i18n';
import type { Role } from '../types';

export default function Login() {
  const { signIn, setTheme, theme } = useStore();
  const nav = useNavigate();
  const t = useT();
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const enter = (r: Role) => { signIn(r); nav(homeFor(r)); };
  return (
    <div className="center-page">
      <div className="panel hero login">
        <span className="brk" aria-hidden="true"><i /><i /><i /><i /></span>
        <div className="l">
          <div>
            <span className="label">RE:FLOW · TRACE</span>
            <h1 className="big" style={{ marginTop: 12 }}>The waste is traceable.<br />The person isn’t.</h1>
          </div>
          <div className="stack">
            <p className="mute">{t('tagline')} No screen here collects a name, phone number, login or menstrual data from a disposer.</p>
            <p className="small mute mono">PROTOTYPE · SIMULATED DATA · NO BACKEND</p>
          </div>
        </div>
        <div className="r stack16">
          <form className="stack" onSubmit={(e) => { e.preventDefault(); setBusy(true); setTimeout(() => { setBusy(false); setErr('Sign-in failed. Check your details or use demo entry.'); }, 500); }}>
            <div className="field"><label htmlFor="id">Email / staff ID</label><input id="id" className="input" autoComplete="username" required /></div>
            <div className="field">
              <label htmlFor="pw">Password</label>
              <div className="row gap8"><input id="pw" className="input" type={show ? 'text' : 'password'} autoComplete="current-password" required />
                <button type="button" className="btn sm" onClick={() => setShow(!show)} aria-pressed={show}>{show ? 'Hide' : 'Show'}</button></div>
            </div>
            {err && <p className="err" role="alert">{err}</p>}
            <button className="btn primary block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
            <button type="button" className="btn ghost sm" onClick={() => setErr('Password reset needs a backend. Not in this prototype.')}>Forgot password</button>
          </form>
          <div className="stack">
            <span className="label">Enter demo as</span>
            <div className="roles">
              {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <button key={r} className="btn" onClick={() => enter(r)}>{ROLE_LABEL[r]}</button>)}
            </div>
            <div className="row between">
              <a href="/p/DP-B-01" className="small">Open public disposer page</a>
              <button className="btn ghost sm" onClick={() => setTheme(theme === 'night' ? 'day' : 'night')}>{theme === 'night' ? 'Day mode' : 'Night mode'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
