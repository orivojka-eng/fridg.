-- Better Auth: user / session / account / verification.
-- Data is preserved: passwords move to "credential" accounts, Apple/Google
-- links move to provider accounts. Old sessions cannot be converted (new
-- token format), so everyone signs in once more.

-- 1. New tables
CREATE TABLE "Account" (
    "id" UUID NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Verification" (
    "id" UUID NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Account_userId_idx" ON "Account"("userId");
CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "Account"("providerId", "accountId");
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Move existing sign-in methods into accounts (argon2 hashes stay valid)
INSERT INTO "Account" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
SELECT gen_random_uuid(), u."id"::text, 'credential', u."id", u."passwordHash", u."createdAt", CURRENT_TIMESTAMP
FROM "User" u
WHERE u."passwordHash" IS NOT NULL;

INSERT INTO "Account" ("id", "accountId", "providerId", "userId", "refreshToken", "createdAt", "updatedAt")
SELECT gen_random_uuid(), a."providerUserId", a."provider"::text, a."userId", a."appleRefreshTokenEnc", a."createdAt", CURRENT_TIMESTAMP
FROM "AuthProvider" a;

-- 3. User: Better Auth core fields
ALTER TABLE "User" ADD COLUMN "name" TEXT NOT NULL DEFAULT '', ADD COLUMN "image" TEXT;
UPDATE "User" SET "name" = btrim("firstName" || ' ' || "lastName");
ALTER TABLE "User" DROP COLUMN "passwordHash";

-- 4. Session: Better Auth shape (old refresh-token sessions are dropped)
DELETE FROM "Session";
DROP INDEX "Session_refreshTokenHash_key";
DROP INDEX "Session_familyId_idx";
ALTER TABLE "Session" DROP COLUMN "deviceName",
DROP COLUMN "familyId",
DROP COLUMN "lastUsedAt",
DROP COLUMN "platform",
DROP COLUMN "refreshTokenHash",
DROP COLUMN "revokedAt",
ADD COLUMN "ipAddress" TEXT,
ADD COLUMN "token" TEXT NOT NULL,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN "userAgent" TEXT;
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- 5. Retire the custom auth tables
ALTER TABLE "AuthProvider" DROP CONSTRAINT "AuthProvider_userId_fkey";
ALTER TABLE "EmailVerification" DROP CONSTRAINT "EmailVerification_userId_fkey";
ALTER TABLE "PasswordReset" DROP CONSTRAINT "PasswordReset_userId_fkey";
DROP TABLE "AuthProvider";
DROP TABLE "EmailVerification";
DROP TABLE "PasswordReset";
DROP TYPE "AuthProviderType";
