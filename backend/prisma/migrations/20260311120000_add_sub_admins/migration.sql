ALTER TYPE "admin_role" ADD VALUE IF NOT EXISTS 'SUB_ADMIN';

CREATE TYPE "merchant_permission_scope" AS ENUM ('STATUS_CHANGE');

ALTER TABLE "admins"
ADD COLUMN "parent_admin_id" INTEGER,
ADD COLUMN "created_by_id" INTEGER;

ALTER TABLE "admins"
ADD CONSTRAINT "admins_parent_admin_id_fkey"
FOREIGN KEY ("parent_admin_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "admins"
ADD CONSTRAINT "admins_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "sub_admin_merchants" (
    "id" SERIAL NOT NULL,
    "merchant_id" INTEGER NOT NULL,
    "sub_admin_id" INTEGER NOT NULL,
    "parent_admin_id" INTEGER NOT NULL,
    "assigned_by" INTEGER NOT NULL,
    "permission_scope" "merchant_permission_scope" NOT NULL DEFAULT 'STATUS_CHANGE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sub_admin_merchants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uniq_sub_admin_merchant" ON "sub_admin_merchants"("merchant_id", "sub_admin_id");
CREATE INDEX "idx_sub_admin_merchants_sub_admin_id" ON "sub_admin_merchants"("sub_admin_id");
CREATE INDEX "idx_sub_admin_merchants_parent_admin_id" ON "sub_admin_merchants"("parent_admin_id");

ALTER TABLE "sub_admin_merchants"
ADD CONSTRAINT "sub_admin_merchants_merchant_id_fkey"
FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sub_admin_merchants"
ADD CONSTRAINT "sub_admin_merchants_sub_admin_id_fkey"
FOREIGN KEY ("sub_admin_id") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sub_admin_merchants"
ADD CONSTRAINT "sub_admin_merchants_parent_admin_id_fkey"
FOREIGN KEY ("parent_admin_id") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sub_admin_merchants"
ADD CONSTRAINT "sub_admin_merchants_assigned_by_fkey"
FOREIGN KEY ("assigned_by") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
