import * as dotenv from "dotenv";
import postgres from "postgres";

dotenv.config();

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("No database URL");
  process.exit(1);
}

const sql = postgres(url);
async function run() {
  await sql`TRUNCATE price_lists CASCADE;`;
  console.log("Truncated price_lists");
  process.exit(0);
}
run();
