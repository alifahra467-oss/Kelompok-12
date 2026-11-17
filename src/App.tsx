import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary, FirebaseSetupNotice } from './components/StatusViews';
import { AuthProvider } from './context/AuthContext';
import { isFirebaseConfigured } from './lib/firebase';
import { RequireAdmin } from './layouts/AdminLayout';
import { HomePage } from './pages/HomePage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { ControlCenterPage } from './pages/admin/ControlCenterPage';
import { PretestControlPage } from './pages/admin/PretestControlPage';
import { PretestsPage } from './pages/admin/PretestsPage';
import { QuestionBankPage } from './pages/admin/QuestionBankPage';
import { SessionsPage } from './pages/admin/SessionsPage';
import { TeamsManagementPage } from './pages/admin/TeamsManagementPage';
import { PretestProjectorPage } from './pages/projector/PretestProjectorPage';
import { ProjectorPage } from './pages/projector/ProjectorPage';
import { ResultsPage } from './pages/results/ResultsPage';
import { JoinPage } from './pages/student/JoinPage';
import { PlayPage } from './pages/student/PlayPage';
import { PretestPlayPage } from './pages/student/PretestPlayPage';
import { UlumulQuranQuizPage } from './pages/student/UlumulQuranQuizPage';

export default function App() {
  if (!isFirebaseConfigured) {
    return <FirebaseSetupNotice />;
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/admin" element={<RequireAdmin><AdminDashboardPage /></RequireAdmin>} />
            <Route path="/admin/questions" element={<RequireAdmin><QuestionBankPage /></RequireAdmin>} />
            <Route path="/admin/pretest" element={<RequireAdmin><PretestsPage /></RequireAdmin>} />
            <Route path="/admin/pretest/:id" element={<RequireAdmin><PretestControlPage /></RequireAdmin>} />
            <Route path="/admin/teams" element={<RequireAdmin><TeamsManagementPage /></RequireAdmin>} />
            <Route path="/admin/sessions" element={<RequireAdmin><SessionsPage /></RequireAdmin>} />
            <Route path="/admin/control/:id" element={<RequireAdmin><ControlCenterPage /></RequireAdmin>} />
            <Route path="/present/:id" element={<ProjectorPage />} />
            <Route path="/pretest/present/:id" element={<PretestProjectorPage />} />
            <Route path="/join" element={<JoinPage />} />
            <Route path="/kuis-pg" element={<UlumulQuranQuizPage />} />
            <Route path="/play/:id" element={<PlayPage />} />
            <Route path="/pretest/play/:id" element={<PretestPlayPage />} />
            <Route path="/results/:id" element={<ResultsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
