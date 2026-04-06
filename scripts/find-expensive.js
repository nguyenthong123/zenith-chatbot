const postgres = require("postgres");

async function findExpensive() {
  const sql = postgres(
    "postgresql://postgres.gueiofvvaixshkrsepzo:Dunvex_Supabase_2026!@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?pgbouncer=true",
  );

  try {
    const products = await sql`
      SELECT name, "priceSell", metadata 
      FROM products 
      WHERE name LIKE '%pima 17%'
    `;
    products.forEach((_p) => {});
  } catch (_err) {
  } finally {
    await sql.end();
  }
}

findExpensive();
