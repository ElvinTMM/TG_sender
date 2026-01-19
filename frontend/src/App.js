import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import AccountsPage from "./pages/AccountsPage";
import ContactsPage from "./pages/ContactsPage";
import CampaignsPage from "./pages/CampaignsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import DialogsPage from "./pages/DialogsPage";
import TemplatesPage from "./pages/TemplatesPage";
import VoicePage from "./pages/VoicePage";
import DashboardLayout from "./components/DashboardLayout";
import "./App.css";

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090B] flex items-center justify-center">
        <div className="text-sky-400 font-mono animate-pulse-glow">Загрузка...</div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090B] flex items-center justify-center">
        <div className="text-sky-400 font-mono animate-pulse-glow">Загрузка...</div>
      </div>
    );
  }
  
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/contacts" element={<ContactsPage />} />
        <Route path="/campaigns" element={<CampaignsPage />} />
        <Route path="/dialogs" element={<DialogsPage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/voice" element={<VoicePage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster 
          position="top-right" 
          toastOptions={{
            style: {
              background: '#18181B',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#FAFAFA',
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
