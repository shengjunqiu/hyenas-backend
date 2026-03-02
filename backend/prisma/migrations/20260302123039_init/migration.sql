-- CreateEnum
CREATE TYPE "admin_role" AS ENUM ('SUPER', 'NORMAL');

-- CreateEnum
CREATE TYPE "admin_status" AS ENUM ('ENABLED', 'DISABLED');

-- CreateEnum
CREATE TYPE "merchant_field_type" AS ENUM ('TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'SELECT', 'MULTI_SELECT', 'BOOLEAN');

-- CreateTable
CREATE TABLE "admins" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "admin_role" NOT NULL DEFAULT 'NORMAL',
    "status" "admin_status" NOT NULL DEFAULT 'ENABLED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchants" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "credit_code" TEXT,
    "contact_name" TEXT,
    "contact_phone" TEXT,
    "address" TEXT,
    "license_no" TEXT,
    "business_type" TEXT,
    "status_id" INTEGER NOT NULL,
    "remark" TEXT,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "merchants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_statuses" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "color" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_field_defs" (
    "id" SERIAL NOT NULL,
    "field_key" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "field_type" "merchant_field_type" NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_searchable" BOOLEAN NOT NULL DEFAULT false,
    "default_value" TEXT,
    "options_json" JSONB,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_field_defs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_field_values" (
    "id" SERIAL NOT NULL,
    "merchant_id" INTEGER NOT NULL,
    "field_def_id" INTEGER NOT NULL,
    "value_text" TEXT,
    "value_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_field_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_admins" (
    "id" SERIAL NOT NULL,
    "merchant_id" INTEGER NOT NULL,
    "admin_id" INTEGER NOT NULL,
    "assigned_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_status_logs" (
    "id" SERIAL NOT NULL,
    "merchant_id" INTEGER NOT NULL,
    "from_status_id" INTEGER,
    "to_status_id" INTEGER NOT NULL,
    "changed_by" INTEGER NOT NULL,
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_status_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operation_logs" (
    "id" SERIAL NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" INTEGER,
    "target_name" TEXT,
    "operator_id" INTEGER NOT NULL,
    "operator_name" TEXT NOT NULL,
    "before_data" JSONB,
    "after_data" JSONB,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admins_username_key" ON "admins"("username");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_statuses_code_key" ON "merchant_statuses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_field_defs_field_key_key" ON "merchant_field_defs"("field_key");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_merchant_field_value" ON "merchant_field_values"("merchant_id", "field_def_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_merchant_admin" ON "merchant_admins"("merchant_id", "admin_id");

-- AddForeignKey
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "merchant_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_field_values" ADD CONSTRAINT "merchant_field_values_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_field_values" ADD CONSTRAINT "merchant_field_values_field_def_id_fkey" FOREIGN KEY ("field_def_id") REFERENCES "merchant_field_defs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_admins" ADD CONSTRAINT "merchant_admins_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_admins" ADD CONSTRAINT "merchant_admins_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_admins" ADD CONSTRAINT "merchant_admins_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_status_logs" ADD CONSTRAINT "merchant_status_logs_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_status_logs" ADD CONSTRAINT "merchant_status_logs_from_status_id_fkey" FOREIGN KEY ("from_status_id") REFERENCES "merchant_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_status_logs" ADD CONSTRAINT "merchant_status_logs_to_status_id_fkey" FOREIGN KEY ("to_status_id") REFERENCES "merchant_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_status_logs" ADD CONSTRAINT "merchant_status_logs_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_logs" ADD CONSTRAINT "operation_logs_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
