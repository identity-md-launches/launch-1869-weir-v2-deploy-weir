import { readFile } from "node:fs/promises";
import {
  decodeFunctionData,
  encodeFunctionResult,
  encodeEventTopics,
  encodeAbiParameters,
  encodeErrorResult,
  keccak256,
  toBytes,
  zeroHash,
  zeroAddress,
  toHex,
} from "viem";

export const manifest = JSON.parse(
  await readFile(new URL("../../dist/imd-deployment.json", import.meta.url)),
);
export const abi = JSON.parse(
  await readFile(new URL("../../dist/abi/Weir.json", import.meta.url)),
);
export const erc20 = JSON.parse(
  await readFile(new URL("../../dist/abi/LaunchToken.json", import.meta.url)),
);
export const weir = manifest.contracts.find((c) => c.name === "Weir").address;
export const launchToken = manifest.contracts.find(
  (c) => c.name === "LaunchToken",
).address;
export const imd = manifest.network.pairToken.address;
const fixture = (label) =>
  `0x${keccak256(toBytes(`weir-browser-fixture:${label}`)).slice(-40)}`;
export const CLIENT = fixture("client"),
  RECIPIENT = fixture("recipient"),
  OTHER = fixture("other"),
  TOKEN = fixture("six-decimal-token");
const NOW = 1_800_000_000n;
const BLOCK =
  BigInt(
    JSON.parse(
      await readFile(new URL("../../dist/history-start.json", import.meta.url)),
    ).fromBlock,
  ) + 1000n;
const blockHash = keccak256(toBytes("weir-browser-fixture:block"));
const lower = (a) => a.toLowerCase();
export function newState() {
  const s = {
    client: CLIENT,
    recipient: RECIPIENT,
    token: TOKEN,
    rate: 10n,
    pausedRate: 0n,
    balance: 100_000_000n,
    withdrawn: 5_000_000n,
    snapDebt: 20_000_000n,
    snapTime: NOW,
    state: 1,
    termsHash: keccak256(toBytes("Deliver the agreed work.")),
    termsURI: "https://example.org/terms",
    imdJobId: zeroHash,
    requestId: zeroHash,
    disputedAt: 0n,
    disputer: zeroAddress,
    bond: 0n,
    ruling: 0,
  };
  return {
    account: CLIENT,
    connected: false,
    walletChain: 1,
    knownChain: false,
    rejectSwitch: false,
    rejectNext: false,
    delay: 0,
    code: "0x60006000",
    fund: 0n,
    price: 500_000_000_000_000_000n,
    holdings: 200_000n * 10n ** 18n,
    allowance: new Map(),
    receipts: new Map(),
    transactions: [],
    requests: [],
    logs: [],
    accepted: new Map(),
    claimable: 0n,
    forcedError: undefined,
    streams: new Map([
      [1n, { ...s }],
      [
        2n,
        {
          ...s,
          state: 2,
          rate: 0n,
          pausedRate: 10n,
          disputedAt: NOW - 604801n,
          requestId: keccak256(toBytes("request")),
          disputer: CLIENT,
          bond: 2_375_000n,
        },
      ],
      [
        3n,
        {
          ...s,
          state: 3,
          rate: 0n,
          pausedRate: 10n,
          ruling: 1,
          requestId: keccak256(toBytes("ruled")),
          disputer: CLIENT,
          bond: 2_375_000n,
        },
      ],
    ]),
  };
}
function allowanceKey(token, owner) {
  return `${lower(token)}:${lower(owner)}`;
}
function logFor(name, args, txHash, index = 0) {
  const event = abi.find((x) => x.type === "event" && x.name === name);
  return {
    address: weir,
    blockHash,
    blockNumber: toHex(BLOCK),
    data: encodeAbiParameters(
      event.inputs.filter((x) => !x.indexed),
      event.inputs.filter((x) => !x.indexed).map((x) => args[x.name]),
    ),
    topics: encodeEventTopics({ abi, eventName: name, args }),
    transactionHash: txHash,
    transactionIndex: "0x0",
    logIndex: toHex(index),
    removed: false,
  };
}
function created(id, s, hash = keccak256(toBytes(`fixture-create-${id}`))) {
  return logFor(
    "StreamCreated",
    {
      id,
      client: s.client,
      recipient: s.recipient,
      token: s.token,
      rate: s.rate || 10n,
      amount: s.balance,
      termsHash: s.termsHash,
      termsURI: s.termsURI,
      imdJobId: s.imdJobId,
    },
    hash,
  );
}
export async function installMock(page, state = newState()) {
  state.logs = [...state.streams].map(([id, s]) => created(id, s));
  async function rpc(method, params = [], wallet = false) {
    state.requests.push({ method, params, wallet });
    if (method === "eth_chainId")
      return toHex(wallet ? state.walletChain : manifest.chainId);
    if (method === "net_version") return String(manifest.chainId);
    if (method === "eth_requestAccounts") {
      state.connected = true;
      return [state.account];
    }
    if (method === "eth_accounts")
      return state.connected ? [state.account] : [];
    if (method === "wallet_switchEthereumChain") {
      if (state.rejectSwitch)
        throw { code: 4001, message: "User rejected network switch" };
      if (!state.knownChain) throw { code: 4902, message: "Unknown chain" };
      state.walletChain = manifest.chainId;
      return null;
    }
    if (method === "wallet_addEthereumChain") {
      state.knownChain = true;
      return null;
    }
    if (method === "wallet_getCapabilities")
      throw { code: -32601, message: "Unsupported" };
    if (method === "eth_getCode") return state.code;
    if (method === "eth_blockNumber") return toHex(BLOCK);
    if (method === "eth_getBalance") return toHex(10n ** 20n);
    if (method === "eth_getBlockByNumber" || method === "eth_getBlockByHash") {
      const n =
        method === "eth_getBlockByNumber" && params[0] && params[0] !== "latest"
          ? BigInt(params[0])
          : BLOCK;
      return {
        number: toHex(n),
        hash: blockHash,
        parentHash: blockHash,
        nonce: "0x0000000000000000",
        sha3Uncles: zeroHash,
        logsBloom: `0x${"0".repeat(512)}`,
        transactionsRoot: zeroHash,
        stateRoot: zeroHash,
        receiptsRoot: zeroHash,
        miner: zeroAddress,
        difficulty: "0x0",
        totalDifficulty: "0x0",
        extraData: "0x",
        size: "0x100",
        gasLimit: "0x1c9c380",
        gasUsed: "0x100",
        timestamp: toHex(NOW - (BLOCK - n)),
        transactions: [],
        uncles: [],
        baseFeePerGas: "0x1",
      };
    }
    if (method === "eth_getLogs") {
      const filter = params[0];
      return state.logs.filter(
        (log) =>
          BigInt(log.blockNumber) >= BigInt(filter.fromBlock ?? 0) &&
          (filter.toBlock === "latest" ||
            BigInt(log.blockNumber) <= BigInt(filter.toBlock ?? BLOCK)) &&
          (!filter.topics ||
            filter.topics.every(
              (topic, i) =>
                !topic ||
                (Array.isArray(topic)
                  ? topic.some((t) => t === log.topics[i])
                  : topic === log.topics[i]),
            )),
      );
    }
    if (method === "eth_getTransactionReceipt")
      return state.receipts.get(params[0]) ?? null;
    if (method === "eth_estimateGas") return "0x7a120";
    if (method === "eth_gasPrice" || method === "eth_maxPriorityFeePerGas")
      return "0x1";
    if (method === "eth_call" || method === "eth_sendTransaction") {
      const call = params[0];
      const isWeir = lower(call.to) === lower(weir);
      const targetAbi = isWeir ? abi : erc20;
      const { functionName: fn, args = [] } = decodeFunctionData({
        abi: targetAbi,
        data: call.data,
      });
      const write = method === "eth_sendTransaction";
      const definition = targetAbi.find(
        (f) =>
          f.type === "function" &&
          f.name === fn &&
          f.inputs.length === args.length,
      );
      const mutation =
        definition.stateMutability !== "view" &&
        definition.stateMutability !== "pure";
      if (mutation && state.forcedError)
        throw {
          code: 3,
          message: "execution reverted",
          data: encodeErrorResult({ abi, errorName: state.forcedError }),
        };
      if (write && state.rejectNext) {
        state.rejectNext = false;
        throw { code: 4001, message: "User rejected request" };
      }
      if (write && state.delay)
        await new Promise((r) => setTimeout(r, state.delay));
      let result;
      const s = state.streams.get(BigInt(args[0] ?? 0));
      if (!isWeir) {
        const isLaunch = lower(call.to) === lower(launchToken),
          isImd = lower(call.to) === lower(imd);
        if (fn === "symbol")
          result = isLaunch ? "WEIR" : isImd ? "IMD" : "USDC";
        if (fn === "decimals") result = isLaunch || isImd ? 18 : 6;
        if (fn === "balanceOf")
          result = isLaunch
            ? state.holdings
            : isImd
              ? 1000n * 10n ** 18n
              : 1_000_000_000_000n;
        if (fn === "allowance")
          result = state.allowance.get(allowanceKey(call.to, args[0])) ?? 0n;
        if (fn === "approve") {
          result = true;
          if (write)
            state.allowance.set(allowanceKey(call.to, call.from), args[1]);
        }
      } else {
        const values = {
          weir: launchToken,
          imd,
          intake: manifest.network.pairToken.address,
          minHold: 10_000n * 10n ** 18n,
          disputeTimeout: 604800,
          courtFund: state.fund,
          oraclePrice: state.price,
          streamCount: BigInt(state.streams.size),
          canUse: state.holdings >= 10_000n * 10n ** 18n,
          tierBps: 250,
          acceptedAt: state.accepted.get(args[0]) ?? 0n,
          claimable: state.claimable,
          records: [2, 1, 3, 0, 4],
        };
        if (fn in values) result = values[fn];
        if (fn === "streams")
          result = s ?? { ...state.streams.get(1n), state: 0 };
        if (
          [
            "streamed",
            "withdrawable",
            "refundable",
            "stake",
            "bondFor",
          ].includes(fn)
        )
          result = !s
            ? 0n
            : fn === "streamed"
              ? s.snapDebt
              : fn === "withdrawable"
                ? s.snapDebt - s.withdrawn
                : fn === "refundable"
                  ? s.balance - s.snapDebt
                  : fn === "stake"
                    ? s.balance - s.withdrawn
                    : ((s.balance - s.withdrawn) * 250n) / 10000n;
        if (fn === "expectedBody")
          result = toHex(
            JSON.stringify({
              v: 1,
              question: `Weir stream ${args[0]} at ${weir} on chain ${manifest.chainId}. Client ${s.client} streams ${s.token} to recipient ${s.recipient} under the terms at ${s.termsURI} (keccak256 ${s.termsHash}). Dispute raised by the ${lower(args[1]) === lower(s.client) ? "client" : "recipient"} with note: ${args[2]}. As of block ${BLOCK}, has the recipient delivered the work those terms describe to the standard a reasonable client would accept? Answer true if yes, false if no.`,
              chainId: manifest.chainId,
              window: { hours: 24 },
              answerType: "bool",
              panelSize: 5,
              quorum: 4,
              validForSeconds: 604800,
              evidence: "panel",
              consumer: { chainId: manifest.chainId, verifyingContract: weir },
            }),
          );
        if (fn === "createStream") result = BigInt(state.streams.size + 1);
        if (write) {
          if (fn === "sponsor") state.fund += args[0];
          if (fn === "createStream") {
            const [
              recipient,
              token,
              rate,
              balance,
              termsHash,
              termsURI,
              imdJobId,
            ] = args;
            state.streams.set(result, {
              ...state.streams.get(1n),
              client: state.account,
              recipient,
              token,
              rate,
              balance,
              termsHash,
              termsURI,
              imdJobId,
              withdrawn: 0n,
              snapDebt: 0n,
              state: 1,
            });
          }
          if (fn === "deposit") s.balance += args[1];
          if (fn === "pause") {
            s.pausedRate = s.rate;
            s.rate = 0n;
          }
          if (fn === "restart" || fn === "adjust") s.rate = args[1];
          if (fn === "refund") s.balance -= args[1];
          if (fn === "refundMax") s.balance = s.snapDebt;
          if (fn === "withdraw") {
            s.withdrawn += args[1];
            state.accepted.set(args[0], NOW);
          }
          if (fn === "withdrawMax") {
            s.withdrawn = s.snapDebt;
            state.accepted.set(args[0], NOW);
          }
          if (fn === "accept") state.accepted.set(args[0], NOW);
          if (fn === "void") s.state = 4;
          if (fn === "dispute") {
            s.state = 2;
            s.pausedRate = s.rate;
            s.rate = 0n;
            s.disputer = state.account;
            s.bond = args[2];
            s.disputedAt = NOW;
            s.requestId = keccak256(toBytes("new dispute"));
          }
          if (fn === "enforce") {
            s.state = s.ruling === 1 ? 1 : 4;
            s.rate = s.ruling === 1 ? s.pausedRate : 0n;
            s.bond = 0n;
          }
          if (fn === "expireDispute") {
            s.state = 1;
            s.bond = 0n;
          }
          if (fn === "claim") state.claimable = 0n;
        }
      }
      if (!write)
        return encodeFunctionResult({
          abi: targetAbi,
          functionName: fn,
          result,
        });
      const hash = keccak256(
        toBytes(`test-transaction:${state.transactions.length + 1}`),
      );
      state.transactions.push({ fn, args, to: call.to, from: call.from, hash });
      const logs =
        fn === "createStream"
          ? [created(result, state.streams.get(result), hash)]
          : fn === "dispute"
            ? [
                logFor(
                  "Disputed",
                  {
                    id: args[0],
                    requestId: state.streams.get(args[0]).requestId,
                    disputer: state.account,
                    bond: args[2],
                    fundPaid: state.fund >= state.price,
                  },
                  hash,
                ),
              ]
            : [];
      state.logs.push(...logs);
      state.receipts.set(hash, {
        transactionHash: hash,
        transactionIndex: "0x0",
        blockHash,
        blockNumber: toHex(BLOCK),
        from: state.account,
        to: call.to,
        cumulativeGasUsed: "0x10000",
        gasUsed: "0x10000",
        effectiveGasPrice: "0x1",
        contractAddress: null,
        logs,
        logsBloom: `0x${"0".repeat(512)}`,
        status: "0x1",
        type: "0x2",
      });
      return hash;
    }
    throw { code: -32601, message: `Mock does not support ${method}` };
  }
  for (const url of manifest.network.rpcUrls)
    await page.route(`${url}/**`, routeRpc);
  for (const url of manifest.network.rpcUrls) await page.route(url, routeRpc);
  await page.route("https://api.imd.fun/intake/**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        entries: [...state.streams.values()]
          .filter((s) => s.requestId !== zeroHash)
          .map((s) => ({
            requestId: s.requestId,
            admission: {
              result: {
                kind: "oracle",
                jobId: "12345678-1234-4abc-8def-123456789abc",
              },
            },
          })),
      }),
    }),
  );
  async function routeRpc(route) {
    const request = route.request().postDataJSON();
    const reply = async (req) => {
      try {
        return {
          jsonrpc: "2.0",
          id: req.id,
          result: await rpc(req.method, req.params),
        };
      } catch (error) {
        return {
          jsonrpc: "2.0",
          id: req.id,
          error: {
            code: error.code ?? -32603,
            message: error.message ?? String(error),
            ...(error.data ? { data: error.data } : {}),
          },
        };
      }
    };
    const body = Array.isArray(request)
      ? await Promise.all(request.map(reply))
      : await reply(request);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  }
  await page.exposeFunction("weirMockRequest", async (method, params) => {
    try {
      return { result: await rpc(method, params, true) };
    } catch (e) {
      return {
        error: {
          code: e.code ?? -32603,
          message: e.message ?? String(e),
          ...(e.data ? { data: e.data } : {}),
        },
      };
    }
  });
  await page.addInitScript(() => {
    const listeners = new Map();
    const provider = {
      request: async ({ method, params }) => {
        const r = await window.weirMockRequest(method, params);
        if (r.error) throw Object.assign(new Error(r.error.message), r.error);
        if (method === "wallet_switchEthereumChain") {
          const chain = await window.weirMockRequest("eth_chainId");
          for (const f of listeners.get("chainChanged") ?? []) f(chain.result);
        }
        return r.result;
      },
      on: (name, fn) =>
        listeners.set(name, [...(listeners.get(name) ?? []), fn]),
      removeListener: (name, fn) =>
        listeners.set(
          name,
          (listeners.get(name) ?? []).filter((f) => f !== fn),
        ),
    };
    window.ethereum = provider;
    window.weirMockEmit = (name, value) => {
      for (const f of listeners.get(name) ?? []) f(value);
    };
    const announce = () =>
      window.dispatchEvent(
        new CustomEvent("eip6963:announceProvider", {
          detail: {
            info: {
              uuid: "00000000-0000-4000-8000-000000000001",
              name: "Test browser wallet",
              icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><rect width="28" height="28" fill="green"/></svg>',
              rdns: "test.weir.wallet",
            },
            provider,
          },
        }),
      );
    window.addEventListener("eip6963:requestProvider", announce);
    announce();
  });
  return state;
}
