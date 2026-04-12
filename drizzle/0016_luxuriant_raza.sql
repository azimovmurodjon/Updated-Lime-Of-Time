ALTER TABLE `locations` ADD `temporarilyClosed` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `locations` ADD `reopenOn` varchar(10);