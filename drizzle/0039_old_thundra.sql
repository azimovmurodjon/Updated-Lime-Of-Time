ALTER TABLE `appointments` ADD `refundedAt` timestamp;--> statement-breakpoint
ALTER TABLE `appointments` ADD `refundedAmount` decimal(10,2);--> statement-breakpoint
ALTER TABLE `appointments` ADD `stripeRefundId` varchar(255);