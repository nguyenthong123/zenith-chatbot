import * as dotenv from "dotenv";
import postgres from "postgres";

dotenv.config();

const sql = postgres(process.env.DIRECT_URL!);

async function resetDb() {
  await sql`DROP SCHEMA public CASCADE;`;
  await sql`CREATE SCHEMA public;`;
  await sql`GRANT ALL ON SCHEMA public TO postgres;`;
  await sql`GRANT ALL ON SCHEMA public TO anon;`;
  await sql`GRANT ALL ON SCHEMA public TO authenticated;`;
  await sql`GRANT ALL ON SCHEMA public TO service_role;`;
  process.exit(0);
}

resetDb().catch((_e) => {
  process.exit(1);
});
