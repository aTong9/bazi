import { fileURLToPath, URL } from "node:url";

import vue from "@vitejs/plugin-vue";
import { defineConfig, type Plugin } from "vite";

const virtualCryptoId = "\0bazi-browser-crypto";
const virtualFsId = "\0bazi-browser-fs";
const virtualUrlId = "\0bazi-browser-url";
const contractsPathFragment = "/packages/contracts/src/";

export default defineConfig({
  base: process.env.VITE_PAGES_BUILD === "true" ? "/bazi/" : "/",
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [browserNodeRuntimeShims(), vue()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/health": "http://127.0.0.1:3000",
      "/v1": "http://127.0.0.1:3000"
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    assetsInlineLimit: 64 * 1024,
  }
});

function browserNodeRuntimeShims(): Plugin {
  return {
    name: "bazi-browser-node-runtime-shims",
    enforce: "pre",
    resolveId(source, importer) {
      if (source === "node:crypto" && importer?.endsWith("/packages/application/src/analyze-m0.ts")) return virtualCryptoId;
      if (source === "node:fs" && importer?.includes(contractsPathFragment)) return virtualFsId;
      if (source === "node:url" && importer?.includes(contractsPathFragment)) return virtualUrlId;
      return null;
    },
    load(id) {
      if (id === virtualCryptoId) return browserCryptoModule;
      if (id === virtualFsId) return browserFsModule;
      if (id === virtualUrlId) return browserUrlModule;
      return null;
    },
  };
}

const browserCryptoModule = String.raw`
export function randomUUID() {
  const browserCrypto = globalThis.crypto;
  if (!browserCrypto) throw new Error("Web Crypto is required by the browser analysis runtime");
  if (typeof browserCrypto.randomUUID === "function") return browserCrypto.randomUUID();
  const bytes = browserCrypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const value = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return [value.slice(0, 8), value.slice(8, 12), value.slice(12, 16), value.slice(16, 20), value.slice(20)].join("-");
}
`;

const browserUrlModule = String.raw`
export function fileURLToPath(value) {
  return typeof value === "string" ? value : value.href;
}
`;

const browserFsModule = String.raw`
const decoder = new TextDecoder();

export function readFileSync(input, encoding) {
  const href = typeof input === "string" ? input : input.href;
  if (!href.startsWith("data:")) {
    throw new Error("Browser contract schemas must be bundled as inline data URLs");
  }
  const comma = href.indexOf(",");
  if (comma < 0) throw new Error("Invalid inline contract schema URL");
  const metadata = href.slice(5, comma);
  const payload = href.slice(comma + 1);
  let bytes;
  if (metadata.split(";").includes("base64")) {
    const binary = atob(payload);
    bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } else {
    bytes = new TextEncoder().encode(decodeURIComponent(payload));
  }
  return encoding ? decoder.decode(bytes) : bytes;
}
`;
