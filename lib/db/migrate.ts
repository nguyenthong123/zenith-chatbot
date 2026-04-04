import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

config({
  path: [".env.local", ".env"],
});

const runMigrate = async () => {
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!dbUrl) {
    console.log(
      "No connection string found (DATABASE_URL or POSTGRES_URL). Skipping migration.",
    );
    process.exit(0);
  }

  const connection = postgres(dbUrl, { max: 1 });
  const db = drizzle(connection);

  const _start = Date.now();
  await migrate(db, { migrationsFolder: "./lib/db/migrations" });
  await connection.end();
  const _end = Date.now();
  process.exit(0);
};

runMigrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
