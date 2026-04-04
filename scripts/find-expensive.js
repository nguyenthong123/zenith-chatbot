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

    console.log("Product Details Found:");
    products.forEach((p) => {
      console.log(`- ${p.name}`);
      console.log(`  Price: ${p.priceSell}`);
      console.log(`  Metadata: ${JSON.stringify(p.metadata)}`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

findExpensive();
