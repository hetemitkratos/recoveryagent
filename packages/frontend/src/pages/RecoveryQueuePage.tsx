import { useEffect, useState, useCallback } from 'react';
import { api, type RecoverySession } from '../api/client';
import { Card, Badge, Button, LoadingSpinner, EmptyState } from '../components/ui';
import { formatINR, formatPct, formatDateTime, stateColor, diagnosisColor } from '../lib/format';
import { Search, RefreshCw } from 'lucide-react';

interface Props {
  onSelectSession: (id: string) => void;
}

export function RecoveryQueuePage({ onSelectSession }: Props) {
  const [sessions, setSessions] = useState<RecoverySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState<string>('ALL');

  const refresh = useCallback(async () => {
    try {
      const data = await api.getSessions();
      setSessions(data);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = sessions.filter(s => {
    if (filterState !== 'ALL' && s.state !== filterState) return false;
    if (search) {
      const q = search.toLowerCase();
      return s.id.toLowerCase().includes(q) || s.customer_id.toLowerCase().includes(q) || (s.payment_id || '').toLowerCase().includes(q);
    }
    return true;
  });

  // Sort: active first, then by risk score descending
  const sorted = [...filtered].sort((a, b) => {
    const aActive = !a.closed_at ? 0 : 1;
    const bActive = !b.closed_at ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    return b.risk_score - a.risk_score;
  });

  const states = ['ALL', 'AT_RISK', 'DIAGNOSING', 'OUTREACH', 'PTP_WAIT', 'RECOVERED', 'STOPPED', 'HUMAN_REVIEW'];

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by session, customer, or payment ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={filterState}
          onChange={e => setFilterState(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {states.map(s => <option key={s} value={s}>{s === 'ALL' ? 'All States' : s}</option>)}
        </select>
        <Button variant="secondary" size="md" onClick={refresh}>
          <RefreshCw size={14} className="inline mr-1" /> Refresh
        </Button>
      </div>

      {/* Table */}
      <Card className="overflow-hidden" >
        {sorted.length > 0 ? (
          <div className="overflow-x-auto -m-5">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Session</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Customer</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">State</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Diagnosis</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Risk</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">P(Recovery)</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Expected</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map(s => (
                  <tr
                    key={s.id}
                    onClick={() => onSelectSession(s.id)}
                    className="hover:bg-indigo-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.id.slice(0, 16)}...</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{s.customer_id}</td>
                    <td className="px-4 py-3"><Badge className={stateColor(s.state)}>{s.state}</Badge></td>
                    <td className="px-4 py-3">
                      {s.diagnosis ? (
                        <span className={`font-medium ${diagnosisColor(s.diagnosis)}`}>
                          {s.diagnosis}
                          {s.diagnosis_confidence != null && (
                            <span className="text-xs text-gray-400 ml-1">{formatPct(s.diagnosis_confidence)}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-700">{s.risk_score}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{formatPct(s.recovery_probability)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-indigo-600">{formatINR(s.expected_recoverable_revenue)}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{formatDateTime(s.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message="No recovery sessions found. Seed demo data or simulate a failure to get started." />
        )}
      </Card>
    </div>
  );
}
