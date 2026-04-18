ALTER TABLE `services` ADD `description` text;--> statement-breakpoint
ALTER TABLE `services` ADD `photoUri` varchar(2048);--> statement-breakpoint
ALTER TABLE `services` ADD `reminderHours` decimal(5,2);