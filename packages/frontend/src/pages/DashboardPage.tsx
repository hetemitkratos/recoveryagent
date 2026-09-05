import { useEffect, useState, useCallback } from 'react';
import { api, type DashboardMetrics, type AuditEvent } from '../api/client';
import { Card, MetricCard, Badge, LoadingSpinner, EmptyState } from '../components/ui';
import { formatINR, formatINRFull, formatPct, formatTime, stateColor, attributionColor } from '../lib/format';
import { TrendingUp, AlertCircle, Activity, DollarSign, Zap, Shield } from 'lucide-react';

export function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [failuresByType, setFailuresByType] = useState<Record<string, number> | null>(null);
  const [funnel, setFunnel] = useState<Record<string, number> | null>(null);
  const [auditTimeline, setAuditTimeline] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [m, ft, fn, at] = await Promise.all([
        api.getMetrics(),
        api.getFailuresByType(),
        api.getRecoveryFunnel(),
        api.getAuditTimeline(),
      ]);
      setMetrics(m);
      setFailuresByType(ft);
      setFunnel(fn);
      setAuditTimeline(at);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  if (loading) return <LoadingSpinner />;
  if (!metrics) return <EmptyState message="No data available. Seed the demo to get started." />;

  const attributionEntries = Object.entries(metrics.attribution_breakdown || {}).filter(([, v]) => v > 0);
  const totalAttribution = attributionEntries.reduce((s, [, v]) => s + v, 0);

  return (
    <div className="space-y-6">
      {/* Headline Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard
          label="Revenue at Risk"
          value={formatINR(metrics.revenue_at_risk)}
          sublabel={formatINRFull(metrics.revenue_at_risk)}
          icon={<AlertCircle size={16} />}
          color="text-red-600"
        />
        <MetricCard
          label="Recovered Revenue"
          value={formatINR(metrics.recovered_revenue)}
          sublabel={formatINRFull(metrics.recovered_revenue)}
          icon={<DollarSign size={16} />}
          color="text-green-600"
        />
        <MetricCard
          label="Incremental Recovery"
          value={formatINR(metrics.incremental_recovery)}
          sublabel="Direct + Assisted"
          icon={<TrendingUp size={16} />}
          color="text-indigo-600"
        />
        <MetricCard
          label="Recovery Rate"
          value={formatPct(metrics.recovery_rate)}
          sublabel="Of observed outcomes"
          icon={<Activity size={16} />}
          color="text-blue-600"
        />
        <MetricCard
          label="Active Workflows"
          value={String(metrics.active_workflows)}
          sublabel="Open recovery sessions"
          icon={<Zap size={16} />}
          color="text-purple-600"
        />
        <MetricCard
          label="Net Recovery ROI"
          value={metrics.recovered_revenue > 0 ? `${(metrics.incremental_recovery / Math.max(metrics.active_workflows * 500, 1)).toFixed(1)}x` : '—'}
          sublabel="Incremental / recovery cost"
          icon={<Shield size={16} />}
          color="text-emerald-600"
        />
      </div>

      {/* Secondary Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Failures by Type */}
        <Card title="Failures by Type">
          {failuresByType && Object.keys(failuresByType).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(failuresByType).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
                const max = Math.max(...Object.values(failuresByType));
                const pct = (count / max) * 100;
                return (
                  <div key={type}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{type}</span>
                      <span className="text-gray-500">{count}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState message="No failure data" />
          )}
        </Card>

        {/* Recovery Funnel */}
        <Card title="Recovery Funnel">
          {funnel && Object.keys(funnel).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(funnel).sort((a, b) => b[1] - a[1]).map(([state, count]) => (
                <div key={state} className="flex items-center justify-between">
                  <Badge className={stateColor(state)}>{state}</Badge>
                  <span className="text-sm font-semibold text-gray-700">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No funnel data" />
          )}
        </Card>

        {/* Attribution Breakdown */}
        <Card title="Attribution Breakdown">
          {attributionEntries.length > 0 ? (
            <div className="space-y-3">
              {attributionEntries.map(([attr, amount]) => (
                <div key={attr} className="flex items-center justify-between">
                  <div>
                    <Badge className={`border ${attributionColor(attr)}`}>{attr}</Badge>
                    <div className="text-xs text-gray-400 mt-1">{formatINRFull(amount)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-gray-900">{formatINR(amount)}</div>
                    <div className="text-xs text-gray-400">{totalAttribution > 0 ? formatPct(amount / totalAttribution) : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No attribution data yet" />
          )}
        </Card>
      </div>

      {/* Audit Timeline */}
      <Card title="Audit Timeline" actions={<button onClick={refresh} className="text-xs text-indigo-600 hover:underline">Refresh</button>}>
        {auditTimeline.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {auditTimeline.slice(0, 30).map((event) => (
              <div key={event.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="text-xs text-gray-400 w-20 shrink-0">{formatTime(event.timestamp)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800">{event.event_type}</span>
                    {event.recovery_session_id && (
                      <span className="text-xs text-gray-400 truncate">{event.recovery_session_id.slice(0, 12)}...</span>
                    )}
                  </div>
                  {event.customer_id && (
                    <div className="text-xs text-gray-400">{event.customer_id}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="No audit events yet" />
        )}
      </Card>
    </div>
  );
}
