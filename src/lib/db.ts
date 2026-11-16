// =============================================================================
// Secure database access
// =============================================================================
// EVERY database read or write made on behalf of a logged-in person must go
// through `withUser()`. It switches to the restricted "app_user" role and
// tells the database who the person is, so the company walls and permission
// rules in docs/SECURITY.md apply automatically.
//
// The underlying connection is deliberately NOT exported: it bypasses the
// company walls and is only for migrations and admin scripts.
// =============================================================================
import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

// Reuse one connection pool (avoids opening new connections on every reload
// during development).
const prisma = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type Db = Prisma.TransactionClient;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Run database work as a specific logged-in user, inside one transaction.
 * Everything inside sees only the companies that user may access.
 */
export async function withUser<T>(userId: string, work: (db: Db) => Promise<T>): Promise<T> {
  if (!UUID.test(userId)) throw new Error("Invalid user id");
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL ROLE app_user");
    await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
    return work(tx);
  });
}
