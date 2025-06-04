/*
  Warnings:

  - You are about to drop the column `flex_balance` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `FlexUsage` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "FlexUsage" DROP CONSTRAINT "FlexUsage_user_id_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "flex_balance";

-- DropTable
DROP TABLE "FlexUsage";
