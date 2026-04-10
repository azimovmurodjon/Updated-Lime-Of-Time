CREATE TABLE `data_deletion_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320),
	`phone` varchar(20),
	`request_type` enum('full','client_data','business_data') NOT NULL DEFAULT 'full',
	`reason` text,
	`status` enum('pending','processing','completed','rejected') NOT NULL DEFAULT 'pending',
	`processedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `data_deletion_requests_id` PRIMARY KEY(`id`)
);
