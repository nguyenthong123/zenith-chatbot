import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DIRECT_URL!);

async function main() {
  try {
    await sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "zaloId" varchar(255)`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS "zalo_id_idx" ON "users" ("zaloId")`;
  } catch (_error) {
  } finally {
    await sql.end();
  }
}

main();
