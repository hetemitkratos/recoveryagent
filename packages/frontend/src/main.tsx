import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { LayoutDashboard, List, FlaskConical, Settings } from 'lucide-react';
import './index.css';
import { DashboardPage } from './pages/DashboardPage';
import { RecoveryQueuePage } from './pages/RecoveryQueuePage';
import { RecoveryDetailPage } from './pages/RecoveryDetailPage';
import { ExperimentPage } from './pages/ExperimentPage';
import { DemoControlPanel } from './pages/DemoControlPanel';

type Page = 'dashboard' | 'queue' | 'detail' | 'experiment' | 'demo';

function getHashPage(): { page: Page; sessionId?: string } {
  const hash = window.location.hash.slice(1);
  if (hash.startsWith('recovery/')) {
    return { page: 'detail', sessionId: hash.slice('recovery/'.length) };
  }
  if (hash === 'queue') return { page: 'queue' };
  if (hash === 'experiment') return { page: 'experiment' };
  if (hash === 'demo') return { page: 'demo' };
  return { page: 'dashboard' };
}

function App() {
  const [route, setRoute] = useState(getHashPage());
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const onHashChange = () => setRoute(getHashPage());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((page: Page, sessionId?: string) => {
    if (page === 'detail' && sessionId) {
      window.location.hash = `recovery/${sessionId}`;
    } else {
      window.location.hash = page;
    }
  }, []);

  const triggerRefresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  const navItems: { page: Page; label: string; icon: React.ReactNode }[] = [
    { page: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { page: 'queue', label: 'Recovery Queue', icon: <List size={18} /> },
    { page: 'experiment', label: 'Experiment', icon: <FlaskConical size={18} /> },
    { page: 'demo', label: 'Demo Controls', icon: <Settings size={18} /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
            RR
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">AI Revenue Recovery</h1>
            <p className="text-xs text-gray-400">Financial Control Room</p>
          </div>
        </div>
        <nav className="flex items-center gap-1">
          {navItems.map(item => (
            <button
              key={item.page}
              onClick={() => navigate(item.page)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                route.page === item.page || (route.page === 'detail' && item.page === 'queue')
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {item.icon}
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          ))}
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {route.page === 'dashboard' && <DashboardPage key={refreshKey} />}
        {route.page === 'queue' && <RecoveryQueuePage key={refreshKey} onSelectSession={(id) => navigate('detail', id)} />}
        {route.page === 'detail' && route.sessionId && (
          <RecoveryDetailPage key={route.sessionId} sessionId={route.sessionId} onBack={() => navigate('queue')} />
        )}
        {route.page === 'experiment' && <ExperimentPage key={refreshKey} />}
        {route.page === 'demo' && <DemoControlPanel key={refreshKey} onActionComplete={triggerRefresh} />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 px-6 py-2 text-center text-xs text-gray-400">
        AI Revenue Recovery MVP — Razorpay Buildathon Track 03
      </footer>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
