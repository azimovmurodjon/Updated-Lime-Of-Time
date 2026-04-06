CREATE TABLE `appointments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`businessOwnerId` int NOT NULL,
	`localId` varchar(64) NOT NULL,
	`serviceLocalId` varchar(64) NOT NULL,
	`clientLocalId` varchar(64) NOT NULL,
	`date` varchar(10) NOT NULL,
	`time` varchar(5) NOT NULL,
	`duration` int NOT NULL,
	`status` enum('pending','confirmed','completed','cancelled') NOT NULL DEFAULT 'pending',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `appointments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `business_owners` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`phone` varchar(20) NOT NULL,
	`businessName` varchar(255) NOT NULL,
	`ownerName` varchar(255),
	`email` varchar(320),
	`address` text,
	`website` varchar(500),
	`description` text,
	`businessLogoUri` text,
	`defaultDuration` int NOT NULL DEFAULT 60,
	`notificationsEnabled` boolean NOT NULL DEFAULT true,
	`themeMode` enum('light','dark','system') NOT NULL DEFAULT 'system',
	`temporaryClosed` boolean NOT NULL DEFAULT false,
	`workingHours` json,
	`cancellationPolicy` json,
	`onboardingComplete` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `business_owners_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`businessOwnerId` int NOT NULL,
	`localId` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`phone` varchar(20),
	`email` varchar(320),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`businessOwnerId` int NOT NULL,
	`localId` varchar(64) NOT NULL,
	`clientLocalId` varchar(64) NOT NULL,
	`appointmentLocalId` varchar(64),
	`rating` int NOT NULL,
	`comment` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`businessOwnerId` int NOT NULL,
	`localId` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`duration` int NOT NULL,
	`price` decimal(10,2) NOT NULL,
	`color` varchar(20) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `services_id` PRIMARY KEY(`id`)
);
