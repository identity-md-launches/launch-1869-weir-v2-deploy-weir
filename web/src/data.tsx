import { createContext, useContext, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useWalletClient } from "wagmi";
import { type Address, type Hex, type TransactionReceipt } from "viem";
import type { Runtime } from "./config";
import { errorText, type Stream } from "./domain";

export const RuntimeContext = createContext<Runtime | null>(null);
export function useRuntime() {
  const r = useContext(RuntimeContext);
  if (!r) throw new Error("Deployment not loaded.");
  return r;
}
export const keyArgs = (args: readonly unknown[]) =>
  JSON.stringify(args, (_, v) => (typeof v === "bigint" ? v.toString() : v));
export function useRead<T>(
  name: string,
  args: readonly unknown[] = [],
  enabled = true,
) {
  const r = useRuntime();
  return useQuery({
    queryKey: ["read", name, keyArgs(args)],
    queryFn: async () =>
      (await r.client.readContract({
        address: r.weir.address,
        abi: r.weir.abi,
        functionName: name,
        args,
      })) as T,
    enabled,
    refetchInterval: 5000,
    staleTime: 3000,
    retry: 1,
  });
}
export type Token = { address: Address; symbol: string; decimals: number };
export function useToken(token?: Address) {
  const r = useRuntime();
  return useQuery({
    queryKey: ["token", token],
    enabled: !!token,
    staleTime: 300_000,
    queryFn: async (): Promise<Token> => {
      const [symbol, decimals, code] = await Promise.all([
        r.client.readContract({
          address: token!,
          abi: r.erc20,
          functionName: "symbol",
        }),
        r.client.readContract({
          address: token!,
          abi: r.erc20,
          functionName: "decimals",
        }),
        r.client.getCode({ address: token! }),
      ]);
      if (
        !code ||
        code === "0x" ||
        typeof symbol !== "string" ||
        typeof decimals !== "number" ||
        decimals > 255
      )
        throw new Error("This address does not expose valid token details.");
      return { address: token!, symbol: symbol.slice(0, 32), decimals };
    },
  });
}
export function useBalance(token?: Address, owner?: Address) {
  const r = useRuntime();
  return useQuery({
    queryKey: ["balance", token, owner],
    enabled: !!token && !!owner,
    refetchInterval: 5000,
    staleTime: 3000,
    queryFn: async () =>
      (await r.client.readContract({
        address: token!,
        abi: r.erc20,
        functionName: "balanceOf",
        args: [owner!],
      })) as bigint,
  });
}
export function useAllowance(token?: Address, owner?: Address) {
  const r = useRuntime();
  return useQuery({
    queryKey: ["allowance", token, owner],
    enabled: !!token && !!owner,
    refetchInterval: 5000,
    staleTime: 1000,
    queryFn: async () =>
      (await r.client.readContract({
        address: token!,
        abi: r.erc20,
        functionName: "allowance",
        args: [owner!, r.weir.address],
      })) as bigint,
  });
}
export function useVerification() {
  const r = useRuntime();
  return useQuery({
    queryKey: ["verification"],
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
    queryFn: async () => {
      if ((await r.client.getChainId()) !== r.chain.id)
        throw new Error(
          "The RPC is on a different chain. Transactions are disabled.",
        );
      for (const contract of Object.values(r.contracts)) {
        const code = await r.client.getCode({ address: contract.address });
        if (!code || code === "0x")
          throw new Error(
            `No deployed code found for ${contract.name}. Transactions are disabled.`,
          );
      }
      const token = (await r.client.readContract({
        address: r.weir.address,
        abi: r.weir.abi,
        functionName: "weir",
      })) as Address;
      if (token.toLowerCase() !== r.token.address.toLowerCase())
        throw new Error(
          "The application’s WEIR token differs from the handoff.",
        );
      return true;
    },
  });
}
export function useReady() {
  const { address, chainId } = useAccount();
  const r = useRuntime();
  const v = useVerification();
  const wallet = useWalletClient({
    chainId: r.chain.id,
    query: { enabled: !!address && chainId === r.chain.id },
  });
  return {
    ready:
      !!address &&
      chainId === r.chain.id &&
      v.data === true &&
      !v.isError &&
      !!wallet.data &&
      !wallet.isError,
    reason: !address
      ? "Connect a wallet to continue."
      : chainId !== r.chain.id
        ? `Switch to ${r.chain.name} to continue.`
        : v.isError
          ? errorText(v.error)
          : !v.data
            ? "Checking the deployed contracts…"
            : wallet.isError
              ? errorText(wallet.error)
              : !wallet.data
                ? "Preparing your wallet for signing…"
                : "",
    address,
  };
}
export function useStream(id: bigint) {
  const r = useRuntime();
  return useQuery({
    queryKey: ["stream", id.toString()],
    refetchInterval: 5000,
    staleTime: 3000,
    queryFn: async () => {
      const block = await r.client.getBlock();
      const read = <T,>(functionName: string) =>
        r.client.readContract({
          address: r.weir.address,
          abi: r.weir.abi,
          functionName,
          args: [id],
          blockNumber: block.number,
        }) as Promise<T>;
      const [stream, streamed, withdrawable, refundable, acceptedAt] =
        await Promise.all([
          read<Stream>("streams"),
          read<bigint>("streamed"),
          read<bigint>("withdrawable"),
          read<bigint>("refundable"),
          read<bigint>("acceptedAt"),
        ]);
      if (stream.state === 0)
        throw new Error(
          "This stream ID does not exist. Check the ID and try again.",
        );
      return {
        stream,
        streamed,
        withdrawable,
        refundable,
        acceptedAt,
        timestamp: block.timestamp,
        block: block.number,
      };
    },
  });
}
export type TxState = {
  phase:
    | "idle"
    | "checking"
    | "signing"
    | "pending"
    | "refreshing"
    | "success"
    | "error";
  hash?: Hex;
  error?: string;
};
export const busy = (state: TxState) =>
  ["checking", "signing", "pending", "refreshing"].includes(state.phase);
export function useTransaction() {
  const r = useRuntime();
  const { address, chainId } = useAccount();
  const { data: wallet } = useWalletClient({
    chainId: r.chain.id,
    query: { enabled: !!address && chainId === r.chain.id },
  });
  const cache = useQueryClient();
  const lock = useRef(false);
  const gate = useReady();
  const [state, setState] = useState<TxState>({ phase: "idle" });
  async function run(
    name: string,
    args: readonly unknown[],
    token?: Address,
    preflight?: () => Promise<void>,
  ): Promise<TransactionReceipt | undefined> {
    if (lock.current) return;
    lock.current = true;
    setState({ phase: "checking" });
    try {
      if (!gate.ready || !wallet || !address)
        throw new Error(
          gate.reason || "Wait for your wallet connection, then try again.",
        );
      if ((await wallet.getChainId()) !== r.chain.id)
        throw new Error(`Switch to ${r.chain.name} to continue.`);
      const accounts = await wallet.getAddresses();
      if (accounts[0]?.toLowerCase() !== address.toLowerCase())
        throw new Error(
          "Your wallet account changed. Refresh before continuing.",
        );
      await preflight?.();
      const { request } = await r.client.simulateContract({
        address: token ?? r.weir.address,
        abi: token ? r.erc20 : r.weir.abi,
        functionName: name,
        args,
        account: address,
      });
      setState({ phase: "signing" });
      const hash = await wallet.writeContract({
        ...request,
        chain: r.chain,
        account: address,
      });
      setState({ phase: "pending", hash });
      const receipt = await r.client.waitForTransactionReceipt({
        hash,
        confirmations: 1,
        onReplaced: (replacement) =>
          setState({ phase: "pending", hash: replacement.transaction.hash }),
      });
      if (receipt.status !== "success")
        throw new Error(
          "The transaction reverted. No action was completed. Refresh the state and try again.",
        );
      setState({ phase: "refreshing", hash: receipt.transactionHash });
      await cache.invalidateQueries({
        predicate: (query) =>
          !["walletClient", "connectorClient"].includes(
            String(query.queryKey[0]),
          ),
      });
      setState({ phase: "success", hash: receipt.transactionHash });
      return receipt;
    } catch (error) {
      setState((s) => ({ ...s, phase: "error", error: errorText(error) }));
    } finally {
      lock.current = false;
    }
  }
  return { state, run, pending: busy(state) };
}
