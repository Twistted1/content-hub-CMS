import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { signUpWithoutLeakedPassword, changePasswordWithoutLeaked } from "./passwordPolicy";
import * as pwned from "./pwnedPassword";

describe("passwordPolicy", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("signUpWithoutLeakedPassword", () => {
    it("never calls signUp when the password is known-breached", async () => {
      vi.spyOn(pwned, "isPasswordLeaked").mockResolvedValue(true);
      const signUp = vi.fn().mockResolvedValue({ error: null });

      const result = await signUpWithoutLeakedPassword(signUp, "password");

      expect(result.leaked).toBe(true);
      // The account must not be created at all, so nothing needs rolling back.
      expect(signUp).not.toHaveBeenCalled();
    });

    it("calls signUp and passes the error through when the password is clean", async () => {
      vi.spyOn(pwned, "isPasswordLeaked").mockResolvedValue(false);
      const signUpError = { message: "email already registered" };
      const signUp = vi.fn().mockResolvedValue({ error: signUpError });

      const result = await signUpWithoutLeakedPassword(signUp, "correct-horse-battery-staple-42");

      expect(signUp).toHaveBeenCalledWith("correct-horse-battery-staple-42");
      expect(result).toEqual({ leaked: false, error: signUpError });
    });

    it("returns no error on a clean successful signup", async () => {
      vi.spyOn(pwned, "isPasswordLeaked").mockResolvedValue(false);
      const signUp = vi.fn().mockResolvedValue({ error: null });

      const result = await signUpWithoutLeakedPassword(signUp, "a-fine-password-9876");

      expect(result).toEqual({ leaked: false, error: null });
    });
  });

  describe("changePasswordWithoutLeaked", () => {
    it("refuses to update when the new password is known-breached", async () => {
      vi.spyOn(pwned, "isPasswordLeaked").mockResolvedValue(true);
      const update = vi.fn().mockResolvedValue({ error: null });

      const result = await changePasswordWithoutLeaked(update, "password");

      expect(result.leaked).toBe(true);
      expect(update).not.toHaveBeenCalled();
    });

    it("updates and surfaces the error for a clean password", async () => {
      vi.spyOn(pwned, "isPasswordLeaked").mockResolvedValue(false);
      const updateError = { message: "new password should be different" };
      const update = vi.fn().mockResolvedValue({ error: updateError });

      const result = await changePasswordWithoutLeaked(update, "a-better-password-1234");

      expect(update).toHaveBeenCalledWith("a-better-password-1234");
      expect(result).toEqual({ leaked: false, error: updateError });
    });
  });
});