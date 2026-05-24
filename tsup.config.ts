import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  // `ws` is an optional dependency loaded via dynamic import at runtime in
  // Node; keep it external so bundlers don't try to inline it and browsers
  // can tree-shake it away (they use the global WebSocket instead).
  external: ["ws"],
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  },
});
