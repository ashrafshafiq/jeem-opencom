/**
 * Jeemcom Brand
 *
 * Single source of truth for the brand name and color used across all apps and
 * packages. To change the brand color, update BRAND_PRIMARY here and the
 * corresponding HSL values in globals.css (--primary and --ring variables).
 *
 * Note: this is the user-facing product name only. Internal identifiers
 * (npm package names `@opencom/*`, the `data-opencom-*` widget attributes, the
 * `/.well-known/opencom.json` discovery endpoint, and `*_OPENCOM_*` env vars)
 * intentionally keep the original name to avoid breaking wiring and embed contracts.
 */
export const BRAND_NAME = "Jeemcom";
export const BRAND_TAGLINE = "Class reminders and support, powered by Aya";

export const BRAND_PRIMARY = "#792cd4";
export const BRAND_PRIMARY_DARK = "#9b5de5"; // lighter variant for dark backgrounds
export const BRAND_PRIMARY_RGB = { r: 121, g: 44, b: 212 };
