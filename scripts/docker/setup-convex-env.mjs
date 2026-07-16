// Idempotently set the Convex deployment environment variables required by Convex Auth
// (and any optional integrations) on the self-hosted backend.
//
// Invoked by scripts/docker/deploy-convex.sh with the working directory at packages/convex
// and CONVEX_SELF_HOSTED_URL / CONVEX_SELF_HOSTED_ADMIN_KEY exported, so the Convex CLI
// targets the containerized backend. Existing values are never overwritten, which keeps
// `docker compose up` re-runs cheap and stable.
//
// The JWT_PRIVATE_KEY / JWKS generation mirrors generateJwtKeyPair() in
// scripts/local-convex-setup.js so the self-hosted flow produces the same key shape as the
// cloud bootstrap.

import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

function generateJwtKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicExponent: 0x10001,
  });
  const jwtPrivateKey = privateKey
    .export({ type: "pkcs8", format: "pem" })
    .trimEnd()
    .replace(/\n/g, " ");
  const publicJwk = publicKey.export({ format: "jwk" });
  return {
    JWT_PRIVATE_KEY: jwtPrivateKey,
    JWKS: JSON.stringify({ keys: [{ use: "sig", ...publicJwk }] }),
  };
}

function convexEnv(args) {
  return execFileSync("pnpm", ["exec", "convex", "env", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
}

function listExistingKeys() {
  let output = "";
  try {
    output = convexEnv(["list"]);
  } catch (error) {
    console.error("Failed to list Convex environment variables.");
    throw error;
  }
  const keys = new Set();
  for (const line of output.split("\n")) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (match) {
      keys.add(match[1]);
    }
  }
  return keys;
}

function setEnv(key, value) {
  // Use the combined `KEY=VALUE` single-argument form. Passing the value as its own
  // argument breaks when it starts with a dash (e.g. a PEM `-----BEGIN PRIVATE KEY-----`),
  // which the CLI's option parser rejects as an unknown flag. `convex env set` splits on
  // the first `=`, so `=` characters inside the value (base64 padding) are preserved.
  convexEnv(["set", `${key}=${value}`]);
  console.log(`  set ${key}`);
}

function main() {
  const existing = listExistingKeys();

  // Convex Auth signing keys: set as a pair or not at all.
  if (!existing.has("JWT_PRIVATE_KEY") || !existing.has("JWKS")) {
    const { JWT_PRIVATE_KEY, JWKS } = generateJwtKeyPair();
    setEnv("JWT_PRIVATE_KEY", JWT_PRIVATE_KEY);
    setEnv("JWKS", JWKS);
  } else {
    console.log("  JWT_PRIVATE_KEY / JWKS already set");
  }

  // Site URL for Convex Auth callback/link generation (defaults to the web dashboard).
  if (!existing.has("SITE_URL")) {
    setEnv("SITE_URL", process.env.SITE_URL || "http://localhost:3000");
  } else {
    console.log("  SITE_URL already set");
  }

  // Optional integration secrets: forwarded from the compose environment when provided.
  const optionalKeys = [
    "RESEND_API_KEY",
    "AUTH_RESEND_KEY",
    "EMAIL_FROM",
    "RESEND_WEBHOOK_SECRET",
    "AI_GATEWAY_API_KEY",
    "AI_GATEWAY_BASE_URL",
  ];
  for (const key of optionalKeys) {
    const value = process.env[key];
    if (value && value.trim() && !existing.has(key)) {
      setEnv(key, value);
    }
  }
}

main();
