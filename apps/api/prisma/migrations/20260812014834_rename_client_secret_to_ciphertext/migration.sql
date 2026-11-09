/*
  Warnings:

  - You are about to drop the column `secretHash` on the `client_secrets` table. All the data in the column will be lost.
  - Added the required column `secretCiphertext` to the `client_secrets` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "client_secrets" DROP COLUMN "secretHash",
ADD COLUMN     "secretCiphertext" TEXT NOT NULL;
