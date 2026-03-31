import { PrismaClient } from "@/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  let adapter: PrismaLibSql;

  if (tursoUrl && tursoToken) {
    // Production: Turso remote
    adapter = new PrismaLibSql({
      url: tursoUrl,
      authToken: tursoToken,
    });
  } else {
    // Local dev: SQLite file
    const dbPath = path.join(process.cwd(), "prisma", "dev.db");
    adapter = new PrismaLibSql({
      url: `file:${dbPath}`,
    });
  }

  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
