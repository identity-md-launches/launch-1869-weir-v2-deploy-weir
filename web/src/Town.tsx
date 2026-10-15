import { useState } from "react";
import { WalletControl } from "./Wallet";
import "./town.css";

export const PLATES = [
  "backdrop",
  "client-house",
  "reviewers-hall",
  "door-building",
  "freelancer-studio",
  "pipe-band",
  "bus",
  "van",
  "truck",
] as const;
const plate = (id: string) => `./assets/plates/${id}.png`;

export function Mark({ size = "100%" }: { size?: string }) {
  // The two-arch mark as the comp and the vehicles carry it: a pixel "m", two arches on three stems.
  const px: [number, number, number][] = [
    [2, 0, 3], [7, 0, 3],
    [1, 1, 1], [5, 1, 2], [10, 1, 1],
    [0, 2, 2], [5, 2, 2], [10, 2, 2],
    [0, 3, 2], [5, 3, 2], [10, 3, 2],
    [0, 4, 2], [5, 4, 2], [10, 4, 2],
    [0, 5, 2], [5, 5, 2], [10, 5, 2],
    [0, 6, 2], [5, 6, 2], [10, 6, 2],
    [0, 7, 2], [5, 7, 2], [10, 7, 2],
  ];
  return (
    <svg
      viewBox="0 0 12 8"
      width={size}
      height={size}
      aria-hidden="true"
      style={{ display: "block", shapeRendering: "crispEdges" }}
    >
      {px.map(([x, y, w], i) => (
        <rect key={i} x={x} y={y} width={w} height={1} fill="currentColor" />
      ))}
    </svg>
  );
}
export function Coin() {
  return (
    <svg viewBox="0 0 8 8" aria-hidden="true">
      <rect x="2" y="0" width="4" height="8" fill="#0b0e18" />
      <rect x="0" y="2" width="8" height="4" fill="#0b0e18" />
      <rect x="1" y="2" width="6" height="4" fill="#f7cc19" />
      <rect x="2" y="1" width="4" height="6" fill="#f7cc19" />
      <rect x="3" y="3" width="2" height="2" fill="#d9a400" />
    </svg>
  );
}
function Arrow() {
  return (
    <svg viewBox="0 0 12 10" aria-hidden="true">
      <rect x="0" y="4" width="8" height="2" fill="#f8f8f8" />
      <rect x="6" y="2" width="2" height="2" fill="#f8f8f8" />
      <rect x="8" y="4" width="2" height="2" fill="#f8f8f8" />
      <rect x="6" y="6" width="2" height="2" fill="#f8f8f8" />
    </svg>
  );
}
const COINS = [22.5, 27.3, 33.5, 40, 46.2, 57.3, 63.8, 70.6, 77.1];
const NAV: [string, string][] = [
  ["/", "Home"],
  ["/create", "Start a stream"],
  ["/streams", "My streams"],
  ["/records", "Records"],
];

export type TownFigures = { streamed: string; symbol: string };
export function Town({
  route = "/",
  platesOnly = false,
  staticShell = false,
  figures,
}: {
  route?: string;
  platesOnly?: boolean;
  /** Render without the wallet runtime (first paint, before the deployment file loads). */
  staticShell?: boolean;
  /** Live figures from stream #1; without them the labels show the comp's example numbers. */
  figures?: TownFigures;
}) {
  const [dot, setDot] = useState(0);
  const f = figures ?? { streamed: "0.35", symbol: "WEIR" };
  const example = figures ? "" : " (example)";
  return (
    <div className="town-wrap-outer">
      <div className="mobile-topbar">
        <a href="#/" className="brand" aria-label="Weir home">
          <Mark size="32px" />
          Weir<span className="brand-period">.</span>
        </a>
        {staticShell ? (
          <button className="wallet-button" type="button" disabled>
            Connect wallet
          </button>
        ) : (
          <WalletControl />
        )}
      </div>
      <nav className="mobile-nav" aria-label="Main navigation">
        {NAV.map(([path, label]) => (
          <a key={path} href={`#${path}`} aria-current={route === path ? "page" : undefined}>
            {label}
          </a>
        ))}
      </nav>
      <div className="town-mobile-copy">
        <h1>Pay as the work flows.</h1>
        <p>
          Money moves per second, only while the work does. Pause any time.
        </p>
      </div>
      <div
        className="town-wrap"
        onScroll={(e) => {
          const el = e.currentTarget;
          const max = el.scrollWidth - el.clientWidth;
          setDot(max > 0 ? Math.round((el.scrollLeft / max) * 2) : 0);
        }}
      >
    <section className="town" aria-label="How Weir works">
      {PLATES.map((id) =>
        id === "pipe-band" ? (
          <div key={id} className="r r-pipe-band">
            <img className="plate soil" src={plate(id)} alt="" decoding="async" />
            <img className="plate pipe" src={plate(id)} alt="" decoding="async" />
          </div>
        ) : (
          <div key={id} className={`r r-${id}`}>
            <img className="plate" src={plate(id)} alt="" decoding="async" />
          </div>
        ),
      )}
      <div className="r r-backdrop pavement-front" aria-hidden="true">
        <img className="plate" src={plate("backdrop")} alt="" decoding="async" />
      </div>
      {!platesOnly && (
        <>
          <div className="r r-topbar" />
          <a className="r r-mark" href="#/" aria-label="Weir home">
            <Mark />
          </a>
          <div className="r r-brand" aria-hidden="true">
            Weir<span className="brand-dot">.</span>
          </div>
          <nav className="r r-nav" aria-label="Main navigation">
            {NAV.map(([path, label]) => (
              <a
                key={path}
                href={`#${path}`}
                aria-current={route === path ? "page" : undefined}
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="r r-connect">
            {staticShell ? (
              <button className="wallet-button" type="button" disabled>
                Connect wallet
              </button>
            ) : (
              <WalletControl />
            )}
          </div>
          <h1 className="r r-headline" tabIndex={-1}>
            Pay as the work flows.
          </h1>
          <p className="r sign r-client-sign">Client</p>
          <p className="r sign r-reviewers-sign">Reviewers</p>
          <p className="r sign r-agree-sign">4 of 5 must agree</p>
          <p className="r stamp r-disputes-stamp">Disputes</p>
          <p className="r sign r-freelancer-sign">Freelancer</p>
          <p className="r sign r-start-sign" aria-hidden="true">
            Start a stream
          </p>
          <a className="r r-door" href="#/create">
            <span className="sr-only">Start a stream</span>
          </a>
          <p className="r label r-deposit-label">deposit</p>
          <p className="r label r-streamed-label" title={`Stream #1 streamed${example}`}>
            streamed
            <br />
            {f.streamed} {f.symbol}
          </p>
          <p className="r label r-stream-label">stream · per second</p>
          <p className="r label r-pause-label">pause</p>
          <div className="r coins" aria-hidden="true">
            {COINS.map((x, i) => (
              <span key={x}>
                <span className="coin" style={{ left: `${x}%` }}>
                  <Coin />
                </span>
                {i !== 4 && (
                  <span className="arrow" style={{ left: `${x + 3.6}%` }}>
                    <Arrow />
                  </span>
                )}
              </span>
            ))}
          </div>
          <p className="r step r-step1-label">No. 1 Agree</p>
          <p className="r step r-step2-label">No. 2 Fund</p>
          <p className="r step r-step3-label">No. 3 Settle</p>
        </>
      )}
    </section>
      </div>
      <div className="town-dots" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span key={i} className={dot === i ? "on" : ""} />
        ))}
      </div>
      <small className="town-mobile-hint">Swipe along the street: client, reviewers, the door, freelancer.</small>
      <div className="town-mobile-cta">
        <a href="#/create" className="button primary">
          Start a stream <span aria-hidden="true">↗</span>
        </a>
      </div>
    </div>
  );
}
