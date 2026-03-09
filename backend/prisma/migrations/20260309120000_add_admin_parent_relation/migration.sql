ALTER TABLE "admins"
ADD COLUMN "parent_admin_id" INTEGER;

ALTER TABLE "admins"
ADD CONSTRAINT "admins_parent_admin_id_fkey"
FOREIGN KEY ("parent_admin_id") REFERENCES "admins"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "admins_parent_admin_id_idx" ON "admins"("parent_admin_id");
