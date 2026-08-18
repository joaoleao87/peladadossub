import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { supabase } from "../lib/supabase";

const usernameEmail = (value: string) =>
  `${value.trim().toLowerCase()}@usuarios.peladasub.com`;

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
      login = String(values.get("login")).trim().toLowerCase(),
      email = login.includes("@") ? login : usernameEmail(login),
      password = String(values.get("password"));
    try {
      if (signup) {
        if (!/^[a-z0-9._-]{3,30}$/.test(login))
          throw new Error("Use de 3 a 30 letras, números, ponto, hífen ou _.");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { nome: String(values.get("nome")), username: login } },
        });
        if (error) throw error;
        if (!data.session)
          throw new Error("Desative a confirmação de e-mail no Supabase para entrar sem e-mail.");
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
          Nome de usuário
          <input
            name="login"
            type="text"
            minLength={signup ? 3 : undefined}
            maxLength={signup ? 30 : undefined}
            pattern={signup ? "[a-z0-9._-]+" : undefined}
            title={signup ? "Sem espaços: use letras minúsculas, números, ponto, hífen ou _." : undefined}
            autoCapitalize="none"
            autoCorrect="off"
            required
            autoComplete="username"
          />
          {signup && <small>Sem espaços. Exemplo: joao.silva</small>}
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
