-- 阶段 1：将零件档案升级为受控的零件主数据与版本。
-- 旧 part 的技术字段会迁移为已发布的 01 版，原始引用仍保持指向 part。

DO $$ BEGIN
  CREATE TYPE "PartLifecycleState" AS ENUM ('draft', 'reviewing', 'released', 'obsolete');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PartCriticality" AS ENUM ('normal', 'important', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "part" ADD COLUMN IF NOT EXISTS "current_revision_id" UUID;
ALTER TABLE "part" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
UPDATE "part" SET "is_active" = false WHERE "status" = '退役';

CREATE TABLE IF NOT EXISTS "part_revision" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "part_id" TEXT NOT NULL,
  "revision_no" TEXT NOT NULL,
  "revision_seq" INTEGER NOT NULL,
  "lifecycle_state" "PartLifecycleState" NOT NULL DEFAULT 'draft',
  "drawing_no" TEXT,
  "unit" TEXT,
  "specification" TEXT,
  "material" TEXT,
  "supplier" TEXT,
  "criticality" "PartCriticality" NOT NULL DEFAULT 'normal',
  "key_characteristics" JSONB,
  "change_summary" TEXT,
  "effective_from" TIMESTAMP(3),
  "effective_to" TIMESTAMP(3),
  "released_at" TIMESTAMP(3),
  "released_by" TEXT,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "remark" TEXT,
  CONSTRAINT "part_revision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "part_revision_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "part"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

DO $$
DECLARE
  fallback_user_id TEXT;
BEGIN
  SELECT "id" INTO fallback_user_id FROM "user" ORDER BY "created_at" ASC LIMIT 1;
  IF fallback_user_id IS NULL AND EXISTS (SELECT 1 FROM "part") THEN
    RAISE EXCEPTION '无法迁移零件版本：user 表中不存在可用的创建人';
  END IF;

  INSERT INTO "part_revision" (
    "part_id", "revision_no", "revision_seq", "lifecycle_state", "specification",
    "material", "supplier", "change_summary", "effective_from", "released_at",
    "released_by", "created_by", "remark"
  )
  SELECT
    p."id", '01', 1, 'released', p."specification", p."material", p."supplier",
    '由历史零件档案自动迁移', NOW(), NOW(), COALESCE(p."created_by", fallback_user_id),
    COALESCE(p."created_by", fallback_user_id), p."remark"
  FROM "part" p
  WHERE NOT EXISTS (SELECT 1 FROM "part_revision" r WHERE r."part_id" = p."id");
END $$;

UPDATE "part" p
SET "current_revision_id" = r."id"
FROM "part_revision" r
WHERE r."part_id" = p."id"
  AND r."revision_no" = '01'
  AND p."current_revision_id" IS NULL;

ALTER TABLE "part"
  ADD CONSTRAINT "part_current_revision_id_fkey"
  FOREIGN KEY ("current_revision_id") REFERENCES "part_revision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "part_revision_drawing_no_key" ON "part_revision"("drawing_no");
CREATE UNIQUE INDEX IF NOT EXISTS "part_revision_part_id_revision_no_key" ON "part_revision"("part_id", "revision_no");
CREATE INDEX IF NOT EXISTS "part_revision_part_id_lifecycle_state_idx" ON "part_revision"("part_id", "lifecycle_state");
CREATE INDEX IF NOT EXISTS "part_current_revision_id_idx" ON "part"("current_revision_id");

ALTER TABLE "part" DROP COLUMN "specification";
ALTER TABLE "part" DROP COLUMN "material";
ALTER TABLE "part" DROP COLUMN "supplier";
ALTER TABLE "part" DROP COLUMN "remark";
ALTER TABLE "part" DROP COLUMN "status";
