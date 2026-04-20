CREATE TABLE `otp_send_log` (
  `id` int AUTO_INCREMENT NOT NULL,
  `phone` varchar(30) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'sent',
  `errorMessage` text,
  `source` varchar(30) NOT NULL DEFAULT 'admin_panel',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `otp_send_log_id` PRIMARY KEY(`id`)
);
