import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';
import AnalystPage from './pages/app/AnalystPage';
import DashboardPage from './pages/app/DashboardPage';
import { DashboardBuilder } from '@/features/dashboard';
import { DashboardList } from '@/features/dashboard';
import DataSourcePage from './pages/app/DataSourcePage';
import MlPage from './pages/app/MlPage';
import { AppLayout } from './layouts/AppLayout';
import SettingsPage from './pages/app/SettingsPage';
import { applyTheme, readUserSettings } from '@/services/userSettings';
import AppLogConsole from '@/components/AppLogConsole';
import { ToastViewport } from '@/components/ui/ToastViewport';
import { LoadingScreen } from '@/components/LoadingScreen';

function BuilderLogConsole() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  if (location.pathname !== '/dashboard/builder') return null;

  return (
    <div id="builder-log-console" className="fixed inset-x-0 bottom-0 z-[100]">
      <AppLogConsole isOpen={isOpen} onToggle={() => setIsOpen((open) => !open)} />
    </div>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const handleLoadDone = useCallback(() => setLoading(false), []);

  useEffect(() => applyTheme(readUserSettings().theme), []);

  return (
    <>
      {loading && <LoadingScreen onDone={handleLoadDone} />}

      <BrowserRouter>
        <Routes>
          {/* Root goes straight to the app */}
          <Route path="/" element={<Navigate to="/app/analyst" replace />} />
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/signup" element={<SignUpPage />} />

          {/* All app pages under /app with sidebar */}
          <Route path="/app" element={<AppLayout />}>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="analyst" element={<AnalystPage />} />
            <Route path="documents" element={<DataSourcePage />} />
            <Route path="ml" element={<MlPage />} />
            <Route path="settings/:section?" element={<SettingsPage />} />
          </Route>

          {/* Builder is full-screen, no sidebar */}
          <Route path="/dashboard/builder" element={<DashboardBuilder />} />

          <Route path="*" element={<Navigate to="/app/analyst" replace />} />
        </Routes>
        <BuilderLogConsole />
        <ToastViewport />
      </BrowserRouter>
    </>
  );
}