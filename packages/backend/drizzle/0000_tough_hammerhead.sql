CREATE TABLE `ai_recommendations` (
	`id` text PRIMARY KEY NOT NULL,
	`recovery_session_id` text NOT NULL,
	`diagnosis` text NOT NULL,
	`diagnosis_confidence` real NOT NULL,
	`recovery_probability` real NOT NULL,
	`recovery_confidence` real NOT NULL,
	`recommended_action` text NOT NULL,
	`action_confidence` real NOT NULL,
	`reason_codes` text NOT NULL,
	`message_text` text,
	`message_tone` text,
	`requires_human_review` integer NOT NULL,
	`model_name` text NOT NULL,
	`model_version` text NOT NULL,
	`prompt_version` text NOT NULL,
	`is_fallback` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`recovery_session_id`) REFERENCES `recovery_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`recovery_session_id` text,
	`customer_id` text,
	`payment_id` text,
	`subscription_id` text,
	`source_event_id` text,
	`actor` text NOT NULL,
	`payload` text NOT NULL,
	`timestamp` integer NOT NULL,
	`previous_hash` text NOT NULL,
	`hash` text NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `communication_events` (
	`id` text PRIMARY KEY NOT NULL,
	`recovery_session_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`channel` text NOT NULL,
	`template_id` text,
	`message` text NOT NULL,
	`provider` text,
	`provider_reference` text,
	`status` text NOT NULL,
	`sent_at` integer,
	`delivered_at` integer,
	`opened_at` integer,
	`responded_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`recovery_session_id`) REFERENCES `recovery_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`external_customer_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`preferred_channel` text NOT NULL,
	`opted_out` integer DEFAULT false NOT NULL,
	`lifetime_value` integer DEFAULT 0 NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_external_customer_id_unique` ON `customers` (`external_customer_id`);--> statement-breakpoint
CREATE TABLE `experiment_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`experiment_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`payment_id` text,
	`variant` text NOT NULL,
	`assigned_at` integer NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`experiment_id`) REFERENCES `experiments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `experiments` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`status` text NOT NULL,
	`seed` integer NOT NULL,
	`control_count` integer NOT NULL,
	`treatment_count` integer NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`control_recovered_revenue` integer,
	`treatment_recovered_revenue` integer,
	`incremental_revenue` integer,
	`control_recovery_rate` real,
	`treatment_recovery_rate` real,
	`incremental_lift_pp` real,
	`roi` real,
	`is_demo` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_payment_id` text NOT NULL,
	`provider_order_id` text,
	`amount` integer NOT NULL,
	`currency` text NOT NULL,
	`status` text NOT NULL,
	`failure_code` text,
	`failure_description` text,
	`failure_class` text,
	`attempt_number` integer DEFAULT 1 NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	`metadata` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`paid_at` integer,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_provider_payment_id_unique` ON `payments` (`provider_payment_id`);--> statement-breakpoint
CREATE TABLE `policy_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`recovery_session_id` text NOT NULL,
	`action_id` text NOT NULL,
	`decision` text NOT NULL,
	`rules_evaluated` text NOT NULL,
	`blocking_reasons` text NOT NULL,
	`policy_version` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`recovery_session_id`) REFERENCES `recovery_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `promises_to_pay` (
	`id` text PRIMARY KEY NOT NULL,
	`recovery_session_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`promised_date` integer NOT NULL,
	`promised_amount` integer,
	`source` text NOT NULL,
	`source_text` text NOT NULL,
	`confidence` real NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`fulfilled_at` integer,
	FOREIGN KEY (`recovery_session_id`) REFERENCES `recovery_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `recovery_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`recovery_session_id` text NOT NULL,
	`action_type` text NOT NULL,
	`reason` text NOT NULL,
	`source` text NOT NULL,
	`ai_recommendation_id` text,
	`policy_decision_id` text,
	`status` text NOT NULL,
	`provider` text,
	`provider_reference` text,
	`idempotency_key` text NOT NULL,
	`payload` text,
	`scheduled_at` integer,
	`executed_at` integer,
	`completed_at` integer,
	`failure_reason` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`recovery_session_id`) REFERENCES `recovery_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recovery_actions_idempotency_key_unique` ON `recovery_actions` (`idempotency_key`);--> statement-breakpoint
CREATE TABLE `recovery_outcomes` (
	`id` text PRIMARY KEY NOT NULL,
	`recovery_session_id` text NOT NULL,
	`action_id` text,
	`result` text NOT NULL,
	`payment_id` text,
	`amount_recovered` integer NOT NULL,
	`currency` text NOT NULL,
	`payment_reference` text,
	`attribution` text NOT NULL,
	`attribution_evidence` text,
	`observed_at` integer NOT NULL,
	FOREIGN KEY (`recovery_session_id`) REFERENCES `recovery_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recovery_outcomes_payment_id_unique` ON `recovery_outcomes` (`payment_id`);--> statement-breakpoint
CREATE TABLE `recovery_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`payment_id` text,
	`subscription_id` text,
	`state` text NOT NULL,
	`risk_score` integer NOT NULL,
	`recovery_probability` real NOT NULL,
	`expected_recoverable_revenue` integer NOT NULL,
	`diagnosis` text,
	`diagnosis_confidence` real,
	`current_owner` text,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`communication_count` integer DEFAULT 0 NOT NULL,
	`last_action_at` integer,
	`next_action_at` integer,
	`is_demo` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`closed_at` integer,
	`closure_reason` text,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_active_uniq` ON `recovery_sessions` (`customer_id`,`payment_id`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_subscription_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text NOT NULL,
	`status` text NOT NULL,
	`next_charge_at` integer,
	`failed_attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`retry_ceiling` integer DEFAULT 3 NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_provider_subscription_id_unique` ON `subscriptions` (`provider_subscription_id`);--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`source_event_id` text NOT NULL,
	`event_type` text NOT NULL,
	`payload` text NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `webhook_events_source_event_id_unique` ON `webhook_events` (`source_event_id`);