import type { RecoverySession } from '../entities/recovery-session.js';
import type { Payment } from '../entities/payment.js';
import type { RecoveryAction } from '../entities/recovery-action.js';
import type { AttributionClass } from '../entities/recovery-outcome.js';

export interface AttributionContext {
  session: RecoverySession;
  payment: Payment;
  actions: RecoveryAction[];
  payment_route?: 'RECOVERY_LINK' | 'DIRECT' | 'OTHER';
  intervention_time?: Date;
  payment_time: Date;
  attribution_window_hours: number;
}

export class AttributionEngine {
  calculate(ctx: AttributionContext): { attribution: AttributionClass; evidence: string } {
    if (ctx.payment_route === 'RECOVERY_LINK') {
      return { attribution: 'DIRECT', evidence: 'PAYMENT_LINK_CLICKED' };
    }

    const hasQualifyingIntervention = ctx.actions.some(a => 
      (a.action_type === 'MESSAGE' || a.action_type === 'PAYMENT_LINK') && a.status === 'SUCCEEDED'
    );
    
    if (hasQualifyingIntervention) {
      // Find first intervention time
      const firstIntervention = ctx.actions.find(a => 
        (a.action_type === 'MESSAGE' || a.action_type === 'PAYMENT_LINK') && a.status === 'SUCCEEDED'
      )?.executed_at;
      
      if (firstIntervention) {
        const msDiff = ctx.payment_time.getTime() - firstIntervention.getTime();
        const hoursDiff = msDiff / (1000 * 60 * 60);
        
        if (hoursDiff <= ctx.attribution_window_hours) {
          return { attribution: 'ASSISTED', evidence: 'INTERVENTION_WITHIN_WINDOW' };
        }
      }
    }

    if (ctx.session.state === 'AT_RISK' || !hasQualifyingIntervention) {
      return { attribution: 'ORGANIC', evidence: 'NO_QUALIFYING_INTERVENTION' };
    }

    return { attribution: 'UNKNOWN', evidence: 'INSUFFICIENT_DATA' };
  }
}
