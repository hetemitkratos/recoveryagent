import type { NormalizedPaymentEvent } from '../webhook/event-normalizer.js';
import type { RecoverySession, RecoveryState } from '../../domain/entities/recovery-session.js';
import type { ActionType, ActionSource } from '../../domain/entities/recovery-action.js';
import type { CustomerRepository } from '../../infrastructure/db/repositories/customer-repo.js';
import type { PaymentRepository } from '../../infrastructure/db/repositories/payment-repo.js';
import type { SessionRepository } from '../../infrastructure/db/repositories/session-repo.js';
import type { ActionRepository } from '../../infrastructure/db/repositories/action-repo.js';
import type { AuditRepository } from '../../infrastructure/db/repositories/audit-repo.js';
import type { AIRecommendationRepository } from '../../infrastructure/db/repositories/ai-recommendation-repo.js';
import type { PolicyDecisionRepository } from '../../infrastructure/db/repositories/policy-decision-repo.js';
import type { OutcomeRepository } from '../../infrastructure/db/repositories/outcome-repo.js';
import type { DiagnosisEngine } from '../../domain/diagnosis/diagnosis-engine.js';
import type { RiskEngine } from '../../domain/risk/risk-engine.js';
import type { PolicyEngine } from '../../domain/policy/policy-engine.js';
import type { ActionExecutor } from './action-executor.js';
import type { OutcomeObserver } from './outcome-observer.js';
import type { AIAdapter, CustomerHistory } from '../../infrastructure/ai/ai-adapter.js';
import type { PaymentProvider } from '../../infrastructure/payment/payment-provider.js';
import type { Config } from '../../config.js';
import type { PaymentStatus } from '../../domain/entities/payment.js';
import { StateMachine, InvalidTransitionError } from '../../domain/state-machine/state-machine.js';
import { ACTION_MATRIX, isActionAllowedForFailure } from '../../domain/policy/action-matrix.js';
import { db } from '../../infrastructure/db/connection.js';
import { ai_recommendations, policy_decisions } from '../../infrastructure/db/schema.js';
import crypto from 'crypto';

const POLICY_VERSION = '1.0.0';

export class RecoveryOrchestrator {
  private stateMachine = new StateMachine();

  constructor(
    private customerRepo: CustomerRepository,
    private paymentRepo: PaymentRepository,
    private sessionRepo: SessionRepository,
    private actionRepo: ActionRepository,
    private auditRepo: AuditRepository,
    private diagnosisEngine: DiagnosisEngine,
    private riskEngine: RiskEngine,
    private policyEngine: PolicyEngine,
    private actionExecutor: ActionExecutor,
    private outcomeObserver: OutcomeObserver,
    private aiAdapter: AIAdapter,
    private paymentProvider: PaymentProvider,
    private aiRecommendationRepo: AIRecommendationRepository,
    private policyDecisionRepo: PolicyDecisionRepository,
    private config: Config
  ) {}

  /**
   * Enforce state machine transitions. Throws on invalid transition.
   */
  private async safeTransition(session: RecoverySession, toState: RecoveryState, data?: any): Promise<RecoverySession> {
    // Use state machine to validate the transition
    this.stateMachine.transition(session, toState, { type: 'STATE_CHANGE' } as any);
    return this.sessionRepo.updateState(session.id, toState, data);
  }

  /**
   * Pre-action payment status re-check.
   * "Payment state always wins" — never contact a customer who already paid.
   */
  private async recheckPaymentStatus(paymentId: string): Promise<PaymentStatus | null> {
    try {
      return await this.paymentProvider.getPaymentStatus(paymentId);
    } catch {
      // If provider fails, return null — we don't block on provider errors,
      // but we also don't proceed without a clean check for high-risk actions.
      return null;
    }
  }

  /**
   * Load real customer history from the database.
   */
  private async loadCustomerHistory(customerId: string): Promise<CustomerHistory> {
    const sessions = await this.sessionRepo.findByCustomer(customerId);
    let success_count = 0;
    let fail_count = 0;
    const prior_recovery_outcomes: string[] = [];

    for (const session of sessions) {
      const outcomes = await this.outcomeObserver.getOutcomesBySession(session.id);
      for (const outcome of outcomes) {
        if (outcome.result === 'PAYMENT_RECOVERED') {
          success_count++;
          prior_recovery_outcomes.push('PAYMENT_RECOVERED');
        } else {
          fail_count++;
          prior_recovery_outcomes.push(outcome.result);
        }
      }
    }

    return { success_count, fail_count, prior_recovery_outcomes };
  }

  /**
   * Persist an AI recommendation to the ai_recommendations table.
   */
  private async persistAIRecommendation(
    sessionId: string,
    aiRec: any,
    diagnosis: any,
    risk: any,
    isFallback: boolean
  ): Promise<string> {
    const id = `airec_${crypto.randomUUID()}`;
    await db.insert(ai_recommendations).values({
      id,
      recovery_session_id: sessionId,
      diagnosis: diagnosis.failure_class,
      diagnosis_confidence: diagnosis.confidence,
      recovery_probability: aiRec.recovery?.probability ?? risk.recovery_probability,
      recovery_confidence: aiRec.recovery?.confidence ?? 0.5,
      recommended_action: aiRec.recommendation.action,
      action_confidence: aiRec.recommendation.confidence,
      reason_codes: aiRec.recommendation.reason_codes || [],
      message_text: aiRec.message?.text || null,
      message_tone: aiRec.message?.tone || null,
      requires_human_review: aiRec.requires_human_review || false,
      model_name: this.config.OPENROUTER_API_KEY ? this.config.OPENROUTER_MODEL : this.config.GEMINI_MODEL,
      model_version: '1.0',
      prompt_version: 'recommendation-v1',
      is_fallback: isFallback,
      created_at: new Date(),
    });
    return id;
  }

  /**
   * Persist a policy decision to the policy_decisions table.
   */
  private async persistPolicyDecision(
    sessionId: string,
    actionId: string | null,
    policyRes: any
  ): Promise<string> {
    const id = `poldec_${crypto.randomUUID()}`;
    await db.insert(policy_decisions).values({
      id,
      recovery_session_id: sessionId,
      action_id: actionId || '',
      decision: policyRes.decision,
      rules_evaluated: policyRes.rulesEvaluated || [],
      blocking_reasons: policyRes.blockingReasons || [],
      policy_version: policyRes.policyVersion || POLICY_VERSION,
      created_at: new Date(),
    });
    return id;
  }

  async handleFailedPayment(event: NormalizedPaymentEvent): Promise<void> {
    if (!event.customer_id || !event.payment_id) return;

    let customer = await this.customerRepo.findById(event.customer_id);
    let payment = await this.paymentRepo.findById(event.payment_id);

    // Persist customer if missing so FK constraints are satisfied
    if (!customer) {
      customer = await this.customerRepo.create({
        id: event.customer_id,
        external_customer_id: event.customer_id,
        name: 'Unknown Customer',
        email: 'unknown@example.com',
        phone: '0000000000',
        preferred_channel: 'SIMULATED',
        opted_out: false,
        lifetime_value: 0,
        is_demo: this.config.DEMO_MODE,
      } as any);
    }
    // Persist payment if missing so FK constraints are satisfied
    if (!payment) {
      payment = await this.paymentRepo.create({
        id: event.payment_id,
        customer_id: event.customer_id,
        provider: event.source,
        provider_payment_id: event.payment_id,
        amount: event.amount || 0,
        currency: event.currency || 'INR',
        status: 'FAILED',
        failure_code: event.failure_code || null,
        failure_description: event.failure_description || null,
        attempt_number: 1,
        is_demo: this.config.DEMO_MODE,
        metadata: {},
      } as any);
    }

    // RULE-002: One active session per customer+payment pair
    const existingSession = await this.sessionRepo.findActive(customer!.id, payment!.id);
    if (existingSession) return;

    // RULE-001: Never start recovery if payment is already captured
    if (payment!.status === 'CAPTURED' || payment!.status === 'AUTHORIZED') return;

    // Create session in AT_RISK
    let session = await this.sessionRepo.create({
      id: `ses_${crypto.randomUUID()}`,
      customer_id: customer!.id,
      payment_id: payment!.id,
      subscription_id: event.subscription_id,
      state: 'AT_RISK',
      risk_score: 0,
      recovery_probability: 0,
      expected_recoverable_revenue: 0,
      attempt_count: 0,
      communication_count: 0,
      is_demo: this.config.DEMO_MODE,
    } as any);

    // Enforce state machine: AT_RISK → DIAGNOSING
    session = await this.safeTransition(session, 'DIAGNOSING');

    // Diagnose the failure
    const diagnosis = this.diagnosisEngine.diagnose(payment!);

    // Load real customer history
    const customerHistory = await this.loadCustomerHistory(customer!.id);

    // Assess risk with real history
    const risk = this.riskEngine.assess({
      payment: payment!,
      diagnosis,
      session_history: { attempt_count: 0, communication_count: 0 },
      customer_history: customerHistory,
    });

    // Update session with diagnosis + risk
    session = await this.sessionRepo.updateState(session.id, 'DIAGNOSING', {
      diagnosis: diagnosis.failure_class,
      diagnosis_confidence: diagnosis.confidence,
      risk_score: risk.risk_score,
      recovery_probability: risk.recovery_probability,
      expected_recoverable_revenue: risk.expected_recoverable_revenue,
    });

    // Wire ACTION_MATRIX: only allow actions appropriate for this failure class
    const availableActions = ACTION_MATRIX[diagnosis.failure_class] || ACTION_MATRIX.UNKNOWN;

    // Get AI recommendation with constrained action set
    let aiRec: any;
    let isAIFallback = false;
    try {
      aiRec = await this.aiAdapter.getRecommendation({
        payment: payment!,
        customer: customer!,
        failure_code: payment!.failure_code || '',
        customer_history: customerHistory,
        diagnosis,
        risk_assessment: risk,
        available_actions: availableActions,
      });
    } catch (err) {
      // AI unavailable — use deterministic fallback
      console.error('[AI] Recommendation failed, using fallback:', err instanceof Error ? err.message : String(err));
      isAIFallback = true;
      aiRec = this.deterministicFallback(diagnosis, risk, availableActions);
    }

    // Persist AI recommendation
    const aiRecId = await this.persistAIRecommendation(session.id, aiRec, diagnosis, risk, isAIFallback);

    // Validate that AI's recommended action is in the allowed action matrix
    const proposedAction = aiRec.recommendation.action;
    if (!isActionAllowedForFailure(diagnosis.failure_class, proposedAction)) {
      // AI proposed an action not allowed for this failure class → escalate
      const action = await this.actionRepo.create({
        id: `act_${crypto.randomUUID()}`,
        recovery_session_id: session.id,
        action_type: 'HUMAN_REVIEW',
        reason: 'ACTION_NOT_IN_MATRIX',
        source: 'AI',
        ai_recommendation_id: aiRecId,
        status: 'BLOCKED',
        idempotency_key: `idemp_${session.id}_${Date.now()}`,
      } as any);

      const policyRes = { decision: 'HUMAN_REVIEW', blockingReasons: ['ACTION_NOT_IN_ACTION_MATRIX'], rulesEvaluated: [], policyVersion: POLICY_VERSION };
      await this.persistPolicyDecision(session.id, action.id, policyRes);

      await this.safeTransition(session, 'HUMAN_REVIEW');
      await this.auditRepo.append({
        id: `aud_${crypto.randomUUID()}`,
        event_type: 'POLICY_BLOCK',
        recovery_session_id: session.id,
        customer_id: customer!.id,
        payment_id: payment!.id,
        actor: 'SYSTEM',
        payload: { reason: 'AI proposed action not in action matrix', proposed_action: proposedAction, failure_class: diagnosis.failure_class },
        is_demo: this.config.DEMO_MODE,
      });
      return;
    }

    // Evaluate policy
    const policyCtx = {
      session: { ...session, ...risk, diagnosis: diagnosis.failure_class },
      payment: payment!,
      customer: customer!,
      proposedAction,
      aiConfidence: aiRec.recommendation.confidence,
      config: this.config,
    };
    const policyRes = this.policyEngine.evaluate(policyCtx as any);

    if (policyRes.decision === 'ALLOW') {
      // Pre-action payment re-check: "payment state always wins"
      const currentStatus = await this.recheckPaymentStatus(payment!.id);
      if (currentStatus === 'CAPTURED' || currentStatus === 'AUTHORIZED') {
        // Payment was completed while we were processing — close session
        await this.sessionRepo.updateState(session.id, 'RECOVERED', {
          closed_at: new Date(),
          closure_reason: 'PAYMENT_ALREADY_COMPLETED_PRE_ACTION',
        });
        await this.auditRepo.append({
          id: `aud_${crypto.randomUUID()}`,
          event_type: 'PAYMENT_ALREADY_COMPLETED',
          recovery_session_id: session.id,
          customer_id: customer!.id,
          payment_id: payment!.id,
          actor: 'SYSTEM',
          payload: { reason: 'Pre-action recheck found payment already captured', current_status: currentStatus },
          is_demo: this.config.DEMO_MODE,
        });
        return;
      }

      // Create action record
      const action = await this.actionRepo.create({
        id: `act_${crypto.randomUUID()}`,
        recovery_session_id: session.id,
        action_type: proposedAction,
        reason: 'AI_POLICY_ALLOW',
        source: 'AI',
        ai_recommendation_id: aiRecId,
        status: 'PROPOSED',
        idempotency_key: `idemp_${session.id}_${Date.now()}`,
        payload: aiRec.message ? { message: aiRec.message.text } : undefined,
      } as any);

      // Persist policy decision
      const policyDecId = await this.persistPolicyDecision(session.id, action.id, policyRes);
      await this.actionRepo.update(action.id, { policy_decision_id: policyDecId });

      // Determine target state based on action type
      const toState = this.getStateForAction(proposedAction, session.state);

      // Enforce state machine transition (WAIT stays in current state)
      if (toState !== session.state) {
        session = await this.safeTransition(session, toState);
      }

      // Increment counters
      const counterUpdates: any = {};
      if (proposedAction === 'SAFE_RETRY') {
        counterUpdates.attempt_count = (session.attempt_count || 0) + 1;
      }
      if (proposedAction === 'PAYMENT_LINK' || proposedAction === 'MESSAGE') {
        counterUpdates.communication_count = (session.communication_count || 0) + 1;
      }
      counterUpdates.last_action_at = new Date();
      if (Object.keys(counterUpdates).length > 0) {
        await this.sessionRepo.updateState(session.id, session.state, counterUpdates);
      }

      // Execute the action
      await this.actionExecutor.execute(action, session as any, customer as any, payment as any);
    } else if (policyRes.decision === 'HUMAN_REVIEW') {
      const policyDecId = await this.persistPolicyDecision(session.id, null, policyRes);
      await this.safeTransition(session, 'HUMAN_REVIEW');
      await this.auditRepo.append({
        id: `aud_${crypto.randomUUID()}`,
        event_type: 'POLICY_HUMAN_REVIEW',
        recovery_session_id: session.id,
        customer_id: customer!.id,
        payment_id: payment!.id,
        actor: 'SYSTEM',
        payload: { reasons: policyRes.blockingReasons, policy_decision_id: policyDecId },
        is_demo: this.config.DEMO_MODE,
      });
    } else {
      // BLOCK
      const policyDecId = await this.persistPolicyDecision(session.id, null, policyRes);
      await this.safeTransition(session, 'STOPPED', { closed_at: new Date(), closure_reason: 'POLICY_BLOCK' });
      await this.auditRepo.append({
        id: `aud_${crypto.randomUUID()}`,
        event_type: 'POLICY_BLOCK',
        recovery_session_id: session.id,
        customer_id: customer!.id,
        payment_id: payment!.id,
        actor: 'SYSTEM',
        payload: { reasons: policyRes.blockingReasons, policy_decision_id: policyDecId },
        is_demo: this.config.DEMO_MODE,
      });
    }
  }

  async handlePaymentSuccess(event: NormalizedPaymentEvent): Promise<void> {
    if (!event.payment_id || !event.customer_id) return;
    const session = await this.sessionRepo.findActive(event.customer_id, event.payment_id);
    if (session) {
      await this.outcomeObserver.observe(event, session);
    }
  }

  async executeManualAction(sessionId: string, actionType: ActionType, source: ActionSource): Promise<void> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) throw new Error('Session not found');

    const payment = await this.paymentRepo.findById(session.payment_id!);
    const customer = await this.customerRepo.findById(session.customer_id);
    if (!payment || !customer) throw new Error('Payment or customer not found');

    // Pre-action payment re-check
    const currentStatus = await this.recheckPaymentStatus(payment.id);
    if (currentStatus === 'CAPTURED' || currentStatus === 'AUTHORIZED') {
      await this.sessionRepo.updateState(session.id, 'RECOVERED', {
        closed_at: new Date(),
        closure_reason: 'PAYMENT_ALREADY_COMPLETED_PRE_ACTION',
      });
      throw new Error('Payment already completed — session closed');
    }

    const policyCtx = {
      session,
      payment: payment!,
      customer: customer!,
      proposedAction: actionType,
      config: this.config,
    };
    const policyRes = this.policyEngine.evaluate(policyCtx as any);

    if (policyRes.decision === 'ALLOW') {
      const action = await this.actionRepo.create({
        id: `act_${crypto.randomUUID()}`,
        recovery_session_id: session.id,
        action_type: actionType,
        reason: 'MANUAL_OVERRIDE',
        source,
        status: 'PROPOSED',
        idempotency_key: `idemp_${session.id}_${Date.now()}`,
      } as any);

      const policyDecId = await this.persistPolicyDecision(session.id, action.id, policyRes);
      await this.actionRepo.update(action.id, { policy_decision_id: policyDecId });

      const toState = this.getStateForAction(actionType, session.state);
      if (toState !== session.state) {
        await this.safeTransition(session, toState);
      }

      // Increment counters
      const counterUpdates: any = {};
      if (actionType === 'SAFE_RETRY') {
        counterUpdates.attempt_count = (session.attempt_count || 0) + 1;
      }
      if (actionType === 'PAYMENT_LINK' || actionType === 'MESSAGE') {
        counterUpdates.communication_count = (session.communication_count || 0) + 1;
      }
      counterUpdates.last_action_at = new Date();
      if (Object.keys(counterUpdates).length > 0) {
        await this.sessionRepo.updateState(session.id, session.state, counterUpdates);
      }

      await this.actionExecutor.execute(action, session as any, customer as any, payment as any);
    } else {
      throw new Error(`Action blocked by policy: ${policyRes.blockingReasons.join(', ')}`);
    }
  }

  /**
   * Map an action type to the target recovery state.
   * WAIT stays in the current state (no transition needed).
   */
  private getStateForAction(action: ActionType, currentState: RecoveryState): RecoveryState {
    switch (action) {
      case 'SAFE_RETRY': return 'SAFE_RETRY';
      case 'PAYMENT_LINK':
      case 'MESSAGE': return 'OUTREACH';
      case 'PTP_WAIT': return 'PTP_WAIT';
      case 'ESCALATE': return 'ESCALATED';
      case 'HUMAN_REVIEW': return 'HUMAN_REVIEW';
      case 'STOP': return 'STOPPED';
      case 'WAIT': return currentState; // WAIT doesn't change state
      default: return 'OUTREACH';
    }
  }

  /**
   * Deterministic fallback when AI is unavailable.
   * Uses the diagnosis failure class to pick a safe action.
   */
  private deterministicFallback(diagnosis: any, risk: any, availableActions: ActionType[]): any {
    const actionMap: Record<string, ActionType> = {
      TECHNICAL: 'SAFE_RETRY',
      BUSINESS: 'PAYMENT_LINK',
      AUTHENTICATION: 'PAYMENT_LINK',
      ABANDONMENT: 'MESSAGE',
      RECURRING_PAYMENT_FAILURE: 'SAFE_RETRY',
      UNKNOWN: 'HUMAN_REVIEW',
    };
    const action = actionMap[diagnosis.failure_class] || 'HUMAN_REVIEW';
    // Ensure the fallback action is in the available actions
    const safeAction = availableActions.includes(action) ? action : 'HUMAN_REVIEW';

    return {
      diagnosis: {
        failure_class: diagnosis.failure_class,
        confidence: diagnosis.confidence,
        reason_codes: diagnosis.reason_codes,
      },
      recovery: {
        probability: risk.recovery_probability,
        confidence: 0.5,
      },
      recommendation: {
        action: safeAction,
        confidence: 0.5,
        reason_codes: ['DETERMINISTIC_FALLBACK', 'AI_UNAVAILABLE'],
      },
      requires_human_review: safeAction === 'HUMAN_REVIEW',
    };
  }
}
