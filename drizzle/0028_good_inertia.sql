CREATE TABLE `admin_expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` varchar(10) NOT NULL,
	`category` enum('hosting','marketing','software','payroll','legal','other') NOT NULL DEFAULT 'other',
	`description` varchar(255) NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_expenses_id` PRIMARY KEY(`id`)
);
