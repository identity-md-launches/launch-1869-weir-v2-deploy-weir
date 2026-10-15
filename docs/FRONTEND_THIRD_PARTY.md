# Frontend dependencies and references

Application changes use the repository’s MIT license. npm versions and integrity hashes are pinned by `web/package-lock.json`; dependencies and caches are excluded from the submission. `web/scripts/licenses.mjs` extracts notices for packages that actually contribute modules to the production chunks and emits `dist/third-party-licenses.txt`, including the Apache 2.0 text for the Coinbase SDK. Preact’s nested `preact-hooks` package uses the Preact license included in that notice file.

Wallet marks for MetaMask, Rabby and Phantom come from RainbowKit’s `packages/rainbowkit/src/wallets/walletConnectors/` assets ([source](https://github.com/rainbow-me/rainbowkit/tree/main/packages/rainbowkit/src/wallets/walletConnectors)). Its MIT license is preserved at `web/assets/wallet-icons-LICENSE.txt` and in the export. The Coinbase mark follows the supplied wallet-connectors reference. Weir’s favicon, flow lines, share artwork and generic browser mark were created as local SVG assets.

The assignment supplied pinned Better Interface, design-critic, wallet-connectors, oracle-consumer, Ethereum UX/security/testing and Pashov reference material. They informed the frontend’s design, integration and bounded review; they did not authorize changes to deployed Solidity. No new contract audit or independent agent review is claimed.

Implementation references consulted where the supplied material needed clarification:

- [Wagmi createConfig](https://wagmi.sh/react/api/createConfig) and [wallet connection](https://wagmi.sh/react/guides/connect-wallet), with installed wagmi 3 API definitions checked locally.
- [Rabby’s universal-link handler](https://github.com/RabbyHub/rabby-mobile/blob/develop/apps/mobile/src/hooks/universalLink.ts) and [link constants](https://github.com/RabbyHub/rabby-mobile/blob/develop/apps/mobile/src/constant/universalLink.ts): the active form is `https://go.rabby.io/mobile/?_cmd=open-dapp&dapp=<encoded-page-url>`.
- [IdentityMD’s public documentation](https://imd.fun/docs/#get-intake-chainid-transactionhash): Intake receipts are resolved via `GET /intake/:chainId/:transactionHash` and `admission.result`, then linked to the actual oracle job on the explorer. These IDs are not interchangeable with the oracle request UUID.
- The attested launch token’s [explorer page](https://explorer.imd.fun/token/0x58b82fa656ecf47a0dca5be6bad06b92e22f7dbe) provides the requested Buy WEIR destination.

External services were consulted read-only. No account, key, relay or hosted backend was provisioned.
