import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { useStore } from '../store';
import { ConfirmDialog, PageHeader, Panel } from '../components/ui';

type Kind = 'point' | 'batch';

export default function Qr() {
  const { points, batches, regenerateQr, toast } = useStore();
  const [sp] = useSearchParams();
  const [kind, setKind] = useState<Kind>('point');
  const [sel, setSel] = useState<string[]>(sp.get('point') ? [sp.get('point')!] : points.slice(0, 6).map((p) => p.id));
  const [imgs, setImgs] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<string | null>(null);
  const [bulk, setBulk] = useState(6);
  const batchIds = batches.slice(-12).map((b) => b.id);
  const list = kind === 'point' ? points.map((p) => p.id) : batchIds;

  const payload = (id: string) => {
    if (kind === 'point') { const v = points.find((p) => p.id === id)?.qrVersion ?? 1; return `${location.origin}/p/${id}?v=${v}`; }
    return `TRACE:${id}`;
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const out: Record<string, string> = {};
      for (const id of sel) out[id] = await QRCode.toDataURL(payload(id), { margin: 1, width: 240, errorCorrectionLevel: 'M' });
      if (alive) setImgs(out);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, kind, points]);

  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const download = () => { window.print(); };

  return (
    <div className="stack16">
      <div className="no-print"><PageHeader title="QR tags" sub="A code holds only an ID. Never a name, phone number or anything about a person."
        right={<><div className="toggle"><button className={kind === 'point' ? 'on' : ''} onClick={() => { setKind('point'); setSel(points.slice(0, 6).map((p) => p.id)); }}>DISPOSAL POINT</button><button className={kind === 'batch' ? 'on' : ''} onClick={() => { setKind('batch'); setSel(batchIds.slice(-6)); }}>BATCH TAG</button></div>
          <button className="btn primary" onClick={download} disabled={!sel.length}>Print / save PDF</button></>} /></div>
      <div className="two">
        <div className="no-print">
          <Panel title="Select" right={<div className="row gap8"><span className="small mute">Bulk</span><input className="input mono" style={{ width: 64, height: 32 }} type="number" min="1" max="30" value={bulk} onChange={(e) => setBulk(+e.target.value)} aria-label="Bulk count" /><button className="btn sm" onClick={() => setSel(list.slice(-Math.max(1, bulk)))}>Pick last {bulk}</button></div>}>
            <div className="stack" style={{ gap: 2, maxHeight: 420, overflow: 'auto' }}>
              {list.map((id) => (
                <div key={id} className="row between"><label className="check"><input type="checkbox" checked={sel.includes(id)} onChange={() => toggle(id)} /><span className="mono">{id}</span></label>
                  {kind === 'point' && <button className="btn ghost sm" onClick={() => setConfirm(id)}>Regenerate (v{points.find((p) => p.id === id)?.qrVersion})</button>}</div>
              ))}
            </div>
          </Panel>
        </div>
        <Panel title={`A4 sheet · ${sel.length} tags`} pad={false}>
          <div className="qr-sheet" id="print-area">
            {sel.map((id) => (
              <div key={id} className="qr-cell">{imgs[id] ? <img src={imgs[id]} alt={`QR for ${id}`} /> : <div style={{ height: 140 }} />}<div className="mono">{id}</div>
                {kind === 'point' && <div style={{ fontSize: 10 }}>{points.find((p) => p.id === id)?.site}</div>}<div style={{ fontSize: 9, color: '#555' }}>ID only · no personal data</div></div>
            ))}
            {sel.length === 0 && <p style={{ padding: 24, color: '#444' }}>Select at least one tag.</p>}
          </div>
        </Panel>
      </div>
      {confirm && <ConfirmDialog title={`Regenerate ${confirm}?`} confirm="Regenerate" danger body={<p>The printed code stops working and the change is logged. Reprint and replace the tag on the bin.</p>} onNo={() => setConfirm(null)} onYes={() => { regenerateQr(confirm); toast('ok', `${confirm} regenerated. Old code invalidated.`); setConfirm(null); }} />}
    </div>
  );
}
