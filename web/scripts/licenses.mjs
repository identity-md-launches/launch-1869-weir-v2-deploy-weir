import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export function licenseNotices() {
  return {
    name: "runtime-license-notices",
    async generateBundle(_options, bundle) {
      const packages = new Map();
      for (const output of Object.values(bundle)) {
        if (output.type !== "chunk") continue;
        for (const id of Object.keys(output.modules)) {
          if (!id.includes("/node_modules/")) continue;
          let dir = dirname(id.split("?")[0]);
          while (dir.includes("/node_modules/")) {
            try {
              const pkg = JSON.parse(
                await readFile(resolve(dir, "package.json"), "utf8"),
              );
              if (!pkg.name) {
                dir = dirname(dir);
                continue;
              }
              if (!packages.has(`${pkg.name}@${pkg.version}`)) {
                const files = (await readdir(dir)).filter((f) =>
                  /^(licen[cs]e|copying|notice)(\.|$)/i.test(f),
                );
                const licenses = await Promise.all(
                  files.map(
                    async (f) =>
                      `${f}\n${await readFile(resolve(dir, f), "utf8")}`,
                  ),
                );
                packages.set(
                  `${pkg.name}@${pkg.version}`,
                  `${pkg.name}@${pkg.version} (${pkg.license ?? "See upstream"})\n${licenses.join("\n\n") || "License information: " + (pkg.repository?.url ?? pkg.homepage ?? pkg.name)}`,
                );
              }
              break;
            } catch {
              dir = dirname(dir);
            }
          }
        }
      }
      const walletLicense = await readFile(
        new URL("../assets/wallet-icons-LICENSE.txt", import.meta.url),
        "utf8",
      );
      const apacheLicense = await readFile(
        new URL("../assets/Apache-2.0.txt", import.meta.url),
        "utf8",
      );
      this.emitFile({
        type: "asset",
        fileName: "third-party-licenses.txt",
        source:
          [...packages.values()].sort().join("\n\n" + "=".repeat(72) + "\n\n") +
          "\n\nRainbowKit wallet icon assets\n" +
          walletLicense +
          "\n\nApache License 2.0 (Coinbase Wallet SDK)\n" +
          apacheLicense,
      });
    },
  };
}
