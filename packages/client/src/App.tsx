import { Navigate, Route, Routes } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import ComingLater from './components/ComingLater';
import { t } from './i18n';
import Home from './pages/Home';

export default function App() {
  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/wilds" element={<ComingLater title={t('nav.wilds')} milestone="M3" />} />
        <Route path="/combat" element={<ComingLater title={t('nav.combat')} milestone="M4" />} />
        <Route path="/summon" element={<ComingLater title={t('nav.summon')} milestone="M6" />} />
        <Route path="/more" element={<ComingLater title={t('nav.more')} milestone="M10" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </div>
  );
}