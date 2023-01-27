import { DefaultAzureCredential } from '@azure/identity'
import {
  DequeuedMessageItem,
  QueueClient,
  QueueReceiveMessageOptions,
  QueueSendMessageOptions,
  QueueSendMessageResponse,
  QueueServiceClient,
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

const unwrap = (job: DequeuedMessageItem | QueueSendMessageResponse): JobContract<any> => ({
  id: job.messageId,
  // @ts-ignore
  payload: safeParseString(job.messageText || job._response.bodyAsText),
  runAt: job.nextVisibleOn.getTime() || 0,
  delayed: job.insertedOn !== job.nextVisibleOn,
  progress: 0,
  reportProgress(progress) {
    this.progress = progress
  },
})

export default class AzureStorageQueue implements DriverContract {
  // @ts-ignore
  private poller: NodeJS.Timeout | null = null
  // @ts-ignore
  private processing: boolean = false

  private queue: QueueClient | null = null
  private processor: ((job: any) => void) | null = null

  // @ts-ignore unused app variable
  constructor(private config: AzureStorageConfig, private app) {}

  public getQueue(): QueueClient {
    if (this.queue) return this.queue
    const {
      name,
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

    this.queue = queueServiceClient.getQueueClient(String(name))
    this.queue.createIfNotExists()
    if (this.processor) this.queue.receiveMessages().then(this.processor)
    return this.queue
  }

  /**
   * Adds job to queue to be processed
   *
   * @param payload Payload to queue for processing
   */
  public async add<T extends Record<string, any>>(
    payload: T,
    opts: AddOptions = {}
  ): Promise<JobContract<T>> {
    let newPayload: string = typeof payload === 'object' ? JSON.stringify(payload) : payload

    let options: QueueSendMessageOptions = {}
    if (opts && opts.runAt) {
      options.visibilityTimeout = (opts.runAt - Date.now()) / 1000
    }

    const job = await this.getQueue().sendMessage(newPayload, options)

    return unwrap(job)
  }

  /**
   * Gets job by ID
   *
   * @param id Job ID
   */
  public async getJob(id?: string | number): Promise<JobContract<any> | null> {
    let options: QueueReceiveMessageOptions = {}
    if (id) {
      options.requestId = String(id)
    }

    const job = await this.getQueue().receiveMessages(options)

    return !job.receivedMessageItems[0] ? null : unwrap(job.receivedMessageItems[0])
  }

  /**
   * Gets multiple jobs
   *
   * Optional @param numberOfJobs A nonzero integer value that specifies the number of messages to retrieve from the queue, up to a maximum of 32. If fewer are visible, the visible messages are returned. By default, a single message is retrieved from the queue with this operation.
   */
  public async getJobs(numberOfJobs?: number): Promise<JobContract<any> | null> {
    let options: QueueReceiveMessageOptions = {}
    numberOfJobs ?? (options.numberOfMessages = numberOfJobs)

    const jobList = await this.getQueue().receiveMessages(options)

    let jobs: any = []
    for (const job of jobList.receivedMessageItems) {
      jobs.push(unwrap(job))
    }
    return jobs
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
