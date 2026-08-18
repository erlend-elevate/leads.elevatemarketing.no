CREATE TYPE "public"."business_type" AS ENUM('ecommerce', 'leadgen');--> statement-breakpoint
CREATE TYPE "public"."channel" AS ENUM('meta_ads', 'google_ads', 'gsc', 'ga4');--> statement-breakpoint
CREATE TYPE "public"."comparison" AS ENUM('previous_period', 'yoy', 'both');--> statement-breakpoint
CREATE TYPE "public"."frequency" AS ENUM('weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('pending', 'generating', 'ready', 'sent', 'failed');--> statement-breakpoint
CREATE TABLE "client_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"channel" "channel" NOT NULL,
	"windsor_connector" text NOT NULL,
	"account_id" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo_url" text,
	"brand_color" text,
	"timezone" text DEFAULT 'Europe/Oslo' NOT NULL,
	"currency" text DEFAULT 'NOK' NOT NULL,
	"goals_note" text,
	"business_type" "business_type" DEFAULT 'leadgen' NOT NULL,
	"portal_token" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clients_slug_unique" UNIQUE("slug"),
	CONSTRAINT "clients_portal_token_unique" UNIQUE("portal_token")
);
--> statement-breakpoint
CREATE TABLE "report_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"frequency" "frequency" DEFAULT 'monthly' NOT NULL,
	"recipients" text[] DEFAULT '{}' NOT NULL,
	"cc_internal" boolean DEFAULT true NOT NULL,
	"language" text DEFAULT 'nb-NO' NOT NULL,
	"sections" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"comparison" "comparison" DEFAULT 'previous_period' NOT NULL,
	"ai_summary_enabled" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"channel" "channel" NOT NULL,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"config_id" uuid NOT NULL,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"comparison_start" text,
	"comparison_end" text,
	"status" "report_status" DEFAULT 'pending' NOT NULL,
	"pdf_path" text,
	"ai_summary" jsonb,
	"error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "send_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"recipient" text NOT NULL,
	"resend_message_id" text,
	"status" text NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"agency_name" text DEFAULT 'Elevate Marketing' NOT NULL,
	"agency_logo_url" text,
	"primary_color" text DEFAULT '#111111' NOT NULL,
	"sender_name" text DEFAULT 'Elevate Marketing' NOT NULL,
	"reply_to" text,
	"footer_text" text,
	"last_tick_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_channels" ADD CONSTRAINT "client_channels_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_configs" ADD CONSTRAINT "report_configs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_snapshots" ADD CONSTRAINT "report_snapshots_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_config_id_report_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."report_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "send_log" ADD CONSTRAINT "send_log_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "client_channels_client_channel_uq" ON "client_channels" USING btree ("client_id","channel");--> statement-breakpoint
CREATE INDEX "report_snapshots_lookup_idx" ON "report_snapshots" USING btree ("client_id","channel","period_start");--> statement-breakpoint
CREATE UNIQUE INDEX "report_snapshots_uq" ON "report_snapshots" USING btree ("client_id","channel","period_start","period_end","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_config_period_uq" ON "reports" USING btree ("config_id","period_start");