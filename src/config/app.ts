export const appConfig = {
  name: "WAPI",
  tagline: "WhatsApp-first SaaS for modern business messaging",
  description:
    "Run campaigns, manage replies, and grow revenue on WhatsApp — all from a single, calm dashboard.",
  url: "https://wapi.getouch.co",
  ogImage: "/og.png",
  support: {
    email: "support@getouch.co",
  },
  social: {
    x: "https://x.com/",
  },
} as const;

export type AppConfig = typeof appConfig;
