CREATE TABLE `waitlist` (
	`id` int AUTO_INCREMENT NOT NULL,
	`businessOwnerId` int NOT NULL,
	`clientName` varchar(255) NOT NULL,
	`clientPhone` varchar(20),
	`clientEmail` varchar(320),
	`serviceLocalId` varchar(64) NOT NULL,
	`preferredDate` varchar(10) NOT NULL,
	`status` enum('waiting','notified','booked','expired') NOT NULL DEFAULT 'waiting',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `waitlist_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `business_owners` ADD `bufferTime` int DEFAULT 0 NOT NULL;