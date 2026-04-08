import { z } from "zod";

console.log("Zod version test:", z.string().email().describe("test"));
