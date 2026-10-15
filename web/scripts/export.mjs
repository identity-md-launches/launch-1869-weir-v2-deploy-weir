import {
  readFile,
  writeFile,
  mkdir,
  readdir,
  stat,
  copyFile,
} from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve, relative } from "node:path";
import { keccak256, toBytes } from "viem";

const root = fileURLToPath(new URL("../../", import.meta.url));
const web = resolve(root, "web");
const dist = resolve(root, "dist");
const json = async (p) => JSON.parse(await readFile(p, "utf8"));
export const canonical = (x) =>
  Array.isArray(x)
    ? x.map(canonical)
    : x && typeof x === "object"
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map((k) => [k, canonical(x[k])]),
        )
      : x;
const abiHash = (a) =>
  keccak256(toBytes(JSON.stringify(canonical(a)))).slice(2);
const sha = (b) => createHash("sha256").update(b).digest("hex");
const assert = (ok, message) => {
  if (!ok) throw new Error(message);
};
const handoff = await json(resolve(web, "deployment/handoff.json"));
const network = await json(resolve(web, "deployment/network.json"));
assert(
  handoff.chainId === network.network.chainId,
  "Handoff and network chain differ",
);
const contracts = handoff.contracts.map(({ name, address, abiHash }) => ({
  name,
  address,
  abiHash,
  abiPath: `abi/${name}.json`,
}));
const expected = {
  version: 1,
  launchId: handoff.launchId,
  chainId: handoff.chainId,
  sourceCommit: handoff.sourceCommit,
  attestationHash: handoff.attestationHash,
  contracts,
  ...(handoff.poolKey ? { poolKey: handoff.poolKey } : {}),
  network: network.network,
  ...(network.walletAddChain ? { walletAddChain: network.walletAddChain } : {}),
};
async function list(dir) {
  const files = [];
  for (const d of await readdir(dir, { withFileTypes: true })) {
    const p = resolve(dir, d.name);
    assert(!d.isSymbolicLink(), `Symlink in export: ${p}`);
    if (d.isDirectory()) files.push(...(await list(p)));
    else files.push(p);
  }
  return files.sort();
}
const mode = process.argv[2];
if (mode === "prepare") {
  await mkdir(resolve(web, "public/abi"), { recursive: true });
  for (const c of contracts) {
    // The ABI is pinned to the deployed source commit. This fork of the delivered repo does not carry
    // that commit, so fall back to the working tree; the keccak check against the handoff still binds it.
    let raw;
    try {
      raw = execFileSync(
        "git",
        ["show", `${handoff.sourceCommit}:docs/${c.abiPath}`],
        { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      );
    } catch {
      raw = await readFile(resolve(root, "docs", c.abiPath), "utf8");
    }
    const abi = JSON.parse(raw);
    assert(
      Array.isArray(abi) && abiHash(abi) === c.abiHash,
      `Pinned ABI mismatch: ${c.name}`,
    );
    // The source ABI is checked too; deployed source is never regenerated or modified here.
    assert(
      abiHash(await json(resolve(root, "docs", c.abiPath))) === c.abiHash,
      `Working ABI differs: ${c.name}`,
    );
    await writeFile(resolve(web, "public", c.abiPath), JSON.stringify(abi));
  }
  await writeFile(
    resolve(web, "public/history-start.json"),
    JSON.stringify({
      fromBlock: String(
        Math.min(...handoff.contracts.map((c) => c.blockNumber)),
      ),
    }),
  );
  // Also makes Vite's dev server use the same configuration shape. Final inventory is emitted after build.
  await writeFile(
    resolve(web, "public/imd-deployment.json"),
    JSON.stringify({ ...expected, assets: [] }, null, 2) + "\n",
  );
  console.log("Pinned source ABIs verified; deployment inputs prepared.");
} else if (mode === "finalize" || mode === "check") {
  const files = (await list(dist)).filter(
    (p) => relative(dist, p) !== "imd-deployment.json",
  );
  assert(files.length <= 128, "More than 128 exported assets");
  const assets = [];
  let total = 0;
  for (const file of files) {
    const size = (await stat(file)).size;
    assert(size <= 8388608, `Oversize asset: ${file}`);
    total += size;
    assets.push({
      path: relative(dist, file).split("\\").join("/"),
      sha256: sha(await readFile(file)),
    });
  }
  // IMD's hosted submission bundle is capped at 8 MiB; this fork is hosted on its own domain and ships
  // nine pixel-art plates, so the cap here is a sanity limit, not IMD's.
  assert(total < 64 * 1024 * 1024, "Export exceeds 64 MiB");
  if (mode === "finalize")
    await writeFile(
      resolve(dist, "imd-deployment.json"),
      JSON.stringify({ ...expected, assets }, null, 2) + "\n",
    );
  const manifest = await json(resolve(dist, "imd-deployment.json"));
  assert(
    JSON.stringify(canonical(manifest)) ===
      JSON.stringify(canonical({ ...expected, assets })),
    "Manifest differs from handoff or asset inventory",
  );
  assert(
    assets.some((a) => a.path === "index.html"),
    "Missing index.html",
  );
  for (const c of contracts)
    assert(
      abiHash(await json(resolve(dist, c.abiPath))) === c.abiHash,
      `Exported ABI mismatch: ${c.name}`,
    );
  console.log(
    JSON.stringify(
      {
        verified: true,
        sourceCommit: handoff.sourceCommit,
        assets: assets.length,
        exportBytes: total,
        abiHashes: contracts.map((c) => ({ name: c.name, abiHash: c.abiHash })),
      },
      null,
      2,
    ),
  );
} else throw new Error("Use prepare, finalize or check");
