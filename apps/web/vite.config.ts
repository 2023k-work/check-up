import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    base: normalizeBasePath(env.VITE_BASE_PATH),
    resolve: {
      alias: {
        "@checkup/parser": fileURLToPath(new URL("../../src/index.ts", import.meta.url)),
        "@checkup/renderer": fileURLToPath(
          new URL("../../packages/renderer/src/index.ts", import.meta.url),
        ),
      },
    },
  };
});

function normalizeBasePath(value: string | undefined): string {
  if (value === undefined || value.trim() === "" || value === "/") {
    return "/";
  }

  return `/${value.replace(/^\/+|\/+$/g, "")}/`;
}
