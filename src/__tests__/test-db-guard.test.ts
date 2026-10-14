import { describe, expect, it } from "vitest";
import { assertIsolatedTestDatabase, VERIFIED_TEST_ENDPOINTS } from "@/lib/test-db-guard";

describe("Fail-Closed Test Database Safety Guard", () => {
  describe("Positive authorizations (Verified Test Endpoints)", () => {
    it("allows verified isolated Neon test branch database (direct)", () => {
      expect(() => {
        assertIsolatedTestDatabase(
          "postgresql://testuser:secretpassword@ep-green-dew-b5hlv87h.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require"
        );
      }).not.toThrow();
    });

    it("allows verified isolated Neon test branch database (pooler)", () => {
      expect(() => {
        assertIsolatedTestDatabase(
          "postgresql://testuser:secretpassword@ep-green-dew-b5hlv87h-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require"
        );
      }).not.toThrow();
    });

    it("allows verified local test database on localhost", () => {
      expect(() => {
        assertIsolatedTestDatabase("postgresql://postgres:secretpassword@localhost:5432/crm_test_db");
      }).not.toThrow();
    });

    it("allows verified local test database on 127.0.0.1", () => {
      expect(() => {
        assertIsolatedTestDatabase("postgresql://postgres:secretpassword@127.0.0.1:5432/dummy_test_db");
      }).not.toThrow();
    });

    it("all declared VERIFIED_TEST_ENDPOINTS pass validation when queried with test credentials", () => {
      for (const endpoint of VERIFIED_TEST_ENDPOINTS) {
        const hostFormatted = endpoint.hostname.startsWith("::")
          ? `[${endpoint.hostname}]`
          : endpoint.hostname;
        expect(() => {
          assertIsolatedTestDatabase(`postgresql://user:pass@${hostFormatted}:5432/${endpoint.database}`);
        }).not.toThrow();
      }
    });
  });

  describe("Negative checks: unauthorized remote hosts with 'test' in their names", () => {
    it("fails closed on unauthorized remote host with 'test' in subdomain", () => {
      expect(() => {
        assertIsolatedTestDatabase(
          "postgresql://user:pass@test-remote-db.example.com:5432/neondb"
        );
      }).toThrow(/does not match an authorized isolated test instance/);
    });

    it("fails closed on arbitrary Neon test branches with 'test' in hostname", () => {
      expect(() => {
        assertIsolatedTestDatabase(
          "postgresql://user:pass@ep-test-fake-branch-12345.us-east-2.aws.neon.tech/neondb"
        );
      }).toThrow(/does not match an authorized isolated test instance/);
    });

    it("fails closed on unauthorized AWS RDS host with 'test' in hostname", () => {
      expect(() => {
        assertIsolatedTestDatabase(
          "postgresql://user:pass@my-test-postgres.us-east-1.rds.amazonaws.com:5432/crm_test_db"
        );
      }).toThrow(/does not match an authorized isolated test instance/);
    });

    it("fails closed on remote staging/test domain with test database name", () => {
      expect(() => {
        assertIsolatedTestDatabase(
          "postgresql://user:pass@staging-test.company.org:5432/test"
        );
      }).toThrow(/does not match an authorized isolated test instance/);
    });
  });

  describe("Negative checks: production and production-like hosts with 'test' database names", () => {
    it("fails closed when known production host uses a 'test' database name (pooler)", () => {
      expect(() => {
        assertIsolatedTestDatabase(
          "postgresql://produser:supersecretpass@ep-soft-frog-awypltii-pooler.c-12.us-east-1.aws.neon.tech/crm_test_db"
        );
      }).toThrow(/matches the production database/);
    });

    it("fails closed when known production host uses a 'test' database name (direct)", () => {
      expect(() => {
        assertIsolatedTestDatabase(
          "postgresql://produser:supersecretpass@ep-soft-frog-awypltii.c-12.us-east-1.aws.neon.tech/test_db"
        );
      }).toThrow(/matches the production database/);
    });

    it("fails closed when known production host uses generic 'test' database", () => {
      expect(() => {
        assertIsolatedTestDatabase(
          "postgresql://produser:supersecretpass@ep-soft-frog-awypltii.c-12.us-east-1.aws.neon.tech/test"
        );
      }).toThrow(/matches the production database/);
    });

    it("fails closed on unverified production-like internal host with 'test' database name", () => {
      expect(() => {
        assertIsolatedTestDatabase(
          "postgresql://user:pass@production-database.internal:5432/test_db"
        );
      }).toThrow(/does not match an authorized isolated test instance/);
    });

    it("fails closed on unverified enterprise database server with 'crm_test_db'", () => {
      expect(() => {
        assertIsolatedTestDatabase(
          "postgresql://user:pass@db-primary.scale-flow.com:5432/crm_test_db"
        );
      }).toThrow(/does not match an authorized isolated test instance/);
    });
  });

  describe("Negative checks: mismatched database names on verified hosts", () => {
    it("fails closed when verified Neon test host has unverified production database name", () => {
      expect(() => {
        assertIsolatedTestDatabase(
          "postgresql://user:pass@ep-green-dew-b5hlv87h.c-7.us-east-2.aws.neon.tech/production_db"
        );
      }).toThrow(/does not match an authorized isolated test instance/);
    });

    it("fails closed when localhost targets unverified production database name", () => {
      expect(() => {
        assertIsolatedTestDatabase(
          "postgresql://postgres:pass@localhost:5432/production_crm"
        );
      }).toThrow(/does not match an authorized isolated test instance/);
    });
  });

  describe("Input validation and fail-closed defaults", () => {
    it("fails closed when target URL is missing or empty", () => {
      expect(() => {
        assertIsolatedTestDatabase("");
      }).toThrow(/TEST_DATABASE_URL is not set/);

      expect(() => {
        assertIsolatedTestDatabase(undefined);
      }).toThrow(/TEST_DATABASE_URL is not set/);
    });

    it("fails closed when target URL is malformed", () => {
      expect(() => {
        assertIsolatedTestDatabase("not-a-valid-database-url");
      }).toThrow(/TEST_DATABASE_URL is not a valid URL/);
    });
  });

  describe("Credential security: NEVER print database credentials in error messages", () => {
    it("never includes passwords or usernames when failing closed on unauthorized remote host", () => {
      let thrownMessage = "";
      try {
        assertIsolatedTestDatabase(
          "postgresql://superadmin:SUPER_SECRET_TOKEN_12345@unauthorized-remote-test.com/mydb"
        );
      } catch (e: any) {
        thrownMessage = e.message;
      }

      expect(thrownMessage).toBeTruthy();
      expect(thrownMessage).not.toContain("SUPER_SECRET_TOKEN_12345");
      expect(thrownMessage).not.toContain("superadmin");
    });

    it("never includes passwords or usernames when failing closed on production host", () => {
      let thrownMessage = "";
      try {
        assertIsolatedTestDatabase(
          "postgresql://prodadmin:HIGHLY_CONFIDENTIAL_PROD_PASSWORD_999@ep-soft-frog-awypltii.c-12.us-east-1.aws.neon.tech/test_db"
        );
      } catch (e: any) {
        thrownMessage = e.message;
      }

      expect(thrownMessage).toBeTruthy();
      expect(thrownMessage).not.toContain("HIGHLY_CONFIDENTIAL_PROD_PASSWORD_999");
      expect(thrownMessage).not.toContain("prodadmin");
    });
  });
});
