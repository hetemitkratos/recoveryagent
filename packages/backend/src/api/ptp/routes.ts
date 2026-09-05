import type { FastifyPluginAsync } from 'fastify';
import { db } from '../../infrastructure/db/connection.js';
import { promises_to_pay } from '../../infrastructure/db/schema.js';
import { eq, desc } from 'drizzle-orm';

const ptpRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request) => {
    const { status, limit } = request.query as any;
    
    let query = db.select().from(promises_to_pay).orderBy(desc(promises_to_pay.created_at));
    if (status) {
      query = query.where(eq(promises_to_pay.status, status)) as any;
    }
    
    const ptps = await query.limit(Number(limit) || 50);
    return { data: ptps };
  });
};
export default ptpRoutes;
