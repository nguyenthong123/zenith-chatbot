import { tool } from "ai";
import { z } from "zod";

try {
  const t = tool({
    description: "test",
    inputSchema: z.object({ a: z.string() }),
    execute: async () => "ok",
  });
  console.log("inputSchema: ok");
} catch (e) {
  console.log("inputSchema: failed", e.message);
}

try {
  const t = (tool as any)({
    description: "test",
    inputSchema: z.object({ a: z.string() }),
    execute: async () => "ok",
  });
  console.log("inputSchema: ok");
} catch (e) {
  console.log("inputSchema: failed", e.message);
}
