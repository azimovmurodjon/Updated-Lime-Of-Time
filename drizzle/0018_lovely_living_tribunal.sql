ALTER TABLE `business_owners` ADD `autoCompleteEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `business_owners` ADD `autoCompleteDelayMinutes` int DEFAULT 5 NOT NULL;