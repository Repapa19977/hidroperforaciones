ALTER TABLE "Usuario"
  ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "twoFactorSecret" TEXT,
  ADD COLUMN "twoFactorPendingSecret" TEXT,
  ADD COLUMN "twoFactorPendingAt" TIMESTAMP(3),
  ADD COLUMN "twoFactorConfirmedAt" TIMESTAMP(3);
