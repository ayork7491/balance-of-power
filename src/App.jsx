/**
 * App.jsx — Root router for Balance of Power.
 *
 * Route architecture:
 *   PUBLIC  — /login, /register, /forgot-password, /reset-password
 *             These render unconditionally. No auth check blocks them.
 *
 *   PROTECTED — everything else (/, /settings, /profiles, /campaigns/*, etc.)
 *               Wrapped in <ProtectedRoute> which redirects to /login if
 *               the user is not authenticated.
 *
 * See AUTH_NOTES.md for the full explanation of how Base44 auth works.
 */
import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';

// Public auth pages
import Login          from './pages/Login';
import Register       from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword  from './pages/ResetPassword';

// Protected app pages
import Home            from './pages/Home';
import Settings        from './pages/Settings';
import TabletopProfiles  from './pages/TabletopProfiles';
import CreateEditProfile from './pages/CreateEditProfile';
import CreateCampaign    from './pages/CreateCampaign';
import JoinCampaign      from './pages/JoinCampaign';
import CampaignLobby     from './pages/CampaignLobby';
import ActiveCampaign    from './pages/ActiveCampaign.jsx';
import BattleCardDetail       from './pages/BattleCardDetail';
import BattleResultEntry      from './pages/BattleResultEntry';
import AdminBattleResultEntry from './pages/AdminBattleResultEntry';
import HistoryDetail          from './pages/HistoryDetail';
import AdminTestMode          from './pages/AdminTestMode';

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <Routes>
            {/* ── Public auth routes ─────────────────────────────────────
                These must come BEFORE <ProtectedRoute> so they are always
                reachable regardless of auth state. */}
            <Route path="/login"          element={<Login />} />
            <Route path="/register"       element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password"  element={<ResetPassword />} />

            {/* ── Protected app routes ───────────────────────────────────
                ProtectedRoute checks auth state. If not authenticated,
                it renders <Navigate to="/login" replace />.
                While auth is loading it renders a spinner fallback. */}
            <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
              <Route path="/"                                       element={<Home />} />
              <Route path="/settings"                               element={<Settings />} />

              {/* Tabletop Game Profiles */}
              <Route path="/profiles"                               element={<TabletopProfiles />} />
              <Route path="/profiles/create"                        element={<CreateEditProfile />} />
              <Route path="/profiles/:id/edit"                      element={<CreateEditProfile />} />

              {/* Campaigns */}
              <Route path="/campaigns/create"                       element={<CreateCampaign />} />
              <Route path="/campaigns/join"                         element={<JoinCampaign />} />
              <Route path="/campaigns/:id/lobby"                    element={<CampaignLobby />} />
              <Route path="/campaigns/:id"                          element={<ActiveCampaign />} />

              {/* Battle cards */}
              <Route path="/campaigns/:id/battles/:battleId"         element={<BattleCardDetail />} />
              <Route path="/campaigns/:id/battles/:battleId/result"  element={<BattleResultEntry />} />
              <Route path="/campaigns/:id/battles/:battleId/admin"   element={<AdminBattleResultEntry />} />

              {/* History */}
              <Route path="/campaigns/:id/history"                  element={<HistoryDetail />} />

              {/* Admin test mode */}
              <Route path="/campaigns/:id/admin"                    element={<AdminTestMode />} />
            </Route>

            {/* 404 */}
            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;