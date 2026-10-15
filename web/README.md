# Weir frontend

A static React/TypeScript interface for the deployed Weir stream engine on Robinhood Chain. The production export is `../dist/`; it runs from an IPFS gateway subpath or ordinary static hosting without server rewrites. Routes use `#/…` and Vite uses `base: './'`.

Weir is **not audited**. The swarm’s review panel is not an audit. The IdentityMD oracle provides a panel judgement, not a court of law. No contract was changed, deployed or funded by this frontend assignment.

## Install, run and rebuild

Use Node 22.12+ (Node 24 was used for validation) and npm. From this directory:

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run check:export
npm run preview
```

`npm run dev` runs Vite against the prepared public assets. `npm run build` first refreshes those generated assets, builds `../dist/`, and then writes its final deployment manifest. Never hand-edit generated addresses, ABIs or the export. The publisher hosts the committed export without rebuilding it.

`node_modules` and caches are not delivered. This project needs no vendored registry, relay, API key, WalletConnect project ID, backend signer or private RPC endpoint. On a restricted worker, point npm’s cache at a permitted temporary directory, for example `npm ci --cache /tmp/weir-npm-cache`.

## Configuration and ABI provenance

- `deployment/handoff.json` and `deployment/network.json` are the preserved public build inputs from the supplied handoff. They are not a second runtime configuration.
- `scripts/export.mjs` reads `docs/abi/<Contract>.json` **from deployed source commit `a01e3ae534fbe2789742d5512ded7a99b2c83f85` using Git**, checks the working ABI exports too, and verifies canonical Keccak-256 against each attested `abiHash`. Keep that commit available when cloning/building; a shallow clone without it must fetch it first.
- Canonicalization sorts object keys recursively and preserves array order. The ABI hash is Keccak-256 of the UTF-8 compact JSON, without the `0x` prefix. `LaunchToken` and `Weir` both match the handoff.
- `src/config.ts` fetches the page-relative **`imd-deployment.json`** at startup, fetches its referenced ABI files, verifies their canonical hashes again, and constructs viem/wagmi from that configuration. It has no separate contract address, chain ID or public RPC map.
- The manifest contains the exact deployed contract set, launch/source/attestation identifiers, unchanged pool key, and unchanged network and wallet-add-chain blocks. Every other exported file has a lowercase SHA-256 inventory entry; the manifest excludes itself.
- `history-start.json` contains only the deployment block checkpoint generated from the handoff. It avoids scanning pre-deployment chain history; it introduces no address or network override.
- `public/abi/`, `public/history-start.json` and `public/imd-deployment.json` are generated build staging files for Vite’s development server. The production manifest is finalized after Vite builds. Runtime always loads the manifest served beside that page.

Writes remain disabled until the RPC reports the configured chain, both deployed contracts have code, Weir’s token getter matches the attested launch token, the wallet uses the correct chain, and its signing client is ready. Public reads use the two handoff RPC endpoints in order, with batching, bounded retries and fallback. Most contract state refreshes every five seconds; each stream’s accounting is read at one block.

## Pages and actions

| Route | Controls and reads |
| --- | --- |
| `#/` | Three-sentence explanation, hold rule, tier table, explorer launch-pool link, connected WEIR balance/eligibility/tier, court balance, exact IMD approval then sponsorship |
| `#/create` | Recipient; on-chain token symbol/decimals; rate per second and daily calculator; initial deposit; terms URI; keccak256 of pasted UTF-8 text or exact file bytes; optional job UUID/bytes32; review, approve, create |
| `#/streams` | Client/recipient lists from indexed `StreamCreated` events, status and live streamed/withdrawable/refundable amounts, terms/job links, direct ID lookup |
| `#/stream/<id>` | Deposit, pause, restart, adjust, partial/max refund, void, recipient accept and partial/max withdraw, deferred-payout claim, dispute, enforce, expire, both parties’ records, event activity |
| `#/records` | Any valid address’s five record counters; no wallet required for lookup |

History loads 50,000-block windows, requests logs in 10,000-block chunks, and labels the exact scanned range. “Load older” continues to the deployment checkpoint. A recent empty window is never presented as proof that the wallet has no older streams. Stream activity is loaded on demand.

All token math uses bigint and on-chain decimals. Excess precision is rejected instead of silently rounded. Creation rate/deposit fit uint128. The per-day helper deliberately rounds down to a whole smallest unit per second and shows the resulting daily rate. File hashing is local, capped at 16 MiB; it does not upload or publish terms. URI links accept only HTTP, HTTPS and IPFS. User-supplied terms and notes render as text.

Every transaction is simulated before signing. Each action has its own immediate lock, wallet/confirmation/refresh phases, persistent error and explorer receipt link. Approval state is reread after the receipt before the next action becomes available. Approvals are exact amounts; a nonzero short allowance is reset explicitly before a replacement approval. No approval is sent to Intake or a router: application spending is approved to Weir.

The Buy WEIR control opens the explorer’s token/pool page, as specified by this assignment. This app does not implement an internal swap or quote, so it introduces no separate Uniswap routing or Permit2 configuration.

## Dispute details

The dialog reads `expectedBody(id, caller, note)`, `bondFor`, `oraclePrice` and `courtFund` at the same block. It displays the exact preview question, raw body, quoted bond and fee payer. The block number in the question changes at execution; `QuestionCommitted` is the record of the actual paid question.

The UI uses the bounded three-argument `dispute` overload with the displayed bond as `maxBond`. It separately stages the stream-token bond and caller-paid IMD fee. When the stream token is IMD it combines both obligations into one allowance. An eligible zero-bond caller does not approve a zero amount. A fresh preflight stops if the oracle price or a fund-paid fee payer changed since review.

Transaction ordering can still consume the fund after simulation; an existing IMD allowance can then permit the contract’s caller-paid fee. The dialog explains this. The oracle fee is spent even on refusal/disagreement. Expiry uses the chain timestamp and is enabled only **strictly after** the immutable timeout; no local clock unlocks it. Recipient withdrawal remains available in Disputed, Ruled and Closed states.

`OracleLink.tsx` finds the corresponding `Disputed` transaction from the on-chain timestamp and consults the public IdentityMD intake-status API to resolve its oracle job. The explorer link initially searches this stream’s question and becomes a direct job link after indexing. Failure of that optional lookup cannot block contract controls. It polls unresolved admission status every 15 seconds. No secret is used.

`submitAttestation` is deliberately not advertised as a recovery action: the pinned implementation’s ABI integration notes explain that the current oracle UUID cannot satisfy that function’s receipt-ID equality. Intake-only callbacks are not user actions. Timeout remains the available exit for a missed callback. There is no owner setup panel because the deployed application has no owner or setters.

## Wallets

The header’s single wallet picker uses wagmi EIP-6963 discovery and the Coinbase Wallet SDK. Named extensions appear separately; the generic connector is labeled “Browser wallet.” Phones without an injected wallet get MetaMask, Coinbase, Rabby and Phantom app links plus Coinbase Smart Wallet. Wrong-chain wallets get `wallet_switchEthereumChain`; an unknown-chain error triggers the handoff’s exact `wallet_addEthereumChain` object and a second switch. No relay/project ID is involved.

Native wallet-app and passkey completion on chain 4663 were not physically tested. Coinbase’s supported Smart Wallet networks are controlled by Coinbase; an unsupported chain produces a visible connection/switch error, and browser-wallet options remain available.

## Validation

```sh
# From web/, after npm run build:
PLAYWRIGHT_BROWSERS_PATH=/tmp/weir-browsers npx playwright install chromium --only-shell
PLAYWRIGHT_BROWSERS_PATH=/tmp/weir-browsers npm run test:browser
npm run check:chain
```

The browser suite owns and closes its local HTTP server and Chromium instance. It tests the production export at `/preview/` with mocked wallet and RPC responses; no real transaction is broadcast. `check:chain` is read-only and writes public validation evidence. The pinned design probe was also run against the final export. Results, reviewed domains, fixes, screenshots and limits are in [the validation report](../docs/FRONTEND_VALIDATION.md).

The implemented design system is documented in [docs/DESIGN.md](../docs/DESIGN.md). The brief also requested a root `DESIGN.md`, but its overriding path budget prohibits that file; the complete document is delivered under the allowed `docs/` scope.

## Licensing and publication

Application source follows the repository’s MIT license. The build emits `third-party-licenses.txt` for bundled dependencies and wallet marks. Icon and API provenance is in [third-party notes](../docs/FRONTEND_THIRD_PARTY.md).

Publishing, IPFS pinning, site naming and post-publication HTTP/RPC checks are performed by the publisher, not this worker. No published URL or CID is claimed. Open Graph uses the local `share.png`; an absolute social URL can be set once hosting is assigned, followed by a rebuild and manifest regeneration.
