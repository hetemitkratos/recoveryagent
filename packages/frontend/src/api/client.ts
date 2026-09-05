// API client for the AI Revenue Recovery backend

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  const json = await resp.json();
  if (!resp.ok) {
    throw new Error(json?.error?.message || `HTTP ${resp.status}`);
  }
  return json.data as T;
}

// ---- Types ----

export interface DashboardMetrics {
  revenue_at_risk: number;
  recovered_revenue: number;
  incremental_recovery: number;
  recovery_rate: number;
  active_workflows: number;
  attribution_breakdown: Record<string, number>;
}

export interface RecoverySession {
  id: string;
  customer_id: string;
  payment_id: string | null;
  subscription_id: string | null;
  state: string;
  risk_score: number;
  recovery_probability: number;
  expected_recoverable_revenue: number;
  diagnosis: string | null;
  diagnosis_confidence: number | null;
  attempt_count: number;
  communication_count: number;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  closure_reason: string | null;
}

export interface RecoveryAction {
  id: string;
  recovery_session_id: string;
  action_type: string;
  reason: string;
  source: string;
  status: string;
  provider_reference: string | null;
  executed_at: string | null;
  completed_at: string | null;
  failure_reason: string | null;
  created_at: string;
}

export interface RecoveryOutcome {
  id: string;
  recovery_session_id: string;
  result: string;
  payment_id: string;
  amount_recovered: number;
  currency: string;
  attribution: string;
  attribution_evidence: string | null;
  observed_at: string;
}

export interface AuditEvent {
  id: string;
  event_type: string;
  recovery_session_id: string | null;
  customer_id: string | null;
  payment_id: string | null;
  actor: string;
  payload: Record<string, unknown>;
  timestamp: string;
  hash: string;
  previous_hash: string;
  is_demo: boolean;
}

export interface DecisionTrace {
  session: RecoverySession;
  actions: RecoveryAction[];
  outcomes: RecoveryOutcome[];
  audit_events: AuditEvent[];
}

export interface ExperimentResult {
  experiment_id: string;
  control: { count: number; recovered: number; recovery_rate: number; recovered_revenue: number };
  treatment: { count: number; recovered: number; recovery_rate: number; recovered_revenue: number };
  incremental_recovered_revenue: number;
  incremental_lift_pp: number;
  roi: number;
}

export interface SeedResult {
  customers_created: number;
  payments_created: number;
  recovery_opportunities: number;
}

export interface SimulateFailureResult {
  payment_id: string;
  customer_id: string;
  recovery_session_id: string | null;
  state: string | null;
}

export interface SimulatePaymentResult {
  payment_id: string;
  recovered: boolean;
  attribution: string | null;
  amount_recovered: number;
}

// ---- API calls ----

export const api = {
  // Dashboard
  getMetrics: () => request<DashboardMetrics>('/dashboard/metrics'),
  getFailuresByType: () => request<Record<string, number>>('/dashboard/failures-by-type'),
  getRecoveryFunnel: () => request<Record<string, number>>('/dashboard/recovery-funnel'),
  getGuardrailEvents: () => request<AuditEvent[]>('/dashboard/guardrail-events'),
  getAuditTimeline: () => request<AuditEvent[]>('/dashboard/audit-timeline'),
  getBestInterventions: () => request<Array<{ action_type: string; total: number; succeeded: number; success_rate: number }>>('/dashboard/best-interventions'),

  // Recovery
  getSessions: () => request<RecoverySession[]>('/recovery'),
  getSession: (id: string) => request<RecoverySession>(`/recovery/${id}`),
  getTrace: (id: string) => request<DecisionTrace>(`/recovery/${id}/trace`),
  executeAction: (id: string, action_type: string) =>
    request<{ success: boolean }>(`/recovery/${id}/actions`, {
      method: 'POST',
      body: JSON.stringify({ action_type }),
    }),

  // Demo
  reset: () => request<{ success: boolean; message: string }>('/demo/reset', { method: 'POST', body: '{}' }),
  seed: (seed = 42, count = 100) =>
    request<SeedResult>('/demo/seed', { method: 'POST', body: JSON.stringify({ seed, count }) }),
  simulateFailure: (params: { amount?: number; failure_class?: string; failure_code?: string }) =>
    request<SimulateFailureResult>('/demo/simulate/failure', { method: 'POST', body: JSON.stringify(params) }),
  simulatePayment: (payment_id: string, route: 'RECOVERY_LINK' | 'DIRECT' | 'OTHER' = 'RECOVERY_LINK') =>
    request<SimulatePaymentResult>('/demo/simulate/payment', { method: 'POST', body: JSON.stringify({ payment_id, route }) }),
  simulatePTP: (recovery_id: string, promised_date?: string, source_text?: string) =>
    request<{ ptp_id: string; recovery_session_id: string; promised_date: string; status: string }>('/demo/simulate/ptp', {
      method: 'POST',
      body: JSON.stringify({ recovery_id, promised_date, source_text }),
    }),
  simulateOptOut: (recovery_id: string) =>
    request<{ recovery_session_id: string; state: string }>('/demo/simulate/optout', {
      method: 'POST',
      body: JSON.stringify({ recovery_id }),
    }),
  runExperiment: (seed = 42, control_size = 50, treatment_size = 50) =>
    request<ExperimentResult>('/demo/experiment', {
      method: 'POST',
      body: JSON.stringify({ seed, control_size, treatment_size }),
    }),
};
