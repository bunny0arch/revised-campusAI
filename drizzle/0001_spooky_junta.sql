CREATE TABLE `agent_runs` (
	`id` varchar(32) NOT NULL,
	`conversationId` varchar(32),
	`userId` int NOT NULL,
	`agent` enum('orchestrator','it_diagnostics','student_support','facilities','academic_advisor') NOT NULL,
	`status` enum('routing','running','completed','escalated','failed') NOT NULL DEFAULT 'routing',
	`intent` varchar(80),
	`summary` text,
	`escalationRequired` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `agent_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversation_messages` (
	`id` varchar(32) NOT NULL,
	`conversationId` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`agent` varchar(40),
	`content` text NOT NULL,
	`citations` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `conversation_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(180) NOT NULL,
	`status` enum('active','closed') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `incidents` (
	`id` varchar(32) NOT NULL,
	`title` varchar(180) NOT NULL,
	`service` varchar(100) NOT NULL,
	`affectedArea` varchar(180),
	`severity` enum('minor','major','critical') NOT NULL DEFAULT 'minor',
	`status` enum('investigating','monitoring','resolved') NOT NULL DEFAULT 'investigating',
	`aiInsight` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	CONSTRAINT `incidents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledge_articles` (
	`id` varchar(32) NOT NULL,
	`title` varchar(200) NOT NULL,
	`category` varchar(80) NOT NULL,
	`content` text NOT NULL,
	`sourceUrl` varchar(1000),
	`published` boolean NOT NULL DEFAULT false,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `knowledge_articles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` varchar(32) NOT NULL,
	`userId` int,
	`type` enum('ticket','incident','escalation','system') NOT NULL,
	`title` varchar(180) NOT NULL,
	`body` text NOT NULL,
	`href` varchar(300),
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scheduled_operations` (
	`id` varchar(32) NOT NULL,
	`operationKey` varchar(80) NOT NULL,
	`scheduleCronTaskUid` varchar(65),
	`lastRunAt` timestamp,
	`lastStatus` enum('idle','success','failed') NOT NULL DEFAULT 'idle',
	`details` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scheduled_operations_id` PRIMARY KEY(`id`),
	CONSTRAINT `scheduled_operations_operationKey_unique` UNIQUE(`operationKey`)
);
--> statement-breakpoint
CREATE TABLE `ticket_events` (
	`id` varchar(32) NOT NULL,
	`ticketId` varchar(32) NOT NULL,
	`actorUserId` int,
	`type` enum('created','assigned','status_changed','comment','escalated') NOT NULL,
	`fromStatus` enum('open','in_progress','resolved'),
	`toStatus` enum('open','in_progress','resolved'),
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ticket_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` varchar(32) NOT NULL,
	`ticketNumber` varchar(24) NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(180) NOT NULL,
	`description` text NOT NULL,
	`category` enum('wifi','account','software','hardware','printing','facilities','academic','general') NOT NULL DEFAULT 'general',
	`priority` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`status` enum('open','in_progress','resolved') NOT NULL DEFAULT 'open',
	`assignee` varchar(120),
	`location` varchar(160),
	`aiSummary` text,
	`diagnosticSummary` text,
	`escalated` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`resolvedAt` timestamp,
	CONSTRAINT `tickets_id` PRIMARY KEY(`id`),
	CONSTRAINT `tickets_ticketNumber_unique` UNIQUE(`ticketNumber`)
);
--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`campusId` varchar(64),
	`campusRole` enum('student','faculty','it_staff') NOT NULL DEFAULT 'student',
	`department` varchar(140),
	`program` varchar(160),
	`yearOfStudy` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_profiles_user_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE INDEX `agent_runs_user_created_idx` ON `agent_runs` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `conversation_messages_conversation_created_idx` ON `conversation_messages` (`conversationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `conversations_user_updated_idx` ON `conversations` (`userId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `incidents_status_created_idx` ON `incidents` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `knowledge_articles_published_category_idx` ON `knowledge_articles` (`published`,`category`);--> statement-breakpoint
CREATE INDEX `notifications_user_created_idx` ON `notifications` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `ticket_events_ticket_created_idx` ON `ticket_events` (`ticketId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `tickets_status_updated_idx` ON `tickets` (`status`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `tickets_user_updated_idx` ON `tickets` (`userId`,`updatedAt`);