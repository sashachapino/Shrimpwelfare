import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './contexts/AppContext';
import { LockScreen } from './components/LockScreen';
import { ClientList } from './components/ClientList';
import { ClientDetail } from './components/ClientDetail';
import { ArchivedClients } from './components/ArchivedClients';

function AppRoutes() {
  const { isUnlocked, loading } = useApp();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!isUnlocked) {
    return <LockScreen />;
  }

  return (
    <Routes>
      <Route path="/" element={<ClientList />} />
      <Route path="/archived" element={<ArchivedClients />} />
      <Route path="/client/:id" element={<ClientDetail />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  );
}

export default App;
