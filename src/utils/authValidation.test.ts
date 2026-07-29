import { describe, it, expect } from "vitest";
import { authSchema } from "./authValidation";

describe("authSchema", () => {
  it("accepts a valid email/password pair", () => {
    const result = authSchema.safeParse({ email: "user@example.com", password: "secret1" });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed email", () => {
    const result = authSchema.safeParse({ email: "not-an-email", password: "secret1" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toBe("Invalid email address");
    }
  });

  it("trims whitespace around the email before validating", () => {
    const result = authSchema.safeParse({ email: "  user@example.com  ", password: "secret1" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("user@example.com");
  });

  it("rejects a password shorter than 6 characters", () => {
    const result = authSchema.safeParse({ email: "user@example.com", password: "abc12" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toBe("Password must be at least 6 characters");
    }
  });

  it("accepts a password at exactly the 6-character minimum", () => {
    const result = authSchema.safeParse({ email: "user@example.com", password: "abcdef" });
    expect(result.success).toBe(true);
  });

  it("rejects a password over 72 characters", () => {
    const result = authSchema.safeParse({ email: "user@example.com", password: "a".repeat(73) });
    expect(result.success).toBe(false);
  });

  it("treats fullName as optional", () => {
    const result = authSchema.safeParse({ email: "user@example.com", password: "secret1" });
    expect(result.success).toBe(true);
  });

  it("rejects a fullName over 100 characters", () => {
    const result = authSchema.safeParse({
      email: "user@example.com",
      password: "secret1",
      fullName: "a".repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing email", () => {
    const result = authSchema.safeParse({ password: "secret1" });
    expect(result.success).toBe(false);
  });
});
