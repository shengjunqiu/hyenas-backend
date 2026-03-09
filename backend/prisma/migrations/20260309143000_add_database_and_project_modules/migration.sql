-- CreateEnum
CREATE TYPE "field_type" AS ENUM ('TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'SELECT', 'MULTI_SELECT', 'BOOLEAN');

-- CreateEnum
CREATE TYPE "template_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "project_status" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "project_member_role" AS ENUM ('PROJECT_ADMIN', 'PROJECT_MEMBER');

-- CreateEnum
CREATE TYPE "import_source_type" AS ENUM ('MANUAL', 'EXCEL', 'PROJECT_IMPORT');

-- CreateTable
CREATE TABLE "data_templates" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "status" "template_status" NOT NULL DEFAULT 'DRAFT',
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "copied_from_id" INTEGER,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_template_fields" (
    "id" SERIAL NOT NULL,
    "template_id" INTEGER NOT NULL,
    "field_key" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "field_type" "field_type" NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_primary_key" BOOLEAN NOT NULL DEFAULT false,
    "is_listed" BOOLEAN NOT NULL DEFAULT false,
    "is_searchable" BOOLEAN NOT NULL DEFAULT false,
    "default_value" TEXT,
    "options_json" JSONB,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_template_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "database_records" (
    "id" SERIAL NOT NULL,
    "template_id" INTEGER NOT NULL,
    "primary_key_value" TEXT NOT NULL,
    "data_json" JSONB NOT NULL,
    "source_type" "import_source_type" NOT NULL DEFAULT 'MANUAL',
    "source_name" TEXT,
    "created_by" INTEGER NOT NULL,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "database_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "database_import_logs" (
    "id" SERIAL NOT NULL,
    "template_id" INTEGER NOT NULL,
    "file_name" TEXT NOT NULL,
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "created_count" INTEGER NOT NULL DEFAULT 0,
    "updated_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "failure_details_json" JSONB,
    "operator_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "database_import_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "template_id" INTEGER NOT NULL,
    "description" TEXT,
    "status" "project_status" NOT NULL DEFAULT 'DRAFT',
    "project_admin_id" INTEGER,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "admin_id" INTEGER NOT NULL,
    "role" "project_member_role" NOT NULL,
    "assigned_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_records" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "template_id" INTEGER NOT NULL,
    "source_record_id" INTEGER NOT NULL,
    "source_primary_key_value" TEXT NOT NULL,
    "data_json" JSONB NOT NULL,
    "imported_by" INTEGER NOT NULL,
    "created_by" INTEGER NOT NULL,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "project_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_import_logs" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "template_id" INTEGER NOT NULL,
    "record_ids_json" JSONB NOT NULL,
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "created_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "operator_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_import_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "data_templates_code_key" ON "data_templates"("code");

-- CreateIndex
CREATE INDEX "idx_data_template_fields_template_id" ON "data_template_fields"("template_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_data_template_field" ON "data_template_fields"("template_id", "field_key");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_database_record" ON "database_records"("template_id", "primary_key_value");

-- CreateIndex
CREATE INDEX "idx_database_records_template_pk" ON "database_records"("template_id", "primary_key_value");

-- CreateIndex
CREATE INDEX "idx_database_records_deleted_at" ON "database_records"("deleted_at");

-- CreateIndex
CREATE INDEX "idx_database_import_logs_template_id" ON "database_import_logs"("template_id");

-- CreateIndex
CREATE INDEX "idx_database_import_logs_operator_id" ON "database_import_logs"("operator_id");

-- CreateIndex
CREATE UNIQUE INDEX "projects_code_key" ON "projects"("code");

-- CreateIndex
CREATE INDEX "idx_projects_template_id" ON "projects"("template_id");

-- CreateIndex
CREATE INDEX "idx_projects_project_admin_id" ON "projects"("project_admin_id");

-- CreateIndex
CREATE INDEX "idx_projects_deleted_at" ON "projects"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_project_member" ON "project_members"("project_id", "admin_id");

-- CreateIndex
CREATE INDEX "idx_project_members_project_id" ON "project_members"("project_id");

-- CreateIndex
CREATE INDEX "idx_project_members_admin_id" ON "project_members"("admin_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_project_record" ON "project_records"("project_id", "source_record_id");

-- CreateIndex
CREATE INDEX "idx_project_records_project_id" ON "project_records"("project_id");

-- CreateIndex
CREATE INDEX "idx_project_records_template_id" ON "project_records"("template_id");

-- CreateIndex
CREATE INDEX "idx_project_records_deleted_at" ON "project_records"("deleted_at");

-- CreateIndex
CREATE INDEX "idx_project_import_logs_project_id" ON "project_import_logs"("project_id");

-- CreateIndex
CREATE INDEX "idx_project_import_logs_template_id" ON "project_import_logs"("template_id");

-- CreateIndex
CREATE INDEX "idx_project_import_logs_operator_id" ON "project_import_logs"("operator_id");

-- AddForeignKey
ALTER TABLE "data_templates" ADD CONSTRAINT "data_templates_copied_from_id_fkey" FOREIGN KEY ("copied_from_id") REFERENCES "data_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_templates" ADD CONSTRAINT "data_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_template_fields" ADD CONSTRAINT "data_template_fields_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "data_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "database_records" ADD CONSTRAINT "database_records_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "data_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "database_records" ADD CONSTRAINT "database_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "database_records" ADD CONSTRAINT "database_records_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "database_import_logs" ADD CONSTRAINT "database_import_logs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "data_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "database_import_logs" ADD CONSTRAINT "database_import_logs_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "data_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_project_admin_id_fkey" FOREIGN KEY ("project_admin_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_records" ADD CONSTRAINT "project_records_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_records" ADD CONSTRAINT "project_records_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "data_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_records" ADD CONSTRAINT "project_records_source_record_id_fkey" FOREIGN KEY ("source_record_id") REFERENCES "database_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_records" ADD CONSTRAINT "project_records_imported_by_fkey" FOREIGN KEY ("imported_by") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_records" ADD CONSTRAINT "project_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_records" ADD CONSTRAINT "project_records_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_import_logs" ADD CONSTRAINT "project_import_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_import_logs" ADD CONSTRAINT "project_import_logs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "data_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_import_logs" ADD CONSTRAINT "project_import_logs_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
