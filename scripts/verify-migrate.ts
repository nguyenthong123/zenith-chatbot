import * as dotenv from "dotenv";
import postgres from "postgres";

dotenv.config();

const url = process.env.DATABASE_URL;
if (!url) {
  process.exit(1);
}

const sql = postgres(url);

async function check() {
  const pCount = await sql`SELECT count(*) FROM products`;
  const cCount = await sql`SELECT count(*) FROM customers`;
  const oCount = await sql`SELECT count(*) FROM orders`;
  const payCount = await sql`SELECT count(*) FROM payments`;
  const cbCount = await sql`SELECT count(*) FROM cash_book`;
  const scCount = await sql`SELECT count(*) FROM system_config`;

  console.log("Products count:", pCount[0].count);
  console.log("Customers count:", cCount[0].count);
  console.log("Orders count:", oCount[0].count);
  console.log("Payments count:", payCount[0].count);
  console.log("Cashbook count:", cbCount[0].count);
  console.log("System Config count:", scCount[0].count);

  const sampleP = await sql`SELECT name, "infoMarkdown" FROM products LIMIT 1`;
  const sampleC = await sql`SELECT name, "infoMarkdown" FROM customers LIMIT 1`;

  console.log("Sample Product Markdown:", sampleP[0]?.infoMarkdown);
  console.log("Sample Customer Markdown:", sampleC[0]?.infoMarkdown);

  process.exit(0);
}

check();
