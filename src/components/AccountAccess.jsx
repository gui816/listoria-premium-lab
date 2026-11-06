import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../lib/supabase.js";
import { UserRound, X, Mail, Lock, Chrome, LoaderCircle, LogOut, CheckCircle2 } from "lucide-react";

export default function AccountAccess({ language = "pt-PT" }) {
  const isEnglish = language === "en";
  const copy = isEnglish ? {
    account:"Account", anonymous:"Guest account", signIn:"Sign in", create:"Create account",
    name:"Name", email:"Email", password:"Password", confirm:"Confirm password",
    country:"Country", age:"Age (optional)", google:"Continue with Google",
    emailAction:"Continue with email", requiredLegend:"* Required fields · Age is optional", requiredMark:"Required", existing:"Already have an account? Sign in",
    new:"New to Listora? Create an account", save:"Save account", close:"Close",
    logout:"Sign out", upgrade:"Create an account to keep your lists and access them on other devices.",
    success:"Account updated successfully.", mismatch:"Passwords do not match.",
    required:"Complete all required fields.", error:"Could not complete the request.",
    loading:"Please wait…", profile:"Your account", signed:"Signed in",
    anonymousInfo:"Your current guest session is kept when you add an email and password.",
    forgot:"Forgot password?", resetSent:"Password reset email sent.", reset:"Send reset email",
    unconfirmed:"Your email address has not been confirmed. Check your inbox or request a new confirmation email.",
    resend:"Resend confirmation email", resendSent:"Confirmation email sent. Check your inbox and spam folder."
  } : {
    account:"Conta", anonymous:"Conta de convidado", signIn:"Iniciar sessão", create:"Criar conta",
    name:"Nome", email:"Email", password:"Password", confirm:"Confirmar password",
    country:"País", age:"Idade (opcional)", google:"Continuar com Google",
    emailAction:"Continuar com email", requiredLegend:"* Campos obrigatórios · Idade opcional", requiredMark:"Obrigatório", existing:"Já tens conta? Inicia sessão",
    new:"Ainda não tens conta? Cria uma conta", save:"Guardar conta", close:"Fechar",
    logout:"Terminar sessão", upgrade:"Cria uma conta para manteres as tuas listas e acederes noutros dispositivos.",
    success:"Conta atualizada com sucesso.", mismatch:"As passwords não coincidem.",
    required:"Preenche todos os campos obrigatórios.", error:"Não foi possível concluir a operação.",
    loading:"Aguarda…", profile:"A tua conta", signed:"Sessão iniciada",
    anonymousInfo:"A tua sessão de convidado é preservada quando adicionas email e password.",
    forgot:"Esqueceste-te da password?", resetSent:"Email de recuperação enviado.", reset:"Enviar email de recuperação",
    unconfirmed:"Ainda não validaste o teu endereço de email. Verifica a tua caixa de entrada ou pede um novo email de confirmação.",
    resend:"Reenviar email de validação", resendSent:"Email de validação reenviado. Verifica também a pasta de spam."
  };
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(null);
  const [countries, setCountries] = useState([]);
  const [mode, setMode] = useState("create");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [country, setCountry] = useState("");
  const [age, setAge] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);

  useEffect(() => {
    if (!supabase) return undefined;
    // INITIAL_SESSION is emitted after Supabase has restored persisted sessions
    // and processed OAuth callback URLs. Use the auth event stream as the single
    // source of truth; a parallel getSession() can resolve later with stale data
    // and overwrite the freshly restored Google session.
    const { data: listener } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "SIGNED_IN") {
        try { window.sessionStorage.removeItem("listora-auth-callback-error"); } catch {}
        setError("");
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    try {
      const callbackError = window.sessionStorage.getItem("listora-auth-callback-error");
      if (callbackError) {
        setError(callbackError);
        setOpen(true);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!open || !supabase) return;
    supabase.from("countries").select("code,name,flag_emoji").eq("enabled", true).order("display_order")
      .then(({ data }) => setCountries(data || []));
  }, [open]);

  const user = session?.user;
  const identities = user?.identities || [];
  const authProvider = user?.app_metadata?.provider;
  // Supabase exposes is_anonymous explicitly. Provider metadata and identities
  // can lag while an OAuth identity is being linked, so do not infer this state
  // from those secondary fields when the authoritative claim is available.
  const isAnonymous = Boolean(user && (user.is_anonymous === true ||
    (user.is_anonymous == null && authProvider === "anonymous" && !identities.some(identity => identity.provider && identity.provider !== "anonymous"))));
  const signedIn = Boolean(user && !isAnonymous);
  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.user_metadata?.display_name || user?.email?.split("@")[0] || copy.profile;
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || "";
  const resetMessages = () => { setError(""); setMessage(""); };

  async function submit(event) {
    event.preventDefault();
    resetMessages();
    if (!supabase) return;
    setNeedsEmailConfirmation(false);
    if (mode === "create" && (!name.trim() || !email.trim() || !password || !country)) {
      setError(copy.required); return;
    }
    if (mode === "create" && password !== confirm) { setError(copy.mismatch); return; }
    setBusy(true);
    try {
      if (mode === "create") {
        const metadata = { display_name: name.trim(), country_code: country, ...(age ? { age: Number(age) } : {}) };
        if (isAnonymous) {
          const { error: updateError } = await supabase.auth.updateUser({ email: email.trim(), password, data: metadata });
          if (updateError) throw updateError;
          const { error: profileError } = await supabase.from("user_profiles").upsert({ user_id: session.user.id, ...metadata }, { onConflict: "user_id" });
          if (profileError) throw profileError;
          setMessage(copy.success);
        } else {
          const { data, error: signUpError } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: metadata, emailRedirectTo: window.location.origin } });
          if (signUpError) throw signUpError;

          // With email confirmation enabled Supabase creates the user but does not
          // establish an authenticated session until the email link is verified.
          setPassword("");
          setConfirm("");
          setMode("signIn");
          setNeedsEmailConfirmation(!data.session);
          setMessage(data.session
            ? (isEnglish ? "Your account is ready. You are signed in." : "A tua conta está criada e a sessão foi iniciada.")
            : (isEnglish
              ? "Account created. Check your inbox and confirm your email before signing in."
              : "Conta criada! Enviámos um email de confirmação. Valida o endereço antes de iniciares sessão."));
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) {
          const confirmationRequired = signInError.code === "email_not_confirmed" ||
            /email not confirmed|email_not_confirmed/i.test(signInError.message || "");
          if (confirmationRequired) {
            setNeedsEmailConfirmation(true);
            setError(copy.unconfirmed);
            return;
          }
          throw signInError;
        }
        setMessage(copy.success);
      }
    } catch (err) { setError(err?.message || copy.error); }
    finally { setBusy(false); }
  }

  async function resendConfirmation() {
    resetMessages();
    if (!email.trim()) {
      setError(isEnglish ? "Enter your email first." : "Indica primeiro o teu email.");
      return;
    }
    setBusy(true);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin }
      });
      if (resendError) throw resendError;
      setMessage(copy.resendSent);
      setNeedsEmailConfirmation(false);
    } catch (err) {
      setError(err?.message || copy.error);
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    resetMessages();
    if (!email.trim()) { setError(isEnglish ? "Enter your email first." : "Indica primeiro o teu email."); return; }
    setBusy(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    if (resetError) setError(resetError.message); else setMessage(copy.resetSent);
    setBusy(false);
  }

  async function googleAuth() {
    resetMessages();
    try { window.sessionStorage.removeItem("listora-auth-callback-error"); } catch {}
    setBusy(true);
    try {
      const { data: currentData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const currentUser = currentData.session?.user;

      // Guest lists are share-code based, not owned by the anonymous auth user.
      // Start a normal Google sign-in directly instead of first attempting
      // linkIdentity: existing Google identities would otherwise trigger a
      // second account chooser after the identity_already_exists callback.
      if (currentUser?.is_anonymous) {
        const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
        if (signOutError) throw signOutError;
      }

      const redirectUrl = new URL(window.location.href);
      ["code", "error", "error_code", "error_description"].forEach(key => redirectUrl.searchParams.delete(key));
      redirectUrl.hash = "";
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: redirectUrl.origin + redirectUrl.pathname + redirectUrl.search }
      });
      if (signInError) throw signInError;
    } catch (err) {
      setError(err?.message || copy.error);
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(signOutError.message);
    setBusy(false);
    setMode("signIn");
    setMessage("");
  }

  return <>
    <button type="button" className={`account-access-trigger${signedIn ? " is-signed-in" : ""}`} onClick={() => { setOpen(true); resetMessages(); }} aria-label={signedIn ? displayName : copy.account} title={signedIn ? user.email || displayName : copy.account}>
      {signedIn && avatarUrl ? <img className="account-avatar" src={avatarUrl} alt="" referrerPolicy="no-referrer"/> : <UserRound size={17}/>}
      <span className="account-trigger-label">{signedIn ? displayName : copy.account}</span>
    </button>
    {open && createPortal(<div className="account-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="account-modal" role="dialog" aria-modal="true" aria-labelledby="account-modal-title">
        <button type="button" className="account-modal-close" aria-label={copy.close} onClick={() => setOpen(false)}><X size={19}/></button>
        <div className="account-modal-icon">{signedIn && avatarUrl ? <img className="account-modal-avatar" src={avatarUrl} alt="" referrerPolicy="no-referrer"/> : <UserRound size={24}/>}</div>
        <h2 id="account-modal-title">{signedIn ? displayName : isAnonymous ? copy.account : copy.signIn}</h2>
        {signedIn ? <>
          <p className="account-modal-subtitle">{session.user.email}</p>
          <button type="button" className="account-primary-button" disabled={busy} onClick={signOut}><LogOut size={16}/>{copy.logout}</button>
        </> : <>
          <p className="account-modal-subtitle">{isAnonymous ? copy.upgrade : copy.anonymousInfo}</p>
          <button type="button" className="account-google-button" disabled={busy} onClick={googleAuth}><Chrome size={17}/>{copy.google}</button>
          <div className="account-divider"><span>{copy.emailAction}</span></div>
          <p className="account-required-note"><span aria-hidden="true">*</span> {copy.requiredLegend}</p>
          <form className="account-form" onSubmit={submit}>
            <div className="account-form-fields">
            {mode === "create" && <>
              <label><span>{copy.name} <span className="account-required-mark" aria-label={copy.requiredMark}>*</span></span><input value={name} onChange={e => setName(e.target.value)} autoComplete="name" maxLength={60} required/></label>
              <label><span>{copy.country} <span className="account-required-mark" aria-label={copy.requiredMark}>*</span></span><select value={country} onChange={e => setCountry(e.target.value)} required><option value="">—</option>{countries.map(item => <option key={item.code} value={item.code}>{item.flag_emoji || ""} {item.name}</option>)}</select></label>
              <label>{copy.age}<input type="number" min="13" max="120" value={age} onChange={e => setAge(e.target.value)}/></label>
            </>}
            <label><span>{copy.email} <span className="account-required-mark" aria-label={copy.requiredMark}>*</span></span><input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required/></label>
            <label><span>{copy.password} <span className="account-required-mark" aria-label={copy.requiredMark}>*</span></span><input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === "create" ? "new-password" : "current-password"} minLength={8} required/></label>
            {mode === "create" && <label><span>{copy.confirm} <span className="account-required-mark" aria-label={copy.requiredMark}>*</span></span><input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" minLength={8} required/></label>}
            </div>
            <button type="submit" className="account-primary-button" disabled={busy}>{busy ? <LoaderCircle size={16} className="spin"/> : <Mail size={16}/>} {mode === "create" ? copy.save : copy.signIn}</button>
            {mode === "signIn" && <button type="button" className="account-mode-toggle" onClick={resetPassword} disabled={busy}>{copy.forgot}</button>}
            {mode === "signIn" && needsEmailConfirmation && <button type="button" className="account-primary-button account-resend-confirmation" onClick={resendConfirmation} disabled={busy}>{busy ? <LoaderCircle size={16} className="spin"/> : <Mail size={16}/>} {copy.resend}</button>}
          </form>
          <button type="button" className="account-mode-toggle" onClick={() => { setMode(mode === "create" ? "signIn" : "create"); resetMessages(); }}>{mode === "create" ? copy.existing : copy.new}</button>
        </>}
        {message && <p className="account-success"><CheckCircle2 size={15}/>{message}</p>}
        {error && <p className="account-error" role="alert">{error}</p>}
      </section>
    </div>, document.body)}
  </>;
}
