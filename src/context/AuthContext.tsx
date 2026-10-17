import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { deleteLocalOrdersForUser } from "../lib/localData";
import { supabase } from "../lib/supabase";

interface LocalUser {
  id: string;
  email: string;
  user_metadata: { full_name: string };
}

interface StoredUser extends LocalUser {
  password_digest: string;
}

interface AuthValue {
  user: LocalUser | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
  resetPassword: (email: string) => Promise<string | null>;
  updateProfile: (fullName: string) => Promise<string | null>;
  deleteAccount: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);
const USERS_KEY = "algase.local.users.v1";
const SESSION_KEY = "algase.local.session.v1";

function mapAuthUser(user: User): LocalUser {
  return {
    id: user.id,
    email: user.email ?? "",
    user_metadata: {
      full_name: String(
        user.user_metadata.full_name ?? user.user_metadata.name ?? "",
      ),
    },
  };
}

function loadUsers(): StoredUser[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? "[]") as StoredUser[];
  } catch {
    return [];
  }
}

function saveSession(user: LocalUser | null): void {
  try {
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* almacenamiento no disponible */
  }
}

async function digestPassword(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      try {
        setUser(
          JSON.parse(
            localStorage.getItem(SESSION_KEY) ?? "null",
          ) as LocalUser | null,
        );
      } catch {
        setUser(null);
      }
      setIsAdmin(true);
      setLoading(false);
      return;
    }

    let active = true;
    const supabaseClient = supabase;
    const updateAdminRole = async (authUser: User | null) => {
      if (!authUser || authUser.is_anonymous) {
        setIsAdmin(false);
        return;
      }
      const { data, error } = await supabaseClient.rpc("is_admin");
      if (active) setIsAdmin(!error && data === true);
    };
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoading(true);
      setUser(
        session?.user && !session.user.is_anonymous
          ? mapAuthUser(session.user)
          : null,
      );
      const authUser = session?.user ?? null;
      window.setTimeout(() => {
        void updateAdminRole(authUser).finally(() => {
          if (active) setLoading(false);
        });
      });
    });
    supabaseClient.auth.getSession().then(async ({ data }) => {
      if (active) {
        setUser(
          data.session?.user && !data.session.user.is_anonymous
            ? mapAuthUser(data.session.user)
            : null,
        );
        await updateAdminRole(data.session?.user ?? null);
        if (active) setLoading(false);
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      isAdmin,
      loading,
      signIn: async (email, password) => {
        if (supabase) {
          const { error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
          return error?.message ?? null;
        }
        const stored = loadUsers().find(
          (item) => item.email === email.trim().toLowerCase(),
        );
        if (
          !stored ||
          stored.password_digest !== (await digestPassword(password))
        )
          return "Correo o contraseña incorrectos.";
        const nextUser: LocalUser = {
          id: stored.id,
          email: stored.email,
          user_metadata: stored.user_metadata,
        };
        setUser(nextUser);
        saveSession(nextUser);
        return null;
      },
      signUp: async (email, password, fullName) => {
        if (supabase) {
          const { data, error } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              data: { full_name: fullName.trim() },
              emailRedirectTo: `${window.location.origin}/cuenta`,
            },
          });
          if (error) return error.message;
          if (!data.session || !data.user)
            return "Cuenta creada. Revisa tu correo para confirmar el registro.";
          setUser(mapAuthUser(data.user));
          return null;
        }
        const normalizedEmail = email.trim().toLowerCase();
        const users = loadUsers();
        if (users.some((item) => item.email === normalizedEmail))
          return "Ya existe una cuenta con ese correo.";
        const account: StoredUser = {
          id: crypto.randomUUID(),
          email: normalizedEmail,
          user_metadata: { full_name: fullName.trim() },
          password_digest: await digestPassword(password),
        };
        try {
          localStorage.setItem(USERS_KEY, JSON.stringify([...users, account]));
        } catch {
          return "No se pudo guardar la cuenta en este navegador.";
        }
        const nextUser: LocalUser = {
          id: account.id,
          email: account.email,
          user_metadata: account.user_metadata,
        };
        setUser(nextUser);
        saveSession(nextUser);
        return null;
      },
      signInWithGoogle: async () => {
        if (!supabase)
          return "El acceso remoto no está configurado. Agrega VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY o VITE_SUPABASE_PUBLISHABLE_KEY.";
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/cuenta` },
        });
        if (error?.message.toLowerCase().includes("unsupported provider"))
          return "Google todavía no está habilitado en Supabase. Actívalo en Authentication > Sign In / Providers > Google y configura las credenciales OAuth.";
        return error?.message ?? null;
      },
      resetPassword: async (email) => {
        if (!supabase)
          return "La recuperación por correo requiere configurar Supabase.";
        if (!email.trim())
          return "Escribe tu correo para enviarte el enlace de recuperación.";
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          {
            redirectTo: `${window.location.origin}/ingresar`,
          },
        );
        return (
          error?.message ??
          "Si el correo está registrado, recibirás un enlace para restablecer la contraseña."
        );
      },
      updateProfile: async (fullName) => {
        if (!user) return "Inicia sesión para editar tu perfil.";
        const normalizedName = fullName.trim();
        if (normalizedName.length < 2)
          return "Ingresa un nombre de al menos 2 caracteres.";
        if (supabase) {
          const { data, error } = await supabase.auth.updateUser({
            data: { full_name: normalizedName },
          });
          if (error) return error.message;
          if (data.user) setUser(mapAuthUser(data.user));
          return null;
        }
        const nextUser = {
          ...user,
          user_metadata: { full_name: normalizedName },
        };
        const users = loadUsers().map((account) =>
          account.id === user.id
            ? { ...account, user_metadata: nextUser.user_metadata }
            : account,
        );
        try {
          localStorage.setItem(USERS_KEY, JSON.stringify(users));
        } catch {
          return "No se pudo guardar el perfil en este navegador.";
        }
        setUser(nextUser);
        saveSession(nextUser);
        return null;
      },
      deleteAccount: async () => {
        if (!user) return "No hay una cuenta activa.";
        if (supabase)
          return "La eliminación de cuentas en línea requiere habilitar una función segura en el servidor.";
        try {
          localStorage.setItem(
            USERS_KEY,
            JSON.stringify(
              loadUsers().filter((account) => account.id !== user.id),
            ),
          );
          deleteLocalOrdersForUser(user.id);
        } catch {
          return "No se pudo eliminar la cuenta de este navegador.";
        }
        setUser(null);
        saveSession(null);
        return null;
      },
      signOut: async () => {
        if (supabase) await supabase.auth.signOut();
        setUser(null);
        saveSession(null);
      },
    }),
    [user, isAdmin, loading],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return v;
}
