import { execSync } from "child_process";
import { useTestEnv } from "./testDb";

// Bring the test database's tables up to date before any test runs
export default function setup() {
  useTestEnv();
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: process.env });
}
