# Login Kit capabilities (v0.20.78)

New requests default to `user.info.basic,video.list`. Only after TikTok approves optional enrichment, set server configuration `TIKTOK_APPROVED_OPTIONAL_SCOPES` to a comma-separated subset of `user.info.profile,user.info.stats`. Other values are ignored; browser parameters cannot enable scopes.

Authorization and exchange use the same configured `TIKTOK_REDIRECT_URI` (default `https://visiondonline.com/api/tiktok/callback`) and Login Kit client key, never the separate Shop key. This configuration does not prove approval. Sandbox requires the signing-in account to be a Target user; customer use requires the effective approved Live app/products/redirect/scopes.

Callback and sync use the token's granted scopes, not the requested set. Basic-only retains verified identity and connection without requesting video or optional profile/stat fields. Missing basic identity permission fails closed. Refresh uses returned scope when present, including explicit empty scope; only an omitted refresh scope retains the prior grant. Existing four-scope connections retain full sync without requesting new consent.

No-video grants neither fetch nor expose cached videos to the Analyzer. Unavailable optional profile/stat values are exposed as null, not zero; stored historical values are not evidence of current permission. Native profiles, pairing, owner/session/state, immutable identity and Shop OAuth are unchanged. This patch does not establish that the reported provider rejection is resolved without the actual user-controlled consent/callback runtime test.
