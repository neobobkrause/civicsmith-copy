/* A token value GENUINELY on the plane's published denylist (`bio-plane/src/tokens.mjs`, `PUBLISHED_TOKEN_HASHES`, its
 * ADMIN_TOKEN line): the 0.2.0 test deployment's, published in this repository and so revoked. DS-3's discipline holds: a
 * fabricated "published" value would test the test, so the suites that use this (R32, R64) assert the cascade judges it
 * `revoked_by_publication`, which only a value whose SHA-256 is on that list can be. It is held here, in this module's
 * own tests, so they read no file of the plane's (ARCH's module-list decision, 22 Nov 2026, owed item 12). It
 * authenticates nothing anywhere. */
export const PUBLISHED_VALUE = "df362a63adbe5d1d96a2942e39fd60e3fbb412eaadf7317266c19a4efea658ba";
