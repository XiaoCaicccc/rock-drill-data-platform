import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";

const assets = [
  [".next/static", ".next/standalone/.next/static"],
  ["public", ".next/standalone/public"],
];

for (const [sourcePath, destinationPath] of assets) {
  const source = resolve(sourcePath);
  const destination = resolve(destinationPath);

  if (!existsSync(source)) {
    throw new Error(`构建产物缺失，无法复制：${sourcePath}`);
  }

  mkdirSync(dirname(destination), { recursive: true });
  rmSync(destination, { recursive: true, force: true });
  cpSync(source, destination, { recursive: true, force: true });
}
