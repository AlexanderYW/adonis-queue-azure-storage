import { Expect } from '@japa/expect'
// @ts-ignore
import Queue from '@cavai/adonis-queue'

declare module '@japa/runner' {
  interface TestContext {
    // notify TypeScript about custom context properties
    expect: Expect
    queues: Queue
  }

  // @ts-ignore
  interface Test<Context, TestData> {
    // notify TypeScript about custom test properties
  }
}
