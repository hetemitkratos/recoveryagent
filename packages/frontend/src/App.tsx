import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TopNavLayout } from './components/layout/TopNavLayout';
import { DashboardPage } from './pages/DashboardPage';
import { ApiKeyModal } from './components/ui/ApiKeyModal';

const Placeholder = ({ title }: { title: string }) => <div className="p-8 text-2xl font-bold">{title}</div>;

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ApiKeyModal />
      <BrowserRouter>
        <Routes>
          <Route element={<TopNavLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/queue" element={<Placeholder title="Recovery Queue" />} />
            <Route path="/recovery/:id" element={<Placeholder title="Decision Trace" />} />
            <Route path="/experiments" element={<Placeholder title="Experiments" />} />
            <Route path="/webhooks" element={<Placeholder title="Webhook Monitor" />} />
            <Route path="/ptp" element={<Placeholder title="PTP Manager" />} />
            <Route path="/demo" element={<Placeholder title="Demo Simulator" />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
