import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import { authErrorMessage, hasActiveSession, signOutCampusFix, validateRegistration, validateSignIn } from "./supabase-auth";

describe("CampusFix Supabase authentication helpers", () => {
  it("requires valid credentials for a password sign-in", () => {
    expect(validateSignIn({ email: "", password: "secret" })).toBe("Enter your campus email to continue.");
    expect(validateSignIn({ email: "not-an-email", password: "secret" })).toBe("Enter a valid campus email address.");
    expect(validateSignIn({ email: "student@campus.edu", password: "" })).toBe("Enter your password to continue.");
    expect(validateSignIn({ email: "student@campus.edu", password: "secret" })).toBeNull();
  });

  it("requires a full name and an eight-character password for account creation", () => {
    expect(validateRegistration({ name: "", email: "student@campus.edu", password: "password" })).toBe("Enter your full name to create an account.");
    expect(validateRegistration({ name: "Student", email: "student@campus.edu", password: "short" })).toBe("Use a password with at least 8 characters.");
    expect(validateRegistration({ name: "Student", email: "student@campus.edu", password: "securepass" })).toBeNull();
  });

  it("maps authentication-provider responses to helpful login-page messages", () => {
    expect(authErrorMessage("Invalid login credentials")).toBe("The email or password is not correct.");
    expect(authErrorMessage("Email not confirmed")).toBe("Confirm your campus email before signing in.");
    expect(authErrorMessage("Provider is not enabled")).toBe("Campus SSO is not configured for this email domain yet. Contact IT support.");
  });

  it("recognizes a persisted Supabase session for a fresh login-route visit", () => {
    expect(hasActiveSession(null)).toBe(false);
    expect(hasActiveSession({})).toBe(false);
    expect(hasActiveSession({ access_token: "session-token" })).toBe(true);
  });

  it("ends the Supabase session and exposes a safe error for a failed logout", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    await expect(signOutCampusFix({ signOut })).resolves.toBeNull();
    expect(signOut).toHaveBeenCalledOnce();
    await expect(signOutCampusFix({ signOut: vi.fn().mockResolvedValue({ error: { message: "network unavailable" } }) })).resolves.toBe("CampusFix could not complete that request. Please try again.");
  });
});
