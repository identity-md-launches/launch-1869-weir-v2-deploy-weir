import { useState } from "react";
import { useAccount } from "wagmi";
import {
  decodeEventLog,
  isAddress,
  keccak256,
  toBytes,
  zeroHash,
  type Address,
  type Hex,
} from "viem";
import { useBalance, useRead, useReady, useRuntime, useToken } from "./data";
import { useWalletClient } from "wagmi";
import {
  address,
  amount,
  byteLength,
  errorText,
  jobId,
  tryAmount,
  UINT128_MAX,
  units,
} from "./domain";
import { ApprovalAction } from "./actions";
import { Eligibility } from "./Home";
import { AddressView, Field, Notice, QueryState, Title } from "./ui";
import { ConnectPrompt } from "./Wallet";

/** Wrap ETH into WETH so it can be streamed; the recipient can unwrap it any time. */
function WrapEth({ needed, decimals }: { needed: bigint; decimals: number }) {
  const r = useRuntime();
  const gate = useReady();
  const { data: wallet } = useWalletClient({ chainId: r.chain.id });
  const weth = WETH[r.chain.id];
  const balance = useBalance(weth, gate.address);
  const [state, setState] = useState<"idle" | "signing" | "pending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  if (!weth || balance.data === undefined || balance.data >= needed) return null;
  const missing = needed - balance.data;
  return (
    <div className="notice">
      <p>
        You hold {units(balance.data, decimals)} WETH. Wrap {units(missing, decimals)} ETH first
        (one wallet step), then approve and create.
      </p>
      <button
        type="button"
        disabled={!gate.ready || !wallet || state === "signing" || state === "pending"}
        onClick={async () => {
          try {
            setState("signing");
            setMessage("");
            const hash = await wallet!.writeContract({
              address: weth,
              abi: WETH_ABI,
              functionName: "deposit",
              value: missing,
              chain: r.chain,
              account: gate.address!,
            });
            setState("pending");
            const receipt = await r.client.waitForTransactionReceipt({ hash });
            if (receipt.status !== "success") throw new Error("The wrap reverted.");
            setState("done");
            await balance.refetch();
          } catch (e) {
            setState("error");
            setMessage(errorText(e));
          }
        }}
      >
        {state === "signing" ? "Confirm in your wallet…" : state === "pending" ? "Wrapping…" : `Wrap ${units(missing, decimals)} ETH`}
      </button>
      {message && <p className="field-error">{message}</p>}
    </div>
  );
}

/** Named tokens offered on Robinhood Chain (4663). Symbol and decimals are still read from the contract. */
const NAMED_TOKENS: Record<number, { label: string; address: Address; note: string }[]> = {
  4663: [
    {
      label: "USDG",
      address: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
      note: "Dollar token",
    },
    {
      label: "WEIR",
      address: "0x58b82fa656ecf47a0dca5be6bad06b92e22f7dbe",
      note: "Weir token",
    },
    {
      label: "IMD",
      address: "0x5f7bb59365ce557c26dbcaa4ee9d39a4b95b7127",
      note: "Identity.md token",
    },
    {
      label: "ETH",
      address: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
      note: "Wrapped, as WETH",
    },
  ],
};
const WETH: Record<number, Address> = { 4663: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73" };
const WETH_ABI = [
  { type: "function", name: "deposit", stateMutability: "payable", inputs: [], outputs: [] },
] as const;
const TERMS_LIMIT = 512;
const PERIODS = { day: 86400n, week: 604800n } as const;
type Period = keyof typeof PERIODS;

type Draft = {
  recipient: Address;
  token: Address;
  rate: bigint;
  deposit: bigint;
  hash: Hex;
  uri: string;
  job: Hex;
  perPeriod: bigint;
  period: Period;
};

export function Create() {
  const r = useRuntime();
  const { address: account } = useAccount();
  const eligible = useRead<boolean>("canUse", [account], !!account);
  const named = NAMED_TOKENS[r.chain.id] ?? [];
  const [recipient, setRecipient] = useState("");
  const [choice, setChoice] = useState<string>(named[0]?.address ?? "");
  const [custom, setCustom] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const [perPeriod, setPerPeriod] = useState("");
  const [period, setPeriod] = useState<Period>("day");
  const [deposit, setDeposit] = useState("");
  const [terms, setTerms] = useState("");
  const [link, setLink] = useState("");
  const [job, setJob] = useState("");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<Draft>();
  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState<{ name: string; message: string }>();
  const fieldError = (name: string) =>
    invalid?.name === name ? invalid.message : undefined;

  const tokenInput = customOpen ? custom : choice;
  const tokenAddress = isAddress(tokenInput.trim())
    ? (tokenInput.trim() as Address)
    : undefined;
  const token = useToken(tokenAddress);
  const symbol = token.data?.symbol ?? "";

  // The terms as stored on-chain: the text itself, plus the link to a longer document when given.
  const onChain = [terms.trim(), link.trim()].filter(Boolean).join("\n");
  const termsBytes = byteLength(onChain);
  const perAmount = token.data
    ? tryAmount(perPeriod, token.data.decimals, UINT128_MAX)
    : undefined;
  const rate = perAmount !== undefined ? perAmount / PERIODS[period] : undefined;
  const depositAmount = token.data
    ? tryAmount(deposit, token.data.decimals, UINT128_MAX)
    : undefined;
  const coverage =
    perAmount && depositAmount && perAmount > 0n
      ? Number((depositAmount * 10n) / perAmount) / 10
      : undefined;

  function review() {
    setInvalid(undefined);
    const fail = (name: string, message: string): never => {
      setInvalid({ name, message });
      document
        .querySelector<HTMLElement>(`[name="${name}"]`)
        ?.focus();
      throw new Error(message);
    };
    const checked = <T,>(name: string, read: () => T): T => {
      try {
        return read();
      } catch (e) {
        return fail(name, errorText(e));
      }
    };
    try {
      if (!account) throw new Error("Connect your wallet first.");
      if (!eligible.data)
        throw new Error("You need to hold 10,000 WEIR to start a stream.");
      const rec = checked("recipient", () => address(recipient));
      if (
        [account.toLowerCase(), r.weir.address.toLowerCase()].includes(
          rec.toLowerCase(),
        )
      )
        fail("recipient", "Pay someone other than yourself.");
      const tok = checked("token", () => address(tokenInput));
      if (!token.data) throw new Error("Give the token a moment to load.");
      const per = checked("perPeriod", () =>
        amount(perPeriod, token.data!.decimals, UINT128_MAX),
      );
      const rateValue = per / PERIODS[period];
      if (rateValue === 0n)
        fail(
          "perPeriod",
          `That is less than the smallest unit of ${symbol} per second. Raise the amount.`,
        );
      const depositValue = checked("deposit", () =>
        amount(deposit, token.data!.decimals, UINT128_MAX),
      );
      if (!terms.trim())
        fail("terms", "Say what is being delivered and by when.");
      if (termsBytes > TERMS_LIMIT)
        fail(
          "terms",
          `Keep the terms under ${TERMS_LIMIT} characters, or shorten them and add a link to the full document.`,
        );
      if (/[\u0000-\u0008\u000b-\u001f\u007f]/.test(onChain))
        fail("terms", "Remove unusual control characters from the terms.");
      if (link.trim() && !/^(https?:\/\/|ipfs:\/\/)\S+$/i.test(link.trim()))
        fail("link", "Use a full https:// or ipfs:// link.");
      setDraft({
        recipient: rec,
        token: tok,
        rate: rateValue,
        deposit: depositValue,
        hash: keccak256(toBytes(onChain)),
        uri: onChain,
        job: checked("imdJobId", () => jobId(job)),
        perPeriod: per,
        period,
      });
      setError("");
      window.scrollTo(0, 0);
    } catch (e) {
      setError(errorText(e));
    }
  }

  return (
    <>
      <Title>Start a stream</Title>
      <p className="page-description">
        Say who, how much, and what for. Money moves per second once it is
        funded, and you can pause or stop any time.
      </p>
      <Notice>
        Before you fund a stream: if the other person opens a dispute, your
        stream pauses until it is settled. They then wait seven days before
        they can dispute it again, and you can stop the stream and take back
        what is unearned in between. Stream only to people you trust and keep
        deposits small. Reviewers read your agreement word for word, so write
        only the work and the deadline.
      </Notice>
      {!account ? <ConnectPrompt /> : <Eligibility compact />}
      {draft && token.data ? (
        <section className="form-surface review-surface">
          <h2>Check it over</h2>
          <dl className="detail-list">
            <div>
              <dt>Paying</dt>
              <dd>
                <AddressView value={draft.recipient} full />
              </dd>
            </div>
            <div>
              <dt>How much</dt>
              <dd>
                {units(draft.perPeriod, token.data.decimals)} {token.data.symbol}{" "}
                per {draft.period}
                <small className="muted">
                  {units(draft.rate, token.data.decimals)} {token.data.symbol}{" "}
                  every second, rounded down to the smallest unit
                </small>
              </dd>
            </div>
            <div>
              <dt>Starting with</dt>
              <dd>
                {units(draft.deposit, token.data.decimals)} {token.data.symbol}
                {coverage !== undefined && (
                  <small className="muted">
                    about {coverage} {draft.period}
                    {coverage === 1 ? "" : "s"} of streaming
                  </small>
                )}
              </dd>
            </div>
            <div>
              <dt>Terms</dt>
              <dd className="terms-preview">{draft.uri}</dd>
            </div>
            {draft.job !== zeroHash && (
              <div>
                <dt>IMD job</dt>
                <dd className="hash">{draft.job}</dd>
              </div>
            )}
          </dl>
          <p className="muted">
            The terms are stored with the stream, word for word. Reviewers read
            exactly this text if there is ever a disagreement. Two wallet
            steps: allow Weir to take the deposit, then create the stream.
          </p>
          {draft.token.toLowerCase() === WETH[r.chain.id]?.toLowerCase() && (
            <WrapEth needed={draft.deposit} decimals={token.data.decimals} />
          )}
          <ApprovalAction
            token={token.data}
            amount={draft.deposit}
            name="createStream"
            args={[
              draft.recipient,
              draft.token,
              draft.rate,
              draft.deposit,
              draft.hash,
              draft.uri,
              draft.job,
            ]}
            label="Create stream"
            disabled={!eligible.data || eligible.isError}
            onBusy={setBusy}
            onDone={(receipt) => {
              for (const log of receipt.logs) {
                try {
                  const decoded = decodeEventLog({
                    abi: r.weir.abi,
                    data: log.data,
                    topics: log.topics,
                  }) as { eventName: string; args: unknown };
                  if (decoded.eventName === "StreamCreated") {
                    const id = (decoded.args as { id: bigint }).id;
                    location.hash = `/stream/${id}`;
                    return;
                  }
                } catch {
                  /* another contract's event */
                }
              }
              location.hash = "/streams";
            }}
          />
          <button
            className="text-button"
            disabled={busy}
            onClick={() => setDraft(undefined)}
          >
            Go back and change something
          </button>
        </section>
      ) : (
        <form
          className="create-grid"
          onSubmit={(e) => {
            e.preventDefault();
            review();
          }}
          noValidate
        >
          <div className="form-surface">
            <h2>Who and how much</h2>
            <Field
              error={fieldError("recipient")}
              label="Who are you paying?"
              hint="Their wallet address. They withdraw what has streamed, any time."
            >
              <input
                name="recipient"
                autoComplete="off"
                spellCheck={false}
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="0x…"
              />
            </Field>
            <Field error={fieldError("token")} label="Pay with">
              <div className="token-picker" role="radiogroup" aria-label="Token">
                {named.map((t) => (
                  <button
                    type="button"
                    key={t.address}
                    role="radio"
                    aria-checked={!customOpen && choice === t.address}
                    className={`token-option${!customOpen && choice === t.address ? " selected" : ""}`}
                    onClick={() => {
                      setChoice(t.address);
                      setCustomOpen(false);
                    }}
                  >
                    <strong>{t.label}</strong>
                    <span>{t.note}</span>
                  </button>
                ))}
                <button
                  type="button"
                  role="radio"
                  aria-checked={customOpen}
                  className={`token-option${customOpen ? " selected" : ""}`}
                  onClick={() => setCustomOpen(true)}
                >
                  <strong>Another token</strong>
                  <span>By address</span>
                </button>
              </div>
              {customOpen && (
                <input
                  name="token"
                  autoComplete="off"
                  spellCheck={false}
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  placeholder="Token contract address 0x…"
                  aria-label="Token contract address"
                />
              )}
            </Field>
            {tokenAddress && <QueryState query={token} />}
            {tokenAddress?.toLowerCase() === WETH[r.chain.id]?.toLowerCase() && (
              <small className="muted">
                ETH is streamed as WETH: we wrap it for you before the stream
                starts, and the recipient can unwrap it back to ETH any time.
              </small>
            )}
            <Field
              error={fieldError("perPeriod")}
              label={`How much${symbol ? ` (${symbol})` : ""}`}
              hint={
                rate !== undefined && token.data
                  ? `${units(rate, token.data.decimals)} ${symbol} every second.`
                  : "The amount they earn each day or each week while the stream runs."
              }
            >
              <div className="amount-row">
                <input
                  name="perPeriod"
                  inputMode="decimal"
                  value={perPeriod}
                  onChange={(e) => setPerPeriod(e.target.value)}
                  placeholder="500"
                />
                <div className="period-toggle" role="radiogroup" aria-label="Per">
                  {(["day", "week"] as Period[]).map((p) => (
                    <button
                      type="button"
                      key={p}
                      role="radio"
                      aria-checked={period === p}
                      className={period === p ? "selected" : ""}
                      onClick={() => setPeriod(p)}
                    >
                      per {p}
                    </button>
                  ))}
                </div>
              </div>
            </Field>
            <Field
              error={fieldError("deposit")}
              label={`Start with${symbol ? ` (${symbol})` : ""}`}
              hint={
                coverage !== undefined
                  ? `Covers about ${coverage} ${period}${coverage === 1 ? "" : "s"}. You can add more later, and anything unstreamed comes back if you stop.`
                  : "Your first deposit. You can top up later; whatever has not streamed comes back if you stop."
              }
            >
              <input
                name="deposit"
                inputMode="decimal"
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
                placeholder="1000"
              />
            </Field>
          </div>
          <div className="form-surface">
            <h2>What for</h2>
            <Field
              error={fieldError("terms")}
              label="What are they delivering, by when?"
              hint={`${termsBytes}/${TERMS_LIMIT} characters. Stored with the stream, word for word. If you ever disagree, five reviewers read exactly this.`}
            >
              <textarea
                name="terms"
                rows={6}
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="Design and deliver the new landing page (Figma + exported assets) by Friday 24 October. Two rounds of revisions included."
              />
            </Field>
            <details className="helper">
              <summary>More details (optional)</summary>
              <Field
                error={fieldError("link")}
                label="Link to the full agreement"
                hint="For longer terms: a public document the reviewers can open. Saved with the text above."
              >
                <input
                  name="link"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://… or ipfs://…"
                />
              </Field>
              <Field
                error={fieldError("imdJobId")}
                label="IMD job"
                hint="If this stream pays for an IMD swarm job, paste its id to link them."
              >
                <input
                  name="imdJobId"
                  value={job}
                  onChange={(e) => setJob(e.target.value)}
                  placeholder="Job id"
                />
              </Field>
            </details>
          </div>
          <div className="form-end">
            {error && <Notice error>{error}</Notice>}
            <p>
              You stay in control of the pace and of anything that has not
              streamed yet. There is no fee.
            </p>
            <button
              className="primary"
              type="submit"
              disabled={!account || !eligible.data || eligible.isError}
            >
              Check it over
            </button>
          </div>
        </form>
      )}
    </>
  );
}
