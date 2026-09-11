---
name: injection-checking
description: >-
  Entry P1 category router for injection testing. Use when routing between XSS,
  SQLi, SSRF, XXE, SSTI, command injection, and NoSQL injection workflows based
  on how attacker-controlled input is consumed.
---

# Injection Testing Router

This is the routing entry point when input reaches a dangerous interpreter or execution environment.

After confirming this is an injection-class issue, use it to decide whether it is mainly browser context, database, template engine, server-side requests, XML parsing, or system commands.

## When to Use

- Input reaches HTML, JS, SQL, templates, URL fetchers, XML parsers, or shell
- You have not yet decided whether to start with XSS, SQLi, SSRF, XXE, SSTI, CMDi, or NoSQL
- You need to choose the correct deep-topic skill based on input flow

## Skill Map

- [XSS Cross Site Scripting](./xss.md)
- [SQLi SQL Injection](./sql-injection.md)
- [SSRF Server Side Request Forgery](./ssrf.md)
- [XXE XML External Entity](./xxe.md)
- [SSTI Server Side Template Injection](./ssti.md)
- [CMDi Command Injection](./command-injection.md)
- [NoSQL Injection](./nosql-injection.md)
- [Deserialization Insecure](./deserialization-insecure.md)
- [JNDI Injection](./jndi-injection.md)
- [Expression Language Injection](./expression-language-injection.md)
- [CRLF Injection](./crlf-injection.md)
- [Extra Injection Types (SSI, LDAP, XPath)](./injection-checking-extra-injection-types.md)
- [Request Smuggling](./request-smuggling.md)
- [Prototype Pollution](./prototype-pollution.md)
- [Type Juggling](./type-juggling.md)
- [HTTP Parameter Pollution](./http-parameter-pollution.md)
- [XSLT Injection](./xslt-injection.md)
- [CSV Formula Injection](./csv-formula-injection.md)

## Recommended Flow

1. First identify the final sink of the input
2. Then choose the topic skill that best matches that interpreter
3. Small payload samples and quick triage are merged into each main skill; no extra payload router is needed

## Related Categories

- [file-access-vuln](./file-access-vuln.md)