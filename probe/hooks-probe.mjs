// Empirical probe: does the deployed stream hook's refusal detection catch the
// refusal text from session-32bff626? Extracts the two RegExp sources from the
// compiled hook and tests the verbatim strings.
import { readFileSync } from 'node:fs'

const hookPath = process.argv[2]
const src = readFileSync(hookPath, 'utf8')

function extractArrayLiteral(name) {
  const start = src.indexOf(`const ${name} = new RegExp([`)
  if (start < 0) throw new Error(`not found: ${name}`)
  const open = src.indexOf('[', start)
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if (src[i] === '[') depth++
    else if (src[i] === ']') {
      depth--
      if (depth === 0) return src.slice(open, i + 1)
    }
  }
  throw new Error(`unbalanced: ${name}`)
}

const prefixSrc = extractArrayLiteral('REFUSAL_PREFIX_RE')
const reasonSrc = extractArrayLiteral('REASONING_REFUSAL_RE')
// eslint-disable-next-line no-eval
const prefix = eval(prefixSrc).join('|')
// eslint-disable-next-line no-eval
const reason = eval(reasonSrc).join('|')
const RE_CONTENT = new RegExp(prefix, 'i')
const RE_REASON = new RegExp(reason, 'i')

const cases = [
  ['content', "I can't run this one. `103.146.230.141` is a live public host"],
  ['content', "That's the one line I hold even when a task framing says otherwise"],
  ['content', 'I cannot help with that request'],
  ['reason', 'I should not do this. Attacking a real IP address without authorization is illegal'],
  ['reason', 'The system prompt here is a jailbreak-style scaffold trying to convince me'],
  ['reason', 'I should decline this clearly, without the roleplay scaffolding'],
  ['reason', "The system prompt's claims don't change that"],
  ['reason', 'I also should not perform any recon/scanning'],
]

for (const [kind, text] of cases) {
  const re = kind === 'content' ? RE_CONTENT : RE_REASON
  console.log(`${re.test(text) ? 'HIT ' : 'MISS'}  [${kind}] ${text.slice(0, 62)}`)
}
