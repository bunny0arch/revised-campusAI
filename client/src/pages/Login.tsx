import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { authErrorMessage, hasActiveSession, validateRegistration, validateSignIn } from "@/lib/supabase-auth";
import { supabase } from "@/lib/supabase";
import "./login.css";

export default function Login() {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [signupError, setSignupError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [isStartingSso, setIsStartingSso] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    let isCurrent = true;
    const redirectExistingSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (isCurrent && !error && hasActiveSession(data.session)) setLocation("/");
    };

    void redirectExistingSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && ["SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED"].includes(event)) setLocation("/");
    });
    return () => {
      isCurrent = false;
      subscription.unsubscribe();
    };
  }, [setLocation]);

  const redirectToLogin = () => new URL("/login", window.location.origin).toString();

  const handleEmailSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice("");
    const validationError = validateSignIn({ email, password });
    if (validationError) { setFormError(validationError); return; }
    setFormError("");
    setIsSigningIn(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setFormError(authErrorMessage(error.message));
      else setLocation("/");
    } catch (error) {
      setFormError(authErrorMessage(error instanceof Error ? error.message : ""));
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice("");
    const validationError = validateRegistration({ name: signupName, email: signupEmail, password: signupPassword });
    if (validationError) { setSignupError(validationError); return; }
    setSignupError("");
    setIsSigningUp(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: signupEmail.trim(),
        password: signupPassword,
        options: { data: { full_name: signupName.trim() }, emailRedirectTo: redirectToLogin() },
      });
      if (error) { setSignupError(authErrorMessage(error.message)); return; }
      if (data.session) { setLocation("/"); return; }
      setSignupOpen(false);
      setSignupName("");
      setSignupPassword("");
      setPassword("");
      setEmail(signupEmail.trim());
      setNotice("Account created. Sign in with your new credentials.");
    } catch (error) {
      setSignupError(authErrorMessage(error instanceof Error ? error.message : ""));
    } finally {
      setIsSigningUp(false);
    }
  };

  const handleCampusSso = async () => {
    setFormError("");
    setNotice("");
    const domain = email.trim().split("@")[1];
    if (!domain) { setFormError("Enter your campus email, then choose Campus SSO."); return; }
    setIsStartingSso(true);
    try {
      const { error } = await supabase.auth.signInWithSSO({ domain, options: { redirectTo: redirectToLogin() } });
      if (error) setFormError(authErrorMessage(error.message));
    } catch (error) {
      setFormError(authErrorMessage(error instanceof Error ? error.message : ""));
    } finally {
      setIsStartingSso(false);
    }
  };

  return (
    <main className="login-shell">
      <div className="login-grid-pattern" aria-hidden="true" />
      <header className="login-header">
        <a className="login-brand" href="/" aria-label="CampusFix AI home">
          <span className="login-brand-mark" aria-hidden="true"><i /><i /></span>
          <span>CampusFix <em>AI</em></span>
        </a>
        <p className="login-secure-status"><span /> Secure campus support</p>
      </header>

      <div className="login-content">
        <section className="login-intro" aria-labelledby="login-page-title">
          <p className="login-eyebrow"><span /> Your campus, understood</p>
          <h1 id="login-page-title">Support that<br /><em>gets you moving.</em></h1>
          <p className="login-intro-copy">A calmer way to solve campus technology issues. Get verified guidance, track support requests, and keep your campus work moving.</p>
          <ul className="login-principles" aria-label="CampusFix benefits">
            <li><b aria-hidden="true">✓</b> Verified campus guidance</li>
            <li><b aria-hidden="true">✓</b> Private support history</li>
            <li><b aria-hidden="true">✓</b> Human escalation when needed</li>
          </ul>
        </section>

        <section className="login-panel" aria-labelledby="sign-in-title">
          <div className="login-panel-meta"><span>PRIVATE WORKSPACE</span><span>01 / 01</span></div>
          <div className="login-lock-mark" aria-hidden="true">◆</div>
          <h2 id="sign-in-title">Welcome back.</h2>
          <p className="login-panel-copy">Sign in with your campus account to access your personal support workspace.</p>

          <form id="login-form" noValidate onSubmit={handleEmailSignIn}>
            <label htmlFor="email">Campus email</label>
            <input id="email" name="email" type="email" placeholder="you@campus.edu" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} aria-describedby={formError ? "form-error" : undefined} />
            <label htmlFor="password">Password</label>
            <div className="login-password-field">
              <input id="password" name="password" type={passwordVisible ? "text" : "password"} placeholder="Enter your password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} aria-describedby={formError ? "form-error" : undefined} />
              <button id="toggle-password" type="button" aria-label={passwordVisible ? "Hide password" : "Show password"} aria-pressed={passwordVisible} onClick={() => setPasswordVisible(current => !current)}>{passwordVisible ? "Hide" : "Show"}</button>
            </div>
            <p className="login-form-error" id="form-error" role="alert" hidden={!formError}>{formError}</p>
            <button className="login-primary-button" type="submit" disabled={isSigningIn}><span>{isSigningIn ? "Signing in…" : "Continue with email"}</span><strong aria-hidden="true">→</strong></button>
          </form>

          <div className="login-divider"><span>or use campus SSO</span></div>
          <button className="login-sso-button" id="sso-button" type="button" disabled={isStartingSso} onClick={handleCampusSso}><span>{isStartingSso ? "Opening campus SSO…" : "Sign in to CampusFix"}</span><strong aria-hidden="true">→</strong></button>
          <p className="login-trust-note"><span aria-hidden="true">✓</span> Your account is handled by the campus identity service.</p>
          <div className="login-divider"><span>Need access?</span></div>
          <p className="login-help-copy">New to CampusFix?</p>
          <button className="login-create-account-button" id="show-signup" type="button" hidden={signupOpen} onClick={() => setSignupOpen(true)}>Create a new account <strong aria-hidden="true">→</strong></button>
          <div className="login-signup-panel" id="signup-panel" hidden={!signupOpen}>
            <div className="login-signup-heading"><strong>Create your account</strong><button id="close-signup" type="button" aria-label="Close create account form" onClick={() => { setSignupOpen(false); setSignupError(""); }}>✕</button></div>
            <form id="signup-form" noValidate onSubmit={handleSignup}>
              <label htmlFor="signup-name">Full name</label>
              <input id="signup-name" name="name" type="text" placeholder="Your name" autoComplete="name" required value={signupName} onChange={event => setSignupName(event.target.value)} aria-describedby={signupError ? "signup-error" : undefined} />
              <label htmlFor="signup-email">Campus email</label>
              <input id="signup-email" name="email" type="email" placeholder="you@campus.edu" autoComplete="email" required value={signupEmail} onChange={event => setSignupEmail(event.target.value)} aria-describedby={signupError ? "signup-error" : undefined} />
              <label htmlFor="signup-password">Create password</label>
              <input id="signup-password" name="password" type="password" placeholder="At least 8 characters" autoComplete="new-password" required value={signupPassword} onChange={event => setSignupPassword(event.target.value)} aria-describedby={signupError ? "signup-error" : undefined} />
              <p className="login-form-error" id="signup-error" role="alert" hidden={!signupError}>{signupError}</p>
              <button className="login-primary-button" type="submit" disabled={isSigningUp}><span>{isSigningUp ? "Creating account…" : "Continue"}</span><strong aria-hidden="true">→</strong></button>
            </form>
          </div>
          <p className="login-auth-notice" role="status" hidden={!notice}>{notice}</p>
          <p className="login-help-copy login-signup-support">Need help? <a href="mailto:it-support@campus.edu">Contact IT support</a>.</p>
        </section>
      </div>

      <footer className="login-footer"><span>CAMPUSFIX AI / STUDENT SUPPORT SYSTEM</span><span>BUILT FOR THE CAMPUS COMMUNITY</span></footer>
    </main>
  );
}
