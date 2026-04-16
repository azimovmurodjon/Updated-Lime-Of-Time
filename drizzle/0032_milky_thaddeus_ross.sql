CREATE TABLE `admin_audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actor` varchar(100) NOT NULL DEFAULT 'admin',
	`category` varchar(50) NOT NULL,
	`action` varchar(255) NOT NULL,
	`details` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_audit_log_id` PRIMARY KEY(`id`)
);
