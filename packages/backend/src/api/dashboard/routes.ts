import type { FastifyPluginAsync } from 'fastify';
import { db } from '../../infrastructure/db/connection.js';
import { recovery_outcomes, recovery_sessions, audit_events, recovery_actions } from '../../infrastructure/db/schema.js';
import { eq, desc, sql } from 'drizzle-orm';
import { buildAppContext } from '../../composition-root.js';

const dashboardRoutes: FastifyPluginAsync = async (app) => {
  const { sessionRepo, auditRepo } = buildAppContext();

  app.get('/metrics', async () => {
    const sessions = await sessionRepo.findAll();
    const outcomes = await db.select().from(recovery_outcomes);

    let totalRecovered = 0;
    let incremental = 0;
    let directRecovered = 0;
    let assistedRecovered = 0;
    let organicRecovered = 0;
    let unknownRecovered = 0;

    const attributionBreakdown: Record<string, number> = {
      DIRECT: 0,
      ASSISTED: 0,
      ORGANIC: 0,
      UNKNOWN: 0,
    };

    outcomes.forEach(o => {
      if (o.result === 'PAYMENT_RECOVERED') {
        totalRecovered += o.amount_recovered;
        attributionBreakdown[o.attribution] = (attributionBreakdown[o.attribution] || 0) + o.amount_recovered;
        if (o.attribution === 'DIRECT') {
          directRecovered += o.amount_recovered;
          incremental += o.amount_recovered;
        } else if (o.attribution === 'ASSISTED') {
          assistedRecovered += o.amount_recovered;
          incremental += o.amount_recovered;
        } else if (o.attribution === 'ORGANIC') {
          organicRecovered += o.amount_recovered;
        } else {
          unknownRecovered += o.amount_recovered;
        }
      }
    });

    const activeSessions = sessions.filter(s => !s.closed_at);
    const revenueAtRisk = activeSessions.reduce((acc, s) => acc + s.expected_recoverable_revenue, 0);
    const recoveryRate = outcomes.length > 0
      ? outcomes.filter(o => o.result === 'PAYMENT_RECOVERED').length / outcomes.length
      : 0;

    return {
      data: {
        revenue_at_risk: revenueAtRisk,
        recovered_revenue: totalRecovered,
        incremental_recovery: incremental,
        recovery_rate: recoveryRate,
        active_workflows: activeSessions.length,
        attribution_breakdown: attributionBreakdown,
      },
    };
  });

  app.get('/failures-by-type', async () => {
    const sessions = await sessionRepo.findAll();
    const breakdown: Record<string, number> = {};
    sessions.forEach(s => {
      const diagnosis = s.diagnosis || 'UNKNOWN';
      breakdown[diagnosis] = (breakdown[diagnosis] || 0) + 1;
    });
    return { data: breakdown };
  });

  app.get('/recovery-funnel', async () => {
    const sessions = await sessionRepo.findAll();
    const funnel: Record<string, number> = {};
    sessions.forEach(s => {
      funnel[s.state] = (funnel[s.state] || 0) + 1;
    });
    return { data: funnel };
  });

  app.get('/guardrail-events', async () => {
    const events = await db.select().from(audit_events)
      .where(eq(audit_events.event_type, 'POLICY_BLOCKED'))
      .orderBy(desc(audit_events.timestamp))
      .limit(50);
    return { data: events };
  });

  app.get('/audit-timeline', async () => {
    const events = await auditRepo.findRecent(50);
    return { data: events };
  });

  app.get('/best-interventions', async () => {
    const actions = await db.select().from(recovery_actions);
    const byType: Record<string, { total: number; succeeded: number }> = {};
    actions.forEach(a => {
      if (!byType[a.action_type]) byType[a.action_type] = { total: 0, succeeded: 0 };
      byType[a.action_type].total++;
      if (a.status === 'SUCCEEDED') byType[a.action_type].succeeded++;
    });
    const result = Object.entries(byType).map(([action_type, stats]) => ({
      action_type,
      total: stats.total,
      succeeded: stats.succeeded,
      success_rate: stats.total > 0 ? stats.succeeded / stats.total : 0,
    }));
    return { data: result };
  });
};
export default dashboardRoutes;
