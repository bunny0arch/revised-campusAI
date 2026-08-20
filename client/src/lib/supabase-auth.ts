type Credentials = { email: string; password: string };
type Registration = Credentials & { name: string };
type SignOutClient = { signOut: () => Promise<{ error: { message: string } | null }> };

export function hasActiveSession(session: { access_token?: string } | null | undefined) {
  return Boolean(session?.access_token);
}

export async function signOutCampusFix(auth: SignOutClient) {
  try {
    const { error } = await auth.signOut();
    return error ? authErrorMessage(error.message) : null;
  } catch (error) {
    return authErrorMessage(error instanceof Error ? error.message : "");
  }
}

export function validateSignIn({ email, password }: Credentials) {
  if (!email.trim()) return "Enter your campus email to continue.";
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) return "Enter a valid campus email address.";
  if (!password) return "Enter your password to continue.";
  return null;
}

export function validateRegistration({ name, email, password }: Registration) {
  if (!name.trim()) return "Enter your full name to create an account.";
  const credentialError = validateSignIn({ email, password });
  if (credentialError) return credentialError;
  if (password.length < 8) return "Use a password with at least 8 characters.";
  return null;
}

export function authErrorMessage(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) return "The email or password is not correct.";
  if (normalized.includes("email not confirmed")) return "Confirm your campus email before signing in.";
  if (normalized.includes("user already registered")) return "An account already exists for this email. Try signing in instead.";
  if (normalized.includes("email rate limit") || normalized.includes("rate limit")) return "Too many attempts. Please wait a moment and try again.";
  if (normalized.includes("provider is not enabled") || normalized.includes("sso")) return "Campus SSO is not configured for this email domain yet. Contact IT support.";
  return "CampusFix could not complete that request. Please try again.";
}
