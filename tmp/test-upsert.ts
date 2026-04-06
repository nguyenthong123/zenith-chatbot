import { upsertProduct, getProductLookup } from './lib/db/queries';
import { db } from './lib/db';
import { products } from './lib/db/schema';
import { eq, and } from 'drizzle-orm';

async function test() {
  const testUserId = 'test-user-uuid';
  const productName = 'Test Product ABC';
  
  console.log('--- Step 1: Saving product with first image ---');
  await upsertProduct({
    name: productName,
    ownerId: testUserId,
    imageUrls: ['http://example.com/img1.jpg'],
    sku: 'SKU-001',
    description: 'First version'
  });
  
  let p = await db.query.products.findFirst({
    where: and(eq(products.name, productName), eq(products.ownerId, testUserId))
  });
  console.log('Product after step 1:', JSON.stringify(p, null, 2));

  console.log('\n--- Step 2: Saving same product name with second image ---');
  await upsertProduct({
    name: productName,
    ownerId: testUserId,
    imageUrls: ['http://example.com/img2.jpg'],
    sku: 'SKU-001-UPDATED',
    description: 'Second version'
  });

  p = await db.query.products.findFirst({
    where: and(eq(products.name, productName), eq(products.ownerId, testUserId))
  });
  console.log('Product after step 2:', JSON.stringify(p, null, 2));
  
  if (p?.imageUrls?.length === 2) {
    console.log('\nSUCCESS: Images were appended!');
  } else {
    console.log('\nFAILURE: Images were NOT appended correctly.');
  }

  // Cleanup
  await db.delete(products).where(and(eq(products.name, productName), eq(products.ownerId, testUserId)));
  console.log('\nCleanup done.');
}

test().catch(console.error);
