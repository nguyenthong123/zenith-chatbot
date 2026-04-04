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
  try {
    await migrate(db, { migrationsFolder: "./lib/db/migrations" });
  } catch (err: any) {
    // 42P07 is the Postgres error code for "relation already exists"
    if (err.code === "42P07") {
      console.log(
        "Migration notice: Some tables already exist. Continuing build...",
      );
    } else {
      console.error("Migration failed with error:", err);
      process.exit(1);
    }
  }
  await connection.end();
  const _end = Date.now();
  console.log(`Migration finished in ${_end - _start}ms`);
  process.exit(0);
};

runMigrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
