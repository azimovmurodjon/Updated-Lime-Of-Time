ALTER TABLE `appointments` ADD `paymentMethod` enum('zelle','venmo','cashapp','cash','unpaid') DEFAULT 'unpaid';--> statement-breakpoint
ALTER TABLE `appointments` ADD `paymentStatus` enum('unpaid','pending_cash','paid') DEFAULT 'unpaid';--> statement-breakpoint
ALTER TABLE `appointments` ADD `paymentConfirmationNumber` varchar(64);--> statement-breakpoint
ALTER TABLE `appointments` ADD `paymentConfirmedAt` timestamp;