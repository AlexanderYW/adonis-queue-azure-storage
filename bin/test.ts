import { expect } from '@japa/expect'
import { expectTypeOf } from '@japa/expect-type'
import { assert } from '@japa/assert'
import { specReporter } from '@japa/spec-reporter'
import { processCliArgs, configure, run } from '@japa/runner'

configure({
  ...processCliArgs(process.argv.slice(2)),
  ...{
    files: ['tests/**/*.spec.ts'],
    plugins: [expect(), expectTypeOf(), assert()],
    reporters: [specReporter()],
    importer: (filePath: string) => import(filePath),
  },
})

run()
