import { gt } from "drizzle-orm";
import { db } from "../lib/db/queries";
import { product } from "../lib/db/schema";

async function checkHighPrices() {
  const highPriceProducts = await db
    .select()
    .from(product)
    .where(gt(product.priceSell, 100000000)); // Check products > 100 million
  highPriceProducts.forEach((_p) => {});
  process.exit(0);
}

checkHighPrices();
