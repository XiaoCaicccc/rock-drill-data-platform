-- SPEC-001-B B-1：报告生命周期数据层。
-- 保留既有 analysis_report.status 字符串和值，不将历史“草稿”“审核中”“已发布”“已归档”重写为 enum。
-- 已发布历史报告不自动回填快照，避免把当前数据误标为发布时快照。

ALTER TABLE "analysis_report"
  ADD COLUMN IF NOT EXISTS "review_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "source_context" JSONB;

CREATE TABLE IF NOT EXISTS "analysis_report_snapshot" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "report_id" TEXT NOT NULL,
  "content_snapshot" JSONB NOT NULL,
  "source_snapshot" JSONB NOT NULL,
  "published_by" TEXT NOT NULL,
  "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "analysis_report_snapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "analysis_report_snapshot_report_id_fkey"
    FOREIGN KEY ("report_id") REFERENCES "analysis_report"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "analysis_report_snapshot_published_by_fkey"
    FOREIGN KEY ("published_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "analysis_report_snapshot_report_id_key"
  ON "analysis_report_snapshot"("report_id");
CREATE INDEX IF NOT EXISTS "analysis_report_snapshot_published_by_idx"
  ON "analysis_report_snapshot"("published_by");
CREATE INDEX IF NOT EXISTS "analysis_report_snapshot_published_at_idx"
  ON "analysis_report_snapshot"("published_at");
CREATE INDEX IF NOT EXISTS "analysis_report_status_created_at_idx"
  ON "analysis_report"("status", "created_at");
CREATE INDEX IF NOT EXISTS "analysis_report_user_id_idx"
  ON "analysis_report"("user_id");
