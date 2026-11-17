// Diagnostic: checks secure queries work through the transaction pooler (port 6543).
// Run: npx tsx scripts/check-pooler.ts
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const url = new URL(process.env.DATABASE_URL!);
url.port = "6543";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });

async function run(userId: string | null) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL ROLE app_user");
    await tx.$executeRaw`SELECT set_config('app.user_id', ${userId ?? ""}, true)`;
    const n = await tx.container.count();
    const role = await tx.$queryRaw<{ r: string }[]>`SELECT current_user AS r`;
    return { n, role: role[0].r };
  });
}

(async () => {
  const admin = await prisma.user.findFirst({ where: { isPlatformAdmin: true } });
  for (let i = 0; i < 5; i++) {
    const a = await run(admin!.id);
    const b = await run(null);
    console.log(`round ${i + 1}: admin sees ${a.n} as ${a.role}; anonymous sees ${b.n}`);
  }
  const after = await prisma.$queryRaw<{ r: string }[]>`SELECT current_user AS r`;
  console.log("role outside transaction:", after[0].r);
  await prisma.$disconnect();
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
