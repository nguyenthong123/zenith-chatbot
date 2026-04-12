import * as path from "node:path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, ".env") });

console.log("DATABASE_URL exists:", !!process.env.DATABASE_URL);

import { desc, eq } from "drizzle-orm";
import * as dbQueries from "./lib/db/queries";
import { message, product } from "./lib/db/schema";

async function checkDatabase() {
  console.log("--- Checking Database Status ---");

  try {
    // 1. Check the specific product
    const products = await dbQueries.db
      .select()
      .from(product)
      .where(eq(product.name, "Tấm DURAFlex 14mm"))
      .limit(1);

    console.log("\n[Product Status]");
    if (products && products.length > 0) {
      const p = products[0];
      console.log(`Product: ${p.name}`);
      console.log(`Image URLs: ${p.imageUrls}`);
      const count = p.imageUrls ? p.imageUrls.split(",").length : 0;
      console.log(`Total images linked: ${count}`);

      if (count > 0) {
        console.log("URLs list:");
        p.imageUrls?.split(",").forEach((url, i) => {
          console.log(`${i + 1}: ${url.trim()}`);
        });
      }
    } else {
      console.log("Product 'Tấm DURAFlex 14mm' not found.");
    }

    // 2. Check recent messages for attachments
    console.log("\n[Recent Message Attachments]");
    const allMessages = await dbQueries.db
      .select()
      .from(message)
      .orderBy(desc(message.createdAt))
      .limit(30);

    allMessages.forEach((m) => {
      const atts = m.attachments as any[];
      if (atts && atts.length > 0) {
        console.log(
          `Message ID: ${m.id.slice(0, 8)}, Role: ${m.role}, CreatedAt: ${m.createdAt}`,
        );
        console.log(`  Attachments count: ${atts.length}`);
        atts.forEach((a, i) => {
          console.log(`    ${i + 1}: ${a.url}`);
        });
      }
    });
  } catch (err) {
    console.error("Diagnostic Error:", err);
  } finally {
    process.exit(0);
  }
}

checkDatabase().catch(console.error);
