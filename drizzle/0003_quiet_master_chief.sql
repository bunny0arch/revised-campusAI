CREATE TABLE `local_account_sessions` (
	`id` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `local_account_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `local_account_sessions_token_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `local_accounts` (
	`id` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`username` varchar(32) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `local_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `local_accounts_user_unique` UNIQUE(`userId`),
	CONSTRAINT `local_accounts_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE INDEX `local_account_sessions_user_expiry_idx` ON `local_account_sessions` (`userId`,`expiresAt`);