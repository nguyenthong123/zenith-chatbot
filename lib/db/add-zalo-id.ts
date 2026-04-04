import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DIRECT_URL!);

async function main() {
  try {
    console.log("Adding zaloId column to users table...");
    await sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "zaloId" varchar(255)`;
    console.log("Creating unique index on zaloId...");
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS "zalo_id_idx" ON "users" ("zaloId")`;
    console.log("Successfully updated database!");
  } catch (error) {
    console.error("Error updating database:", error);
  } finally {
    await sql.end();
  }
}

main();
