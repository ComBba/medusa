import { Migration } from '@mikro-orm/migrations';

export class Migration20250717143525 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "amazon_marketplace" drop constraint if exists "amazon_marketplace_marketplace_id_unique";`);
    this.addSql(`create table if not exists "amazon_marketplace" ("id" text not null, "marketplace_id" text not null, "country_code" text not null, "name" text not null, "currency_code" text not null, "region" text not null, "endpoint" text not null, "seller_id" text null, "mws_auth_token" text null, "is_active" boolean not null default false, "auto_sync" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "amazon_marketplace_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_amazon_marketplace_marketplace_id_unique" ON "amazon_marketplace" (marketplace_id) WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_amazon_marketplace_deleted_at" ON "amazon_marketplace" (deleted_at) WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "amazon_product_sync" ("id" text not null, "medusa_product_id" text not null, "amazon_marketplace_id" text not null, "amazon_asin" text null, "amazon_sku" text null, "amazon_listing_id" text null, "sync_status" text check ("sync_status" in ('pending', 'processing', 'completed', 'failed', 'cancelled')) not null default 'pending', "last_sync_at" timestamptz null, "sync_attempts" integer not null default 0, "max_attempts" integer not null default 3, "error_message" text null, "error_code" text null, "feed_submission_id" text null, "processing_status" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "amazon_product_sync_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_amazon_product_sync_deleted_at" ON "amazon_product_sync" (deleted_at) WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "amazon_marketplace" cascade;`);

    this.addSql(`drop table if exists "amazon_product_sync" cascade;`);
  }

}
