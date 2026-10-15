import { useState } from "react";
import { useAccount } from "wagmi";
import { zeroHash } from "viem";
import { useMyStreamIds } from "./history";
import { useStream, useToken } from "./data";
import { displayJob, safeUri, stateLabel, units } from "./domain";
import { LINKS } from "./config";
import { AddressView, External, Field, Notice, QueryState, Title } from "./ui";
import { ConnectPrompt } from "./Wallet";

export function StreamRow({ id }: { id: bigint }) {
  const q = useStream(id);
  const token = useToken(q.data?.stream.token);
  const s = q.data?.stream;
  return (
    <article className="stream-row">
      <div className="stream-row-head">
        <h3>
          <a href={`#/stream/${id}`}>Stream #{id.toString()}</a>
        </h3>
        {s && <span className={`badge state-${s.state}`}>{stateLabel(s)}</span>}
      </div>
      <QueryState query={q} />
      {s && (
        <>
          <div className="parties">
            <span>
              From <AddressView value={s.client} />
            </span>
            <span>
              To <AddressView value={s.recipient} />
            </span>
          </div>
          {q.data && token.data && (
            <dl className="amount-grid">
              {(["streamed", "withdrawable", "refundable"] as const).map(
                (key) => (
                  <div key={key}>
                    <dt>{key[0].toUpperCase() + key.slice(1)}</dt>
                    <dd>
                      {units(q.data![key], token.data!.decimals)}{" "}
                      <span>{token.data!.symbol}</span>
                    </dd>
                  </div>
                ),
              )}
            </dl>
          )}
          <QueryState query={token} />
          <div className="row-links">
            {safeUri(s.termsURI) ? (
              <External href={safeUri(s.termsURI)!}>Open the agreement</External>
            ) : (
              <span className="terms-inline">{s.termsURI}</span>
            )}
            {s.imdJobId !== zeroHash && (
              <External href={LINKS.job(displayJob(s.imdJobId))}>
                View IMD job
              </External>
            )}
            <a href={`#/stream/${id}`}>Open →</a>
          </div>
        </>
      )}
    </article>
  );
}
export function Streams() {
  const { address } = useAccount();
  const q = useMyStreamIds(address);
  const [role, setRole] = useState<"client" | "recipient">("client");
  const [lookup, setLookup] = useState("");
  const [error, setError] = useState("");
  const ids = q.data?.[role] ?? [];
  return (
    <>
      <Title
        aside={
          <a href="#/create" className="button primary">
            Start a stream ↗
          </a>
        }
      >
        My streams
      </Title>
      <p className="page-description">
        Streams you pay and streams that pay you.
      </p>
      <form
        className="lookup-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (/^[1-9]\d*$/.test(lookup)) {
            setError("");
            location.hash = `/stream/${lookup}`;
          } else setError("Enter a stream number greater than zero.");
        }}
      >
        <Field label="Open a stream by its number">
          <input
            inputMode="numeric"
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
            placeholder="Stream number"
          />
        </Field>
        <button type="submit">Open stream</button>
      </form>
      {error && <Notice error>{error}</Notice>}
      {!address ? (
        <ConnectPrompt />
      ) : (
        <>
          <div className="tabs" aria-label="Stream role">
            <button
              aria-pressed={role === "client"}
              onClick={() => setRole("client")}
            >
              I pay
            </button>
            <button
              aria-pressed={role === "recipient"}
              onClick={() => setRole("recipient")}
            >
              I get paid
            </button>
            <button
              className="refresh-button"
              disabled={q.isFetching}
              onClick={() => q.refetch()}
            >
              {q.isFetching ? "Refreshing…" : "Refresh"}
            </button>
          </div>
          <QueryState query={q} />
          {ids.map((id) => (
            <StreamRow key={id.toString()} id={id} />
          ))}
          {!q.isPending && !q.isError && ids.length === 0 && (
            <div className="empty">
              <h2>Nothing here yet</h2>
              <p>
                {role === "client"
                  ? "This wallet has not started a stream yet."
                  : "No stream pays this wallet yet."}
              </p>
              <a href="#/create">Start a stream →</a>
            </div>
          )}
          {q.data && (
            <p className="muted history-range">
              Checked all {q.data.count.toString()} streams on the contract.
            </p>
          )}
        </>
      )}
    </>
  );
}
