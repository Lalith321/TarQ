import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';
import AnalystPage from './pages/app/AnalystPage';
import DashboardPage from './pages/app/DashboardPage';
import { DashboardBuilder } from '@/features/dashboard';
import { DashboardList } from '@/features/dashboard';
import DocumentsPage from './pages/app/DocumentsPage';
import MlPage from './pages/app/MlPage';
import { AppLayout } from './layouts/AppLayout';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        
        {/* All app pages under /app with sidebar */}
        <Route path="/app" element={<AppLayout />}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="analyst" element={<AnalystPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="ml" element={<MlPage />} />
        </Route>
        
        {/* Builder is full-screen, no sidebar */}
        <Route path="/dashboard/builder" element={<DashboardBuilder />} />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}