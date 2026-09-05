import type { FastifyPluginAsync } from 'fastify';
import { buildAppContext } from '../../composition-root.js';
import {
  seedBodySchema,
  simulateFailureBodySchema,
  simulatePaymentBodySchema,
  simulatePTPBodySchema,
  simulateOptOutBodySchema,
  experimentBodySchema,
} from '../schemas.js';

const demoRoutes: FastifyPluginAsync = async (app) => {
  const { demoService } = buildAppContext();

  // POST /api/demo/reset — clear all demo data
  app.post('/reset', async () => {
    await demoService.reset();
    return { data: { success: true, message: 'Demo data cleared' } };
  });

  // POST /api/demo/seed — seed deterministic demo dataset
  app.post('/seed', async (request, reply) => {
    const parsed = seedBodySchema.safeParse(request.body || {});
    if (!parsed.success) {
      return reply.code(400).send({ data: null, error: { code: 'INVALID_REQUEST', message: parsed.error.issues[0]?.message } });
    }
    const result = await demoService.seed(parsed.data.seed, parsed.data.count);
    return { data: result };
  });

  // POST /api/demo/simulate/failure — create a controlled payment failure
  app.post('/simulate/failure', async (request, reply) => {
    const parsed = simulateFailureBodySchema.safeParse(request.body || {});
    if (!parsed.success) {
      return reply.code(400).send({ data: null, error: { code: 'INVALID_REQUEST', message: parsed.error.issues[0]?.message } });
    }
    try {
      const result = await demoService.simulateFailure(parsed.data);
      return { data: result };
    } catch (err: any) {
      return reply.code(400).send({ data: null, error: { code: 'INVALID_REQUEST', message: err.message } });
    }
  });

  // POST /api/demo/simulate/payment — simulate successful payment
  app.post('/simulate/payment', async (request, reply) => {
    const parsed = simulatePaymentBodySchema.safeParse(request.body || {});
    if (!parsed.success) {
      return reply.code(400).send({ data: null, error: { code: 'INVALID_REQUEST', message: parsed.error.issues[0]?.message } });
    }
    try {
      const result = await demoService.simulatePayment(parsed.data);
      return { data: result };
    } catch (err: any) {
      return reply.code(404).send({ data: null, error: { code: 'NOT_FOUND', message: err.message } });
    }
  });

  // POST /api/demo/simulate/ptp — create a PTP event
  app.post('/simulate/ptp', async (request, reply) => {
    const parsed = simulatePTPBodySchema.safeParse(request.body || {});
    if (!parsed.success) {
      return reply.code(400).send({ data: null, error: { code: 'INVALID_REQUEST', message: parsed.error.issues[0]?.message } });
    }
    try {
      const result = await demoService.simulatePTP(parsed.data);
      return { data: result };
    } catch (err: any) {
      return reply.code(404).send({ data: null, error: { code: 'NOT_FOUND', message: err.message } });
    }
  });

  // POST /api/demo/simulate/optout — simulate customer opt-out
  app.post('/simulate/optout', async (request, reply) => {
    const parsed = simulateOptOutBodySchema.safeParse(request.body || {});
    if (!parsed.success) {
      return reply.code(400).send({ data: null, error: { code: 'INVALID_REQUEST', message: parsed.error.issues[0]?.message } });
    }
    try {
      const result = await demoService.simulateOptOut(parsed.data);
      return { data: result };
    } catch (err: any) {
      return reply.code(404).send({ data: null, error: { code: 'NOT_FOUND', message: err.message } });
    }
  });

  // POST /api/demo/experiment — run batch experiment
  app.post('/experiment', async (request, reply) => {
    const parsed = experimentBodySchema.safeParse(request.body || {});
    if (!parsed.success) {
      return reply.code(400).send({ data: null, error: { code: 'INVALID_REQUEST', message: parsed.error.issues[0]?.message } });
    }
    const result = await demoService.runExperiment({
      seed: parsed.data.seed,
      control_size: parsed.data.control_size,
      treatment_size: parsed.data.treatment_size,
    });
    return { data: result };
  });
};

export default demoRoutes;
