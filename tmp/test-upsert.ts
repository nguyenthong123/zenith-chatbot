import { and, eq } from "drizzle-orm";
import { db } from "./lib/db";
import { upsertProduct } from "./lib/db/queries";
import { products } from "./lib/db/schema";

async function test() {
  const testUserId = "test-user-uuid";
  const productName = "Test Product ABC";
  await upsertProduct({
    name: productName,
    ownerId: testUserId,
    imageUrls: ["http://example.com/img1.jpg"],
    sku: "SKU-001",
    description: "First version",
  });

  let p = await db.query.products.findFirst({
    where: and(
      eq(products.name, productName),
      eq(products.ownerId, testUserId),
    ),
  });
  await upsertProduct({
    name: productName,
    ownerId: testUserId,
    imageUrls: ["http://example.com/img2.jpg"],
    sku: "SKU-001-UPDATED",
    description: "Second version",
  });

  p = await db.query.products.findFirst({
    where: and(
      eq(products.name, productName),
      eq(products.ownerId, testUserId),
    ),
  });

  if (p?.imageUrls?.length === 2) {
  } else {
  }

  // Cleanup
  await db
    .delete(products)
    .where(
      and(eq(products.name, productName), eq(products.ownerId, testUserId)),
    );
}

// biome-ignore lint/suspicious/noConsole: script entry point
test().catch(console.error);
