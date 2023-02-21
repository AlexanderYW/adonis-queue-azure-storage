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
// import { setupGroup, sleep } from './helpers'

const sleep = (time) => {
  return new Promise((resolve) => setTimeout(resolve, time))
}

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

test.group('Azure Storage Queue driver', (group) => {
  test('Create instance of driver', async ({ assert }) => {
    const driver = new AzureStorageQueue(configs['AzureStorage'])
    assert.isTrue(driver instanceof AzureStorageQueue)
  })
  test('Authorize access', async ({ assert }) => {
    const driver = new AzureStorageQueue(configs['AzureStorage'])

    const client = await driver.getQueueServiceClient()
    assert.exists(client)
  })
  test('Create and delete queue', async ({ assert }) => {
    const driver = new AzureStorageQueue(configs['AzureStorage'])

    await driver.createQueue('testqueue')
    await driver.deleteQueue('testqueue')
  })
  test('List queues', async ({ assert }) => {
    const driver = new AzureStorageQueue(configs['AzureStorage'])

    const queues = await driver.listQueues()
    assert.exists(queues)
  })
  test('Get queue properties', async ({ assert }) => {
    const driver = new AzureStorageQueue(configs['AzureStorage'])

    const queues = await driver.getQueueProperties()
    assert.equal(typeof queues.approximateMessagesCount, 'number')
  })
  test('Store message in queue', async ({ assert }) => {
    const driver = new AzureStorageQueue(configs['AzureStorage'])
    const message = await driver.store('Hello World!')
    assert.exists(message)
  })
  test('Clear messages', async ({ assert }) => {
    const driver = new AzureStorageQueue(configs['AzureStorage'])

    for (let i = 1; i <= 10; i++) {
      await driver.store('Hello World!' + i)
    }

    const beforeQueueClearLength = (await driver.getQueueProperties()).approximateMessagesCount || 0
    assert.isAbove(beforeQueueClearLength, 9)

    const messages = await driver.clear()
    assert.exists(messages)

    const afterQueueClearLength = (await driver.getQueueProperties()).approximateMessagesCount || 0
    assert.equal(afterQueueClearLength, 0)
  })
  test('Get message in queue', async ({ assert }) => {
    const driver = new AzureStorageQueue(configs['AzureStorage'])
    await driver.store('Hello World!')
    const message = await driver.getNext()
    assert.exists(message)
  })
  test('Peek message in queue', async ({ assert }) => {
    const driver = new AzureStorageQueue(configs['AzureStorage'])
    await driver.store('Hello World!')
    const peekedMessage = await driver.peekNext()
    assert.exists(peekedMessage)
  })
  test('Delete message in queue', async ({ assert }) => {
    const driver = new AzureStorageQueue(configs['AzureStorage'])
    const createdMessage = await driver.store('Hello World!')
    assert.exists(createdMessage)
    sleep(100)
    const deletedMessage = await driver.remove(createdMessage.id, createdMessage.receipt)
    assert.exists(deletedMessage)
  })
})
