-- 阶段 0：安全、角色、审计与对象存储元数据。
-- 本 migration 假定现有生产库已由历史 schema 创建；请使用 `prisma migrate deploy` 执行。

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('admin', 'quality_manager', 'inspector', 'engineer', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "user" ALTER COLUMN "role" DROP DEFAULT;
UPDATE "user" SET "role" = 'inspector' WHERE "role" IS NULL OR "role" NOT IN ('admin', 'quality_manager', 'inspector', 'engineer', 'viewer');
ALTER TABLE "user" ALTER COLUMN "role" TYPE "UserRole" USING "role"::"UserRole";
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'inspector';
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "organization_id" TEXT;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "failed_login_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "locked_until" TIMESTAMP(3);
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "mfa_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "mfa_secret" TEXT;

ALTER TABLE "equipment" ADD COLUMN IF NOT EXISTS "created_by" TEXT;
ALTER TABLE "part_category" ADD COLUMN IF NOT EXISTS "created_by" TEXT;
ALTER TABLE "part" ADD COLUMN IF NOT EXISTS "created_by" TEXT;
ALTER TABLE "parameter_template" ADD COLUMN IF NOT EXISTS "created_by" TEXT;
ALTER TABLE "meeting" ADD COLUMN IF NOT EXISTS "created_by" TEXT;
ALTER TABLE "attendance_record" ADD COLUMN IF NOT EXISTS "created_by" TEXT;

ALTER TABLE "document" RENAME COLUMN "file_path" TO "storage_key";
ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "original_name" TEXT;
ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "file_size" INTEGER;
ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "mime_type" TEXT;
ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "created_by" TEXT;

CREATE INDEX IF NOT EXISTS "equipment_created_by_idx" ON "equipment"("created_by");
CREATE INDEX IF NOT EXISTS "part_category_created_by_idx" ON "part_category"("created_by");
CREATE INDEX IF NOT EXISTS "part_created_by_idx" ON "part"("created_by");
CREATE INDEX IF NOT EXISTS "parameter_template_created_by_idx" ON "parameter_template"("created_by");
CREATE INDEX IF NOT EXISTS "meeting_created_by_idx" ON "meeting"("created_by");
CREATE INDEX IF NOT EXISTS "document_created_by_idx" ON "document"("created_by");
CREATE INDEX IF NOT EXISTS "attendance_record_created_by_idx" ON "attendance_record"("created_by");

CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "audit_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "audit_log_userId_createdAt_idx" ON "audit_log"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "audit_log_entityType_entityId_idx" ON "audit_log"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "audit_log_action_createdAt_idx" ON "audit_log"("action", "createdAt");
