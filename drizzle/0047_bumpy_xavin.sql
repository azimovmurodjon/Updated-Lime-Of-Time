ALTER TABLE `subscription_plans` ADD `discountPercent` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `subscription_plans` ADD `discountLabel` varchar(100);