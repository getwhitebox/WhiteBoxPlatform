import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components is intentionally OFF: every page shows logged-in,
  // company-specific data, so pages are always rendered fresh per request.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
