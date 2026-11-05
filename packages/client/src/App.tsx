import { Navigate, Route, Routes } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import Hud from './components/Hud';
import Arena from './pages/Arena';
import ArenaRankings from './pages/ArenaRankings';
import Campaign from './pages/Campaign';
import Challenges from './pages/Challenges';
import Combat from './pages/Combat';
import Dungeons from './pages/Dungeons';
import Explore from './pages/Explore';
import ExploreMode from './pages/ExploreMode';
import Gallery from './pages/Gallery';
import Home from './pages/Home';
import Idle from './pages/Idle';
import Mail from './pages/Mail';
import More from './pages/More';
import PetHome from './pages/PetHome';
import SkyPillar from './pages/SkyPillar';
import HoopaVault from './pages/HoopaVault';
import RiftArena from './pages/RiftArena';
import MistyWoods from './pages/MistyWoods';
import FactionTower from './pages/FactionTower';
import BerryGrove from './pages/BerryGrove';
import DigSite from './pages/DigSite';
import VictoryRoad from './pages/VictoryRoad';
import KingsTrial from './pages/KingsTrial';
import Paradise from './pages/Paradise';
import JointTeam from './pages/JointTeam';
import ClashOfIsles from './pages/ClashOfIsles';
import AccountSystems from './pages/AccountSystems';
import Guild from './pages/Guild';
import Events from './pages/Events';
import GuildWar from './pages/GuildWar';
import RelicBattlefield from './pages/RelicBattlefield';
import PokemonPark from './pages/PokemonPark';
import SptTemple from './pages/SptTemple';
import Clash from './pages/Clash';
import Championship from './pages/Championship';
import PveTower from './pages/PveTower';
import Pvp from './pages/Pvp';
import Quests from './pages/Quests';
import SignIn from './pages/SignIn';
import Ranked from './pages/Ranked';
import Shop from './pages/Shop';
import Squad from './pages/Squad';
import Summon from './pages/Summon';
import Bag from './pages/Bag';
import Trainer from './pages/Trainer';
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
        <Route path="/explore" element={<Explore />} />
        <Route path="/explore/pet-home" element={<PetHome />} />
        <Route path="/explore/sky-pillar" element={<SkyPillar />} />
        <Route path="/explore/hoopa-vault" element={<HoopaVault />} />
        <Route path="/explore/rift-arena" element={<RiftArena />} />
        <Route path="/explore/misty-woods" element={<MistyWoods />} />
        <Route path="/explore/faction-tower" element={<FactionTower />} />
        <Route path="/explore/berry-grove" element={<BerryGrove />} />
        <Route path="/explore/dig-site" element={<DigSite />} />
        <Route path="/explore/:id" element={<ExploreMode />} />
        <Route path="/campaign" element={<Campaign />} />
        <Route path="/victory-road" element={<VictoryRoad />} />
        <Route path="/kings-trial" element={<KingsTrial />} />
        <Route path="/paradise" element={<Paradise />} />
        <Route path="/joint-team" element={<JointTeam />} />
        <Route path="/clash-of-isles" element={<ClashOfIsles />} />
        <Route path="/account-systems" element={<AccountSystems />} />
        <Route path="/guild" element={<Guild />} />
        <Route path="/events" element={<Events />} />
        <Route path="/guild-war" element={<GuildWar />} />
        <Route path="/relic-battlefield" element={<RelicBattlefield />} />
        <Route path="/pokemon-park" element={<PokemonPark />} />
        <Route path="/spt-temple" element={<SptTemple />} />
        <Route path="/clash" element={<Clash />} />
        <Route path="/championship" element={<Championship />} />
        <Route path="/idle" element={<Idle />} />
        <Route path="/quests" element={<Quests />} />
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/mail" element={<Mail />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/wilds" element={<Wilds />} />
        <Route path="/wilds/:id" element={<WildDetail />} />
        <Route path="/squad" element={<Squad />} />
        <Route path="/combat" element={<Challenges />} />
        <Route path="/combat/training" element={<Combat />} />
        <Route path="/tower" element={<PveTower />} />
        <Route path="/boss" element={<WorldBoss />} />
        <Route path="/dungeons" element={<Dungeons />} />
        <Route path="/arena" element={<Arena />} />
        <Route path="/arena/rankings" element={<ArenaRankings />} />
        <Route path="/ranked" element={<Ranked />} />
        <Route path="/pvp" element={<Pvp />} />
        <Route path="/summon" element={<Summon />} />
        <Route path="/bag" element={<Bag />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/trainer" element={<Trainer />} />
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
