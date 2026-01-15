/*
  Warnings:

  - The `permission` column on the `DocumentCollaborator` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('VIEW', 'EDIT', 'OWNER');

-- AlterTable
ALTER TABLE "DocumentCollaborator" DROP COLUMN "permission",
ADD COLUMN     "permission" "Role" NOT NULL DEFAULT 'EDIT';
