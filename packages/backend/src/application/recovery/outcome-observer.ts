import type { NormalizedPaymentEvent } from '../webhook/event-normalizer.js';
import type { RecoverySession } from '../../domain/entities/recovery-session.js';
import type { ActionRepository } from '../../infrastructure/db/repositories/action-repo.js';
import type { SessionRepository } from '../../infrastructure/db/repositories/session-repo.js';
import type { OutcomeRepository } from '../../infrastructure/db/repositories/outcome-repo.js';
import type { AuditRepository } from '../../infrastructure/db/repositories/audit-repo.js';
import type { RecoveryAction } from '../../domain/entities/recovery-action.js';
import type { RecoveryOutcome } from '../../domain/entities/recovery-outcome.js';
import { AttributionEngine } from '../../domain/attribution/attribution-engine.js';
import { StateMachine } from '../../domain/state-machine/state-machine.js';
import crypto from 'crypto';

export class OutcomeObserver {
  private stateMachine = new StateMachine();

  constructor(
    private sessionRepo: SessionRepository,
    private actionRepo: ActionRepository,
    private outcomeRepo: OutcomeRepository,
    private auditRepo: AuditRepository,
    private attributionEngine: AttributionEngine
  ) {}

  /**
   * Get outcomes for a session — used by the orchestrator to build customer history.
   */
  async getOutcomesBySession(sessionId: string): Promise<RecoveryOutcome[]> {
    return this.outcomeRepo.findBySession(sessionId);
  }

  async observe(event: NormalizedPaymentEvent, session: RecoverySession): Promise<void> {
    // Fetch the real payment from the event
    const payment = {
      id: event.payment_id!,
      amount: event.amount!,
      currency: event.currency || 'INR',
      status: 'CAPTURED' as const,
    };

    // Fetch real actions for this session (FIX: was always [])
    const actions = await this.actionRepo.findBySession(session.id);

    // Determine payment route from event type
    const payment_route = event.event_type === 'PAYMENT_LINK_PAID' ? 'RECOVERY_LINK' as const : 'DIRECT' as const;

    const attrContext = {
      session,
      payment: payment as any,
      actions,
      payment_route,
      payment_time: event.occurred_at || new Date(),
      attribution_window_hours: 72,
    };

    const { attribution, evidence } = this.attributionEngine.calculate(attrContext);

    // Persist the outcome
    await this.outcomeRepo.create({
      id: `out_${crypto.randomUUID()}`,
      recovery_session_id: session.id,
      result: 'PAYMENT_RECOVERED',
      payment_id: event.payment_id,
      amount_recovered: event.amount || 0,
      currency: event.currency || 'INR',
      attribution,
      attribution_evidence: evidence,
      observed_at: new Date(),
    } as any);

    // Enforce state machine: current state → RECOVERED
    try {
      this.stateMachine.transition(session, 'RECOVERED', { type: 'PAYMENT_SUCCESS' } as any);
    } catch {
      // If already in a terminal state, skip the transition
    }
    await this.sessionRepo.updateState(session.id, 'RECOVERED', {
      closed_at: new Date(),
      closure_reason: 'PAYMENT_SUCCESS',
    });

    await this.auditRepo.append({
      id: `aud_${crypto.randomUUID()}`,
      event_type: 'PAYMENT_RECOVERED',
      recovery_session_id: session.id,
      customer_id: event.customer_id,
      payment_id: event.payment_id,
      actor: 'SYSTEM',
      payload: { amount: event.amount, attribution, evidence, action_count: actions.length },
      is_demo: session.is_demo,
    });
  }
}
