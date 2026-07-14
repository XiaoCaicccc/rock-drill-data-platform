import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const log = createWriteStream("dev.log", { flags: "a" });
const child = spawn(process.execPath, [nextBin, "dev", "-p", "3000"], {
  stdio: ["inherit", "pipe", "pipe"],
});

for (const [stream, output] of [
  [child.stdout, process.stdout],
  [child.stderr, process.stderr],
]) {
  stream.on("data", (chunk) => {
    output.write(chunk);
    log.write(chunk);
  });
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("error", (error) => {
  console.error(error);
  log.end();
  process.exitCode = 1;
});

child.on("close", (code) => {
  log.end();
  process.exitCode = code ?? 1;
});
