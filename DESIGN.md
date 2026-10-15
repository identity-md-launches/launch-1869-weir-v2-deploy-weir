# Design System: Weir.

This documents the front end as implemented in `web/` at SwarmStream/weir commit `bf5fa02392c5c0fd1f7bb4b29ade63396025414b`, which this repository imports unchanged and publishes from `dist/`. Every value below is read from `web/src/style.css`, `web/src/town.css`, `web/index.html` and the React components in `web/src/`. Nothing here is a proposal; where the source carries older, unreconciled rules, that is stated as drift rather than hidden. Rendered observations come from the checks recorded in `docs/FRONTEND_VALIDATION.md`.

## Overview

Weir. is a dapp for freelancers and their clients on Robinhood Chain: a client funds a per-second token stream, the recipient withdraws as the work flows, and either side can pause the stream and ask the IdentityMD reviewer panel to decide a dispute. The product name is always written **"Weir."** with the period (`web/src/App.tsx:33`, `web/index.html:7`).

Visual character: an 8-bit cutaway town on the home page (client's house, reviewers' hall, a lit door, the freelancer's studio, a pipe of coins under the street), drawn from nine pixel-art plates in `web/public/assets/plates/`. Every object wears a sign or a small label, so the scene explains the product without a feature grid. Product pages (create, streams, stream, records, receipt) are plain paper: pixel lettering only at display size, a clear bold humanist face for controls and headings, a smooth sans for reading, hyperlegible tabular numerals for money. Yellow marks the thing to press; brick marks the current page and keyboard focus. Edges are drawn in ink, never implied by shadow.

System-wide rules versus one page's arrangement: the town composition (`web/src/Town.tsx`, `web/src/town.css`) belongs to the home page only. The token, type, spacing, button, field, notice and dialog rules in `web/src/style.css` apply to every page.

## Colors

Canonical notation is hex in CSS custom properties. Semantic tokens live in `:root` of `web/src/style.css` (lines 17 to 41); the town's palette is in `:root` of `web/src/town.css` (lines 3 to 15).

| Token | Value | Job |
| --- | --- | --- |
| `--color-page` / `--px-paper` | `#f8f8f8` | Page and town background |
| `--color-surface` | `#ffffff` | Panels, inputs, secondary buttons, receipts |
| `--color-subtle` | `#eef3f7` | Disabled button fill, receipt terms block |
| `--color-text` / `--px-ink` | `#0a0b11` | All text, every border, pressed tabs, active dots |
| `--color-muted` | `#4a5160` | Helper text, footer, labels in definition lists |
| `--color-border` | `#d7dce3` | Hairline rules, idle dots, the light bevel on white buttons |
| `--color-input-border` | `#0a0b11` | Input and button borders |
| `--color-highlight` | `#e6f4fd` | Notices, the eligibility panel, secondary button hover |
| `--color-focus` / `--px-brick` | `#b8402a` | Focus outline, current-page underline, the brand period, the pause valve |
| `--px-yellow` | `#f7c751` | Primary buttons, Connect wallet, selected token and period options, coins |
| `--px-sky` | `#56c7f8` | Town sky |
| `--px-grass` | `#4f8f3a` | Town grass |
| `--px-soil` | `#4c2c24` | Ground under the pipe |
| `--px-sign` | `#f8f7ee` | Sign plates in the town |
| `--px-wood` | `#f6cb87` | Money signs (the "Start a stream" door sign) |
| `--color-error` / `--color-error-bg` | `--red-700 #a02f22` / `--red-50 #fff1eb` | Error text and tint; always paired with words |
| `--color-pending` / `--color-pending-bg` | `--blue-700 #3e487b` / `--blue-50 #edf0f9` | Pending transaction text and tint |
| `--color-accent`, `-hover`, `-pressed`, `--color-on-accent` | `#0a0b11`, `#26282f`, `#000000`, `#ffffff` | Ink accent used by pressed tabs and inverted states |

Literal colors used by the bevels: yellow buttons shade with `inset -2px -2px 0 #c98f00` and light with `inset 2px 2px 0 #ffe08a` (`style.css:137`, `town.css` `.px-button`); white buttons use `--color-border` and `#ffffff`. Yellow hover is `#ffd978`. The "DISPUTES" stamp in the town is `#38414a` with a `#d2d7da` pixel shadow (`town.css` `.r-disputes-stamp`).

Primitive ramps `--stone-*` and `--green-*` (`style.css:2-13`) are declared from the superseded theme. Components reference the semantic tokens above; the green primitives remain only in `::selection` and the hidden `.flow-art`.

Rules:

- **One yellow.** Yellow is only something you can press or a coin. Selected state in the token picker and the period toggle is a yellow fill (`style.css` `.token-option.selected`, `.period-toggle button.selected`).
- **Ink borders.** Edges are 2px ink on pages (buttons, form surface, terms box, receipt) and `0.13cqw` to `0.26cqw` in the town.
- **Status is never color alone.** Error and pending tints always carry a sentence (`Notice` in `web/src/ui.tsx:73`, `TxFeedback` at `ui.tsx:152`).

Measured contrast: the design probe found all measured text at 4.5:1 or better (3:1 for large text) on the home page at 320, 390 and 1440; 21 text boxes drawn over the plates were not measurable by it. No other ratio was measured.

## Typography

All faces are self-hosted `woff2` files in `web/public/fonts/`, declared with `@font-face` in `web/index.html` and preloaded for the two faces on the first screen. No font host is contacted.

| Role | Family and fallbacks | Weights | Where |
| --- | --- | --- | --- |
| Pixel display (`--font-pixel`) | "Press Start 2P", "Pixelify Sans", monospace | 400 only (Pixelify Sans variable 400 to 700 is the fallback) | Page `h1` (2.1rem, `style.css:1379`), the town headline (2.6cqw), the building signs, the brand, the receipt brand line |
| Control and heading (`--font-numeric`) | "Atkinson Hyperlegible", "Alef", system-ui, sans-serif | 400, 700 | Buttons (700, 0.95rem), `h2` (700, 1.35rem), `h3` (700, 1.1rem), nav links, badges, tabs, town labels, amounts with `tabular-nums` |
| Body (`--font-body`) | "Alef", "Avenir Next", system-ui, sans-serif | 400, 700 | Paragraphs (1rem, line-height 1.55, `max-width: 72ch`, `text-wrap: pretty`), helpers, tables |
| Figure signs | "Jersey 25", then `--font-numeric` | 400 | Only the two money figures in the town (`town.css:154`): "deposit" and "streamed 0.35 WEIR" |
| Silkscreen | declared in `index.html`, weights 400 and 700 | | No rule in `style.css` or `town.css` references it; the files are still served |

Type tokens (`style.css:42-47`): `--text-small 0.875rem`, `--text-body 1rem`, `--text-section 1.25rem`, `--text-title 1.5rem`, `--text-large 2rem`, `--text-display 3rem`. `strong` is weight 500 (`style.css:208`), which the probe records as a third weight.

Hierarchy:

- `h1`: pixel face, 2.1rem, line-height 1.25, letter-spacing 0, `text-wrap: balance`. On phones the home headline is 2rem with line-height 1.1 (`town.css` `.town-mobile-copy h1`).
- `h2` 1.35rem and `h3` 1.1rem in Atkinson 700; headings descend in size with level.
- Controls: Atkinson 700 at 0.95rem; mobile nav links 0.9rem; the phone "Start a stream" button 1rem.
- Town type scales with the frame in `cqw`: headline 2.6cqw, signs 1.3 to 1.6cqw uppercase, labels 0.95 to 1.4cqw, nav 1.1cqw, buttons 1.05cqw. The pixel face is never set below display size on product pages; small town lettering uses Atkinson.
- Letter-spacing: 0 everywhere except the town's "DISPUTES" stamp (0.1em) and the Jersey figures (0.02em).

Measured by the design probe on the home page: 8 recurring sizes at 390 and 9 at 1440 (the probe's bar is 6), four families and three weights. These are the approved design's choices and were left as shipped.

## Layout

Spacing scale (`style.css:48-55`): `--space-1 4px`, `--space-2 8px`, `--space-3 12px`, `--space-4 16px`, `--space-6 24px`, `--space-8 32px`, `--space-12 48px`, `--space-16 64px`.

Content width: `.site-header`, `.page` and `.site-footer` share `width: min(1120px, calc(100% - 64px))` (`style.css:248-251`), narrowing to `calc(100% - 32px)` at 640px and below. Section groups are separated by 1px `--color-border` rules; two-column grids (`.home-grid`, `.create-grid`, `.controls-grid`, `.two-columns`) and `.three-columns` collapse to one column at 640px.

Breakpoints, all from the content:

- **900px**: the town stops being a full composition. Above it, `.town-wrap` keeps `aspect-ratio: 1536 / 940`; the town itself is a 1536×1024 frame (`aspect-ratio`, `container-type: inline-size`) where every element is positioned in percentages measured from the approved comp (`town.css`, "measured boxes"). At or below 900px the town's own chrome and copy hide; a pixel top bar, a horizontally scrolling pixel nav, the headline and body copy as text, then the scene as a **1100px-wide strip 513px tall** that pans sideways inside its own frame (`overflow-x: auto`, `scroll-snap-type: x proximity`), three 10px square dots, a hint line, and a full-width yellow "Start a stream" button. The page itself never scrolls horizontally; this was checked at 320, 360, 390 and 768.
- **640px**: single column, 16px page gutters, header 80px tall, wallet button text 0.875rem, dialogs become bottom sheets (`inset: auto 0 0`, `border-radius: 20px 20px 0 0`, safe-area padding).
- **560px**: receipt facts stack (`style.css:1399`).

Wallet errors reserve a row above the navigation instead of covering it (`style.css:1113-1140`). Logical properties (`padding-inline-start`, `margin-inline-start`) are used in the page system; the town uses physical percentages because it is a fixed picture.

## Elevation & Depth

Flat. Depth is a pixel bevel, not a shadow: 2px ink border, `inset -2px -2px` shade and `inset 2px 2px` light (`style.css:88-108`). Pressing a button moves it 1px down and right and flips the bevel (`style.css:113-118`). The town layers plates by `z-index` and clips the pavement front with `clip-path`.

The one exception is the dialog: `box-shadow: 0 24px 80px #18251f30` over a `#17251fc0` backdrop (`style.css:950-953`). This is drift from the superseded theme, not a rule to copy.

## Shapes

Square corners for everything the pixel world has reached: buttons (`border-radius: 0`), the form surface, the terms box, the receipt, the town's signs and the phone's dots. Pointer lines are 1px ink rules rotated 18° to 35°. Pixel SVGs (the mark, coins, arrows) are rect-only with `shape-rendering: crispEdges`.

Rounded corners that remain from the older swarm theme: inputs 7px (`style.css:532`), `.notice` 8px (`style.css:614`), `.eligibility` 12px (`style.css:362`), `.dialog` 16px (`style.css:943`) and other 6 to 20px radii on badges, metrics and list surfaces. They are documented so a new page matches what ships; squaring them is a design decision for the owner, not for this import.

## Components

| Component | Source | Use and states |
| --- | --- | --- |
| Button | `style.css` `button, .button`; `.primary`; `.text-button`; `:disabled` | Square, min-height 44px, Atkinson 700. Primary is yellow with the yellow bevel; secondary is white with the grey bevel and highlight hover; text button is underlined with no border; disabled is `--color-subtle` fill with muted text. 120ms color transition and `scale(0.96)` on press only under `prefers-reduced-motion: no-preference`. |
| TxButton and TxFeedback | `web/src/ui.tsx:166`, `:152` | A button whose label gains " · <phase>" while pending (`aria-busy`), followed by a persistent status line with the explorer receipt link or the error and its recovery. |
| ApprovalAction and Action | `web/src/actions.tsx:15`, `:137` | Two-step list "1 Approve TOKEN / 2 <verb>" (`.steps`, `.current`, `.done`), exact-amount approval, then the contract call. Writes stay disabled until the runtime gate is ready (correct chain, deployed code, wallet client). |
| Field | `web/src/ui.tsx:114`; `.field`, `.field small`, `.field-error` | Visible label above, muted hint below, error text associated to the input with `aria-invalid`; the first invalid field is focused on submit. |
| Notice and QueryState | `web/src/ui.tsx:73`, `:89` | Highlight-tinted paragraph (`.notice`); `error` variant uses the red pair. QueryState renders loading, error and a "Try again" button for a query. |
| Dialog | `web/src/ui.tsx:205`; `.dialog`, `.dialog-head` | Native `<dialog>` with explicit first/last Tab cycling, Escape to close, focus restored to the opener, a "Close dialog" button. Bottom sheet below 640px. Used by the wallet sheet, confirmations and the dispute flow. |
| Wallet control | `web/src/Wallet.tsx:75`; `.wallet-button`, `.wallet-error` | One "Connect wallet" control. Desktop: EIP-6963 wallets by name and icon, then Coinbase Wallet. Phone without an injected wallet: "Open in MetaMask / Coinbase Wallet / Rabby / Phantom" links, then Coinbase Smart Wallet. Connected: short address and "Disconnect". Wrong chain: "Switch to Robinhood Chain" with the add-chain fallback. |
| Token picker and period toggle | `web/src/Create.tsx:375-440`; `.token-picker`, `.token-option`, `.period-toggle` | Square option buttons in a 120px auto-fit grid; the selected option is yellow; "Another token" reveals an address field. Per day / per week toggle shares the same selected style. |
| Tabs | `web/src/Streams.tsx:114`; `.tabs button[aria-pressed]` | "I pay" / "I get paid" role switch; the pressed tab inverts to ink. |
| Badge and stream metrics | `.badge` (`style.css:767`), `.stream-metrics` (`:864`) | Status word (Active, Paused, Disputed, Ruled, Closed) and the live numerals in Atkinson `tabular-nums`. |
| Town | `web/src/Town.tsx:74`, `web/src/town.css` | The home composition: plates, signs, labels, the coin pipe (`.coins` steps 8 frames over 4s, only under `prefers-reduced-motion: no-preference`), the door that is the "Start a stream" link, and the phone strip with dots and a hint. |
| Receipt | `web/src/Receipt.tsx`; `.receipt*` | A printable white paper page with the brand line, facts grid, rows and the terms block; `@media print` rules at the end of `style.css`. |
| Footer | `web/src/App.tsx:130-160`; `.site-footer` | Brand, the two disclosure lines, and a "Deployment & network" details block listing the chain and the contract addresses read from `imd-deployment.json`. |

## Do's and Don'ts

Do:

- Start a new page from `App.tsx`'s hash router: add the route, render `<main id="main" className="page">` with one pixel `h1`, Atkinson `h2` sections separated by 1px rules, and `Field`, `Notice`, `TxButton` or `ApprovalAction` from `ui.tsx` and `actions.tsx`.
- Use the semantic tokens; add a token for a new role rather than borrowing `--color-border` for text or `--px-yellow` for decoration.
- Set every amount in `--font-numeric` with `tabular-nums`; keep the pixel face for `h1` and the town only.
- Keep the one yellow on the single primary action of a view.
- Say reviewers, deposit, terms, per day, settle, paused, closed, as the existing copy does.

Don't:

- Add drop shadows, blur, gradients or anti-aliased plate scaling (`image-rendering: pixelated` is deliberate).
- Set the pixel face under about 24px; its 5/S and C/O collapse.
- Add motion beyond the coin pipe and the 120ms button transitions, and never outside `prefers-reduced-motion: no-preference`.
- Add a font, a font host, an external script or a tracker: the site serves everything from its own origin.
- Write oracle, hash, URI, attestation, bps or tier outside a details disclosure.

Recipe for one more page: copy `web/src/Records.tsx` (a form, a lookup, a definition list), register its route in `App.tsx` next to `/records`, add the nav entry to the three nav arrays (`App.tsx:95-97`, `Town.tsx`, the mobile nav) and build with `npm run build` in `web/`. The published `dist/` for this job is the upstream export and is not rebuilt here.
