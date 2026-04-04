import { gt } from "drizzle-orm";
import { db } from "../lib/db/queries";
import { product } from "../lib/db/schema";

async function checkHighPrices() {
  const highPriceProducts = await db
    .select()
    .from(product)
    .where(gt(product.priceSell, 100000000)); // Check products > 100 million

  console.log("--- Products with prices > 100M ---");
  highPriceProducts.forEach((p) => {
    console.log(`- ${p.name}: ${p.priceSell?.toLocaleString()} VNĐ`);
  });
  process.exit(0);
}

checkHighPrices();
