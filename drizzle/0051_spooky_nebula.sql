ALTER TABLE `business_owners` ADD `scheduledPlanKey` enum('solo','growth','studio','enterprise');--> statement-breakpoint
ALTER TABLE `business_owners` ADD `scheduledPlanPeriod` enum('monthly','yearly');--> statement-breakpoint
ALTER TABLE `business_owners` ADD `cancelAtPeriodEnd` boolean DEFAULT false NOT NULL;