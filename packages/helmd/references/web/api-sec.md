# API Security Router

This is the routing entry point for API security testing.

Read this document first to decide whether the API issue is mostly recon/docs, object authorization, token trust, or GraphQL/hidden parameters, then route to a deeper topic document.

## When to Use

- The target exposes REST APIs, mobile backends, or GraphQL endpoints
- You need to define API testing order before going into specific topics
- You want to handle object authorization, JWT, GraphQL, and hidden fields as separate tracks

## Document Map

- [API Recon and Docs](./api-recon-and-docs.md): OpenAPI, Swagger, version drift, hidden documentation
- [API Authorization and BOLA](./api-authorization-and-bola.md): BOLA, BFLA, method abuse, hidden writable fields
- [API Auth and JWT Abuse](./api-auth-and-jwt-abuse.md): bearer token, header trust, claim abuse, rate-limit bypass
- [GraphQL and Hidden Parameters](./graphql-and-hidden-parameters.md): introspection, batching, undocumented fields, hidden parameters

## Quick Triage

| Observation | Route |
|---|---|
| Swagger or OpenAPI is present | [api-recon-and-docs](./api-recon-and-docs.md) |
| IDs appear in URL, JSON, headers, or GraphQL args | [api-authorization-and-bola](./api-authorization-and-bola.md) |
| JWT token visible in traffic | [api-auth-and-jwt-abuse](./api-auth-and-jwt-abuse.md) |
| `/graphql` or batched JSON arrays are present | [graphql-and-hidden-parameters](./graphql-and-hidden-parameters.md) |
| Registration, login, or profile updates accept extra fields | [api-authorization-and-bola](./api-authorization-and-bola.md) then [api-auth-and-jwt-abuse](./api-auth-and-jwt-abuse.md) |

## Recommended Flow

1. Start with exposed endpoints and documentation assets
2. Then evaluate object-level and function-level authorization
3. Then evaluate token, header, signature, and rate-limit boundaries
4. If GraphQL or complex JSON is present, continue with hidden fields and schema abuse

## Related Categories

- [auth-sec](./auth-sec.md)
- [business-logic-vuln](./business-logic-vuln.md)
- [recon-for-sec](./recon-for-sec.md)