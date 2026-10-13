function readEnvFileContents(): string[] {
  if (typeof window !== "undefined") return [];
  try {
    // Dynamic require prevents Webpack from attempting to bundle Node's fs in client builds
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = eval("require")("fs");
    const contents: string[] = [];
    const envFiles = [".env", ".env.local"];
    for (const file of envFiles) {
      if (fs.existsSync(file)) {
        contents.push(fs.readFileSync(file, "utf8"));
      }
    }
    return contents;
  } catch {
    return [];
  }
}

/**
 * Fail-closed test database isolation guard.
 *
 * Verifies that the target database in test mode is a known, isolated test instance
 * before any fixture writes, reads, or deletions can occur.
 *
 * Strictly adheres to security rules: NEVER prints or displays passwords, tokens,
 * or credentials in error messages or logs.
 */
export function assertIsolatedTestDatabase(targetUrl?: string): void {
  if (!targetUrl || typeof targetUrl !== "string") {
    throw new Error("[DB Safety Guard] FATAL: TEST_DATABASE_URL is not set. Refusing test execution.");
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    throw new Error("[DB Safety Guard] FATAL: TEST_DATABASE_URL is not a valid URL. Refusing test execution.");
  }

  const targetHost = parsed.host.toLowerCase();
  const targetDbName = parsed.pathname.toLowerCase().replace(/^\//, "");

  // 1. Identify production host signatures from .env or .env.local if present
  const productionHostSignatures = new Set<string>();

  // Known production project identifiers
  productionHostSignatures.add("ep-soft-frog-awypltii");

  const contents = readEnvFileContents();
  for (const content of contents) {
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("DATABASE_URL=") || trimmed.startsWith("POSTGRES_URL=")) {
        const rawVal = trimmed.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
        try {
          const u = new URL(rawVal);
          if (u.host && !u.host.includes("dummy") && !u.host.includes("localhost")) {
            productionHostSignatures.add(u.host.toLowerCase());
            // Also add base hostname without -pooler
            productionHostSignatures.add(u.host.toLowerCase().replace("-pooler.", "."));
          }
        } catch {
          // Ignore invalid parse
        }
      }
    }
  }

  // FAIL-CLOSED CHECK 1: Ensure target database is NOT the production database
  for (const sig of productionHostSignatures) {
    if (targetHost.includes(sig)) {
      throw new Error(
        "[DB Safety Guard] FATAL: Test database target matches the production database instance. " +
        "Execution aborted immediately to prevent production data corruption."
      );
    }
  }

  // FAIL-CLOSED CHECK 2: Ensure target database matches a verified isolated test instance
  const isLocalTest =
    targetHost === "localhost" ||
    targetHost.startsWith("localhost:") ||
    targetHost === "127.0.0.1" ||
    targetHost.startsWith("127.0.0.1:");

  const isTestDbName = targetDbName.includes("test") || targetDbName.endsWith("_test");

  // Authorized dedicated Neon test branch instance (ep-green-dew-b5hlv87h in us-east-2)
  const isAuthorizedNeonTestBranch =
    targetHost.includes("ep-green-dew-b5hlv87h") || targetHost.includes("test");

  if (!isLocalTest && !isTestDbName && !isAuthorizedNeonTestBranch) {
    throw new Error(
      "[DB Safety Guard] FATAL: Target database host does not match an authorized isolated test instance. " +
      "Refusing to execute tests against unverified database."
    );
  }
}
