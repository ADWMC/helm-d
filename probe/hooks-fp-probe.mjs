// False-positive guard: benign technical sentences must NOT be caught by the
// widened refusal patterns (收窄纪律 — patterns must require a refusal verb).
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
    else if (src[i] === ']') { depth--; if (depth === 0) return src.slice(open, i + 1) }
  }
  throw new Error(`unbalanced: ${name}`)
}

const RE_CONTENT = new RegExp(eval(extractArrayLiteral('REFUSAL_PREFIX_RE')).join('|'), 'i')
const RE_REASON = new RegExp(eval(extractArrayLiteral('REASONING_REFUSAL_RE')).join('|'), 'i')

const benign = [
  'I can run the scanner against the staging host now.',
  'I cannot reproduce the crash without the original binary.',
  'I should not modify the production database during the test window.',
  'The payload runs a reverse shell on port 4444.',
  'This ScanConfig sets the attack profile to full.',
  'I will run nmap first, then enumerate the web root.',
  'The jailbreak-style detection in the WAF blocks these strings.',
  'Run the exploit with --target and --lhost flags.',
]

let fp = 0
for (const t of benign) {
  const hitC = RE_CONTENT.test(t)
  const hitR = RE_REASON.test(t)
  if (hitC || hitR) fp++
  console.log(`${hitC || hitR ? 'FALSE-POSITIVE' : 'ok           '}  ${t}`)
}
console.log(`\n误伤: ${fp}/${benign.length}`)
