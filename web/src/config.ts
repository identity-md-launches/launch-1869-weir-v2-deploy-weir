import { createConfig } from "wagmi";
import { injected } from "wagmi/connectors/injected";
import { coinbaseWallet } from "wagmi/connectors/coinbaseWallet";
import {
  createPublicClient,
  defineChain,
  fallback,
  http,
  keccak256,
  toBytes,
  type Abi,
  type Address,
} from "viem";

export type Deployment = {
  version: 1;
  launchId: string;
  chainId: number;
  sourceCommit: string;
  attestationHash: string;
  contracts: {
    name: string;
    address: Address;
    abiHash: string;
    abiPath: string;
  }[];
  poolKey?: {
    currency0: Address;
    currency1: Address;
    fee: number;
    tickSpacing: number;
    hooks: Address;
  };
  assets: { path: string; sha256: string }[];
  network: {
    chainId: number;
    name: string;
    rpcUrls: string[];
    explorer: string;
    testnet: boolean;
    nativeCurrency: { name: string; symbol: string; decimals: number };
    [key: string]: unknown;
  };
  walletAddChain?: {
    chainId: string;
    chainName: string;
    rpcUrls: string[];
    nativeCurrency: { name: string; symbol: string; decimals: number };
    blockExplorerUrls: string[];
  };
};
export const LINKS = {
  repo: "https://github.com/identity-md-launches/launch-1780-weir",
  oracleDocs: "https://imd.fun/docs/#oracle-body",
  token: (address: string) => `https://explorer.imd.fun/token/${address}`,
  job: (id: string) => `https://explorer.imd.fun/jobs/${id}`,
  oracle: (id: bigint, contract: Address) =>
    `https://explorer.imd.fun/oracle?q=${encodeURIComponent(`Weir stream ${id} at ${contract}`)}`,
  intakeStatus: (chainId: number, transaction: string) =>
    `https://api.imd.fun/intake/${chainId}/${transaction}`,
};
export function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
export function hashAbi(abi: Abi) {
  return keccak256(toBytes(JSON.stringify(canonical(abi)))).slice(2);
}
function relativePath(path: string) {
  return (
    !path.includes("..") &&
    !path.startsWith("/") &&
    !path.includes(":") &&
    !path.includes("\\")
  );
}
async function loadJson(path: string) {
  if (!relativePath(path)) throw new Error("Unsafe deployment asset path.");
  const result = await fetch(new URL(path, document.baseURI), {
    cache: "no-cache",
  });
  if (!result.ok)
    throw new Error(`Could not load ${path}. Reload to try again.`);
  return result.json();
}
export async function loadRuntime() {
  const deployment = (await loadJson("imd-deployment.json")) as Deployment;
  if (
    deployment.version !== 1 ||
    deployment.chainId !== deployment.network?.chainId ||
    !deployment.network.rpcUrls.length
  )
    throw new Error(
      "Deployment configuration is invalid. Transactions are disabled.",
    );
  const entries = await Promise.all(
    deployment.contracts.map(async (c) => {
      const abi = (await loadJson(c.abiPath)) as Abi;
      if (!Array.isArray(abi) || hashAbi(abi) !== c.abiHash)
        throw new Error(
          `ABI verification failed for ${c.name}. Transactions are disabled.`,
        );
      return [c.name, { ...c, abi }] as const;
    }),
  );
  const contracts = Object.fromEntries(entries);
  if (!contracts.Weir || !contracts.LaunchToken)
    throw new Error("Required application contracts are missing.");
  const chain = defineChain({
    id: deployment.chainId,
    name: deployment.network.name,
    nativeCurrency: deployment.network.nativeCurrency,
    rpcUrls: { default: { http: deployment.network.rpcUrls } },
    blockExplorers: {
      default: { name: "Explorer", url: deployment.network.explorer },
    },
    testnet: deployment.network.testnet,
  });
  const transport = fallback(
    deployment.network.rpcUrls.map((url) =>
      http(url, { timeout: 10_000, retryCount: 1, batch: { wait: 30 } }),
    ),
    { rank: false },
  );
  const client = createPublicClient({
    chain,
    transport,
    pollingInterval: 4000,
  });
  const wallet = createConfig({
    chains: [chain],
    multiInjectedProviderDiscovery: true,
    connectors: [
      injected(),
      coinbaseWallet({
        appName: "Weir",
        appLogoUrl: new URL("favicon.svg", document.baseURI).href,
      }),
    ],
    transports: { [chain.id]: transport },
  });
  const history = (await loadJson("history-start.json")) as {
    fromBlock: string;
  };
  if (!/^\d+$/.test(history.fromBlock))
    throw new Error("Invalid history checkpoint.");
  return {
    deployment,
    chain,
    client,
    wallet,
    contracts,
    fromBlock: BigInt(history.fromBlock),
    weir: contracts.Weir,
    token: contracts.LaunchToken,
    // Standard token methods come from the verified implementation ABI, including errors.
    erc20: contracts.LaunchToken.abi,
  };
}
export type Runtime = Awaited<ReturnType<typeof loadRuntime>>;
