ALTER TABLE `appointments` ADD `totalPrice` decimal(10,2);--> statement-breakpoint
ALTER TABLE `appointments` ADD `extraItems` json;--> statement-breakpoint
ALTER TABLE `appointments` ADD `discountPercent` int;--> statement-breakpoint
ALTER TABLE `appointments` ADD `discountAmount` decimal(10,2);--> statement-breakpoint
ALTER TABLE `appointments` ADD `discountName` varchar(255);--> statement-breakpoint
ALTER TABLE `appointments` ADD `giftApplied` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `appointments` ADD `giftUsedAmount` decimal(10,2);--> statement-breakpoint
ALTER TABLE `appointments` ADD `staffId` varchar(64);--> statement-breakpoint
ALTER TABLE `appointments` ADD `locationId` varchar(64);