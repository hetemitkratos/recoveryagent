import { useState } from 'react';
import { api, type ExperimentResult } from '../api/client';
import { Card, Button, LoadingSpinner, EmptyState } from '../components/ui';
import { formatINRFull, formatPct, formatPp } from '../lib/format';
import { Play, TrendingUp } from 'lucide-react';

export function ExperimentPage() {
  const [result, setResult] = useState<ExperimentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [seed, setSeed] = useState(42);
  const [controlSize, setControlSize] = useState(50);
  const [treatmentSize, setTreatmentSize] = useState(50);

  async function runExperiment() {
    setLoading(true);
    setError('');
    try {
      const data = await api.runExperiment(seed, controlSize, treatmentSize);
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card title="Batch Experiment Setup">
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Seed</label>
            <input
              type="number"
              value={seed}
              onChange={e => setSeed(Number(e.target.value))}
              className="w-24 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Control Size</label>
            <input
              type="number"
              value={controlSize}
              onChange={e => setControlSize(Number(e.target.value))}
              className="w-24 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Treatment Size</label>
            <input
              type="number"
              value={treatmentSize}
              onChange={e => setTreatmentSize(Number(e.target.value))}
              className="w-24 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <Button onClick={runExperiment} disabled={loading}>
            <Play size={16} className="inline mr-1" /> Run Experiment
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          The experiment runs the real recovery engine for the treatment group and an organic baseline for the control group.
          All metrics are calculated from real data — nothing is hardcoded.
        </p>
      </Card>

      {loading && <LoadingSpinner />}

      {error && (
        <Card>
          <div className="text-red-600 text-sm">{error}</div>
        </Card>
      )}

      {/* Results */}
      {result && !loading && (
        <>
          {/* Headline Result */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp size={24} />
              <h2 className="text-xl font-bold">Incremental Revenue Recovered</h2>
            </div>
            <div className="text-4xl font-bold mb-2">{formatINRFull(result.incremental_recovered_revenue)}</div>
            <div className="flex gap-6 text-sm opacity-90">
              <span>Lift: <strong>{formatPp(result.incremental_lift_pp)}</strong></span>
              <span>ROI: <strong>{result.roi.toFixed(1)}x</strong></span>
            </div>
          </div>

          {/* Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Control */}
            <Card title="Control Group (No AI Recovery)">
              <div className="space-y-3">
                <StatRow label="Payments" value={String(result.control.count)} />
                <StatRow label="Recovered" value={String(result.control.recovered)} />
                <StatRow label="Recovery Rate" value={formatPct(result.control.recovery_rate)} />
                <StatRow label="Recovered Revenue" value={formatINRFull(result.control.recovered_revenue)} highlight />
              </div>
            </Card>

            {/* Treatment */}
            <Card title="AI Treatment Group (Real Recovery Engine)">
              <div className="space-y-3">
                <StatRow label="Payments" value={String(result.treatment.count)} />
                <StatRow label="Recovered" value={String(result.treatment.recovered)} />
                <StatRow label="Recovery Rate" value={formatPct(result.treatment.recovery_rate)} highlight />
                <StatRow label="Recovered Revenue" value={formatINRFull(result.treatment.recovered_revenue)} highlight />
              </div>
            </Card>
          </div>

          {/* Visual Comparison */}
          <Card title="Recovery Rate Comparison">
            <div className="space-y-4">
              <ComparisonBar
                label="Control"
                rate={result.control.recovery_rate}
                color="bg-gray-400"
              />
              <ComparisonBar
                label="AI Treatment"
                rate={result.treatment.recovery_rate}
                color="bg-indigo-600"
              />
              <div className="pt-2 border-t border-gray-100">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Incremental Lift</span>
                  <span className="font-bold text-indigo-600">{formatPp(result.incremental_lift_pp)}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Experiment ID */}
          <div className="text-xs text-gray-400 text-center">
            Experiment ID: <span className="font-mono">{result.experiment_id}</span>
          </div>
        </>
      )}

      {!result && !loading && !error && (
        <Card>
          <EmptyState message="Run an experiment to see results." />
        </Card>
      )}
    </div>
  );
}

function StatRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`font-semibold ${highlight ? 'text-indigo-600 text-lg' : 'text-gray-900'}`}>{value}</span>
    </div>
  );
}

function ComparisonBar({ label, rate, color }: { label: string; rate: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="font-semibold text-gray-900">{formatPct(rate)}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-4">
        <div className={`h-4 rounded-full ${color} transition-all duration-500`} style={{ width: `${rate * 100}%` }} />
      </div>
    </div>
  );
}
