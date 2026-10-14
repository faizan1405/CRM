export interface VerifiedTestEndpoint {
  readonly hostname: string;
  readonly database: string;
}

/**
 * Explicitly verified test database endpoints.
 * Test runs are strictly restricted to these exact endpoints with exact hostname
 * and exact database name matching.
 */
export const VERIFIED_TEST_ENDPOINTS: readonly VerifiedTestEndpoint[] = [
  // Dedicated Neon test branch instance (direct and pooler)
  {
    hostname: "ep-green-dew-b5hlv87h.c-7.us-east-2.aws.neon.tech",
    database: "neondb",
  },
  {
    hostname: "ep-green-dew-b5hlv87h-pooler.c-7.us-east-2.aws.neon.tech",
    database: "neondb",
  },
  // Explicitly verified local test database endpoints
  {
    hostname: "localhost",
    database: "crm_test_db",
  },
  {
    hostname: "localhost",
    database: "dummy_test_db",
  },
  {
    hostname: "localhost",
    database: "crm_test",
  },
  {
    hostname: "localhost",
    database: "test_db",
  },
  {
    hostname: "localhost",
    database: "test",
  },
  {
    hostname: "127.0.0.1",
    database: "crm_test_db",
  },
  {
    hostname: "127.0.0.1",
    database: "dummy_test_db",
  },
  {
    hostname: "127.0.0.1",
    database: "crm_test",
  },
  {
    hostname: "127.0.0.1",
    database: "test_db",
  },
  {
    hostname: "127.0.0.1",
    database: "test",
  },
  {
    hostname: "::1",
    database: "crm_test_db",
  },
  {
    hostname: "::1",
    database: "dummy_test_db",
  },
  {
    hostname: "::1",
    database: "crm_test",
  },
  {
    hostname: "::1",
    database: "test_db",
  },
  {
    hostname: "::1",
    database: "test",
  },
];

const KNOWN_PRODUCTION_HOST_SIGNATURES: readonly string[] = [
  "ep-soft-frog-awypltii",
  "ep-soft-frog-awypltii-pooler.c-12.us-east-1.aws.neon.tech",
  "ep-soft-frog-awypltii.c-12.us-east-1.aws.neon.tech",
];

function getProductionHostSignatures(): Set<string> {
  const signatures = new Set<string>(KNOWN_PRODUCTION_HOST_SIGNATURES);

  if (typeof process !== "undefined" && process.env) {
    const envVars = [
      process.env.DATABASE_URL,
      process.env.POSTGRES_URL,
      process.env.DIRECT_URL,
      process.env.DATABASE_URL_UNPOOLED,
      process.env.PGHOST,
      process.env.PGHOST_UNPOOLED,
      process.env.POSTGRES_HOST,
    ];

    for (const rawVal of envVars) {
      if (!rawVal) continue;
      const clean = rawVal.trim().replace(/^["']|["']$/g, "");
      if (!clean || clean.includes("dummy") || clean.includes("localhost") || clean === "127.0.0.1") {
        continue;
      }

      try {
        const u = clean.includes("://") ? new URL(clean) : new URL(`postgresql://${clean}`);
        const host = u.hostname.toLowerCase();
        if (host && host !== "localhost" && host !== "127.0.0.1") {
          signatures.add(host);
          signatures.add(host.replace("-pooler.", "."));
          const projectPrefix = host.split(".")[0]?.replace("-pooler", "");
          if (projectPrefix) {
            signatures.add(projectPrefix);
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`[DB Safety Guard] FATAL: Failed to parse production database host from environment: ${msg}`);
      }
    }
  }

  return signatures;
}

/**
 * Fail-closed test database isolation guard.
 *
 * Verifies that the target database in test mode is a known, explicitly verified
 * test instance matching exact hostname and database name before any fixture writes,
 * reads, or deletions can occur.
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

  const targetHostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const targetDbName = parsed.pathname.toLowerCase().replace(/^\/|\/$/g, "");

  // FAIL-CLOSED CHECK 1: Ensure target database is NOT any production database instance
  const productionSignatures = getProductionHostSignatures();
  for (const sig of productionSignatures) {
    if (targetHostname.includes(sig)) {
      throw new Error(
        "[DB Safety Guard] FATAL: Test database target matches the production database instance. " +
        "Execution aborted immediately to prevent production data corruption."
      );
    }
  }

  // FAIL-CLOSED CHECK 2: Target database MUST match an explicitly verified test database endpoint
  // with exact hostname and exact database name match.
  // Arbitrary remote databases are NEVER authorized simply because their hostname or database name contains "test".
  const isVerified = VERIFIED_TEST_ENDPOINTS.some(
    (endpoint) =>
      endpoint.hostname.toLowerCase() === targetHostname &&
      endpoint.database.toLowerCase() === targetDbName
  );

  if (!isVerified) {
    throw new Error(
      "[DB Safety Guard] FATAL: Target database host does not match an authorized isolated test instance. " +
      "Refusing to execute tests against unverified database."
    );
  }
}
