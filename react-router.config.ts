import type { Config } from "@react-router/dev/config";

export default {
  ssr: true,
  routeDiscovery: { mode: "initial" },
  allowedActionOrigins: ["*.myshopify.com"],
} satisfies Config;