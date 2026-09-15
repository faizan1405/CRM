export const META_CONFIG = {
  get appSecret(): string | undefined {
    return process.env.META_APP_SECRET;
  },
  get verifyToken(): string | undefined {
    return process.env.META_VERIFY_TOKEN;
  },
  get pageAccessToken(): string | undefined {
    return process.env.META_PAGE_ACCESS_TOKEN;
  },
  get graphApiVersion(): string {
    return process.env.META_GRAPH_API_VERSION || "v21.0";
  },
  isConfigured(): boolean {
    return Boolean(
      this.pageAccessToken &&
      this.appSecret &&
      this.verifyToken
    );
  },
  getMissingConfig(): string[] {
    const missing: string[] = [];
    if (!this.pageAccessToken) missing.push("META_PAGE_ACCESS_TOKEN");
    if (!this.appSecret) missing.push("META_APP_SECRET");
    if (!this.verifyToken) missing.push("META_VERIFY_TOKEN");
    return missing;
  },
} as const;
