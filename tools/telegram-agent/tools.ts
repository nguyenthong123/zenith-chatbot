import { exec } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { promisify } from "node:util";

const execPromise = promisify(exec);

// Get the project root directory (two levels up from tools/telegram-agent)
const PROJECT_ROOT = path.resolve(__dirname, "../../");

export async function listFiles(directory: string = ".") {
  const targetDir = path.resolve(PROJECT_ROOT, directory);
  const entries = await fs.readdir(targetDir, { withFileTypes: true });
  return entries.map((entry) => ({
    name: entry.name,
    type: entry.isDirectory() ? "directory" : "file",
  }));
}

export async function readFile(filePath: string) {
  const fullPath = path.resolve(PROJECT_ROOT, filePath);
  return await fs.readFile(fullPath, "utf-8");
}

export async function writeFile(filePath: string, content: string) {
  const fullPath = path.resolve(PROJECT_ROOT, filePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, "utf-8");
  return `File ${filePath} written successfully.`;
}

export async function editFile(
  filePath: string,
  targetContent: string,
  replacementContent: string,
) {
  const fullPath = path.resolve(PROJECT_ROOT, filePath);
  const currentContent = await fs.readFile(fullPath, "utf-8");

  if (!currentContent.includes(targetContent)) {
    throw new Error(`Target content not found in ${filePath}`);
  }

  const newContent = currentContent.replace(targetContent, replacementContent);
  await fs.writeFile(fullPath, newContent, "utf-8");
  return `File ${filePath} updated successfully.`;
}

export async function runCommand(command: string) {
  try {
    const { stdout, stderr } = await execPromise(command, {
      cwd: PROJECT_ROOT,
    });
    return {
      stdout: stdout || "Success (no output)",
      stderr: stderr || null,
    };
  } catch (error: unknown) {
    let stdout = null;
    let stderr = null;
    let message = "Unknown error";

    if (error instanceof Error) {
      message = error.message;
      if ("stdout" in error && typeof error.stdout === "string") {
        stdout = error.stdout;
      }
      if ("stderr" in error && typeof error.stderr === "string") {
        stderr = error.stderr;
      }
    }
    
    return {
      stdout: stdout,
      stderr: stderr || message,
    };
  }
}
