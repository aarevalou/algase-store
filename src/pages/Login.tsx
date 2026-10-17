import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { user, signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
  const nav = useNavigate();
  const from =
    (useLocation().state as { from?: string } | null)?.from ?? "/cuenta";
  const [mode, setMode] = useState<"in" | "up">("in");
  const [msg, setMsg] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") nav("/");
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [nav]);

  if (user) return <Navigate to={from} replace />;
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setWorking(true);
    try {
      const submittedEmail = String(f.get("email"));
      const password = String(f.get("password"));
      const err =
        mode === "in"
          ? await signIn(submittedEmail, password)
          : await signUp(submittedEmail, password, String(f.get("name") ?? ""));
      if (err) setMsg(err);
      else nav(from, { replace: true });
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="auth-modal" role="presentation">
      <button
        type="button"
        className="auth-modal__backdrop"
        aria-label="Cerrar inicio de sesión"
        onClick={() => nav("/")}
      />
      <section
        className="auth-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title">
        <button
          type="button"
          className="auth-modal__close"
          aria-label="Cerrar"
          onClick={() => nav("/")}>
          <X size={20} />
        </button>
        <h1 id="auth-title" className="auth-modal__title">
          {mode === "in" ? "Ingresar" : "Crear cuenta"}
        </h1>
        {msg && (
          <p role="status" className="auth-modal__message">
            {msg}
          </p>
        )}
        <form onSubmit={submit} className="auth-modal__form">
          {mode === "up" && (
            <div>
              <label className="alg-label" htmlFor="name">
                Nombre
              </label>
              <input
                id="name"
                name="name"
                className="alg-field"
                autoComplete="name"
                required
              />
            </div>
          )}
          <div>
            <label className="alg-label" htmlFor="email">
              Correo
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              className="alg-field"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="alg-label" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              minLength={8}
              autoComplete={mode === "in" ? "current-password" : "new-password"}
              className="alg-field"
              required
            />
          </div>
          <button className="alg-btn-primary" disabled={working}>
            {working
              ? "Un momento…"
              : mode === "in"
                ? "Ingresar"
                : "Crear cuenta"}
          </button>
        </form>
        <div className="auth-modal__actions">
          <button
            type="button"
            className="auth-modal__text-button"
            onClick={() => {
              setMsg(null);
              setMode(mode === "in" ? "up" : "in");
            }}>
            {mode === "in" ? "Crear una cuenta" : "Ya tengo cuenta"}
          </button>
          <button
            type="button"
            className="auth-modal__text-button"
            onClick={async () => setMsg(await resetPassword(email))}>
            Recuperar contraseña
          </button>
        </div>
        <div className="auth-modal__divider">o continúa con</div>
        <button
          type="button"
          className="gsi-material-button"
          disabled={working}
          onClick={async () => {
            setWorking(true);
            try {
              const error = await signInWithGoogle();
              if (error) setMsg(error);
            } finally {
              setWorking(false);
            }
          }}>
          <span className="gsi-material-button-state" aria-hidden="true" />
          <span className="gsi-material-button-content-wrapper">
            <span className="gsi-material-button-icon" aria-hidden="true">
              <svg viewBox="0 0 48 48" role="img">
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
            </span>
            <span className="gsi-material-button-contents">
              Continuar con Google
            </span>
          </span>
        </button>
        <p className="auth-modal__note">
          Google debe estar habilitado en Authentication &gt; Sign In /
          Providers de Supabase, con credenciales OAuth y URL de retorno
          configuradas. Sin Supabase, solo están disponibles las cuentas
          locales.
        </p>
      </section>
    </div>
  );
}
