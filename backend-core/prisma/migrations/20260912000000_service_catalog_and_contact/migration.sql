-- Service catalog (Service Boxes) + Contact requests
-- Spec Section 4.1 / 15 / 27: service_lines + contact_requests tables.

-- CreateTable
CREATE TABLE "ServiceLineCatalog" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "serviceLine" "ServiceLine" NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '🧩',
    "startingPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "includes" JSONB,
    "timelineWeeks" INTEGER,
    "statusPipeline" JSONB,
    "isMostRequested" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ServiceLineCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactRequest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "message" TEXT NOT NULL,
    "sourcePage" TEXT NOT NULL DEFAULT 'contact',
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceLineCatalog_slug_key" ON "ServiceLineCatalog"("slug");
CREATE UNIQUE INDEX "ServiceLineCatalog_serviceLine_key" ON "ServiceLineCatalog"("serviceLine");
CREATE INDEX "ServiceLineCatalog_isActive_idx" ON "ServiceLineCatalog"("isActive");

CREATE INDEX "ContactRequest_status_createdAt_idx" ON "ContactRequest"("status", "createdAt");
