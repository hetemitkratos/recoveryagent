import React, { useState } from 'react';
import { api } from '../api/client';
import { Card, Button } from '../components/ui';
import { RotateCcw, Database, AlertTriangle, DollarSign, Calendar, Ban, FlaskConical } from 'lucide-react';

interface Props {
  onActionComplete: () => void;
}

export function DemoControlPanel({ onActionComplete }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function run(fn: () => Promise<any>, label: string) {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const result = await fn();
      setMessage(`${label}: ${JSON.stringify(result).slice(0, 200)}`);
      onActionComplete();
    } catch (err: any) {
      setError(`${label} failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card title="Demo Control Panel">
        <p className="text-xs text-gray-400 mb-4">
          Use these controls to seed data, simulate scenarios, and reset the demo.
          All actions use the real recovery engine — no fake paths.
        </p>

        {message && <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{message}</div>}
        {error && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Seed */}
          <Button variant="secondary" disabled={busy} onClick={() => run(() => api.seed(42, 100), 'Seed')}>
            <Database size={16} className="inline mr-2" /> Seed Demo (100)
          </Button>

          {/* Reset */}
          <Button variant="danger" disabled={busy} onClick={() => run(() => api.reset(), 'Reset')}>
            <RotateCcw size={16} className="inline mr-2" /> Reset Demo
          </Button>

          {/* Simulate Technical Failure */}
          <Button variant="secondary" disabled={busy} onClick={() => run(() => api.simulateFailure({ amount: 750000, failure_class: 'TECHNICAL', failure_code: 'gateway_timeout' }), 'Technical Failure')}>
            <AlertTriangle size={16} className="inline mr-2" /> Simulate Technical Failure
          </Button>

          {/* Simulate Business Failure */}
          <Button variant="secondary" disabled={busy} onClick={() => run(() => api.simulateFailure({ amount: 500000, failure_class: 'BUSINESS', failure_code: 'insufficient_funds' }), 'Business Failure')}>
            <AlertTriangle size={16} className="inline mr-2" /> Simulate Business Failure (₹5K)
          </Button>

          {/* Simulate High-Value Failure */}
          <Button variant="secondary" disabled={busy} onClick={() => run(() => api.simulateFailure({ amount: 1200000, failure_class: 'BUSINESS', failure_code: 'insufficient_funds' }), 'High-Value Failure')}>
            <AlertTriangle size={16} className="inline mr-2" /> Simulate High-Value (₹12K)
          </Button>

          {/* Simulate Unknown Failure */}
          <Button variant="secondary" disabled={busy} onClick={() => run(() => api.simulateFailure({ amount: 350000, failure_class: 'UNKNOWN', failure_code: 'unknown_error' }), 'Unknown Failure')}>
            <AlertTriangle size={16} className="inline mr-2" /> Simulate Unknown Failure
          </Button>

          {/* Run Experiment */}
          <Button variant="secondary" disabled={busy} onClick={() => run(() => api.runExperiment(42, 50, 50), 'Experiment')}>
            <FlaskConical size={16} className="inline mr-2" /> Run Batch Experiment
          </Button>
        </div>
      </Card>

      {/* Hero Scenario Quick Guide */}
      <Card title="Hero Scenarios">
        <div className="space-y-3 text-sm">
          <ScenarioRow
            icon={<AlertTriangle size={16} className="text-blue-600" />}
            title="A: Technical Failure"
            desc="Simulate Technical Failure → safe retry → recovery"
          />
          <ScenarioRow
            icon={<DollarSign size={16} className="text-purple-600" />}
            title="B: Insufficient Funds (Hero)"
            desc="Simulate Business Failure → payment link → DIRECT recovery"
          />
          <ScenarioRow
            icon={<Calendar size={16} className="text-cyan-600" />}
            title="C: Promise to Pay"
            desc="Simulate failure → use PTP control on session → PTP_WAIT"
          />
          <ScenarioRow
            icon={<DollarSign size={16} className="text-green-600" />}
            title="D: Already Paid (Safety)"
            desc="Simulate failure → simulate payment → action blocked"
          />
          <ScenarioRow
            icon={<Ban size={16} className="text-red-600" />}
            title="E: Opt Out"
            desc="Simulate failure → use opt-out control → STOPPED"
          />
        </div>
      </Card>
    </div>
  );
}

function ScenarioRow({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">{icon}</div>
      <div>
        <div className="font-medium text-gray-800">{title}</div>
        <div className="text-xs text-gray-400">{desc}</div>
      </div>
    </div>
  );
}
