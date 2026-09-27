import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const skillNames = ["fqgate-realtime-stock-analyzer", "trade-execution"];

function copyFile(source, destination) {
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
}

function copyTree(source, destination) {
  mkdirSync(destination, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const sourcePath = join(source, entry.name);
    const destinationPath = join(destination, entry.name);
    if (entry.isDirectory()) copyTree(sourcePath, destinationPath);
    else copyFile(sourcePath, destinationPath);
  }
}

function preparePackage(root, adapter) {
  const packageRoot = join(root, "package", adapter);
  for (const name of ["install.ps1", "plugin.json"]) {
    copyFile(
      join(repositoryRoot, "AI-plugins", adapter, name),
      join(packageRoot, name),
    );
  }
  for (const name of skillNames) {
    mkdirSync(join(packageRoot, "skills"), { recursive: true });
    copyTree(
      join(repositoryRoot, "skills", name),
      join(packageRoot, "skills", name),
    );
  }
  if (adapter === "qianwen") {
    for (const name of [
      "fqgate-config.mjs",
      "configure-fqgate.mjs",
      "launch-fqgate-mcp.mjs",
    ]) {
      copyFile(
        join(repositoryRoot, "installer", "runtime", name),
        join(packageRoot, "scripts", name),
      );
    }
    copyFile(
      join(repositoryRoot, "fqgate", "compatibility.json"),
      join(packageRoot, "metadata", "fqgate-compatibility.json"),
    );
  }
  return packageRoot;
}

function runInstaller(packageRoot, localAppData, uninstall = false) {
  const scriptPath = join(packageRoot, "install.ps1").replaceAll("'", "''");
  const args = [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    `Import-Module Microsoft.PowerShell.Utility; & '${scriptPath}'${uninstall ? " -Uninstall" : ""}`,
  ];
  const result = spawnSync("powershell.exe", args, {
    env: {
      ...process.env,
      LOCALAPPDATA: localAppData,
    },
    encoding: "utf8",
    timeout: 30_000,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
}

function runInstallerExpectFailure(packageRoot, localAppData) {
  const scriptPath = join(packageRoot, "install.ps1").replaceAll("'", "''");
  const result = spawnSync("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    `Import-Module Microsoft.PowerShell.Utility; & '${scriptPath}'`,
  ], {
    env: { ...process.env, LOCALAPPDATA: localAppData },
    encoding: "utf8",
    timeout: 30_000,
  });
  assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
}

test(
  "豆包隔离安装、重复安装与第三方来源卸载只影响 FQGate 技能",
  { skip: process.platform !== "win32" },
  () => {
    const root = mkdtempSync(join(tmpdir(), "fqgate-doubao-e2e-"));
    try {
      const packageRoot = preparePackage(root, "doubao");
      const localAppData = join(root, "LocalAppData");
      const skillsRoot = join(
        localAppData,
        "Doubao",
        "User Data",
        "profile-1",
        ".doubao",
        "agent_mode",
        "workspace",
        ".user_skills",
      );
      const otherSkill = join(skillsRoot, "other-skill", "SKILL.md");
      mkdirSync(dirname(otherSkill), { recursive: true });
      writeFileSync(otherSkill, "name: other-skill\n");

      runInstaller(packageRoot, localAppData);
      runInstaller(packageRoot, localAppData);
      for (const name of skillNames) {
        const skillRoot = join(skillsRoot, name);
        assert.equal(existsSync(join(skillRoot, "SKILL.md")), true);
        assert.equal(
          existsSync(join(skillRoot, ".fqgate-agent-managed.json")),
          true,
        );
        rmSync(join(skillRoot, ".fqgate-agent-managed.json"));
      }

      runInstaller(packageRoot, localAppData, true);
      runInstaller(packageRoot, localAppData, true);
      for (const name of skillNames)
        assert.equal(existsSync(join(skillsRoot, name)), false);
      assert.equal(readFileSync(otherSkill, "utf8"), "name: other-skill\n");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);

test(
  "千问隔离安装与重复卸载保留其他 MCP 和技能",
  { skip: process.platform !== "win32" },
  () => {
    const root = mkdtempSync(join(tmpdir(), "fqgate-qianwen-e2e-"));
    try {
      const packageRoot = preparePackage(root, "qianwen");
      const localAppData = join(root, "LocalAppData");
      const agentRoot = join(
        localAppData,
        "Qianwen",
        "User Data",
        "qwen-agent",
      );
      const accountRoot = join(agentRoot, "account-1");
      const otherSkill = join(accountRoot, "skills", "other-skill", "SKILL.md");
      mkdirSync(dirname(otherSkill), { recursive: true });
      writeFileSync(otherSkill, "name: other-skill\n");
      writeFileSync(
        join(accountRoot, "mcp.json"),
        JSON.stringify({ mcpServers: { other: { command: "other" } } }),
      );
      const nodePath = join(agentRoot, "resources", "bins", "node.exe");
      mkdirSync(dirname(nodePath), { recursive: true });
      writeFileSync(nodePath, "");

      runInstaller(packageRoot, localAppData);
      runInstaller(packageRoot, localAppData);
      const installed = JSON.parse(
        readFileSync(join(accountRoot, "mcp.json"), "utf8"),
      );
      assert.equal(installed.mcpServers.fqgate.type, "stdio");
      assert.deepEqual(installed.mcpServers.other, { command: "other" });
      for (const name of skillNames) {
        const skillRoot = join(accountRoot, "skills", name);
        assert.equal(existsSync(join(skillRoot, "SKILL.md")), true);
        rmSync(join(skillRoot, ".fqgate-agent-managed.json"));
      }

      runInstaller(packageRoot, localAppData, true);
      runInstaller(packageRoot, localAppData, true);
      const removed = JSON.parse(
        readFileSync(join(accountRoot, "mcp.json"), "utf8"),
      );
      assert.equal(Object.hasOwn(removed.mcpServers, "fqgate"), false);
      assert.deepEqual(removed.mcpServers.other, { command: "other" });
      for (const name of skillNames)
        assert.equal(existsSync(join(accountRoot, "skills", name)), false);
      assert.equal(readFileSync(otherSkill, "utf8"), "name: other-skill\n");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);

test(
  "豆包安装冲突在写入前失败，不留下半安装技能",
  { skip: process.platform !== "win32" },
  () => {
    const root = mkdtempSync(join(tmpdir(), "fqgate-doubao-preflight-"));
    try {
      const packageRoot = preparePackage(root, "doubao");
      const localAppData = join(root, "LocalAppData");
      const skillsRoot = join(
        localAppData,
        "Doubao",
        "User Data",
        "profile-1",
        ".doubao",
        "agent_mode",
        "workspace",
        ".user_skills",
      );
      const conflict = join(skillsRoot, "trade-execution", "SKILL.md");
      mkdirSync(dirname(conflict), { recursive: true });
      writeFileSync(conflict, "name: user-owned\n");

      runInstallerExpectFailure(packageRoot, localAppData);
      assert.equal(existsSync(join(skillsRoot, "fqgate-realtime-stock-analyzer")), false);
      assert.equal(readFileSync(conflict, "utf8"), "name: user-owned\n");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);

test(
  "千问 MCP 冲突在写入前失败，不留下技能或适配器目录",
  { skip: process.platform !== "win32" },
  () => {
    const root = mkdtempSync(join(tmpdir(), "fqgate-qianwen-preflight-"));
    try {
      const packageRoot = preparePackage(root, "qianwen");
      const localAppData = join(root, "LocalAppData");
      const accountRoot = join(
        localAppData,
        "Qianwen",
        "User Data",
        "qwen-agent",
        "account-1",
      );
      mkdirSync(accountRoot, { recursive: true });
      writeFileSync(join(accountRoot, "projects.json"), "[]");
      writeFileSync(
        join(accountRoot, "mcp.json"),
        JSON.stringify({ mcpServers: { fqgate: { command: "user-owned" } } }),
      );
      const nodePath = join(
        localAppData,
        "Qianwen",
        "User Data",
        "qwen-agent",
        "resources",
        "bins",
        "node.exe",
      );
      mkdirSync(dirname(nodePath), { recursive: true });
      writeFileSync(nodePath, "");

      runInstallerExpectFailure(packageRoot, localAppData);
      assert.equal(existsSync(join(accountRoot, "skills")), false);
      assert.equal(existsSync(join(localAppData, "fqgate", "agents", "qianwen")), false);
      assert.deepEqual(
        JSON.parse(readFileSync(join(accountRoot, "mcp.json"), "utf8")),
        { mcpServers: { fqgate: { command: "user-owned" } } },
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);

test("DeepSeek Harness 发行包包含 FQGate 兼容清单", () => {
  const root = mkdtempSync(join(tmpdir(), "fqgate-deepseek-package-"));
  try {
    const packageRoot = join(root, "package");
    copyTree(
      join(repositoryRoot, "AI-plugins", "deepseek-harness"),
      packageRoot,
    );
    copyFile(
      join(repositoryRoot, "fqgate", "compatibility.json"),
      join(packageRoot, "metadata", "fqgate-compatibility.json"),
    );
    const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
    const result = spawnSync(
      npmCommand,
      ["pack", "--dry-run", "--json", "--ignore-scripts"],
      {
        cwd: packageRoot,
        encoding: "utf8",
        shell: process.platform === "win32",
        timeout: 30_000,
      },
    );
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const report = JSON.parse(result.stdout);
    assert.ok(
      report[0]?.files?.some(
        (file) => file.path === "metadata/fqgate-compatibility.json",
      ),
      "npm pack 没有包含 metadata/fqgate-compatibility.json",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
