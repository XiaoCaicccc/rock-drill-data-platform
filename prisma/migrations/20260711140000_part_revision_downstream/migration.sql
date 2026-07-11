-- 阶段 1：检测、设备装配和报告引用改为面向零件版本。
-- 历史检测数据保留 NULL version，前端展示为“未知版本”。

ALTER TABLE "inspection_data_item" ADD COLUMN IF NOT EXISTS "part_revision_id" UUID;

CREATE TABLE IF NOT EXISTS "equipment_part_installation" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "equipment_id" TEXT NOT NULL,
  "part_revision_id" UUID NOT NULL,
  "installed_at" TIMESTAMP(3) NOT NULL,
  "removed_at" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'active',
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "remark" TEXT,
  CONSTRAINT "equipment_part_installation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "equipment_part_installation_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "equipment_part_installation_part_revision_id_fkey" FOREIGN KEY ("part_revision_id") REFERENCES "part_revision"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "analysis_report_part_revision" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "report_id" TEXT NOT NULL,
  "part_revision_id" UUID NOT NULL,
  "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analysis_report_part_revision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "analysis_report_part_revision_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "analysis_report"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "analysis_report_part_revision_part_revision_id_fkey" FOREIGN KEY ("part_revision_id") REFERENCES "part_revision"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "inspection_data_item"
  ADD CONSTRAINT "inspection_data_item_part_revision_id_fkey"
  FOREIGN KEY ("part_revision_id") REFERENCES "part_revision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "inspection_data_item_part_revision_id_idx" ON "inspection_data_item"("part_revision_id");
CREATE INDEX IF NOT EXISTS "equipment_part_installation_equipment_id_idx" ON "equipment_part_installation"("equipment_id");
CREATE INDEX IF NOT EXISTS "equipment_part_installation_part_revision_id_idx" ON "equipment_part_installation"("part_revision_id");
CREATE UNIQUE INDEX IF NOT EXISTS "analysis_report_part_revision_report_id_part_revision_id_key" ON "analysis_report_part_revision"("report_id", "part_revision_id");
CREATE INDEX IF NOT EXISTS "analysis_report_part_revision_report_id_idx" ON "analysis_report_part_revision"("report_id");

DO $$
DECLARE fallback_user_id TEXT;
BEGIN
  SELECT "id" INTO fallback_user_id FROM "user" ORDER BY "created_at" ASC LIMIT 1;
  INSERT INTO "equipment_part_installation" (
    "equipment_id", "part_revision_id", "installed_at", "status", "created_by", "remark"
  )
  SELECT p."equipment_id", p."current_revision_id", COALESCE(p."install_date", CURRENT_TIMESTAMP),
    'active', COALESCE(p."created_by", fallback_user_id), '由历史零件设备关联自动迁移'
  FROM "part" p
  WHERE p."equipment_id" IS NOT NULL
    AND p."current_revision_id" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM "equipment_part_installation" i
      WHERE i."equipment_id" = p."equipment_id" AND i."part_revision_id" = p."current_revision_id" AND i."status" = 'active'
    );
END $$;

ALTER TABLE "part" DROP CONSTRAINT IF EXISTS "part_equipment_id_fkey";
ALTER TABLE "part" DROP COLUMN "equipment_id";
