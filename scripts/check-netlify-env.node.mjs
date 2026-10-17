import test from "node:test";
import assert from "node:assert/strict";
import { validateBuildEnvironment } from "./check-netlify-env.mjs";

const jwtForRole = (role) =>
  `header.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;

const validNetlifyEnv = {
  NETLIFY: "true",
  VITE_SUPABASE_URL: "https://project.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY:
    "sb_publishable_AbCdEf1234567890GhIjKlMnOpQrStUvWxYz",
};

test("accepts a publishable key and HTTPS Supabase URL on Netlify", () => {
  assert.deepEqual(validateBuildEnvironment(validNetlifyEnv), {
    errors: [],
    configured: true,
  });
});

test("requires both public Supabase variables in a Netlify build", () => {
  const result = validateBuildEnvironment({ NETLIFY: "true" });
  assert.equal(result.configured, false);
  assert.equal(result.errors.length, 2);
});

test("accepts legacy anon JWTs", () => {
  const result = validateBuildEnvironment({
    NETLIFY: "true",
    VITE_SUPABASE_URL: "https://project.supabase.co",
    VITE_SUPABASE_ANON_KEY: jwtForRole("anon"),
  });
  assert.deepEqual(result.errors, []);
});

test("rejects service-role keys", () => {
  const result = validateBuildEnvironment({
    ...validNetlifyEnv,
    VITE_SUPABASE_PUBLISHABLE_KEY: jwtForRole("service_role"),
  });
  assert.ok(result.errors.some((error) => error.includes("anon role")));
});

test("rejects server secrets exposed through VITE variables", () => {
  const result = validateBuildEnvironment({
    ...validNetlifyEnv,
    VITE_SUPABASE_SERVICE_ROLE_KEY: "should-not-be-here",
  });
  assert.ok(
    result.errors.some((error) =>
      error.includes("VITE_SUPABASE_SERVICE_ROLE_KEY"),
    ),
  );
});

test("checks a legacy key even when a publishable key is also configured", () => {
  const result = validateBuildEnvironment({
    ...validNetlifyEnv,
    VITE_SUPABASE_ANON_KEY: jwtForRole("service_role"),
  });
  assert.ok(result.errors.some((error) => error.includes("anon role")));
});

test("rejects template values instead of treating them as configured", () => {
  const result = validateBuildEnvironment({
    NETLIFY: "true",
    VITE_SUPABASE_URL: "https://your-project-ref.supabase.co",
    VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_replace_with_your_key",
  });
  assert.ok(result.errors.some((error) => error.includes("template value")));
});

test("allows local mode when neither remote variable is configured", () => {
  assert.deepEqual(validateBuildEnvironment({}), {
    errors: [],
    configured: false,
  });
});
