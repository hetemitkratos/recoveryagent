// Formatting utilities for the dashboard

/** Format paise (integer) to INR currency string */
export function formatINR(paise: number): string {
  const rupees = paise / 100;
  if (rupees >= 10000000) return `\u20B9${(rupees / 10000000).toFixed(2)}Cr`;
  if (rupees >= 100000) return `\u20B9${(rupees / 100000).toFixed(2)}L`;
  if (rupees >= 1000) return `\u20B9${(rupees / 1000).toFixed(1)}K`;
  return `\u20B9${rupees.toFixed(0)}`;
}

/** Format paise to full INR string (no abbreviation) */
export function formatINRFull(paise: number): string {
  return `\u20B9${(paise / 100).toLocaleString('en-IN')}`;
}

/** Format a percentage (0-1 → "XX%") */
export function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/** Format a percentage point value (55 → "+55pp") */
export function formatPp(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}pp`;
}

/** Format ISO timestamp to short time */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** Format ISO timestamp to short date-time */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** State color mapping */
export function stateColor(state: string): string {
  const colors: Record<string, string> = {
    AT_RISK: 'bg-gray-100 text-gray-700',
    DIAGNOSING: 'bg-blue-100 text-blue-700',
    SAFE_RETRY: 'bg-yellow-100 text-yellow-700',
    OUTREACH: 'bg-purple-100 text-purple-700',
    PAYMENT_PENDING: 'bg-indigo-100 text-indigo-700',
    PTP_WAIT: 'bg-cyan-100 text-cyan-700',
    RECOVERED: 'bg-green-100 text-green-700',
    ESCALATED: 'bg-orange-100 text-orange-700',
    STOPPED: 'bg-red-100 text-red-700',
    HUMAN_REVIEW: 'bg-amber-100 text-amber-700',
  };
  return colors[state] || 'bg-gray-100 text-gray-700';
}

/** Attribution color mapping */
export function attributionColor(attr: string): string {
  const colors: Record<string, string> = {
    DIRECT: 'bg-green-100 text-green-700 border-green-200',
    ASSISTED: 'bg-blue-100 text-blue-700 border-blue-200',
    ORGANIC: 'bg-gray-100 text-gray-700 border-gray-200',
    UNKNOWN: 'bg-red-100 text-red-700 border-red-200',
  };
  return colors[attr] || 'bg-gray-100 text-gray-700 border-gray-200';
}

/** Diagnosis color mapping */
export function diagnosisColor(diagnosis: string | null): string {
  if (!diagnosis) return 'text-gray-400';
  const colors: Record<string, string> = {
    TECHNICAL: 'text-blue-600',
    BUSINESS: 'text-purple-600',
    AUTHENTICATION: 'text-orange-600',
    ABANDONMENT: 'text-yellow-600',
    RECURRING_PAYMENT_FAILURE: 'text-indigo-600',
    UNKNOWN: 'text-red-600',
  };
  return colors[diagnosis] || 'text-gray-600';
}
