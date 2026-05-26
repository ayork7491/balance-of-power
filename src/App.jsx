import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import LoadingScreen from '@/components/ui/LoadingScreen';

// Page imports
import Home from './pages/Home';
import Settings from './pages/Settings';
import TabletopProfiles from './pages/TabletopProfiles';
import CreateEditProfile from './pages/CreateEditProfile';
import CreateCampaign from './pages/CreateCampaign';
import JoinCampaign from './pages/JoinCampaign';
import CampaignLobby from './pages/CampaignLobby';
import ActiveCampaign from './pages/ActiveCampaign';
import BattleCardDetail from './pages/BattleCardDetail';
import BattleResultEntry from './pages/BattleResultEntry';
import HistoryDetail from './pages/HistoryDetail';
import AdminTestMode from './pages/AdminTestMode';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return <LoadingScreen message="Loading Balance of Power..." />;
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      {/* Home */}
      <Route path="/" element={<Home />} />

      {/* Settings */}
      <Route path="/settings" element={<Settings />} />

      {/* Tabletop Game Profiles */}
      <Route path="/profiles" element={<TabletopProfiles />} />
      <Route path="/profiles/create" element={<CreateEditProfile />} />
      <Route path="/profiles/:id/edit" element={<CreateEditProfile />} />

      {/* Campaigns */}
      <Route path="/campaigns/create" element={<CreateCampaign />} />
      <Route path="/campaigns/join" element={<JoinCampaign />} />
      <Route path="/campaigns/:id/lobby" element={<CampaignLobby />} />
      <Route path="/campaigns/:id" element={<ActiveCampaign />} />

      {/* Battle cards */}
      <Route path="/campaigns/:id/battles/:battleId" element={<BattleCardDetail />} />
      <Route path="/campaigns/:id/battles/:battleId/result" element={<BattleResultEntry />} />

      {/* History */}
      <Route path="/campaigns/:id/history" element={<HistoryDetail />} />

      {/* Admin tools */}
      <Route path="/campaigns/:id/admin" element={<AdminTestMode />} />

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;