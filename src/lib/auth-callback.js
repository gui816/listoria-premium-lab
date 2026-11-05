const AUTH_ERROR_KEY = "listora-auth-callback-error";

function cleanCallbackUrl(url, history) {
  const next = new URL(url.href);
  ["code", "error", "error_code", "error_description", "error_uri"].forEach((key) => next.searchParams.delete(key));
  const hash = new URLSearchParams(next.hash.replace(/^#/, ""));
  ["access_token", "refresh_token", "expires_in", "expires_at", "token_type", "type", "error", "error_code", "error_description"].forEach((key) => hash.delete(key));
  next.hash = hash.toString() ? "#" + hash.toString() : "";
  history.replaceState(history.state, document.title, next.pathname + next.search + next.hash);
}

export async function completeAuthCallback({ supabase, location, history, storage }) {
  if (!supabase || !location || !history) return { handled: false, error: null };
  const url = new URL(location.href);
  const query = url.searchParams;
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const code = query.get("code");
  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  const callbackError = query.get("error_description") || hash.get("error_description") ||
    query.get("error_code") || hash.get("error_code") || query.get("error") || hash.get("error");

  if (!code && !(accessToken && refreshToken) && !callbackError) {
    return { handled: false, error: null };
  }

  let error = null;
  try {
    if (code) {
      const result = await supabase.auth.exchangeCodeForSession(code);
      error = result.error || null;
    } else if (accessToken && refreshToken) {
      const result = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      error = result.error || null;
    } else {
      error = new Error(callbackError || "O fornecedor de autenticação não concluiu o login.");
    }
  } catch (caught) {
    error = caught instanceof Error ? caught : new Error(String(caught));
  }

  cleanCallbackUrl(url, history);
  try {
    if (error) storage?.setItem(AUTH_ERROR_KEY, error.message || "Não foi possível concluir o login.");
    else storage?.removeItem(AUTH_ERROR_KEY);
  } catch {}
  return { handled: true, error: error ? (error.message || "Não foi possível concluir o login.") : null };
}

export const AUTH_CALLBACK_ERROR_KEY = AUTH_ERROR_KEY;
