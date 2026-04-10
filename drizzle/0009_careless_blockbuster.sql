CREATE TABLE `staff_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`businessOwnerId` int NOT NULL,
	`localId` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`phone` varchar(20),
	`email` varchar(320),
	`role` varchar(100),
	`color` varchar(20),
	`serviceIds` json,
	`workingHours` json,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `staff_members_id` PRIMARY KEY(`id`)
);
