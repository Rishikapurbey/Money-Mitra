import { describe, expect, it } from "vitest";
import { emailProblem, passwordProblem, usernameProblem } from "../src/lib/validation";

describe("signup rules", () => {
  it("accepts valid values", () => {
    expect(emailProblem("someone@example.com")).toBeNull();
    expect(usernameProblem("rishika_01")).toBeNull();
    expect(passwordProblem("abcd1234")).toBeNull();
  });

  it("rejects bad emails", () => {
    expect(emailProblem("not-an-email")).not.toBeNull();
    expect(emailProblem("a@b")).not.toBeNull();
  });

  it("rejects bad or reserved usernames, ignoring capitals", () => {
    expect(usernameProblem("ab")).not.toBeNull();
    expect(usernameProblem("has space")).not.toBeNull();
    expect(usernameProblem("Anonymous")).not.toBeNull();
    expect(usernameProblem("DELETED_USER")).not.toBeNull();
  });

  it("requires 8-72 characters with a letter and a number", () => {
    expect(passwordProblem("short1")).not.toBeNull();
    expect(passwordProblem("onlyletters")).not.toBeNull();
    expect(passwordProblem("12345678")).not.toBeNull();
    expect(passwordProblem("a1".repeat(37))).not.toBeNull();
  });
});
