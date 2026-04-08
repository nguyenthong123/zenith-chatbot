import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { ilike } from "drizzle-orm";
import { db } from "../../lib/db/queries";
import { product } from "../../lib/db/schema";

async function check() {
  const all = await db
    .select()
    .from(product)
    .where(ilike(product.name, "%DURAFlex%"));
  console.log(
    "Found products containing DURAFlex:",
    JSON.stringify(all, null, 2),
  );
}

check().catch(console.error);
