import { NextResponse } from "next/server";
import { syncFirestoreToSupabase } from "@/lib/ai/tools/sync-firestore";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Call the tool to sync all default collections
    const result = await (syncFirestoreToSupabase.execute as any)({
      collections: [
        "users",
        "customers",
        "products",
        "price_lists",
        "orders",
        "payments",
        "cash_book",
        "system_config",
      ],
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Cron Sync Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
