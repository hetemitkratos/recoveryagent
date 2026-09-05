import { eq } from 'drizzle-orm';
import { db } from '../connection.js';
import { experiments, experiment_assignments } from '../schema.js';
import type { Experiment, ExperimentAssignment } from '../../../domain/entities/experiment.js';

export class ExperimentRepository {
  async createExperiment(exp: Omit<Experiment, 'created_at' | 'updated_at'>): Promise<Experiment> {
    const result = await db.insert(experiments).values(exp).returning();
    return result[0] as Experiment;
  }

  async createAssignment(assignment: ExperimentAssignment): Promise<ExperimentAssignment> {
    const result = await db.insert(experiment_assignments).values(assignment).returning();
    return result[0] as ExperimentAssignment;
  }

  async findAssignment(experimentId: string, customerId: string): Promise<ExperimentAssignment | null> {
    const results = await db.select().from(experiment_assignments).where(
      eq(experiment_assignments.experiment_id, experimentId)
    ); // simplified
    const found = results.find(r => r.customer_id === customerId);
    return (found as ExperimentAssignment) || null;
  }

  async updateExperimentMetrics(id: string, metrics: Partial<Experiment>): Promise<Experiment> {
    const result = await db.update(experiments)
      .set(metrics)
      .where(eq(experiments.id, id))
      .returning();
    return result[0] as Experiment;
  }
}
