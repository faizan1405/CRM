import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  /**
   * The complete-backup PDF pipeline uses pdfkit (with fontkit for embedded font subsetting).
   * Both use Node built-ins, so they are resolved at runtime instead of being bundled.
   */
  serverExternalPackages: ["pdfkit", "fontkit"],
  /**
   * The embedded Unicode fonts (Noto Sans) live outside the source tree. They must travel with the
   * serverless trace so the backup reports can embed real glyphs (including the Indian Rupee sign)
   * in every deployment target.
   */
  outputFileTracingIncludes: {
    "/api/backup/jobs": ["./assets/fonts/**"],
    "/api/backup/jobs/[jobId]": ["./assets/fonts/**"],
    "/api/backup/jobs/[jobId]/download": ["./assets/fonts/**"],
    "/api/backup/download": ["./assets/fonts/**"],
    "/api/backup/report": ["./assets/fonts/**"],
  },
};

export default nextConfig;

