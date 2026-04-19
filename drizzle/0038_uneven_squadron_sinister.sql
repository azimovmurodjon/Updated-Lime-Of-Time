ALTER TABLE `appointments` MODIFY COLUMN `paymentMethod` enum('zelle','venmo','cashapp','cash','card','unpaid','free') DEFAULT 'unpaid';--> statement-breakpoint
ALTER TABLE `appointments` ADD `stripeCheckoutSessionId` varchar(255);--> statement-breakpoint
ALTER TABLE `business_owners` ADD `stripeConnectAccountId` varchar(255);--> statement-breakpoint
ALTER TABLE `business_owners` ADD `stripeConnectEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `business_owners` ADD `stripeConnectOnboardingComplete` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `business_owners` ADD `acceptCardPayments` boolean DEFAULT false NOT NULL;