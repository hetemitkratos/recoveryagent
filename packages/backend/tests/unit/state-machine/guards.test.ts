import { describe, it, expect } from 'vitest';
import { StateMachine } from '../../../src/domain/state-machine/state-machine.js';
import { makeSession, makePayment, makeCustomer, makeConfig } from '../../fixtures/index.js';
import type { GuardContext } from '../../../src/domain/state-machine/guards.js';

describe('StateMachine Guards', () => {
  const sm = new StateMachine();
  const config = makeConfig();

  describe('checkPaymentState (already-paid guard)', () => {
    it('blocks action when payment is CAPTURED', () => {
      const session = makeSession({ state: 'OUTREACH' });
      const payment = makePayment({ status: 'CAPTURED' });
      const ctx: GuardContext = { session, payment, customer: makeCustomer(), proposedAction: 'PAYMENT_LINK', config };
      const result = sm.evaluateAction(session, 'PAYMENT_LINK', ctx);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('PAYMENT_ALREADY_COMPLETED');
      expect(result.redirectState).toBe('RECOVERED');
    });

    it('blocks action when payment is AUTHORIZED', () => {
      const session = makeSession({ state: 'OUTREACH' });
      const payment = makePayment({ status: 'AUTHORIZED' });
      const ctx: GuardContext = { session, payment, customer: makeCustomer(), proposedAction: 'MESSAGE', config };
      const result = sm.evaluateAction(session, 'MESSAGE', ctx);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('PAYMENT_ALREADY_COMPLETED');
    });

    it('allows action when payment is still FAILED', () => {
      const session = makeSession({ state: 'OUTREACH' });
      const payment = makePayment({ status: 'FAILED' });
      const ctx: GuardContext = { session, payment, customer: makeCustomer(), proposedAction: 'PAYMENT_LINK', config };
      const result = sm.evaluateAction(session, 'PAYMENT_LINK', ctx);
      expect(result.allowed).toBe(true);
    });
  });

  describe('checkOptOut guard', () => {
    it('blocks all communication for opted-out customer', () => {
      const session = makeSession({ state: 'OUTREACH' });
      const customer = makeCustomer({ opted_out: true });
      const ctx: GuardContext = { session, payment: makePayment(), customer, proposedAction: 'MESSAGE', config };
      const result = sm.evaluateAction(session, 'MESSAGE', ctx);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('CUSTOMER_OPTED_OUT');
      expect(result.redirectState).toBe('STOPPED');
    });

    it('allows action for non-opted-out customer', () => {
      const session = makeSession({ state: 'OUTREACH' });
      const customer = makeCustomer({ opted_out: false });
      const ctx: GuardContext = { session, payment: makePayment(), customer, proposedAction: 'MESSAGE', config };
      const result = sm.evaluateAction(session, 'MESSAGE', ctx);
      expect(result.allowed).toBe(true);
    });
  });

  describe('checkRetryLimit guard', () => {
    it('blocks SAFE_RETRY when attempt_count >= MAX_RETRIES', () => {
      const session = makeSession({ state: 'SAFE_RETRY', attempt_count: 3 });
      const ctx: GuardContext = { session, payment: makePayment(), customer: makeCustomer(), proposedAction: 'SAFE_RETRY', config };
      const result = sm.evaluateAction(session, 'SAFE_RETRY', ctx);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('RETRY_LIMIT_REACHED');
    });

    it('allows SAFE_RETRY when under retry ceiling', () => {
      const session = makeSession({ state: 'SAFE_RETRY', attempt_count: 1 });
      const ctx: GuardContext = { session, payment: makePayment(), customer: makeCustomer(), proposedAction: 'SAFE_RETRY', config };
      const result = sm.evaluateAction(session, 'SAFE_RETRY', ctx);
      expect(result.allowed).toBe(true);
    });
  });

  describe('checkCommunicationLimit guard', () => {
    it('blocks MESSAGE when communication_count >= MAX_COMMUNICATIONS', () => {
      const session = makeSession({ state: 'OUTREACH', communication_count: 5 });
      const ctx: GuardContext = { session, payment: makePayment(), customer: makeCustomer(), proposedAction: 'MESSAGE', config };
      const result = sm.evaluateAction(session, 'MESSAGE', ctx);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('COMMUNICATION_LIMIT_REACHED');
    });

    it('blocks PAYMENT_LINK when communication_count >= MAX_COMMUNICATIONS', () => {
      const session = makeSession({ state: 'OUTREACH', communication_count: 5 });
      const ctx: GuardContext = { session, payment: makePayment(), customer: makeCustomer(), proposedAction: 'PAYMENT_LINK', config };
      const result = sm.evaluateAction(session, 'PAYMENT_LINK', ctx);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('COMMUNICATION_LIMIT_REACHED');
    });
  });

  describe('checkAIConfidence guard', () => {
    it('blocks high-risk action when AI confidence below threshold', () => {
      const session = makeSession({ state: 'OUTREACH' });
      const ctx: GuardContext = { session, payment: makePayment(), customer: makeCustomer(), proposedAction: 'PAYMENT_LINK', aiConfidence: 0.5, config };
      const result = sm.evaluateAction(session, 'PAYMENT_LINK', ctx);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('LOW_CONFIDENCE_HIGH_RISK');
      expect(result.redirectState).toBe('HUMAN_REVIEW');
    });

    it('allows high-risk action when AI confidence above threshold', () => {
      const session = makeSession({ state: 'OUTREACH' });
      const ctx: GuardContext = { session, payment: makePayment(), customer: makeCustomer(), proposedAction: 'PAYMENT_LINK', aiConfidence: 0.85, config };
      const result = sm.evaluateAction(session, 'PAYMENT_LINK', ctx);
      expect(result.allowed).toBe(true);
    });
  });

  describe('checkTerminalState guard', () => {
    it('blocks any action on RECOVERED session', () => {
      const session = makeSession({ state: 'RECOVERED' });
      const ctx: GuardContext = { session, payment: makePayment(), customer: makeCustomer(), proposedAction: 'MESSAGE', config };
      const result = sm.evaluateAction(session, 'MESSAGE', ctx);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('RECOVERY_ALREADY_CLOSED');
    });

    it('blocks any action on STOPPED session', () => {
      const session = makeSession({ state: 'STOPPED' });
      const ctx: GuardContext = { session, payment: makePayment(), customer: makeCustomer(), proposedAction: 'SAFE_RETRY', config };
      const result = sm.evaluateAction(session, 'SAFE_RETRY', ctx);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('RECOVERY_ALREADY_CLOSED');
    });
  });
});
