import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { supabase } from "../lib/supabase";

export function AuthPage() {
  const { session } = useAuth(),
    [signup, setSignup] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  if (session) return <Navigate to="/" replace />;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const values = new FormData(e.currentTarget),
      email = String(values.get("email")),
      password = String(values.get("password"));
    try {
      if (signup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { nome: String(values.get("nome")) } },
        });
        if (error) throw error;
        if (!data.session)
          setMessage("Conta criada. Confirme seu e-mail para entrar.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Não foi possível continuar.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <img className="auth-logo" src="/logo.png" alt="Pelada dos Sub" />
      <p>
        {signup
          ? "Crie sua conta. Um administrador fará o vínculo com seu jogador."
          : "Entre para acompanhar a lista e suas confirmações."}
      </p>
      <form onSubmit={submit}>
        {signup && (
          <label>
            Nome
            <input name="nome" minLength={2} required autoComplete="name" />
          </label>
        )}
        <label>
          E-mail
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Senha
          <input
            name="password"
            type="password"
            minLength={8}
            required
            autoComplete={signup ? "new-password" : "current-password"}
          />
        </label>
        <button disabled={busy}>
          {busy ? "AGUARDE…" : signup ? "CRIAR CONTA" : "ENTRAR"}
        </button>
        {message && <div className="form-message">{message}</div>}
      </form>
      <button
        type="button"
        className="link"
        onClick={() => {
          setSignup((value) => !value);
          setMessage("");
        }}
      >
        {signup ? "Já tenho uma conta" : "Ainda não tenho conta"}
      </button>
    </div>
  );
}
