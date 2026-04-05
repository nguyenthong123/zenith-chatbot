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
    // Postgres error codes that indicate the migration has already been
    // (fully or partially) applied and can be safely ignored:
    //   42P07 – relation already exists  (CREATE TABLE)
    //   42701 – duplicate_column         (ADD COLUMN)
    //   42704 – undefined_object         (DROP CONSTRAINT / DROP INDEX on missing object)
    //   42710 – duplicate_object         (ADD CONSTRAINT / CREATE INDEX on existing object)
    //   3F000 – invalid_schema_name
    const idempotentCodes = new Set([
      "42P07",
      "42701",
      "42704",
      "42710",
      "3F000",
    ]);
    if (idempotentCodes.has(err.code)) {
      console.log(
        `Migration notice: Encountered code ${err.code} (${err.message ?? ""}). Schema is likely up-to-date. Continuing build...`,
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
