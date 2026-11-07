// Starts the backend for the emulator tests without going through a shell, so a project path with spaces
// ("Claude Code") is not split. Used by playwright.emulator.config.js.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../backend");
const python = process.platform === "win32" ? "venv\\Scripts\\python.exe" : "venv/bin/python";
const child = spawn(path.join(backendDir, python), ["-m", "scripts.run_test_backend"], {
  cwd: backendDir,
  env: process.env,
  stdio: "inherit",
});
child.on("exit", (code) => process.exit(code ?? 1));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
