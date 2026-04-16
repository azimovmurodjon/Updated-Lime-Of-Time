CREATE TABLE `platform_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`configKey` varchar(100) NOT NULL,
	`configValue` text,
	`isSensitive` boolean NOT NULL DEFAULT false,
	`description` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `platform_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `platform_config_configKey_unique` UNIQUE(`configKey`)
);
--> statement-breakpoint
CREATE TABLE `subscription_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planKey` enum('solo','growth','studio','enterprise') NOT NULL,
	`displayName` varchar(100) NOT NULL,
	`monthlyPrice` decimal(10,2) NOT NULL DEFAULT '0',
	`yearlyPrice` decimal(10,2) NOT NULL DEFAULT '0',
	`maxClients` int NOT NULL DEFAULT -1,
	`maxAppointments` int NOT NULL DEFAULT -1,
	`maxLocations` int NOT NULL DEFAULT -1,
	`maxStaff` int NOT NULL DEFAULT -1,
	`maxServices` int NOT NULL DEFAULT -1,
	`maxProducts` int NOT NULL DEFAULT -1,
	`smsLevel` enum('none','confirmations','full') NOT NULL DEFAULT 'none',
	`paymentLevel` enum('basic','full') NOT NULL DEFAULT 'basic',
	`isPublic` boolean NOT NULL DEFAULT false,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscription_plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscription_plans_planKey_unique` UNIQUE(`planKey`)
);
--> statement-breakpoint
ALTER TABLE `business_owners` ADD `subscriptionPlan` enum('solo','growth','studio','enterprise') DEFAULT 'solo' NOT NULL;--> statement-breakpoint
ALTER TABLE `business_owners` ADD `subscriptionStatus` enum('trial','active','expired','free') DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE `business_owners` ADD `subscriptionPeriod` enum('monthly','yearly') DEFAULT 'monthly' NOT NULL;--> statement-breakpoint
ALTER TABLE `business_owners` ADD `trialEndsAt` timestamp;--> statement-breakpoint
ALTER TABLE `business_owners` ADD `stripeCustomerId` varchar(255);--> statement-breakpoint
ALTER TABLE `business_owners` ADD `stripeSubscriptionId` varchar(255);--> statement-breakpoint
ALTER TABLE `business_owners` ADD `adminOverride` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `business_owners` ADD `adminOverrideNote` text;--> statement-breakpoint
ALTER TABLE `business_owners` ADD `zelleHandle` varchar(255);--> statement-breakpoint
ALTER TABLE `business_owners` ADD `cashAppHandle` varchar(255);--> statement-breakpoint
ALTER TABLE `business_owners` ADD `venmoHandle` varchar(255);--> statement-breakpoint
ALTER TABLE `business_owners` ADD `paymentNotes` text;