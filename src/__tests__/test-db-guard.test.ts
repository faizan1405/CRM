import { describe, expect, it } from "vitest";
import { assertIsolatedTestDatabase } from "@/lib/test-db-guard";

describe("Fail-Closed Test Database Safety Guard", () => {
  it("allows verified isolated Neon test branch database", () => {
    expect(() => {
      assertIsolatedTestDatabase(
        "postgresql://testuser:secretpassword@ep-green-dew-b5hlv87h-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require"
      );
    }).not.toThrow();
  });

  it("allows verified local test database", () => {
    expect(() => {
      assertIsolatedTestDatabase("postgresql://postgres:secretpassword@localhost:5432/crm_test_db");
    }).not.toThrow();
  });

  it("fails closed when target URL points to the production database instance", () => {
    expect(() => {
      assertIsolatedTestDatabase(
        "postgresql://produser:supersecretpass@ep-soft-frog-awypltii-pooler.c-12.us-east-1.aws.neon.tech/neondb?sslmode=require"
      );
    }).toThrow(/matches the production database/);
  });

  it("fails closed when target URL points to an unverified third-party host", () => {
    expect(() => {
      assertIsolatedTestDatabase(
        "postgresql://user:pass@some-random-production-server.com:5432/production_data"
      );
    }).toThrow(/does not match an authorized isolated test instance/);
  });

  it("fails closed when target URL is missing or empty", () => {
    expect(() => {
      assertIsolatedTestDatabase("");
    }).toThrow(/TEST_DATABASE_URL is not set/);

    expect(() => {
      assertIsolatedTestDatabase(undefined);
    }).toThrow(/TEST_DATABASE_URL is not set/);
  });

  it("never includes passwords or credentials in thrown error messages", () => {
    let thrownMessage = "";
    try {
      assertIsolatedTestDatabase(
        "postgresql://superadmin:SUPER_SECRET_TOKEN_12345@some-unauthorized-db.com/mydb"
      );
    } catch (e: any) {
      thrownMessage = e.message;
    }

    expect(thrownMessage).toBeTruthy();
    expect(thrownMessage).not.toContain("SUPER_SECRET_TOKEN_12345");
    expect(thrownMessage).not.toContain("superadmin");
  });
});
