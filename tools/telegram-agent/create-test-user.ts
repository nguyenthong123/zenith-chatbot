import { hash } from "bcrypt-ts";
import * as dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { db } from "../../lib/db/queries";
import { user } from "../../lib/db/schema";

dotenv.config();

async function run() {
  const email = "admin@zenith.com";
  const name = "Sếp Tổng";
  const password = "password123";

  console.log(`Checking for user: ${email}...`);
  const [existing] = await db
    .select()
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  if (!existing) {
    const hashedPassword = await hash(password, 10);
    await db.insert(user).values({
      email,
      name,
      password: hashedPassword,
      role: "admin",
      isAnonymous: false,
    });
    console.log(`✅ Created test admin: ${email} / ${password}`);
  } else {
    console.log(`ℹ️ Test admin already exists: ${email}`);
  }
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Error creating test user:", err);
  process.exit(1);
});
