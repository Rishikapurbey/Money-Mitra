import dotenv from "dotenv";

// The test database URL: TEST_DATABASE_URL if set (CI), otherwise the local
// DATABASE_URL with the database name swapped for "money_mitra_test".
export function testDatabaseUrl() {
  dotenv.config();
  const explicit = process.env.TEST_DATABASE_URL;
  const url = explicit ?? process.env.DATABASE_URL?.replace(/\/([^/?]+)(\?|$)/, "/money_mitra_test$2");
  if (!url) throw new Error("Set TEST_DATABASE_URL or DATABASE_URL to run the tests");
  // Tests wipe their database, so never run against anything not clearly named as a test database
  const name = new URL(url).pathname.slice(1);
  if (!name.includes("test")) throw new Error(`Refusing to run tests against database "${name}"`);
  return url;
}

export function useTestEnv() {
  const url = testDatabaseUrl();
  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = url;
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "test-secret-that-is-at-least-thirty-two-characters";
  delete process.env.BREVO_API_KEY;
}
