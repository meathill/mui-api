ALTER TABLE `user` ADD `accepted_terms_at` integer;
--> statement-breakpoint
ALTER TABLE `user` ADD `accepted_terms_version` text;
--> statement-breakpoint
ALTER TABLE `user` ADD `accepted_privacy_version` text;
