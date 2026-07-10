-- 生产库既有结构基线：仅用于初始化 Prisma 迁移历史。
-- 已存在的生产数据库必须通过 `prisma migrate resolve --applied 0_init` 标记，
-- 不应直接执行本文件。

CREATE SCHEMA IF NOT EXISTS "public";

CREATE TABLE "public"."analysis_report" (
    "id" TEXT NOT NULL,
    "report_no" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "period" TEXT,
    "summary" TEXT,
    "conclusion" TEXT,
    "author" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT '草稿',
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "analysis_report_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."attendance_record" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "member_name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "remark" TEXT,
    CONSTRAINT "attendance_record_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."document" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "file_path" TEXT,
    "related_report_id" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."equipment" (
    "id" TEXT NOT NULL,
    "machine_no" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "manufacturer" TEXT,
    "production_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT '在用',
    "current_location" TEXT,
    "total_working_hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."inspection_data_item" (
    "id" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "part_id" TEXT NOT NULL,
    "param_item_id" TEXT NOT NULL,
    "value_number" DOUBLE PRECISION,
    "value_text" TEXT,
    "is_qualified" BOOLEAN,
    "is_optimal" BOOLEAN,
    CONSTRAINT "inspection_data_item_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."inspection_record" (
    "id" TEXT NOT NULL,
    "record_no" TEXT NOT NULL,
    "equipment_id" TEXT,
    "inspector" TEXT NOT NULL,
    "batch_no" TEXT,
    "inspection_date" TIMESTAMP(3) NOT NULL,
    "overall_result" TEXT NOT NULL DEFAULT '待检',
    "remark" TEXT,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "inspection_record_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."meeting" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "meeting_date" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "organizer" TEXT NOT NULL,
    "participants" TEXT,
    "minutes_content" TEXT,
    "status" TEXT NOT NULL DEFAULT '待召开',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "meeting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."meeting_resolution" (
    "id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "responsible_person" TEXT,
    "due_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT '待执行',
    CONSTRAINT "meeting_resolution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."parameter_item" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "param_name" TEXT NOT NULL,
    "param_code" TEXT NOT NULL,
    "unit" TEXT,
    "data_type" TEXT NOT NULL DEFAULT 'number',
    "standard_min" DOUBLE PRECISION,
    "standard_max" DOUBLE PRECISION,
    "optimal_min" DOUBLE PRECISION,
    "optimal_max" DOUBLE PRECISION,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "options" TEXT,
    CONSTRAINT "parameter_item_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."parameter_template" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "parameter_template_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."part" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "specification" TEXT,
    "material" TEXT,
    "supplier" TEXT,
    "equipment_id" TEXT,
    "install_date" TIMESTAMP(3),
    "working_hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT '在用',
    "remark" TEXT,
    CONSTRAINT "part_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."part_category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "standard_param_count" INTEGER NOT NULL DEFAULT 40,
    CONSTRAINT "part_category_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT NOT NULL DEFAULT '中',
    "status" TEXT NOT NULL DEFAULT '待办',
    "assignee" TEXT,
    "due_date" TIMESTAMP(3),
    "task_type" TEXT NOT NULL DEFAULT '常规',
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "task_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "analysis_report_report_no_key" ON "public"."analysis_report"("report_no" ASC);
CREATE UNIQUE INDEX "equipment_machine_no_key" ON "public"."equipment"("machine_no" ASC);
CREATE INDEX "inspection_data_item_param_item_id_idx" ON "public"."inspection_data_item"("param_item_id" ASC);
CREATE INDEX "inspection_data_item_part_id_idx" ON "public"."inspection_data_item"("part_id" ASC);
CREATE INDEX "inspection_data_item_record_id_idx" ON "public"."inspection_data_item"("record_id" ASC);
CREATE UNIQUE INDEX "inspection_record_record_no_key" ON "public"."inspection_record"("record_no" ASC);
CREATE UNIQUE INDEX "parameter_template_category_id_key" ON "public"."parameter_template"("category_id" ASC);
CREATE UNIQUE INDEX "part_code_key" ON "public"."part"("code" ASC);
CREATE UNIQUE INDEX "part_category_code_key" ON "public"."part_category"("code" ASC);
CREATE UNIQUE INDEX "part_category_name_key" ON "public"."part_category"("name" ASC);
CREATE UNIQUE INDEX "user_email_key" ON "public"."user"("email" ASC);

ALTER TABLE "public"."analysis_report" ADD CONSTRAINT "analysis_report_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."inspection_data_item" ADD CONSTRAINT "inspection_data_item_param_item_id_fkey" FOREIGN KEY ("param_item_id") REFERENCES "public"."parameter_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."inspection_data_item" ADD CONSTRAINT "inspection_data_item_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "public"."part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."inspection_data_item" ADD CONSTRAINT "inspection_data_item_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "public"."inspection_record"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."inspection_record" ADD CONSTRAINT "inspection_record_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."inspection_record" ADD CONSTRAINT "inspection_record_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."meeting_resolution" ADD CONSTRAINT "meeting_resolution_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."parameter_item" ADD CONSTRAINT "parameter_item_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."parameter_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."parameter_template" ADD CONSTRAINT "parameter_template_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."part_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."part" ADD CONSTRAINT "part_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."part_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."part" ADD CONSTRAINT "part_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."task" ADD CONSTRAINT "task_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
