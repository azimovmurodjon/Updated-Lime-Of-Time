CREATE TABLE `custom_schedule` (
	`id` int AUTO_INCREMENT NOT NULL,
	`businessOwnerId` int NOT NULL,
	`date` varchar(10) NOT NULL,
	`isOpen` boolean NOT NULL DEFAULT true,
	`startTime` varchar(5),
	`endTime` varchar(5),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `custom_schedule_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `discounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`businessOwnerId` int NOT NULL,
	`localId` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`percentage` int NOT NULL,
	`startTime` varchar(5) NOT NULL,
	`endTime` varchar(5) NOT NULL,
	`daysOfWeek` json,
	`serviceIds` json,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `discounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gift_cards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`businessOwnerId` int NOT NULL,
	`localId` varchar(64) NOT NULL,
	`code` varchar(20) NOT NULL,
	`serviceLocalId` varchar(64) NOT NULL,
	`recipientName` varchar(255),
	`recipientPhone` varchar(20),
	`message` text,
	`redeemed` boolean NOT NULL DEFAULT false,
	`redeemedAt` timestamp,
	`expiresAt` varchar(10),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gift_cards_id` PRIMARY KEY(`id`)
);
