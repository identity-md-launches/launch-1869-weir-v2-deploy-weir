import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, type Connector } from "wagmi";
import { numberToHex } from "viem";
import type { Runtime } from "./config";
import { useRuntime } from "./data";
import { Dialog, Notice, AddressView } from "./ui";
import { errorText, short } from "./domain";

type Provider = {
  request: (a: { method: string; params?: unknown[] }) => Promise<unknown>;
};
export async function switchProvider(provider: Provider, r: Runtime) {
  const id = numberToHex(r.chain.id);
  if (Number(await provider.request({ method: "eth_chainId" })) === r.chain.id)
    return;
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: id }],
    });
  } catch (error) {
    const e = error as {
      code?: number;
      message?: string;
      cause?: { code?: number };
    };
    if (
      (e.code === 4902 ||
        e.cause?.code === 4902 ||
        /unknown chain|unrecognized chain|not added/i.test(e.message ?? "")) &&
      r.deployment.walletAddChain
    ) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [r.deployment.walletAddChain],
      });
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: id }],
      });
    } else throw error;
  }
  if (Number(await provider.request({ method: "eth_chainId" })) !== r.chain.id)
    throw new Error(
      `Switch to ${r.chain.name} in your wallet, then try again.`,
    );
}
export const openWallet = () => window.dispatchEvent(new Event("weir:connect"));
const mobileLinks = [
  {
    id: "metamask",
    name: "MetaMask",
    href: (url: string) =>
      `https://link.metamask.io/dapp/${url.replace(/^https?:\/\//, "")}`,
  },
  {
    id: "coinbase",
    name: "Coinbase Wallet",
    href: (url: string) =>
      `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(url)}`,
  },
  {
    id: "rabby",
    name: "Rabby",
    href: (url: string) =>
      `https://go.rabby.io/mobile/?_cmd=open-dapp&dapp=${encodeURIComponent(url)}`,
  },
  {
    id: "phantom",
    name: "Phantom",
    href: (url: string) =>
      `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(new URL(url).origin)}`,
  },
];
export function WalletControl() {
  const r = useRuntime();
  const { address, chainId, connector } = useAccount();
  const { connectors, connectAsync } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const mobile =
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) &&
    !("ethereum" in window);
  const named = connectors.some(
    (c) => c.type === "injected" && c.id !== "injected",
  );
  const listed = [
    ...connectors.filter((c) => c.type === "injected"),
    ...connectors.filter((c) => c.type !== "injected"),
  ].filter(
    (c) =>
      !(c.id === "injected" && named) && (!mobile || c.type !== "injected"),
  );
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("weir:connect", show);
    return () => window.removeEventListener("weir:connect", show);
  }, []);
  async function connect(c: Connector) {
    setPending(c.uid);
    setError("");
    try {
      if (c.id === "injected" && !("ethereum" in window))
        throw new Error(
          "No browser wallet was found. Install a wallet, or choose Coinbase Wallet.",
        );
      await connectAsync({ connector: c });
      await switchProvider((await c.getProvider()) as Provider, r);
      setOpen(false);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setPending("");
    }
  }
  async function switchChain() {
    if (!connector) return;
    setPending("switch");
    setError("");
    try {
      await switchProvider((await connector.getProvider()) as Provider, r);
      setOpen(false);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setPending("");
    }
  }
  return (
    <>
      <button
        className="wallet-button"
        disabled={!!pending}
        onClick={() =>
          address && chainId !== r.chain.id ? void switchChain() : setOpen(true)
        }
      >
        {pending === "switch"
          ? "Switching…"
          : address
            ? chainId !== r.chain.id
              ? `Switch to ${r.chain.name}`
              : short(address)
            : "Connect wallet"}
        <span aria-hidden="true"> {address ? "⌄" : "↗"}</span>
      </button>
      {error && !open && (
        <p className="wallet-error" role="alert">
          {error}
        </p>
      )}
      {open && (
        <Dialog
          title={address ? "Your wallet" : "Connect a wallet"}
          onClose={() => setOpen(false)}
        >
          {address ? (
            <div className="stack">
              <AddressView value={address} full />
              <p>
                {chainId === r.chain.id
                  ? r.chain.name
                  : `Connected to chain ${chainId}. Switch to ${r.chain.name}.`}
              </p>
              {chainId !== r.chain.id && (
                <button disabled={!!pending} onClick={switchChain}>
                  {pending === "switch"
                    ? "Switching…"
                    : `Switch to ${r.chain.name}`}
                </button>
              )}
              <button
                disabled={!!pending}
                onClick={async () => {
                  setPending("disconnect");
                  try {
                    await disconnectAsync();
                    setOpen(false);
                  } catch (e) {
                    setError(errorText(e));
                  } finally {
                    setPending("");
                  }
                }}
              >
                Disconnect{pending === "disconnect" ? "…" : ""}
              </button>
            </div>
          ) : (
            <div className="wallet-list">
              {mobile &&
                mobileLinks.map((w) => (
                  <a key={w.id} href={w.href(location.href)}>
                    <img
                      src={`./wallets/${w.id}.svg`}
                      width="28"
                      height="28"
                      alt=""
                    />
                    Open in {w.name}
                    <span aria-hidden="true">↗</span>
                  </a>
                ))}
              {listed.map((c) => (
                <button
                  key={c.uid}
                  disabled={!!pending}
                  onClick={() => connect(c)}
                >
                  {c.icon ? (
                    <img src={c.icon} width="28" height="28" alt="" />
                  ) : (
                    <img
                      src={`./wallets/${c.id === "coinbaseWalletSDK" ? "coinbase" : "browser"}.svg`}
                      width="28"
                      height="28"
                      alt=""
                    />
                  )}
                  <span>
                    {c.id === "injected"
                      ? "Browser wallet"
                      : c.id === "coinbaseWalletSDK" && mobile
                        ? "Coinbase Smart Wallet"
                        : c.name}
                    {pending === c.uid ? " · Opening…" : ""}
                  </span>
                </button>
              ))}
              {!named && !mobile && (
                <p className="muted">
                  Install a browser wallet, or create a passkey wallet with
                  Coinbase.
                </p>
              )}
            </div>
          )}
          {error && <Notice error>{error}</Notice>}
        </Dialog>
      )}
    </>
  );
}
export function ConnectPrompt() {
  return (
    <div className="notice">
      <p>Connect your wallet to see what you can do.</p>
      <button onClick={openWallet}>Connect wallet</button>
    </div>
  );
}
