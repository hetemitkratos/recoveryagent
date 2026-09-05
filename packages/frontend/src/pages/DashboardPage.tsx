import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../components/ui/Card';
import { formatINRCompact } from '../lib/utils';
import { Zap, Activity, TrendingUp, AlertCircle, RefreshCw, ShieldAlert } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api } from '../api/client';
import { Link } from 'react-router-dom';

export function DashboardPage() {
  const { data: metrics } = useQuery({
    queryKey: ['dashboardMetrics'],
    queryFn: () => api.getMetrics(true),
    refetchInterval: 5000,
  });

  const { data: failures } = useQuery({
    queryKey: ['dashboardFailures'],
    queryFn: () => api.getFailuresByType(),
    refetchInterval: 10000,
  });
  
  const { data: guardrails } = useQuery({
    queryKey: ['dashboardGuardrails'],
    queryFn: () => api.getGuardrailEvents(),
    refetchInterval: 5000,
  });

  const failureData = failures ? Object.entries(failures).map(([key, val]) => ({ name: key.substring(0, 4), fullName: key, value: val as number })) : [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-black mb-2">Overview Panel</h1>
          <p className="text-content-muted font-medium">Financial Control Room based on all clients</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm font-medium text-content-muted flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin-slow" /> Auto-updating
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card variant="brand" className="col-span-1 md:col-span-2 flex flex-col justify-between overflow-hidden relative">
          <div className="flex items-center gap-2 font-medium text-black/70 mb-4 uppercase tracking-wider text-sm">
            <Zap className="w-4 h-4" /> Account Insights
          </div>
          <div className="z-10">
            <h2 className="text-3xl font-semibold leading-tight tracking-tight max-w-sm">
              AI automation successfully recovered <span className="font-bold">{formatINRCompact(metrics?.recovered_revenue || 0)}</span> in revenue.
            </h2>
          </div>
          <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-white/20 blur-3xl rounded-full" />
        </Card>

        <Card className="flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 text-content-muted text-sm font-medium mb-4">
            <AlertCircle className="w-4 h-4" /> Revenue at Risk
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-4xl font-bold tracking-tight">{formatINRCompact(metrics?.revenue_at_risk || 0)}</span>
          </div>
          <div className="mt-4 w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-red-500 w-1/3 h-full rounded-full" />
          </div>
        </Card>

        <Card className="flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-content-muted text-sm font-medium mb-4">
            <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Incremental Recovery</div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-4xl font-bold tracking-tight">{formatINRCompact(metrics?.incremental_recovery || 0)}</span>
          </div>
          <div className="mt-4 w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-brand-dark w-2/3 h-full rounded-full relative">
               <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full" />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-2 hover:shadow-md transition-shadow">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><Activity className="w-5 h-5 text-content-muted"/> Failures by Type</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={failureData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {failureData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.name === 'BIZ' ? '#f59e0b' : entry.name === 'TECH' ? '#3b82f6' : '#10b981'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="flex flex-col relative overflow-hidden hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
            <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 font-bold text-xs"><ShieldAlert className="w-4 h-4"/></div>
            <div>
              <h3 className="font-bold text-sm">Policy Interventions</h3>
              <p className="text-xs text-content-muted">Guardrail Events</p>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
             {!guardrails || guardrails.length === 0 ? (
               <div className="text-sm text-content-muted italic">No recent policy blocks.</div>
             ) : (
               guardrails.map((evt: any) => (
                 <div key={evt.id} className="text-sm bg-gray-50 rounded-2xl p-3 border border-border">
                   <div className="flex justify-between items-start mb-1">
                     <span className="font-bold text-[10px] text-amber-600 uppercase tracking-wider">{evt.event_type}</span>
                     <span className="text-[10px] text-content-muted">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                   </div>
                   <p className="text-xs text-content-muted mt-1 break-words">
                     {evt.payload?.blocking_reasons?.join(', ') || evt.payload?.reason || JSON.stringify(evt.payload)}
                   </p>
                 </div>
               ))
             )}
          </div>
          
          <div className="mt-auto pt-4 border-t border-border">
            <Link to="/queue" className="w-full text-sm font-semibold text-center text-content-muted hover:text-black block">Review Session Queue →</Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
