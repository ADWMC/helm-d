# API Recon and Docs — Endpoints, Schemas, and Version Surface

## 1. PRIMARY GOALS

1. Discover all reachable API entrypoints.
2. Extract schemas, optional fields, and role differences.
3. Identify old versions, mobile paths, GraphQL endpoints, and undocumented parameters.

## 2. RECON CHECKLIST

### JavaScript and client mining

```bash
curl https://target/app.js | grep -oE '(/api|/rest|/graphql)[^"'\'' ]+' | sort -u
```

### Common documentation and schema paths

```text
/swagger.json
/openapi.json
/api-docs
/docs
/.well-known/
/graphql
/gql
```

### Version and product drift

```text
/api/v1/
/api/v2/
/api/mobile/v1/
/legacy/
```

## 3. WHAT TO EXTRACT FROM DOCS

- optional and undocumented fields
- admin-only request examples
- deprecated endpoints that may still be active
- schema hints like `additionalProperties: true`
- parameter names tied to filtering, sorting, IDs, roles, or tenancy

## 4. NEXT ROUTING

| Finding | Next Document |
|---|---|
| object IDs everywhere | [api authorization and bola](./api-authorization-and-bola.md) |
| JWT, OAuth, role claims | [api auth and jwt abuse](./api-auth-and-jwt-abuse.md) |
| GraphQL or hidden fields | [graphql and hidden parameters](./graphql-and-hidden-parameters.md) |
| strong auth boundary but suspicious business flow | [business logic vulnerabilities](./business-logic-vulnerabilities.md) |