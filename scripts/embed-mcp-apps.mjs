import { copyFile, mkdir, readFile, rename, rm, stat } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildMcpApps } from "../mcp-apps/scripts/mcp-apps-lib.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argumentsMap = parseArguments(process.argv.slice(2));
const fqgateRoot = resolve(argumentsMap.get("fqgate-root") ?? resolve(repositoryRoot, "..", "fqgate"));
const cargoManifest = resolve(fqgateRoot, "Cargo.toml");
const destination = resolve(fqgateRoot, "assets", "mcp-apps", "embedded");
const allowedRoot = resolve(fqgateRoot, "assets", "mcp-apps");
const buildDirectory = resolve(repositoryRoot, "mcp-apps", "dist", "embedded");

await assertFqgateRepository(cargoManifest);
assertChildPath(allowedRoot, destination);
const { manifest } = await buildMcpApps({ channel: "stable", outputDirectory: buildDirectory });

const staging = resolve(allowedRoot, `.embedded-${process.pid}.staging`);
const previous = resolve(allowedRoot, `.embedded-${process.pid}.previous`);
await rm(staging, { recursive: true, force: true });
await rm(previous, { recursive: true, force: true });
await mkdir(staging, { recursive: true });
try {
  for (const file of ["manifest.json", ...manifest.apps.map((app) => app.file)]) {
    await copyFile(resolve(buildDirectory, file), resolve(staging, file));
  }
  await assertEmbeddedBundle(staging, manifest);

  const hadPrevious = await pathExists(destination);
  if (hadPrevious) await rename(destination, previous);
  try {
    await rename(staging, destination);
  } catch (error) {
    if (hadPrevious) await rename(previous, destination);
    throw error;
  }
  await rm(previous, { recursive: true, force: true });
} finally {
  await rm(staging, { recursive: true, force: true });
}

process.stdout.write(`已内置 MCP Apps ${manifest.bundleVersion}：${destination}\n`);

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key !== "--fqgate-root" || !value) throw new Error(`无法识别或缺少参数：${key ?? "<empty>"}`);
    if (values.has("fqgate-root")) throw new Error("--fqgate-root 不能重复。");
    values.set("fqgate-root", value);
  }
  return values;
}

async function assertFqgateRepository(path) {
  const manifest = await readFile(path, "utf8").catch(() => "");
  if (!/^name\s*=\s*"fqgate"\s*$/m.test(manifest)) {
    throw new Error(`目标不是 FQGate 主程序仓库：${dirname(path)}`);
  }
}

function assertChildPath(parent, child) {
  const nested = relative(parent, child);
  if (!nested || nested.startsWith("..")) throw new Error(`目标目录不在允许范围内：${child}`);
}

async function assertEmbeddedBundle(directory, expected) {
  const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8"));
  if (
    manifest.channel !== "stable" ||
    manifest.bundleVersion !== expected.bundleVersion ||
    manifest.apps.length !== expected.apps.length
  ) {
    throw new Error("准备内置的 MCP Apps 清单与本次构建不一致。");
  }
  for (const app of manifest.apps) {
    const metadata = await stat(resolve(directory, app.file));
    if (!metadata.isFile() || metadata.size !== app.size) {
      throw new Error(`准备内置的 MCP App 文件无效：${app.file}`);
    }
  }
}

async function pathExists(path) {
  return stat(path).then(() => true, () => false);
}
