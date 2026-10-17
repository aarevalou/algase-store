import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { loadEnv } from "vite";

const isNetlifyBuild = (env) => env.NETLIFY === "true";

export function validateBuildEnvironment(env) {
  const errors = [];
  const exposedSecrets = Object.keys(env).filter((name) =>
    /^VITE_.*(SERVICE_ROLE|SECRET|PRIVATE_KEY|ACCESS_TOKEN)/i.test(name),
  );

  if (exposedSecrets.length) {
    errors.push(
      `Remove server-only variables from the VITE_ namespace: ${exposedSecrets.join(", ")}. VITE_ values are included in public browser code.`,
    );
  }

  const url = env.VITE_SUPABASE_URL?.trim() ?? "";
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim() ?? "";
  const configuredKeys = [publishableKey, anonKey].filter(Boolean);

  if (!url && !configuredKeys.length && !isNetlifyBuild(env))
    return { errors, configured: false };
  if (!url) errors.push("VITE_SUPABASE_URL is required.");
  if (!configuredKeys.length) {
    errors.push("Set VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY.");
  }

  if (url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
        errors.push(
          "VITE_SUPABASE_URL must be an HTTPS URL without credentials.",
        );
      }
      if (/your-project-ref|placeholder|example/i.test(url)) {
        errors.push("VITE_SUPABASE_URL still contains a template value.");
      }
    } catch {
      errors.push("VITE_SUPABASE_URL must be a valid URL.");
    }
  }

  for (const key of configuredKeys) {
    if (/replace_with|placeholder|example/i.test(key)) {
      errors.push("A Supabase key still contains a template value.");
      continue;
    }
    if (!key.startsWith("sb_publishable_")) {
      try {
        const [header, payload, signature] = key.split(".");
        if (!header || !payload || !signature) throw new Error("not a JWT");
        const role = JSON.parse(
          Buffer.from(payload, "base64url").toString("utf8"),
        ).role;
        if (role !== "anon") {
          errors.push("Supabase browser keys must have the anon role.");
        }
      } catch {
        errors.push(
          "Each Supabase browser key must be a publishable key or legacy anon JWT.",
        );
      }
    }
  }

  return { errors, configured: Boolean(url && configuredKeys.length) };
}

function run() {
  const env = isNetlifyBuild(process.env)
    ? process.env
    : { ...loadEnv("production", process.cwd(), ""), ...process.env };
  const result = validateBuildEnvironment(env);
  if (result.errors.length) {
    console.error("Supabase build configuration is invalid:");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  if (result.configured) {
    console.log("Supabase browser configuration validated.");
  } else {
    console.log(
      "No Supabase build variables found; using the local development fallback.",
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  run();
}
