import { useEffect, useState } from "react";
import { useRuntime, useStream, useToken } from "./data";
import { safeUri, units } from "./domain";
import { QueryState } from "./ui";

export type ReceiptRole = "client" | "freelancer";
const DAY = 86_400n;
const date = (seconds: bigint) =>
  new Date(Number(seconds) * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

/**
 * A receipt for one side of a stream. It carries the agreement's own words and the money figures,
 * and nothing that identifies a person: no wallet addresses, no transaction links, no job ids.
 */
export function Receipt({ id, role }: { id: bigint; role: ReceiptRole }) {
  const r = useRuntime();
  const q = useStream(id);
  const token = useToken(q.data?.stream.token);
  const [copied, setCopied] = useState(false);
  // Older streams keep their agreement at a link. Read its words so the receipt still carries the notes.
  const href = q.data ? safeUri(q.data.stream.termsURI) : undefined;
  const [linked, setLinked] = useState<string | undefined>();
  useEffect(() => {
    if (!href || !/^https:\/\//.test(href)) return;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 6000);
    fetch(href, { signal: ctl.signal, credentials: "omit", referrerPolicy: "no-referrer" })
      .then((res) => (res.ok && /text\/plain/.test(res.headers.get("content-type") ?? "") ? res.text() : ""))
      .then((text) => setLinked(text.trim().slice(0, 2000) || undefined))
      .catch(() => undefined)
      .finally(() => clearTimeout(timer));
    return () => { ctl.abort(); clearTimeout(timer); };
  }, [href]);
  if (!q.data || !token.data)
    return (
      <>
        <h1 tabIndex={-1}>Receipt</h1>
        <QueryState query={q} />
        {q.data && <QueryState query={token} />}
        <a href="#/streams">Back to my streams</a>
      </>
    );
  const { stream: s, streamed, withdrawable, refundable, acceptedAt, timestamp } = q.data;
  const t = token.data;
  const fmt = (v: bigint) => `${units(v, t.decimals, 6)} ${t.symbol}`;
  const client = role === "client";
  const link = safeUri(s.termsURI);
  const agreement = link
    ? (linked ?? "The written agreement is kept at a link and could not be read just now. Open it from the stream page.")
    : s.termsURI;
  const ref = `WEIR-${id.toString()}-${s.termsHash.slice(2, 8).toUpperCase()}`;
  const status =
    s.state === 4
      ? "Closed"
      : s.state === 3 || s.state === 2
        ? "Under review"
        : s.rate === 0n
          ? "Paused"
          : "Active";
  const ruled = s.ruling !== 0 && s.state >= 3;
  const rows: [string, string][] = client
    ? [
        ["Put in, after any refund", fmt(s.balance)],
        ...(s.rate > 0n ? [["Rate", `${fmt(s.rate * DAY)} per day`] as [string, string]] : []),
        ["Earned by the freelancer so far", fmt(streamed)],
        ["Already sent to the freelancer", fmt(s.withdrawn)],
        ["Still yours", fmt(refundable)],
      ]
    : [
        ...(s.rate > 0n ? [["Rate", `${fmt(s.rate * DAY)} per day`] as [string, string]] : []),
        ["Earned so far", fmt(streamed)],
        ["Already withdrawn", fmt(s.withdrawn)],
        ["Ready to withdraw", fmt(withdrawable)],
      ];
  const lines = [
    client ? "Weir. · Payment receipt" : "Weir. · Proof of contract",
    `Reference ${ref}`,
    `Agreement accepted: ${acceptedAt > 0n ? date(acceptedAt) : "not yet"}`,
    `Status: ${status}`,
    "",
    "What was agreed",
    agreement,
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    ...(ruled
      ? [`Reviewers' ruling: ${s.ruling === 1 ? "the work was accepted" : "the work was not accepted"}`]
      : []),
    `Issued ${date(timestamp)}`,
  ].join("\n");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(lines);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: printing still works */
    }
  };
  return (
    <>
      <div className="breadcrumb no-print">
        <a href="#/streams">My streams</a>
        <span aria-hidden="true">/</span>
        <a href={`#/stream/${id.toString()}`}>#{id.toString()}</a>
        <span aria-hidden="true">/</span>
        <span>Receipt</span>
      </div>
      <article className="receipt" aria-labelledby="receipt-title">
        <header>
          <p className="receipt-brand">Weir.</p>
          <h1 id="receipt-title" tabIndex={-1}>
            {client ? "Payment receipt" : "Proof of contract"}
          </h1>
          <p className="receipt-ref">Reference {ref}</p>
        </header>
        <dl className="receipt-facts">
          <div>
            <dt>Agreement accepted</dt>
            <dd>{acceptedAt > 0n ? date(acceptedAt) : "Not accepted yet"}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{status}</dd>
          </div>
          <div>
            <dt>Paid in</dt>
            <dd>{t.symbol}</dd>
          </div>
        </dl>
        <section>
          <h2>What was agreed</h2>
          <p className="receipt-terms">{agreement}</p>
        </section>
        <section>
          <h2>{client ? "The payment" : "What you have earned"}</h2>
          <dl className="receipt-rows">
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
        {ruled && (
          <section>
            <h2>Reviewers’ ruling</h2>
            <p>
              A panel of reviewers read the agreement and ruled that the work was{" "}
              <strong>{s.ruling === 1 ? "accepted" : "not accepted"}</strong>.
            </p>
          </section>
        )}
        {acceptedAt === 0n && (
          <p className="receipt-draft">
            The freelancer has not accepted the agreement yet, so this is not a final record.
          </p>
        )}
        <footer>
          <p>
            Issued {date(timestamp)}. Amounts are read live from the Weir. contract on {r.deployment.network.name ?? "the network"}. This receipt names
            no people and no wallets.
          </p>
        </footer>
      </article>
      <div className="receipt-actions no-print">
        <button className="primary" onClick={() => window.print()}>
          Print or save as PDF
        </button>
        <button onClick={copy}>{copied ? "Copied" : "Copy as text"}</button>
        <a href={`#/stream/${id.toString()}`}>Back to the stream</a>
      </div>
    </>
  );
}
