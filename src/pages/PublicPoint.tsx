import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useStore } from '../store';
import { useT } from '../i18n';
import { Glyph } from '../components/Glyph';

export default function PublicPoint() {
  const { pointId } = useParams();
  const { points, lang, setLang, anonReport } = useStore();
  const t = useT();
  const [msg, setMsg] = useState('');
  const point = points.find((p) => p.id === pointId);
  const send = (k: string, label: string) => {
    const ok = anonReport(pointId!, label);
    setMsg(ok ? t('public.sent') : t('public.limited'));
    void k;
  };
  return (
    <div className="center-page">
      <div className="panel hero pub">
        <span className="brk" aria-hidden="true"><i /><i /><i /><i /></span>
        <div className="panel-b stack16" style={{ padding: 24 }}>
          <div className="row between">
            <span className="label">TRACE · {point ? point.id : 'unknown point'}</span>
            <div className="toggle" role="group" aria-label="Language"><button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button><button className={lang === 'ta' ? 'on' : ''} onClick={() => setLang('ta')}>தமிழ்</button></div>
          </div>
          {!point ? (
            <><h1 className="big">No such bin.</h1><p className="mute">This code does not match a registered point.</p></>
          ) : (
            <>
              <div><h1 className="big">{t('public.title')}</h1><p className="display" style={{ fontSize: 24, marginTop: 8 }}>{t('public.line')}</p></div>
              <p className="mute small">{point.name}</p>
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }} className="stack">
                {['public.how1', 'public.how2', 'public.how3'].map((k, i) => <li key={k} className="row gap12" style={{ alignItems: 'flex-start' }}><span className="mono mute">{i + 1}</span><span>{t(k)}</span></li>)}
              </ul>
              <div className="stack">
                <span className="label"><Glyph name="shield" size={12} /> {t('public.report')}</span>
                <div className="row gap8 wrap">
                  <button className="btn" onClick={() => send('full', 'Bin full')}>{t('public.full')}</button>
                  <button className="btn" onClick={() => send('dmg', 'Bin damaged')}>{t('public.damaged')}</button>
                  <button className="btn" onClick={() => send('sup', 'Supplies needed')}>{t('public.supplies')}</button>
                </div>
                {msg && <p role="status" className="small">{msg}</p>}
              </div>
            </>
          )}
          <Link to="/login" className="small mute">Staff sign-in</Link>
        </div>
      </div>
    </div>
  );
}
