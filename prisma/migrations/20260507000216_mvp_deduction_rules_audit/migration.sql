-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "nonClaimableAmountMinor" INTEGER;
ALTER TABLE "Expense" ADD COLUMN "parsedSnapshotJson" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "country" TEXT;

-- CreateTable
CREATE TABLE "DeductionRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "deductiblePercent" INTEGER NOT NULL DEFAULT 100,
    "reimbursementEligible" BOOLEAN NOT NULL DEFAULT true,
    "receiptRecommended" BOOLEAN NOT NULL DEFAULT false,
    "businessPurposeRecommended" BOOLEAN NOT NULL DEFAULT false,
    "jurisdictionNotes" TEXT,
    "countryCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeductionRule_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DeductionRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Receipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "sha256" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "extractedJson" JSONB,
    "confidenceScore" REAL,
    "ocrStatus" TEXT NOT NULL DEFAULT 'none',
    "ocrProvider" TEXT,
    "storageProvider" TEXT NOT NULL DEFAULT 'local',
    CONSTRAINT "Receipt_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Receipt_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Receipt" ("confidenceScore", "contentType", "expenseId", "extractedJson", "fileSize", "id", "orgId", "sha256", "storageKey", "uploadedAt") SELECT "confidenceScore", "contentType", "expenseId", "extractedJson", "fileSize", "id", "orgId", "sha256", "storageKey", "uploadedAt" FROM "Receipt";
DROP TABLE "Receipt";
ALTER TABLE "new_Receipt" RENAME TO "Receipt";
CREATE INDEX "Receipt_orgId_expenseId_idx" ON "Receipt"("orgId", "expenseId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "DeductionRule_categoryId_key" ON "DeductionRule"("categoryId");

-- CreateIndex
CREATE INDEX "DeductionRule_orgId_idx" ON "DeductionRule"("orgId");
