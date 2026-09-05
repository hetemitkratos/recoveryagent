import React, { useEffect, useState, useCallback } from 'react';
import { api, type DecisionTrace } from '../api/client';
import { Card, Badge, Button, LoadingSpinner, EmptyState } from '../components/ui';
import { formatINR, formatINRFull, formatPct, formatDateTime, stateColor, attributionColor, diagnosisColor } from '../lib/format';
import { ArrowLeft, CheckCircle, XCircle, Clock, Shield, Brain, Cog, Send, DollarSign, AlertCircle } from 'lucide-react';

interface Props {
  sessionId: string;
  onBack: () => void;
}

export function RecoveryDetailPage({ sessionId, onBack }: Props) {
  const [trace, setTrace] = useState<DecisionTrace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const data = await api.getTrace(sessionId);
      setTrace(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading) return <LoadingSpinner />;
  if (error) return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack}><ArrowLeft size={16} className="inline mr-1" /> Back</Button>
      <EmptyState message={error} />
    </div>
  );
  if (!trace) return <EmptyState message="Session not found" />;

  const { session, actions, outcomes, audit_events } = trace;
  const outcome = outcomes[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack}><ArrowLeft size={16} /> Back</Button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-gray-900">Recovery Session</h2>
          <p className="text-xs text-gray-400 font-mono">{session.id}</p>
        </div>
        <Badge className={stateColor(session.state)}>{session.state}</Badge>
      </div>

      {/* Decision Trace — the hero panel */}
      <Card title="Decision Trace">
        <div className="space-y-0">
          {/* Step 1: Failure */}
          <TraceStep
            icon={<AlertCircle size={16} />}
            label="Payment Failed"
            color="text-red-600 bg-red-50"
            detail={
              <div className="flex items-center gap-4">
                <span className="text-lg font-bold text-gray-900">{formatINR(session.expected_recoverable_revenue > 0 ? session.expected_recoverable_revenue / session.recovery_probability : 0)} at risk</span>
                <span className="text-sm text-gray-500">Customer: {session.customer_id}</span>
              </div>
            }
          />

          {/* Step 2: Diagnosis */}
          <TraceStep
            icon={<Brain size={16} />}
            label="Diagnosis"
            color="text-purple-600 bg-purple-50"
            detail={
              <div className="flex items-center gap-3">
                <span className={`font-semibold ${diagnosisColor(session.diagnosis)}`}>{session.diagnosis || 'UNKNOWN'}</span>
                {session.diagnosis_confidence != null && (
                  <Badge className="bg-purple-100 text-purple-700">Confidence: {formatPct(session.diagnosis_confidence)}</Badge>
                )}
              </div>
            }
          />

          {/* Step 3: Risk Assessment */}
          <TraceStep
            icon={<Cog size={16} />}
            label="Risk Assessment"
            color="text-blue-600 bg-blue-50"
            detail={
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-xs text-gray-400">Risk Score</div>
                  <div className="font-semibold text-gray-900">{session.risk_score}/100</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">P(Recovery)</div>
                  <div className="font-semibold text-gray-900">{formatPct(session.recovery_probability)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Expected Recoverable</div>
                  <div className="font-semibold text-indigo-600">{formatINR(session.expected_recoverable_revenue)}</div>
                </div>
              </div>
            }
          />

          {/* Step 4: AI Recommendation */}
          <TraceStep
            icon={<Brain size={16} />}
            label="AI Recommendation"
            color="text-indigo-600 bg-indigo-50"
            detail={
              actions.length > 0 ? (
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-900">{actions[0].action_type}</span>
                  <Badge className="bg-indigo-100 text-indigo-700">{actions[0].source}</Badge>
                  <span className="text-xs text-gray-400">{actions[0].reason}</span>
                </div>
              ) : (
                <span className="text-sm text-gray-400">No action recommended (blocked or human review)</span>
              )
            }
          />

          {/* Step 5: Policy Decision */}
          <TraceStep
            icon={<Shield size={16} />}
            label="Policy Decision"
            color="text-green-600 bg-green-50"
            detail={
              actions.length > 0 ? (
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-green-600" />
                  <span className="font-semibold text-green-700">ALLOW</span>
                  <span className="text-xs text-gray-400">— Policy approved the action</span>
                </div>
              ) : session.state === 'HUMAN_REVIEW' ? (
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-amber-600" />
                  <span className="font-semibold text-amber-700">HUMAN_REVIEW</span>
                  <span className="text-xs text-gray-400">— Low confidence or high-value threshold</span>
                </div>
              ) : session.state === 'STOPPED' ? (
                <div className="flex items-center gap-2">
                  <XCircle size={16} className="text-red-600" />
                  <span className="font-semibold text-red-700">BLOCKED</span>
                  <span className="text-xs text-gray-400">— {session.closure_reason || 'Policy blocked'}</span>
                </div>
              ) : (
                <span className="text-sm text-gray-400">Pending</span>
              )
            }
          />

          {/* Step 6: Action Executed */}
          {actions.length > 0 && (
            <TraceStep
              icon={<Send size={16} />}
              label="Action Executed"
              color="text-purple-600 bg-purple-50"
              detail={
                <div className="space-y-1">
                  {actions.map(a => (
                    <div key={a.id} className="flex items-center gap-3 text-sm">
                      <span className="font-medium text-gray-900">{a.action_type}</span>
                      {a.status === 'SUCCEEDED' ? (
                        <Badge className="bg-green-100 text-green-700"><CheckCircle size={12} className="inline mr-1" />{a.status}</Badge>
                      ) : a.status === 'FAILED' ? (
                        <Badge className="bg-red-100 text-red-700"><XCircle size={12} className="inline mr-1" />{a.status}</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-700">{a.status}</Badge>
                      )}
                      {a.provider_reference && <span className="text-xs text-gray-400 font-mono">{a.provider_reference}</span>}
                    </div>
                  ))}
                </div>
              }
            />
          )}

          {/* Step 7: Outcome */}
          {outcome && (
            <TraceStep
              icon={<DollarSign size={16} />}
              label="Outcome"
              color="text-green-600 bg-green-50"
              detail={
                <div className="flex items-center gap-4">
                  <CheckCircle size={20} className="text-green-600" />
                  <span className="text-lg font-bold text-green-700">{formatINRFull(outcome.amount_recovered)} recovered</span>
                  <Badge className={`border ${attributionColor(outcome.attribution)}`}>{outcome.attribution}</Badge>
                  <span className="text-xs text-gray-400">{outcome.attribution_evidence}</span>
                </div>
              }
              last
            />
          )}
        </div>
      </Card>

      {/* Session Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Session Details">
          <dl className="space-y-2 text-sm">
            <DetailRow label="Customer" value={session.customer_id} mono />
            <DetailRow label="Payment" value={session.payment_id || '—'} mono />
            <DetailRow label="State" value={<Badge className={stateColor(session.state)}>{session.state}</Badge>} />
            <DetailRow label="Diagnosis" value={session.diagnosis || '—'} />
            <DetailRow label="Risk Score" value={String(session.risk_score)} />
            <DetailRow label="Recovery Probability" value={formatPct(session.recovery_probability)} />
            <DetailRow label="Expected Recoverable" value={formatINRFull(session.expected_recoverable_revenue)} />
            <DetailRow label="Attempts" value={String(session.attempt_count)} />
            <DetailRow label="Communications" value={String(session.communication_count)} />
            <DetailRow label="Created" value={formatDateTime(session.created_at)} />
            {session.closed_at && <DetailRow label="Closed" value={formatDateTime(session.closed_at)} />}
            {session.closure_reason && <DetailRow label="Closure Reason" value={session.closure_reason} />}
          </dl>
        </Card>

        {/* Audit Timeline */}
        <Card title="Audit Timeline">
          {audit_events.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {audit_events.map((event, idx) => (
                <div key={event.id} className="relative pl-6 pb-3">
                  {idx < audit_events.length - 1 && (
                    <div className="absolute left-2 top-4 bottom-0 w-px bg-gray-200" />
                  )}
                  <div className="absolute left-0 top-1 w-4 h-4 rounded-full bg-indigo-100 border-2 border-indigo-400" />
                  <div className="text-sm font-medium text-gray-800">{event.event_type}</div>
                  <div className="text-xs text-gray-400">{formatDateTime(event.timestamp)}</div>
                  {event.payload && Object.keys(event.payload).length > 0 && (
                    <pre className="text-xs text-gray-500 bg-gray-50 rounded p-2 mt-1 overflow-x-auto">
                      {JSON.stringify(event.payload, null, 2)}
                    </pre>
                  )}
                  <div className="text-xs text-gray-300 font-mono mt-1">hash: {event.hash.slice(0, 16)}...</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No audit events" />
          )}
        </Card>
      </div>
    </div>
  );
}

function TraceStep({ icon, label, color, detail, last }: {
  icon: React.ReactNode;
  label: string;
  color: string;
  detail: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className="flex gap-4 pb-6 relative">
      {!last && <div className="absolute left-4 top-10 bottom-0 w-px bg-gray-200" />}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-700 mb-1">{label}</div>
        {detail}
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <dt className="text-gray-500">{label}</dt>
      <dd className={`font-medium text-gray-900 ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}


