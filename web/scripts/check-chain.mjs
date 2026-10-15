import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createPublicClient, http, keccak256 } from "viem";
const dist = new URL("../../dist/", import.meta.url);
const m = JSON.parse(await readFile(new URL("imd-deployment.json", dist)));
const records = [];
for (const url of m.network.rpcUrls) {
  const client = createPublicClient({
    transport: http(url, { timeout: 15000, retryCount: 1 }),
  });
  const chainId = await client.getChainId();
  if (chainId !== m.chainId) throw new Error("Wrong RPC chain");
  const blockNumber = await client.getBlockNumber();
  const contracts = [];
  for (const c of m.contracts) {
    const code = await client.getCode({ address: c.address, blockNumber });
    if (!code || code === "0x") throw new Error(`Empty code: ${c.name}`);
    contracts.push({
      name: c.name,
      address: c.address,
      byteLength: (code.length - 2) / 2,
      runtimeCodeKeccak: keccak256(code),
    });
  }
  const c = m.contracts.find((c) => c.name === "Weir");
  const abi = JSON.parse(await readFile(new URL(c.abiPath, dist)));
  const reads = {};
  for (const name of [
    "weir",
    "imd",
    "intake",
    "minHold",
    "disputeTimeout",
    "courtFund",
    "oraclePrice",
    "streamCount",
  ])
    reads[name] = String(
      await client.readContract({
        address: c.address,
        abi,
        functionName: name,
        blockNumber,
      }),
    );
  if (
    reads.weir.toLowerCase() !==
    m.contracts.find((c) => c.name === "LaunchToken").address.toLowerCase()
  )
    throw new Error("Weir token binding differs");
  records.push({
    rpc: url,
    chainId,
    blockNumber: blockNumber.toString(),
    contracts,
    reads,
  });
}
const evidence = {
  observedAt: new Date().toISOString(),
  sourceCommit: m.sourceCommit,
  readOnly: true,
  records,
};
await mkdir(new URL("../../docs/validation/", import.meta.url), {
  recursive: true,
});
await writeFile(
  new URL("../../docs/validation/live-chain.json", import.meta.url),
  JSON.stringify(evidence, null, 2) + "\n",
);
console.log(JSON.stringify(evidence, null, 2));
