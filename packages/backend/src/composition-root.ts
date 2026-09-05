import { config, type Config } from './config.js';

// Repositories
import { CustomerRepository } from './infrastructure/db/repositories/customer-repo.js';
import { PaymentRepository } from './infrastructure/db/repositories/payment-repo.js';
import { SessionRepository } from './infrastructure/db/repositories/session-repo.js';
import { ActionRepository } from './infrastructure/db/repositories/action-repo.js';
import { AuditRepository } from './infrastructure/db/repositories/audit-repo.js';
import { OutcomeRepository } from './infrastructure/db/repositories/outcome-repo.js';
import { PTPRepository } from './infrastructure/db/repositories/ptp-repo.js';
import { ExperimentRepository } from './infrastructure/db/repositories/experiment-repo.js';
import { AIRecommendationRepository } from './infrastructure/db/repositories/ai-recommendation-repo.js';
import { PolicyDecisionRepository } from './infrastructure/db/repositories/policy-decision-repo.js';

// Domain engines
import { DiagnosisEngine } from './domain/diagnosis/diagnosis-engine.js';
import { RiskEngine } from './domain/risk/risk-engine.js';
import { PolicyEngine } from './domain/policy/policy-engine.js';
import { AttributionEngine } from './domain/attribution/attribution-engine.js';

// AI adapters
import type { AIAdapter } from './infrastructure/ai/ai-adapter.js';
import { MockAIAdapter } from './infrastructure/ai/mock-ai-adapter.js';
import { GeminiAdapter } from './infrastructure/ai/gemini-adapter.js';
import { OpenRouterAdapter } from './infrastructure/ai/openrouter-adapter.js';

// Payment + notification providers
import type { PaymentProvider } from './infrastructure/payment/payment-provider.js';
import type { NotificationProvider } from './infrastructure/notifications/notification-provider.js';
import { SimulatorAdapter } from './infrastructure/payment/simulator-adapter.js';
import { RazorpayAdapter } from './infrastructure/payment/razorpay-adapter.js';
import { SimulatorNotificationAdapter } from './infrastructure/notifications/simulator-adapter.js';

// Application layer
import { ActionExecutor } from './application/recovery/action-executor.js';
import { OutcomeObserver } from './application/recovery/outcome-observer.js';
import { RecoveryOrchestrator } from './application/recovery/recovery-orchestrator.js';
import { WebhookProcessor } from './application/webhook/webhook-processor.js';
import { BatchExperimentRunner } from './application/experiment/batch-experiment-runner.js';
import { DemoService } from './application/demo/demo-service.js';

export interface AppContext {
  config: Config;
  // Repositories
  customerRepo: CustomerRepository;
  paymentRepo: PaymentRepository;
  sessionRepo: SessionRepository;
  actionRepo: ActionRepository;
  auditRepo: AuditRepository;
  outcomeRepo: OutcomeRepository;
  ptpRepo: PTPRepository;
  experimentRepo: ExperimentRepository;
  aiRecommendationRepo: AIRecommendationRepository;
  policyDecisionRepo: PolicyDecisionRepository;
  // Domain engines
  diagnosisEngine: DiagnosisEngine;
  riskEngine: RiskEngine;
  policyEngine: PolicyEngine;
  attributionEngine: AttributionEngine;
  // Adapters
  aiAdapter: AIAdapter;
  paymentProvider: PaymentProvider;
  notificationProvider: NotificationProvider;
  // Application services
  actionExecutor: ActionExecutor;
  outcomeObserver: OutcomeObserver;
  orchestrator: RecoveryOrchestrator;
  webhookProcessor: WebhookProcessor;
  batchExperimentRunner: BatchExperimentRunner;
  demoService: DemoService;
}

function createAIAdapter(cfg: Config): AIAdapter {
  // Priority: OpenRouter > Gemini > Mock fallback
  if (cfg.OPENROUTER_API_KEY) {
    return new OpenRouterAdapter({
      OPENROUTER_API_KEY: cfg.OPENROUTER_API_KEY,
      OPENROUTER_MODEL: cfg.OPENROUTER_MODEL,
      OPENROUTER_BASE_URL: cfg.OPENROUTER_BASE_URL,
      OPENROUTER_TIMEOUT_MS: cfg.OPENROUTER_TIMEOUT_MS,
    });
  }
  if (cfg.GEMINI_API_KEY) {
    return new GeminiAdapter({
      GEMINI_API_KEY: cfg.GEMINI_API_KEY,
      GEMINI_MODEL: cfg.GEMINI_MODEL,
    });
  }
  return new MockAIAdapter();
}

function createPaymentProvider(cfg: Config): PaymentProvider {
  if (cfg.DEMO_MODE || !cfg.RAZORPAY_KEY_ID) {
    return new SimulatorAdapter();
  }
  return new RazorpayAdapter();
}

function createNotificationProvider(): NotificationProvider {
  // MVP: always use the simulator notification adapter.
  // A real SMS/email provider can be plugged in here later.
  return new SimulatorNotificationAdapter();
}

let cached: AppContext | null = null;

export function buildAppContext(): AppContext {
  if (cached) return cached;

  // Repositories
  const customerRepo = new CustomerRepository();
  const paymentRepo = new PaymentRepository();
  const sessionRepo = new SessionRepository();
  const actionRepo = new ActionRepository();
  const auditRepo = new AuditRepository();
  const outcomeRepo = new OutcomeRepository();
  const ptpRepo = new PTPRepository();
  const experimentRepo = new ExperimentRepository();
  const aiRecommendationRepo = new AIRecommendationRepository();
  const policyDecisionRepo = new PolicyDecisionRepository();

  // Domain engines
  const diagnosisEngine = new DiagnosisEngine();
  const riskEngine = new RiskEngine();
  const policyEngine = new PolicyEngine();
  const attributionEngine = new AttributionEngine();

  // Adapters
  const aiAdapter = createAIAdapter(config);
  const paymentProvider = createPaymentProvider(config);
  const notificationProvider = createNotificationProvider();

  // Application services
  const actionExecutor = new ActionExecutor(
    paymentProvider,
    notificationProvider,
    actionRepo,
    auditRepo,
  );

  const outcomeObserver = new OutcomeObserver(
    sessionRepo,
    actionRepo,
    outcomeRepo,
    auditRepo,
    attributionEngine,
  );

  const orchestrator = new RecoveryOrchestrator(
    customerRepo,
    paymentRepo,
    sessionRepo,
    actionRepo,
    auditRepo,
    diagnosisEngine,
    riskEngine,
    policyEngine,
    actionExecutor,
    outcomeObserver,
    aiAdapter,
    paymentProvider,
    aiRecommendationRepo,
    policyDecisionRepo,
    config,
  );

  const webhookProcessor = new WebhookProcessor(orchestrator, config);

  const batchExperimentRunner = new BatchExperimentRunner(orchestrator);

  const demoService = new DemoService(orchestrator, config);

  cached = {
    config,
    customerRepo,
    paymentRepo,
    sessionRepo,
    actionRepo,
    auditRepo,
    outcomeRepo,
    ptpRepo,
    experimentRepo,
    aiRecommendationRepo,
    policyDecisionRepo,
    diagnosisEngine,
    riskEngine,
    policyEngine,
    attributionEngine,
    aiAdapter,
    paymentProvider,
    notificationProvider,
    actionExecutor,
    outcomeObserver,
    orchestrator,
    webhookProcessor,
    batchExperimentRunner,
    demoService,
  };

  return cached;
}
