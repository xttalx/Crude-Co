-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('owner', 'admin', 'member', 'accountant');

-- CreateEnum
CREATE TYPE "ExpenseSource" AS ENUM ('manual', 'recurring', 'receipt_scan', 'import');

-- CreateEnum
CREATE TYPE "DeductibilityStatus" AS ENUM ('deductible', 'partial', 'non_deductible', 'unknown');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('csv', 'xlsx');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('queued', 'running', 'done', 'failed');

-- CreateEnum
CREATE TYPE "AiSuggestionType" AS ENUM ('category', 'vendor', 'deductibility', 'anomaly');

-- CreateEnum
CREATE TYPE "AuditEntityType" AS ENUM ('user', 'organization', 'expense', 'receipt', 'recurring_expense', 'export', 'tax_rule_pack');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "jobType" TEXT,
    "city" TEXT,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeductionRule" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "deductiblePercent" INTEGER NOT NULL DEFAULT 100,
    "reimbursementEligible" BOOLEAN NOT NULL DEFAULT true,
    "receiptRecommended" BOOLEAN NOT NULL DEFAULT false,
    "businessPurposeRecommended" BOOLEAN NOT NULL DEFAULT false,
    "jurisdictionNotes" TEXT,
    "countryCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeductionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'owner',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessProfile" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "businessType" TEXT NOT NULL,
    "industryCode" TEXT NOT NULL,
    "employeeCount" INTEGER NOT NULL DEFAULT 0,
    "settingsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Jurisdiction" (
    "code" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "currency" TEXT NOT NULL,

    CONSTRAINT "Jurisdiction_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "OrgJurisdiction" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "jurisdictionCode" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "taxYearStartMonth" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgJurisdiction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRulePack" (
    "id" TEXT NOT NULL,
    "jurisdictionCode" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "rulesJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxRulePack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT,
    "country" TEXT,
    "taxId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "last4" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "jurisdictionCode" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deductionType" TEXT NOT NULL,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "paymentMethodId" TEXT NOT NULL,
    "vendorId" TEXT,
    "description" TEXT,
    "jurisdictionCode" TEXT,
    "source" "ExpenseSource" NOT NULL DEFAULT 'manual',
    "deductibilityStatus" "DeductibilityStatus" NOT NULL DEFAULT 'unknown',
    "deductibleAmountMinor" INTEGER,
    "nonClaimableAmountMinor" INTEGER,
    "taxAmountMinor" INTEGER,
    "taxInclusive" BOOLEAN NOT NULL DEFAULT true,
    "parsedSnapshotJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "sha256" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "extractedJson" JSONB,
    "confidenceScore" DOUBLE PRECISION,
    "ocrStatus" TEXT NOT NULL DEFAULT 'none',
    "ocrProvider" TEXT,
    "storageProvider" TEXT NOT NULL DEFAULT 'local',

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringExpense" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "templateJson" JSONB NOT NULL,
    "schedule" TEXT NOT NULL,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Export" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "jurisdictionCode" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "ExportStatus" NOT NULL DEFAULT 'queued',
    "storageKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Export_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiSuggestion" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "type" "AiSuggestionType" NOT NULL,
    "suggestionJson" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "AiSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" "AuditEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "diffJson" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "DeductionRule_categoryId_key" ON "DeductionRule"("categoryId");

-- CreateIndex
CREATE INDEX "DeductionRule_orgId_idx" ON "DeductionRule"("orgId");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_orgId_userId_key" ON "Membership"("orgId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessProfile_orgId_key" ON "BusinessProfile"("orgId");

-- CreateIndex
CREATE INDEX "OrgJurisdiction_jurisdictionCode_idx" ON "OrgJurisdiction"("jurisdictionCode");

-- CreateIndex
CREATE UNIQUE INDEX "OrgJurisdiction_orgId_jurisdictionCode_key" ON "OrgJurisdiction"("orgId", "jurisdictionCode");

-- CreateIndex
CREATE INDEX "TaxRulePack_jurisdictionCode_effectiveFrom_idx" ON "TaxRulePack"("jurisdictionCode", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRulePack_jurisdictionCode_version_key" ON "TaxRulePack"("jurisdictionCode", "version");

-- CreateIndex
CREATE INDEX "Vendor_orgId_name_idx" ON "Vendor"("orgId", "name");

-- CreateIndex
CREATE INDEX "PaymentMethod_orgId_type_idx" ON "PaymentMethod"("orgId", "type");

-- CreateIndex
CREATE INDEX "ExpenseCategory_orgId_name_idx" ON "ExpenseCategory"("orgId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_orgId_code_key" ON "ExpenseCategory"("orgId", "code");

-- CreateIndex
CREATE INDEX "Expense_orgId_expenseDate_idx" ON "Expense"("orgId", "expenseDate");

-- CreateIndex
CREATE INDEX "Expense_orgId_categoryId_idx" ON "Expense"("orgId", "categoryId");

-- CreateIndex
CREATE INDEX "Receipt_orgId_expenseId_idx" ON "Receipt"("orgId", "expenseId");

-- CreateIndex
CREATE INDEX "RecurringExpense_orgId_nextRunAt_idx" ON "RecurringExpense"("orgId", "nextRunAt");

-- CreateIndex
CREATE INDEX "Export_orgId_createdAt_idx" ON "Export"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "AiSuggestion_orgId_createdAt_idx" ON "AiSuggestion"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_orgId_createdAt_idx" ON "AuditEvent"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_orgId_action_idx" ON "AuditEvent"("orgId", "action");

-- AddForeignKey
ALTER TABLE "DeductionRule" ADD CONSTRAINT "DeductionRule_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeductionRule" ADD CONSTRAINT "DeductionRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessProfile" ADD CONSTRAINT "BusinessProfile_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgJurisdiction" ADD CONSTRAINT "OrgJurisdiction_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgJurisdiction" ADD CONSTRAINT "OrgJurisdiction_jurisdictionCode_fkey" FOREIGN KEY ("jurisdictionCode") REFERENCES "Jurisdiction"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRulePack" ADD CONSTRAINT "TaxRulePack_jurisdictionCode_fkey" FOREIGN KEY ("jurisdictionCode") REFERENCES "Jurisdiction"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Export" ADD CONSTRAINT "Export_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Export" ADD CONSTRAINT "Export_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSuggestion" ADD CONSTRAINT "AiSuggestion_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSuggestion" ADD CONSTRAINT "AiSuggestion_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

