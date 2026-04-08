import { getDatabaseLookup } from "../lib/ai/tools/database-lookup";
import { db } from "../lib/db/queries";
import { user } from "../lib/db/schema";

async function main() {
  const [firstUser] = await db.select().from(user).limit(1);
  if (!firstUser) {
    console.log("No user found in DB.");
    return;
  }

  const lookup = getDatabaseLookup(
    firstUser.id,
    firstUser.role,
    firstUser.email,
  );
  const tool = lookup as any; // Cast to access execute

  console.log(`Testing with user: ${firstUser.email} (${firstUser.id})`);

  // Test 1: Global search for a common term (e.g., "Sắt" or from samples)
  console.log("\nSearching for 'Nẹp viền' (Product)...");
  const res1 = await tool.execute({
    query: "Nẹp viền",
    category: "all",
    limit: 5,
  });
  console.log(JSON.stringify(res1, null, 2));

  // Test 2: Search for a customer name/phone
  console.log("\nSearching for '0329976191' (Customer Phone)...");
  const res2 = await tool.execute({
    query: "0329976191",
    category: "all",
    limit: 5,
  });
  console.log(JSON.stringify(res2, null, 2));

  // Test 3: Search for something in Dak Lak (Should return customers)
  console.log("\nSearching for 'Đắk Lắk'...");
  const res3 = await tool.execute({
    query: "Đắk Lắk",
    category: "all",
    limit: 5,
  });
  console.log(JSON.stringify(res3, null, 2));
}

main().catch(console.error);
