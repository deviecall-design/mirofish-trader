import { describe, it, expect } from "vitest";
import { authorizationMatches } from "./orderAuth";

describe("authorizationMatches", () => {
  it("rejects when the secret is unset or empty", () => {
    expect(authorizationMatches("Bearer secret", undefined)).toBe(false);
    expect(authorizationMatches("Bearer secret", "")).toBe(false);
  });

  it("rejects a missing or wrong header", () => {
    expect(authorizationMatches(null, "secret")).toBe(false);
    expect(authorizationMatches("Bearer other", "secret")).toBe(false);
    expect(authorizationMatches("secret", "secret")).toBe(false);
  });

  it("accepts the exact bearer token", () => {
    expect(authorizationMatches("Bearer secret", "secret")).toBe(true);
  });
});
