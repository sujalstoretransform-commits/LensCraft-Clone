import type { Config } from "@react-router/dev/config";
import { vercelPreset } from "@vercel/react-router/vite";

export default {
  ssr: true,
  routeDiscovery: { mode: "initial" },
  allowedActionOrigins: ["*.myshopify.com", "**"],
  presets: [vercelPreset()],
} satisfies Config;
