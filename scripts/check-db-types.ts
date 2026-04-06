import * as dotenv from "dotenv";
import postgres from "postgres";

dotenv.config();

const sql = postgres(process.env.DIRECT_URL!);

async function checkColumns() {
  const _columns = await sql`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name IN ('products', 'price_lists', 'orders', 'payments', 'cash_book');
  `;
  process.exit(0);
}

checkColumns().catch(console.error);
