import type { DiscoveryResponse, BackendValidationResult } from "./backend";

const DISCOVERY_REQUEST_TIMEOUT_MS = 10000;

/**
 * Loopback hosts (localhost / 127.0.0.1 / ::1) are treated as trusted local
 * development backends: they are allowed over http:// (no public network exposure)
 * and use port-based cloud/site mapping instead of Convex Cloud's domain convention.
 * This mirrors the backend's own local-dev carve-out (see isLocalDevOrigin in
 * packages/convex/convex/http.ts).
 */
function isLoopbackHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}

/**
 * Convert a Convex URL to the HTTP endpoint URL.
 * Convex Cloud URLs use .convex.cloud for the real-time API but .convex.site for
 * HTTP endpoints. Self-hosted backends (e.g. local Docker) instead serve HTTP actions
 * on the site port, which is the cloud/API port + 1 (Convex default: 3210 -> 3211).
 */
function getHttpEndpointUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith(".convex.cloud")) {
      return url.replace(/\.convex\.cloud$/, ".convex.site");
    }
    if (isLoopbackHostname(parsed.hostname) && parsed.port) {
      parsed.port = String(Number.parseInt(parsed.port, 10) + 1);
      return parsed.toString().replace(/\/$/, "");
    }
    return url;
  } catch {
    // Fall back to the Convex Cloud convention if the URL cannot be parsed.
    return url.replace(/\.convex\.cloud$/, ".convex.site");
  }
}

export async function validateBackendUrl(url: string): Promise<BackendValidationResult> {
  // Normalize URL
  let normalizedUrl = url.trim();

  // Add a protocol if none was specified. Loopback hosts default to http:// (local
  // self-hosted dev); everything else defaults to https://.
  if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
    const hostToken = normalizedUrl.split("/")[0]?.split(":")[0] ?? "";
    const defaultProtocol = isLoopbackHostname(hostToken) ? "http://" : "https://";
    normalizedUrl = `${defaultProtocol}${normalizedUrl}`;
  }

  // Reject HTTP URLs (require HTTPS) except for trusted loopback dev backends.
  if (normalizedUrl.startsWith("http://")) {
    let isLoopback = false;
    try {
      isLoopback = isLoopbackHostname(new URL(normalizedUrl).hostname);
    } catch {
      isLoopback = false;
    }
    if (!isLoopback) {
      return {
        valid: false,
        error: "HTTPS is required for secure connections",
      };
    }
  }

  // Remove trailing slash
  normalizedUrl = normalizedUrl.replace(/\/$/, "");

  try {
    // Convert to HTTP endpoint URL (e.g., .convex.cloud -> .convex.site)
    const httpEndpointUrl = getHttpEndpointUrl(normalizedUrl);
    const discoveryUrl = `${httpEndpointUrl}/.well-known/opencom.json`;

    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    if (controller) {
      timeoutHandle = setTimeout(() => {
        controller.abort();
      }, DISCOVERY_REQUEST_TIMEOUT_MS);
    }

    const response = await fetch(discoveryUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller?.signal,
    });

    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }

    if (!response.ok) {
      return {
        valid: false,
        error: "Server is not a valid Opencom instance",
      };
    }

    const data = await response.json();

    // Validate required fields
    if (!data.version || !data.name || !data.convexUrl) {
      return {
        valid: false,
        error: "Server is not a valid Opencom instance (missing required fields)",
      };
    }

    const discovery: DiscoveryResponse = {
      version: data.version,
      name: data.name,
      convexUrl: data.convexUrl,
      features: data.features,
      signupMode: data.signupMode,
      authMethods: data.authMethods,
    };

    return {
      valid: true,
      discovery,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        valid: false,
        error:
          "Could not connect to server. Discovery request timed out after " +
          `${Math.floor(DISCOVERY_REQUEST_TIMEOUT_MS / 1000)}s. Please check the URL and network, then try again.`,
      };
    }

    return {
      valid: false,
      error: "Could not connect to server. Please check the URL and try again.",
    };
  }
}

export function normalizeBackendUrl(url: string): string {
  let normalized = url.trim();

  if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
    normalized = `https://${normalized}`;
  }

  return normalized.replace(/\/$/, "");
}
