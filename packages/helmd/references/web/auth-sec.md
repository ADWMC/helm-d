# Authentication and Authorization Router

This is the routing entry point for authentication, sessions, and authorization boundaries.

Use it to decide whether the issue is mainly login mechanics, object-level authorization, browser trust boundaries, or identity protocols such as OAuth/JWT/SAML before going deeper.

## When to Use

- The target includes login, registration, password reset, 2FA, sessions, JWT, OAuth, or SSO
- You suspect object authorization flaws, cross-tenant access, cross-origin reads, CSRF, or protocol misconfiguration
- You need to decide whether to test authentication or authorization first

## Document Map

- [Authentication Bypass](./authbypass-authentication-flaws.md): login bypass, password reset, 2FA, enumeration, brute-force protections
- [IDOR Broken Object Authorization](./idor.md): IDOR, BOLA, BFLA, missing object permissions
- [JWT OAuth Token Attacks](./jwt-attack.md): algorithm confusion, key trust issues, claim abuse, token forgery
- [OAuth OIDC Misconfiguration](./oauth-token-attacks.md): redirect URI, state, nonce, PKCE, account binding
- [CSRF Cross Site Request Forgery](./csrf.md): CSRF tokens, SameSite, JSON CSRF, login CSRF
- [CORS Cross Origin Misconfiguration](./cors-cross-origin-misconfiguration.md): reflected Origin, credentialed cross-origin reads, allowlist bypass
- [SAML SSO Assertion Attacks](./saml-sso-assertion-attacks.md): assertion wrapping, signature validation, audience, ACS boundaries

## Recommended Flow

1. First confirm the authentication model and session boundaries
2. Then confirm object-level and function-level authorization
3. Then move to token, cross-origin, and protocol details
4. If enterprise federation exists, continue with OAuth, OIDC, or SAML topics

## Related Categories

- [api-sec](./api-sec.md)
- Default credentials, username variants, wordlist sizing, and port focus are consolidated in [authbypass-authentication-flaws](./authbypass-authentication-flaws.md)