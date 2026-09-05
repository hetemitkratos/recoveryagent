import type { RecoveryOrchestrator } from '../../application/recovery/recovery-orchestrator.js';
import { db } from '../../infrastructure/db/connection.js';
import { experiments, experiment_assignments, webhook_events } from '../../infrastructure/db/schema.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export class BatchExperimentRunner {
  constructor(private orchestrator: RecoveryOrchestrator) {}

  async run(seed: number, count: number): Promise<string> {
    const experimentId = `exp_${crypto.randomUUID()}`;
    
    await db.insert(experiments).values({
      id: experimentId,
      name: `Batch Test Seed ${seed}`,
      status: 'RUNNING',
      seed,
      control_count: count / 2,
      treatment_count: count / 2,
      started_at: new Date(),
      is_demo: true
    });

    for (let i = 0; i < count; i++) {
      const variant = i % 2 === 0 ? 'CONTROL' : 'TREATMENT';
      const customerId = `cus_sim_${seed}_${i}`;
      const paymentId = `pay_sim_${seed}_${i}`;

      await db.insert(experiment_assignments).values({
        id: `asn_${crypto.randomUUID()}`,
        experiment_id: experimentId,
        customer_id: customerId,
        payment_id: paymentId,
        variant,
        assigned_at: new Date(),
        is_demo: true
      });

      await this.orchestrator.handleFailedPayment({
        event_type: 'PAYMENT_FAILED',
        source: 'simulator',
        source_event_id: `evt_sim_${seed}_${i}`,
        payment_id: paymentId,
        customer_id: customerId,
        amount: Math.floor(Math.random() * 50000) + 1000,
        currency: 'INR',
        failure_code: ['insufficient_funds', 'gateway_timeout', 'afa_failed'][i % 3],
        occurred_at: new Date(),
        raw_payload: {}
      });
    }

    await db.update(experiments)
      .set({ status: 'COMPLETED', completed_at: new Date() })
      .where(eq(experiments.id, experimentId));

    return experimentId;
  }
}
