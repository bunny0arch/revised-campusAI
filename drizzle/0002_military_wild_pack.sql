CREATE TABLE `public_support_messages` (
	`id` varchar(32) NOT NULL,
	`sessionId` varchar(32) NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`stage` enum('clarify','retrieve','guide','check','escalate') NOT NULL,
	`content` text NOT NULL,
	`citations` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `public_support_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `public_support_sessions` (
	`id` varchar(32) NOT NULL,
	`visitorToken` varchar(64) NOT NULL,
	`title` varchar(180) NOT NULL,
	`status` enum('diagnosing','resolved','escalated') NOT NULL DEFAULT 'diagnosing',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `public_support_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `public_support_tickets` (
	`id` varchar(32) NOT NULL,
	`ticketNumber` varchar(24) NOT NULL,
	`sessionId` varchar(32) NOT NULL,
	`title` varchar(180) NOT NULL,
	`description` text NOT NULL,
	`category` enum('wifi','account','password','software','network','printing','configuration','general') NOT NULL DEFAULT 'general',
	`priority` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`status` enum('open','in_progress','resolved') NOT NULL DEFAULT 'open',
	`triageSummary` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `public_support_tickets_id` PRIMARY KEY(`id`),
	CONSTRAINT `public_support_tickets_ticketNumber_unique` UNIQUE(`ticketNumber`)
);
--> statement-breakpoint
CREATE INDEX `public_support_messages_session_created_idx` ON `public_support_messages` (`sessionId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `public_support_sessions_visitor_updated_idx` ON `public_support_sessions` (`visitorToken`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `public_support_tickets_session_updated_idx` ON `public_support_tickets` (`sessionId`,`updatedAt`);