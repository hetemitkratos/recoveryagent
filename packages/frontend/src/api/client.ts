export const getApiKey = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const paramKey = urlParams.get('api_key');
  if (paramKey) {
    localStorage.setItem('recovery_api_key', paramKey);
    window.history.replaceState({}, document.title, window.location.pathname);
    return paramKey;
  }
  const localKey = localStorage.getItem('recovery_api_key');
  if (localKey) return localKey;
  
  // Safe cast for Vite environment variables
  const envKey = (import.meta as any).env?.VITE_API_KEY;
  if (envKey) return envKey;
  
  return null;
};

class ApiClient {
  private baseUrl = '/api';

  private async fetch(path: string, options: RequestInit = {}) {
    const apiKey = getApiKey();
    const headers = new Headers(options.headers || {});
    
    headers.set('Content-Type', 'application/json');
    if (apiKey) {
      headers.set('x-api-key', apiKey);
    }

    const response = await window.fetch(`${this.baseUrl}${path}`, { ...options, headers });

    if (response.status === 401) {
      window.dispatchEvent(new Event('api:unauthorized'));
    }

    const json = await response.json();
    if (!response.ok || json.error) {
      throw new Error(json.error?.message || response.statusText);
    }

    return json.data;
  }

  getMetrics(isDemo?: boolean) { return this.fetch(`/dashboard/metrics${isDemo !== undefined ? `?is_demo=${isDemo}` : ''}`); }
  getFailuresByType() { return this.fetch('/dashboard/failures-by-type'); }
  getRecoveryFunnel() { return this.fetch('/dashboard/recovery-funnel'); }
  getGuardrailEvents() { return this.fetch('/dashboard/guardrail-events'); }
  getAuditTimeline() { return this.fetch('/dashboard/audit-timeline'); }
  getBestInterventions() { return this.fetch('/dashboard/best-interventions'); }
  getSystemStatus() { return this.fetch('/system/status'); }
  getSessions(limit = 50, offset = 0) { return this.fetch(`/recovery?limit=${limit}&offset=${offset}`); }
  getSession(id: string) { return this.fetch(`/recovery/${id}`); }
  getTrace(id: string) { return this.fetch(`/recovery/${id}/trace`); }
  executeAction(id: string, action_type: string) { return this.fetch(`/recovery/${id}/actions`, { method: 'POST', body: JSON.stringify({ action_type }) }); }
  syncPayment(id: string) { return this.fetch(`/recovery/${id}/sync-payment`, { method: 'POST' }); }
  getPtpList(status = 'ACTIVE', limit = 50) { return this.fetch(`/ptp?status=${status}&limit=${limit}`); }
  addPtpReply(id: string, text: string, source: string) { return this.fetch(`/recovery/${id}/ptp-reply`, { method: 'POST', body: JSON.stringify({ source_text: text, source }) }); }
  resetDemo() { return this.fetch('/demo/reset', { method: 'POST' }); }
  seedDemo(seed = 42, count = 50) { return this.fetch('/demo/seed', { method: 'POST', body: JSON.stringify({ seed, count }) }); }
  simulateFailure(payload: any) { return this.fetch('/demo/simulate/failure', { method: 'POST', body: JSON.stringify(payload) }); }
  runExperiment(payload: any) { return this.fetch('/demo/experiment', { method: 'POST', body: JSON.stringify(payload) }); }
}

export const api = new ApiClient();
