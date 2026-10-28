import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { Shell, homeFor } from './components/Shell';
import { PermissionGate } from './components/ui';
import { useStore } from './store';
import Login from './pages/Login';
import ChainMap from './pages/ChainMap';
import Batches from './pages/Batches';
import Dossier from './pages/Dossier';
import { DiscrepancyList, DiscrepancyDetail } from './pages/Discrepancies';
import Handoff from './pages/Handoff';
import { PointList, PointDetail } from './pages/Points';
import Network from './pages/Network';
import Evidence from './pages/Evidence';
import Audit from './pages/Audit';
import Qr from './pages/Qr';
import Control from './pages/Control';
import PublicPoint from './pages/PublicPoint';

function Home() {
  const role = useStore((s) => s.role);
  if (!role) return <Navigate to="/login" replace />;
  if (role === 'admin') return <ChainMap />;
  return <Navigate to={homeFor(role)} replace />;
}

function NotFound() {
  return (
    <div className="panel hero denied">
      <span className="brk" aria-hidden="true"><i /><i /><i /><i /></span>
      <div className="panel-b stack">
        <span className="label">404</span>
        <h2 className="display">No such record.</h2>
        <p className="mute">The address does not match any screen or batch.</p>
        <Link to="/" className="btn primary">Back to home</Link>
      </div>
    </div>
  );
}

const A = ['admin'] as const;
const AP = ['admin', 'pibo'] as const;

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/p/:pointId" element={<PublicPoint />} />
      <Route element={<Shell />}>
        <Route index element={<Home />} />
        <Route path="/map" element={<PermissionGate allow={[...AP]}><ChainMap /></PermissionGate>} />
        <Route path="/batches" element={<Batches />} />
        <Route path="/batch/:id" element={<Dossier />} />
        <Route path="/discrepancies" element={<PermissionGate allow={[...A]}><DiscrepancyList /></PermissionGate>} />
        <Route path="/discrepancies/:id" element={<PermissionGate allow={[...A]}><DiscrepancyDetail /></PermissionGate>} />
        <Route path="/handoff" element={<Handoff />} />
        <Route path="/points" element={<PermissionGate allow={[...A]}><PointList /></PermissionGate>} />
        <Route path="/points/:id" element={<PermissionGate allow={[...A]}><PointDetail /></PermissionGate>} />
        <Route path="/network" element={<PermissionGate allow={[...AP]}><Network /></PermissionGate>} />
        <Route path="/evidence" element={<PermissionGate allow={[...AP]}><Evidence /></PermissionGate>} />
        <Route path="/audit" element={<PermissionGate allow={[...AP]}><Audit /></PermissionGate>} />
        <Route path="/qr" element={<PermissionGate allow={[...A]}><Qr /></PermissionGate>} />
        <Route path="/control" element={<PermissionGate allow={[...A]}><Control /></PermissionGate>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
