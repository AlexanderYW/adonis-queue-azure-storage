import { DefaultAzureCredential } from '@azure/identity'
import {
  DequeuedMessageItem,
  MessageIdDeleteResponse,
  MessagesClearResponse,
  PeekedMessageItem,
  QueueClearMessagesOptions,
  QueueClient,
  QueueCreateOptions,
  QueueCreateResponse,
  QueueDeleteMessageOptions,
  QueueDeleteOptions,
  QueueDeleteResponse,
  QueueGetPropertiesOptions,
  QueueGetPropertiesResponse,
  QueuePeekMessagesOptions,
  QueueReceiveMessageOptions,
  QueueSendMessageOptions,
  QueueSendMessageResponse,
  QueueServiceClient,
  QueueUpdateMessageResponse,
  ServiceListQueuesOptions,
  StorageSharedKeyCredential,
} from '@azure/storage-queue'
import type { Config } from '@ioc:Cavai/Adonis-Queue'
import { AddOptions, DriverContract, JobContract } from '@ioc:Cavai/Adonis-Queue'

export interface AzureStorageConfig extends Config {
  name: string
  driver: string
  config: {
    connectionString?: string
    accountName?: string
    accountKey?: string
    pollingDelay?: number
  }
}

const safeParseString = (inputString: string) => {
  try {
    return JSON.parse(inputString)
  } catch (e) {
    return inputString
  }
}

const unwrap = (
  message: DequeuedMessageItem | QueueSendMessageResponse | PeekedMessageItem
): JobContract<any> => ({
  id: message.messageId,
  receipt: message['popReceipt'] || null,
  // @ts-ignore
  payload: safeParseString(message.messageText || message._response.bodyAsText),
  runAt: message['nextVisibleOn'] ? message['nextVisibleOn'].getTime() || 0 : 0,
  delayed: message.insertedOn !== message['nextVisibleOn'],
  progress: 0,
  reportProgress(progress) {
    this.progress = progress
  },
})

export default class AzureStorageQueue implements DriverContract {
  private queueServiceClient: QueueServiceClient | null = null
  private queue: QueueClient | null = null
  private processor: ((job: any) => void) | null = null

  // @ts-ignore unused app variable
  constructor(private config: AzureStorageConfig) {}

  public getQueueServiceClient(): QueueServiceClient {
    if (this.queueServiceClient) return this.queueServiceClient
    const {
      config: { accountName, accountKey, connectionString },
    } = this.config

    let credential: any
    if (
      process.env.AZURE_TENANT_ID &&
      process.env.AZURE_CLIENT_ID &&
      process.env.AZURE_CLIENT_SECRET
    ) {
      // Authenticating with client id, client secret and tenant id
      credential = new DefaultAzureCredential()
    } else if (accountName && accountKey) {
      credential = new StorageSharedKeyCredential(accountName, accountKey)
    }

    let queueServiceClient: QueueServiceClient
    if (connectionString) {
      queueServiceClient = QueueServiceClient.fromConnectionString(connectionString)
    } else {
      queueServiceClient = new QueueServiceClient(
        `https://${accountName}.queue.core.windows.net`,
        credential
      )
    }

    this.queueServiceClient = queueServiceClient
    return this.queueServiceClient
  }

  /**
   * Gets list of queues
   *
   * @param options Options for listing queues
   */
  public async listQueues(options?: ServiceListQueuesOptions | undefined): Promise<any[]> {
    const iterator = this.getQueueServiceClient().listQueues(options)

    let item = await iterator.next()
    const queueList: any[] = []
    while (!item.done) {
      queueList.push(item.value)
      item = await iterator.next()
    }

    return queueList
  }

  /**
   * Create queue
   *
   * @param queueName Name of queue to be removed
   * @param options Options of create queue function
   */
  public async createQueue(
    queueName: string,
    options?: QueueCreateOptions | undefined
  ): Promise<QueueCreateResponse> {
    return await this.getQueueServiceClient().createQueue(queueName, options)
  }

  /**
   * Delete queue
   *
   * @param queueName — name of the queue to delete.
   * @param options — Options to Queue delete operation.
   */
  public async deleteQueue(
    queueName: string,
    options?: QueueDeleteOptions | undefined
  ): Promise<QueueDeleteResponse> {
    return await this.getQueueServiceClient().deleteQueue(queueName, options)
  }

  /**
   * Get queue
   *
   * @returns a new QueueClient
   */
  public getQueue(): QueueClient {
    if (this.queue) return this.queue

    const { name } = this.config

    this.queue = this.getQueueServiceClient().getQueueClient(String(name))
    this.queue.createIfNotExists()
    if (this.processor) this.queue.receiveMessages().then(this.processor)
    return this.queue
  }

  /**
   * Get queue properties
   *
   * @param options — Options to Queue get properties operation.
   * @returns — Response data for the Queue get properties operation.
   */
  public async getQueueProperties(
    options?: QueueGetPropertiesOptions | undefined
  ): Promise<QueueGetPropertiesResponse> {
    return await this.getQueue().getProperties(options)
  }

  /**
   * Adds job to queue to be processed
   *
   * @param payload Payload to queue for processing
   */
  public async store(payload: string, opts: AddOptions = {}): Promise<JobContract<any>> {
    let newPayload: string = typeof payload === 'object' ? JSON.stringify(payload) : payload

    let options: QueueSendMessageOptions = {}
    if (opts && opts.runAt) {
      options.visibilityTimeout = (opts.runAt - Date.now()) / 1000
    }

    const message = await this.getQueue().sendMessage(newPayload, options)
    return unwrap(message)
  }

  /**
   * Get next message
   *
   * @param options — Options to receive messages operation.
   * @returns Response data for the receive messages operation.
   */
  public async getNext(options?: QueueReceiveMessageOptions): Promise<JobContract<any> | null> {
    const messages = await this.getQueue().receiveMessages(options)
    if (messages.receivedMessageItems.length === 0) {
      return null
    }

    const items: JobContract<any>[] = []
    for (const message of messages.receivedMessageItems) {
      items.push(unwrap(message))
    }
    return items.length === 1 ? items[0] : items
  }

  /**
   * Peek next message by ID
   *
   * @param id Message ID
   */
  public async peekNext(options?: QueuePeekMessagesOptions): Promise<JobContract<any> | null> {
    const messages = await this.getQueue().peekMessages(options)

    if (messages.peekedMessageItems.length === 0) {
      return null
    }

    const items: JobContract<any>[] = []
    for (const message of messages.peekedMessageItems) {
      items.push(unwrap(message))
    }
    return items.length === 1 ? items[0] : items
  }

  /**
   * Removes messsage from queue
   *
   * @param messageId Id of the message
   * @param popReceipt A valid pop receipt value returned from an earlier call to the receive messages or update message operation.
   * @param options Options to delete message operation.
   */
  public async remove(
    messageId: string,
    popReceipt: string,
    options?: QueueDeleteMessageOptions | undefined
  ): Promise<MessageIdDeleteResponse> {
    return await this.getQueue().deleteMessage(messageId, popReceipt, options)
  }

  /**
   * Clear deletes all messages from a queue.
   *
   * @param options — Options to clear messages operation.
   * @returns — Response data for the clear messages operation.
   */
  public async clear(options?: QueueClearMessagesOptions): Promise<MessagesClearResponse> {
    return await this.getQueue().clearMessages(options)
  }

  /**
   * Update job
   *
   * @param messageId Id of the message
   * @param popReceipt A valid pop receipt value returned from an earlier call to the receive messages or update message operation.
   * @param message Message to update. If this parameter is undefined, then the content of the message won't be updated.
   * @param visibilityTimeout Specifies the new visibility timeout value, in seconds, relative to server time. The new value must be larger than or equal to 0, and cannot be larger than 7 days. The visibility timeout of a message cannot be set to a value later than the expiry time. A message can be updated until it has been deleted or has expired.
   * @param options Options to update message operation.
   * @returns — Response data for the update message operation.
   */
  public async update(
    messageId: string,
    popReceipt: string,
    message?: string,
    visibilityTimeout?: number,
    options?: QueueDeleteMessageOptions
  ): Promise<QueueUpdateMessageResponse> {
    // Update the received message
    return await this.getQueue().updateMessage(
      messageId,
      popReceipt,
      message,
      visibilityTimeout,
      options
    )
  }

  public async close(): Promise<void> {
    if (!this.queue) return
    this.queue = null
  }

  /**
   * Starts processing queued jobs. If no jobs in queue,
   * then starts polling queue for new ones
   *
   * @param cb Callback to execute. Callback is the job executor
   * which receives queued job
   */
  // @ts-ignore
  public process(cb: (job: JobContract<any>) => void) {
    throw new Error('Not implemented yet')
    // this.processor = cb
    // this.start()
  }
}
