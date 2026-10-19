import { Navigate, Route, Routes } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import Hud from './components/Hud';
import Arena from './pages/Arena';
import ArenaRankings from './pages/ArenaRankings';
import Campaign from './pages/Campaign';
import Challenges from './pages/Challenges';
import Combat from './pages/Combat';
import Dungeons from './pages/Dungeons';
import Gallery from './pages/Gallery';
import Home from './pages/Home';
import Idle from './pages/Idle';
import LinkCrystal from './pages/LinkCrystal';
import Mail from './pages/Mail';
import More from './pages/More';
import PveTower from './pages/PveTower';
import PveTrials from './pages/PveTrials';
import Quests from './pages/Quests';
import Shop from './pages/Shop';
import Squad from './pages/Squad';
import Summon from './pages/Summon';
import WildDetail from './pages/WildDetail';
import Wilds from './pages/Wilds';
import WorldBoss from './pages/WorldBoss';
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
        <Route path="/campaign" element={<Campaign />} />
        <Route path="/idle" element={<Idle />} />
        <Route path="/quests" element={<Quests />} />
        <Route path="/mail" element={<Mail />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/wilds" element={<Wilds />} />
        <Route path="/wilds/:id" element={<WildDetail />} />
        <Route path="/squad" element={<Squad />} />
        <Route path="/combat" element={<Challenges />} />
        <Route path="/combat/training" element={<Combat />} />
        <Route path="/tower" element={<PveTower />} />
        <Route path="/trials" element={<PveTrials />} />
        <Route path="/boss" element={<WorldBoss />} />
        <Route path="/dungeons" element={<Dungeons />} />
        <Route path="/crystal" element={<LinkCrystal />} />
        <Route path="/arena" element={<Arena />} />
        <Route path="/arena/rankings" element={<ArenaRankings />} />
        <Route path="/summon" element={<Summon />} />
        <Route path="/shop" element={<Shop />} />
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
