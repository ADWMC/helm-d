// Named-assertion reporter for the checks under scripts/checks/.
// One responsibility: turn a series of named assertions into a readable verdict and
// the matching exit status. It knows nothing about what is being checked.
export function createReporter(subject) {
  let failed = 0
  return {
    /** Run one named assertion; await it so an async check cannot escape the verdict. */
    async check(name, fn) {
      try {
        await fn()
        console.log(`  PASS ${name}`)
      } catch (error) {
        failed += 1
        console.log(`  FAIL ${name}: ${error.message}`)
      }
    },
    /** Print the verdict and exit with the matching status. */
    finish() {
      console.log(failed === 0 ? `${subject}: PASS` : `${subject}: ${failed} FAILED`)
      process.exit(failed === 0 ? 0 : 1)
    },
  }
}

/** Announce a skipped check and exit successfully (no host install, no build). */
export function skip(subject, why) {
  console.log(`${subject}: SKIP (${why})`)
  process.exit(0)
}
