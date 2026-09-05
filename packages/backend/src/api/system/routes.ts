import type { FastifyPluginAsync } from 'fastify';
import { config } from '../../config.js';

const systemRoutes: FastifyPluginAsync = async (app) => {
  app.get('/status', async () => {
    return {
      data: {
        mode: config.DEMO_MODE ? 'DEMO' : 'LIVE',
        model: config.GEMINI_MODEL,
        policy_version: '1.0.0',
        provider: config.DEMO_MODE ? 'simulator' : 'razorpay'
      }
    };
  });
};
export default systemRoutes;
