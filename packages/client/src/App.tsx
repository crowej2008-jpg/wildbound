import { Navigate, Route, Routes } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import ComingLater from './components/ComingLater';
import Hud from './components/Hud';
import { t } from './i18n';
import Combat from './pages/Combat';
import Gallery from './pages/Gallery';
import Home from './pages/Home';
import More from './pages/More';
import Squad from './pages/Squad';
import WildDetail from './pages/WildDetail';
import Wilds from './pages/Wilds';
import { ServerProvider, useServer } from './server/ServerProvider';

function ErrorBanner() {
  const { error } = useServer();
  if (!error) return null;
  return (
    <div className="error-banner" role="alert">
      {error}
    </div>
  );
}

function AppRoutes() {
  return (
    <div className="app-shell">
      <Hud />
      <ErrorBanner />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/wilds" element={<Wilds />} />
        <Route path="/wilds/:id" element={<WildDetail />} />
        <Route path="/squad" element={<Squad />} />
        <Route path="/combat" element={<Combat />} />
        <Route path="/summon" element={<ComingLater title={t('nav.summon')} milestone="M6" />} />
        <Route path="/more" element={<More />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <ServerProvider>
      <AppRoutes />
    </ServerProvider>
  );
}
