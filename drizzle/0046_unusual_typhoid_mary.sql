DROP TABLE `client_accounts`;--> statement-breakpoint
DROP TABLE `client_messages`;--> statement-breakpoint
DROP TABLE `client_saved_businesses`;--> statement-breakpoint
DROP TABLE `service_photos`;--> statement-breakpoint
ALTER TABLE `business_owners` DROP COLUMN `businessCategory`;--> statement-breakpoint
ALTER TABLE `business_owners` DROP COLUMN `lat`;--> statement-breakpoint
ALTER TABLE `business_owners` DROP COLUMN `lng`;--> statement-breakpoint
ALTER TABLE `business_owners` DROP COLUMN `clientPortalVisible`;--> statement-breakpoint
ALTER TABLE `business_owners` DROP COLUMN `appStoreUrl`;--> statement-breakpoint
ALTER TABLE `business_owners` DROP COLUMN `playStoreUrl`;--> statement-breakpoint
ALTER TABLE `locations` DROP COLUMN `lat`;--> statement-breakpoint
ALTER TABLE `locations` DROP COLUMN `lng`;