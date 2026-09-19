# API Authorization and BOLA — Object Access, Function Access, and Mass Assignment
> **SRC / 众测语境** → 用 `read_reference(path: "src-hunter/playbooks/api-rest/10-rest-api.md")`（BOLA / Mass Assignment / 速率）

## 1. CORE TEST LOOP

1. Create Account A and Account B.
2. As Account A, capture create, read, update, and delete flows.
3. Replay with Account B's token.
4. Test sibling endpoints, nested endpoints, and alternate HTTP verbs.

## 2. TEST SURFACES

| Surface | Example |
|---|---|
| object read | `/api/v1/orders/123` |
| nested object | `/api/v1/users/1/invoices/9` |
| admin or internal function | `/api/v1/admin/users` |
| update path | `PUT`, `PATCH`, `DELETE` variants |
| hidden JSON fields | `role`, `org`, `verified`, `tier` |

## 3. QUICK PAYLOADS

```json
{"role":"admin"}
{"isAdmin":true}
{"org":"target-company"}
{"verified":true}
```

## 4. WHAT TESTERS MISS

- object IDs in headers, cookies, GraphQL args, and nested objects
- alternate methods sharing the same route but weaker authz
- parent check present, child resource check missing
- admin docs revealing extra writable fields

## 5. NEXT ROUTING

- For JWT or token-layer abuse: [api auth and jwt abuse](./api-auth-and-jwt-abuse.md)
- For GraphQL and hidden parameter discovery: [graphql and hidden parameters](./graphql-and-hidden-parameters.md)
- For broader IDOR patterns outside APIs: [idor broken object authorization](./idor.md)