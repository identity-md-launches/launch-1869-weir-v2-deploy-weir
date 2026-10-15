import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { hexToString, type Address, type Hex } from "viem";
import {
  useAllowance,
  useBalance,
  useRead,
  useReady,
  useRuntime,
  useToken,
  useTransaction,
  type Token,
} from "./data";
import {
  byteLength,
  disputeAllowances,
  errorText,
  units,
  type Stream,
} from "./domain";
import { Dialog, Field, Notice, QueryState, TxButton, TxFeedback } from "./ui";

type Quote = {
  body: string;
  question: string;
  bond: bigint;
  price: bigint;
  fund: bigint;
  block: bigint;
  caller: Address;
  note: string;
};
function DisputeApproval({
  token,
  required,
  disabled,
  label,
  onBusy,
}: {
  token: Token;
  required: bigint;
  disabled: boolean;
  label: string;
  onBusy: (key: string, value: boolean) => void;
}) {
  const r = useRuntime();
  const { address } = useAccount();
  const allowance = useAllowance(token.address, address);
  const balance = useBalance(token.address, address);
  const tx = useTransaction();
  const gate = useReady();
  const approved = allowance.data !== undefined && allowance.data >= required;
  const enough = balance.data !== undefined && balance.data >= required;
  const reset = (allowance.data ?? 0n) > 0n && !approved;
  useEffect(() => {
    onBusy(token.address, tx.pending);
    return () => onBusy(token.address, false);
  }, [token.address, tx.pending, onBusy]);
  return (
    <div className="dispute-approval">
      <p>
        <strong>{label}</strong> · {units(required, token.decimals)}{" "}
        {token.symbol}
      </p>
      {approved ? (
        <p className="success">✓ Allowance ready</p>
      ) : (
        <TxButton
          label={
            reset
              ? `Reset ${token.symbol} allowance`
              : `Approve ${token.symbol}`
          }
          pending={tx.pending}
          phase={tx.state.phase}
          disabled={
            disabled ||
            !gate.ready ||
            !enough ||
            allowance.isError ||
            allowance.data === undefined
          }
          onClick={() =>
            tx.run(
              "approve",
              [r.weir.address, reset ? 0n : required],
              token.address,
            )
          }
        />
      )}
      {!enough && balance.data !== undefined && (
        <Notice error>
          Your {token.symbol} balance is too small for this approval.
        </Notice>
      )}
      <QueryState query={allowance} />
      <QueryState query={balance} />
      <TxFeedback state={tx.state} />
    </div>
  );
}
export function DisputeDialog({
  id,
  stream,
  token,
  onClose,
}: {
  id: bigint;
  stream: Stream;
  token: Token;
  onClose: () => void;
}) {
  const r = useRuntime();
  const { address } = useAccount();
  const gate = useReady();
  const imd = useRead<Address>("imd");
  const imdToken = useToken(imd.data);
  const canUse = useRead<boolean>("canUse", [address], !!address);
  const [note, setNote] = useState("");
  const [quote, setQuote] = useState<Quote>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const tx = useTransaction();
  const [approvalStates, setApprovalStates] = useState<Record<string, boolean>>(
    {},
  );
  const onApprovalBusy = useCallback(
    (key: string, value: boolean) =>
      setApprovalStates((states) =>
        states[key] === value ? states : { ...states, [key]: value },
      ),
    [],
  );
  const pending = tx.pending || Object.values(approvalStates).some(Boolean);
  const tokenAllowance = useAllowance(token.address, address);
  const imdAllowance = useAllowance(imd.data, address);
  const tokenBalance = useBalance(token.address, address);
  const imdBalance = useBalance(imd.data, address);
  const requests =
    quote && imd.data
      ? disputeAllowances(
          token.address,
          imd.data,
          quote.bond,
          quote.price,
          quote.fund,
        ).filter((x) => x.amount > 0n)
      : [];
  const ready =
    !!quote &&
    quote.caller.toLowerCase() === address?.toLowerCase() &&
    requests.every((req) => {
      const isToken = req.token.toLowerCase() === token.address.toLowerCase();
      const allowance = isToken ? tokenAllowance : imdAllowance;
      const balance = isToken ? tokenBalance : imdBalance;
      return (
        !allowance.isError &&
        !balance.isError &&
        allowance.data !== undefined &&
        balance.data !== undefined &&
        allowance.data >= req.amount &&
        balance.data >= req.amount
      );
    });
  async function preview() {
    setLoading(true);
    setError("");
    setQuote(undefined);
    try {
      if (!address || !canUse.data)
        throw new Error("Connect an eligible client or recipient wallet.");
      if (byteLength(note) > 280)
        throw new Error("Keep your note within 280 UTF-8 bytes.");
      const block = await r.client.getBlockNumber();
      const read = <T,>(name: string, args: readonly unknown[] = []) =>
        r.client.readContract({
          address: r.weir.address,
          abi: r.weir.abi,
          functionName: name,
          args,
          blockNumber: block,
        }) as Promise<T>;
      const [bodyHex, bond, price, fund] = await Promise.all([
        read<Hex>("expectedBody", [id, address, note]),
        read<bigint>("bondFor", [id, address]),
        read<bigint>("oraclePrice"),
        read<bigint>("courtFund"),
      ]);
      const body = hexToString(bodyHex);
      const parsed = JSON.parse(body);
      setQuote({
        body,
        question: parsed.question,
        bond,
        price,
        fund,
        block,
        caller: address,
        note,
      });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }
  async function preflight() {
    if (!quote || quote.caller.toLowerCase() !== address?.toLowerCase())
      throw new Error("Your wallet changed. Review the dispute again.");
    const read = <T,>(name: string) =>
      r.client.readContract({
        address: r.weir.address,
        abi: r.weir.abi,
        functionName: name,
      }) as Promise<T>;
    const [price, fund] = await Promise.all([
      read<bigint>("oraclePrice"),
      read<bigint>("courtFund"),
    ]);
    const covered = price - (price * 2000n) / 10000n;
    if (price !== quote.price || (quote.fund >= covered && fund < covered))
      throw new Error(
        "The oracle price or fee payer changed. Refresh the dispute preview before signing.",
      );
  }
  return (
    <Dialog
      title={`Ask the reviewers · stream #${id}`}
      onClose={() => {
        if (!pending) onClose();
      }}
    >
      <p>
        The stream pauses while five independent reviewers look at the work.
        Four must agree. They read the terms exactly as written and your note.
      </p>
      <Field
        label="Your note to the reviewers"
        hint={`${byteLength(note)}/280 characters. This note is public.`}
      >
        <textarea
          rows={3}
          disabled={loading || pending}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setQuote(undefined);
          }}
        />
      </Field>
      <button
        onClick={preview}
        disabled={
          loading ||
          pending ||
          !gate.ready ||
          !canUse.data ||
          canUse.isError ||
          byteLength(note) > 280
        }
      >
        {loading
          ? "Working out the cost…"
            : quote
              ? "Refresh"
              : "See the question and the cost"}
      </button>
      {!gate.ready && <Notice>{gate.reason}</Notice>}
      {canUse.data === false && (
        <Notice error>
          You need to hold 10,000 WEIR to raise a dispute.
        </Notice>
      )}
      <QueryState query={imdToken} />
      {error && <Notice error>{error}</Notice>}
      {quote && imdToken.data && (
        <div className="dispute-review">
          <h3>What the reviewers will be asked</h3>
          <blockquote className="question">{quote.question}</blockquote>
          <small className="muted">
            The block number in the question is filled in when the dispute is
            sent.
          </small>
          <details>
            <summary>Technical details</summary>
            <pre className="body-json">{quote.body}</pre>
          </details>
          <dl className="detail-list">
            <div>
              <dt>Your deposit</dt>
              <dd>
                {units(quote.bond, token.decimals)} {token.symbol}
              </dd>
            </div>
            <div>
              <dt>Reviewers’ fee</dt>
              <dd>
                {units(quote.price, imdToken.data.decimals)}{" "}
                {imdToken.data.symbol}
              </dd>
            </div>
            <div>
              <dt>Who pays the fee</dt>
              <dd>
                {quote.fund >= quote.price - (quote.price * 2000n) / 10000n
                  ? "You pay 20%. The court fund covers the rest, up to five disputes a day"
                  : "You pay all of it"}
              </dd>
            </div>
          </dl>
          <p className="muted">
            The fee is read live from the reviewers’ service.
          </p>
          <p>
            The fee is spent even if the reviewers cannot agree. If they rule
            against you, your deposit goes to the other side. If they rule for
            you, or cannot decide, you get it back.
          </p>
          {stream.recipient.toLowerCase() === address?.toLowerCase() && (
            <p>
              Disputing also counts as accepting the terms, so the decision
              goes on both track records.
            </p>
          )}
          <p className="muted">
            You always pay at least 20% of the fee yourself. If the court fund
            runs out, or has already helped with five disputes today, the whole
            fee is taken from your wallet instead. After a dispute ends, you
            wait seven days before disputing the same stream again.
          </p>
          {requests.map((req, i) => (
            <DisputeApproval
              key={`${req.token}-${req.amount}`}
              token={
                req.token.toLowerCase() === token.address.toLowerCase()
                  ? token
                  : imdToken.data!
              }
              required={req.amount}
              label={`${i + 1}. Allow the ${req.kind.replace("bond", "deposit").replace("oracle fee", "reviewers’ fee")}`}
              disabled={pending || !canUse.data || canUse.isError}
              onBusy={onApprovalBusy}
            />
          ))}
          <TxButton
            label="Send to the reviewers"
            primary
            pending={tx.pending}
            phase={tx.state.phase}
            disabled={
              pending || !gate.ready || !ready || !canUse.data || canUse.isError
            }
            onClick={async () => {
              const receipt = await tx.run(
                "dispute",
                [id, quote.note, quote.bond],
                undefined,
                preflight,
              );
              if (receipt) onClose();
            }}
          />
          <TxFeedback state={tx.state} />
        </div>
      )}
    </Dialog>
  );
}
