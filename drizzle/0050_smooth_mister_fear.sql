ALTER TABLE `gift_cards` ADD `purchaserName` varchar(255);--> statement-breakpoint
ALTER TABLE `gift_cards` ADD `purchaserEmail` varchar(320);--> statement-breakpoint
ALTER TABLE `gift_cards` ADD `recipientEmail` varchar(320);--> statement-breakpoint
ALTER TABLE `gift_cards` ADD `recipientChoosesDate` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `gift_cards` ADD `paymentMethod` varchar(30) DEFAULT 'unpaid';--> statement-breakpoint
ALTER TABLE `gift_cards` ADD `paymentStatus` varchar(20) DEFAULT 'unpaid';--> statement-breakpoint
ALTER TABLE `gift_cards` ADD `totalValue` decimal(10,2);--> statement-breakpoint
ALTER TABLE `gift_cards` ADD `purchasedPublicly` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `gift_cards` ADD `preselectedDate` varchar(10);--> statement-breakpoint
ALTER TABLE `gift_cards` ADD `preselectedTime` varchar(5);