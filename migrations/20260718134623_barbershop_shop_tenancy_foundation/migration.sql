-- CreateEnum
CREATE TYPE "ShopStatusType" AS ENUM ('active', 'paused', 'inactive');

-- CreateEnum
CREATE TYPE "ShopMembershipMembershipRoleType" AS ENUM ('owner', 'manager', 'front_desk', 'barber', 'viewer');

-- CreateEnum
CREATE TYPE "ShopMembershipStatusType" AS ENUM ('invited', 'active', 'suspended', 'revoked');

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "legalName" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL DEFAULT '',
    "status" "ShopStatusType" DEFAULT 'active',
    "tagline" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "hours" JSONB DEFAULT '{}',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopMembership" (
    "id" TEXT NOT NULL,
    "membershipKey" TEXT NOT NULL DEFAULT '',
    "shop" TEXT,
    "user" TEXT,
    "membershipRole" "ShopMembershipMembershipRoleType" DEFAULT 'viewer',
    "status" "ShopMembershipStatusType" DEFAULT 'invited',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_slug_key" ON "Shop"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ShopMembership_membershipKey_key" ON "ShopMembership"("membershipKey");

-- CreateIndex
CREATE INDEX "ShopMembership_shop_idx" ON "ShopMembership"("shop");

-- CreateIndex
CREATE INDEX "ShopMembership_user_idx" ON "ShopMembership"("user");

-- AddForeignKey
ALTER TABLE "ShopMembership" ADD CONSTRAINT "ShopMembership_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopMembership" ADD CONSTRAINT "ShopMembership_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
