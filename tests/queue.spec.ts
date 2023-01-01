/*
 * adonis-drive-azure-storage
 *
 * (c) Alexander Wennerstrøm <alexanderw0310@gmail.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import AzureStorageQueue, { AzureStorageConfig } from '../src/drivers'
import { setupGroup, sleep } from './helpers'

const configs = {
  AzureStorage: {
    name: 'azurequeue',
    driver: 'AzureStorage',
    config: {
      connectionString:
        'DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;QueueEndpoint=http://127.0.0.1:10001/devstoreaccount1;TableEndpoint=http://127.0.0.1:10002/devstoreaccount1;',
      pollingDelay: 10,
    },
  } as AzureStorageConfig,
}

const [name, config] = Object.entries(configs)[0]

test.group(`${config.driver}Queue`, (group) => {
  // setupGroup(group, { ...configs, ...configsDelayed })
  setupGroup(group, configs)

  test(`missing queue name throws exception`, async ({ queues, expect }) => {
    expect(queues.use).toThrow(Error)
  })

  test(`getJob returns null for missing id`, async ({ queues, expect }) => {
    queues.extend(name, (cfg, app) => new AzureStorageQueue(cfg, app))
    const queue = queues.use(name)
    const id = await queue.getJob('111')
    expect(id).toBeNull()
  })

  test(`single job is executed`, async ({ queues, expect }) => {
    queues.extend(name, (cfg, app) => new AzureStorageQueue(cfg, app))
    const queue = queues.use(name)

    await queue.add({})
    await sleep(100)
    const job = await queue.getJob()
    expect(job).toBeDefined()
  })

  test(`payload is passed to processor`, async ({ queues, expect }) => {
    queues.extend(name, (cfg, app) => new AzureStorageQueue(cfg, app))
    const queue = queues.use(name)
    const inPayload = { name: 'test' }

    await queue.add(inPayload)
    await sleep(100)
    const outPayload = (await queue.getJob()).payload
    expect(outPayload).toEqual(inPayload)
  })

  test(`default payload is object`, async ({ queues, expect }) => {
    queues.extend(name, (cfg, app) => new AzureStorageQueue(cfg, app))
    const queue = queues.use(name)

    await queue.add({})
    await sleep(100)
    const payload = (await queue.getJob()).payload
    expect(payload).toEqual({})
  })

  test(`add reopens queue if it is closed`, async ({ queues, expect }) => {
    queues.extend(name, (cfg, app) => new AzureStorageQueue(cfg, app))
    const queue = queues.use(name)
    await queue.close()
    await expect(queue.add({})).toBeTruthy()
  })

  test(`add returns job id`, async function ({ queues, expect }) {
    queues.extend(name, (cfg, app) => new AzureStorageQueue(cfg, app))
    const { id } = await queues.use(name).add({})
    expect(id).toBeTruthy()
  })

  test(`queue use returns the same queue`, async ({ queues, expect }) => {
    queues.extend(name, (cfg, app) => new AzureStorageQueue(cfg, app))
    const queue1 = queues.use(name)
    const queue2 = queues.use(name)
    const { id } = await queue1.add({})
    const job = await queue2.getJob(id)
    expect(job).toBeTruthy
  })

  test('scheduled job is processed with a delay if delayed jobs are active', async function ({
    queues,
    expect,
  }) {
    queues.extend(name, (cfg, app) => new AzureStorageQueue(cfg, app))
    const queue = queues.use(name)

    await queue.add({}, { runAt: Date.now() + 500 })
    await sleep(100)
    let job = await queue.getJob()
    expect(job).toBeNull()
    await sleep(1000)
    expect(job).toBeDefined()
  })
})
