/**
 * Test script: Send a signed Razorpay webhook event to your deployed endpoint.
 *
 * Usage:
 *   node scripts/test-webhook.js <event-type>
 *
 * Examples:
 *   node scripts/test-webhook.js payment.failed
 *   node scripts/test-webhook.js payment.captured
 *   node scripts/test-webhook.js subscription.payment_failed
 *
 * Reads RAZORPAY_WEBHOOK_SECRET from .env.
 * Override target with: WEBHOOK_TARGET_URL=https://... node scripts/test-webhook.js
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Load .env ---
const envPath = path.resolve(__dirname, '../.env');
const envVars = {};
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const idx = line.indexOf('=');
    if (idx > 0) {
      const key = line.substring(0, idx).trim();
      const val = line.substring(idx + 1).trim();
      if (/^[A-Z_]+$/.test(key)) envVars[key] = val;
    }
  }
}

const WEBHOOK_SECRET = envVars.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET;
const TARGET_URL = process.env.WEBHOOK_TARGET_URL || 'https://ai-revenue-recovery-xzo8.onrender.com/webhooks/razorpay';
const eventType = process.argv[2] || 'payment.failed';

if (!WEBHOOK_SECRET) {
  console.error('ERROR: RAZORPAY_WEBHOOK_SECRET not found in .env or environment');
  process.exit(1);
}

// --- Generate realistic Razorpay webhook payloads ---
function generatePayload(event) {
  const paymentId = `pay_${crypto.randomBytes(14).toString('hex')}`;
  const orderId = `order_${crypto.randomBytes(14).toString('hex')}`;
  const customerId = `cust_${crypto.randomBytes(10).toString('hex')}`;
  const entityId = `evt_${crypto.randomBytes(10).toString('hex')}`;
  const now = Math.floor(Date.now() / 1000);
  const amount = 50000; // 500 INR in paise

  const paymentEntity = {
    id: paymentId,
    entity: 'payment',
    amount,
    currency: 'INR',
    status: 'failed',
    order_id: orderId,
    invoice_id: null,
    international: false,
    method: 'upi',
    amount_refunded: 0,
    refund_status: null,
    captured: false,
    description: 'Payment for order',
    card_id: null,
    bank: null,
    wallet: null,
    vpa: 'test@upi',
    email: 'customer@example.com',
    contact: '919999999999',
    customer_id: customerId,
    notes: [],
    fee: null,
    tax: null,
    error_code: 'insufficient_funds',
    error_description: 'Insufficient balance in account',
    created_at: now,
  };

  const subscriptionEntity = {
    id: `sub_${crypto.randomBytes(10).toString('hex')}`,
    entity: 'subscription',
    plan_id: `plan_${crypto.randomBytes(8).toString('hex')}`,
    customer_id: customerId,
    status: 'active',
    current_start: now,
    current_end: now + 2592000,
    ended_at: null,
    quantity: 1,
    notes: [],
    charge_at: now,
    start_at: now,
    end_at: now + 31536000,
    auth_attempts: 1,
    total_count: 12,
    paid_count: 3,
    customer_notify: true,
    created_at: now - 7776000,
  };

  function baseEvent(entity, contains) {
    return {
      entity: 'event',
      account_id: 'acc_test_123',
      event,
      id: entityId,
      contains,
      payment_id: event.startsWith('payment') ? paymentId : null,
      subscription_id: event.startsWith('subscription') ? subscriptionEntity.id : null,
      created_at: now,
      payload: {
        [contains[0]]: {
          entity,
        },
      },
    };
  }

  switch (event) {
    case 'payment.failed':
      return baseEvent({ ...paymentEntity, status: 'failed' }, ['payment']);

    case 'payment.captured':
      return baseEvent({ ...paymentEntity, status: 'captured', captured: true, error_code: null, error_description: null }, ['payment']);

    case 'payment.authorized':
      return baseEvent({ ...paymentEntity, status: 'authorized' }, ['payment']);

    case 'subscription.payment_failed':
      return baseEvent({ ...paymentEntity, status: 'failed' }, ['subscription_payment']);

    case 'subscription.charged':
      return baseEvent({ ...paymentEntity, status: 'captured', captured: true }, ['subscription_payment']);

    case 'payment.link.paid':
      return {
        entity: 'event',
        account_id: 'acc_test_123',
        event,
        id: entityId,
        contains: ['payment_link'],
        created_at: now,
        payload: {
          payment_link: {
            entity: {
              id: `plink_${crypto.randomBytes(10).toString('hex')}`,
              entity: 'payment_link',
              status: 'paid',
              amount,
              currency: 'INR',
              customer: {
                name: 'Test Customer',
                email: 'customer@example.com',
                contact: '919999999999',
              },
              payment_id: paymentId,
              created_at: now - 3600,
            },
          },
        },
      };

    default:
      console.error('Unknown event type: ' + event);
      console.error('Supported: payment.failed, payment.captured, payment.authorized, subscription.payment_failed, subscription.charged, payment.link.paid');
      process.exit(1);
  }
}

// --- Sign and send ---
async function main() {
  const payload = generatePayload(eventType);
  const body = JSON.stringify(payload);

  const signature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(body)
    .digest('hex');

  console.log('--- Webhook Test Script ---');
  console.log('Event:      ' + eventType);
  console.log('Target:     ' + TARGET_URL);
  console.log('Secret:     ' + WEBHOOK_SECRET.substring(0, 3) + '*** (' + WEBHOOK_SECRET.length + ' chars)');
  console.log('Signature:  ' + signature);
  console.log('Body size:  ' + body.length + ' bytes');
  console.log('');

  try {
    const res = await fetch(TARGET_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Razorpay-Signature': signature,
        'X-Razorpay-Event-Id': 'evt_' + crypto.randomBytes(10).toString('hex'),
      },
      body,
    });

    const responseText = await res.text();
    console.log('Status:   ' + res.status + ' ' + res.statusText);
    console.log('Response: ' + responseText);

    if (res.status === 200 || res.status === 202) {
      console.log('\n Webhook delivered successfully!');
    } else if (res.status === 401) {
      console.log('\n Signature verification failed — check RAZORPAY_WEBHOOK_SECRET');
    } else if (res.status === 400) {
      console.log('\n Payload validation failed — check the event format');
    }
  } catch (err) {
    console.error('Request failed:', err.message);
  }
}

main();
