/*
 * adonis-queue-azure-storage
 *
 * (c) Alexander Wennerstrøm <alexanderw0310@gmail.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

declare module '@ioc:Adonis/Core/Drive' {
  import { CommonOptions, QueueServiceClient } from '@azure/storage-queue'

  /**
   * Configuration accepted by the gcs driver
   */
  export type AzureStorageDriverConfig = CommonOptions & {
    name?: string
    driver: string
    config: {
      connectionString?: string
      accountName?: string
      accountKey?: string
    }
  }

  /**
   * The Azure Storage driver implementation interface
   */
  export interface AzureStorageDriverContract extends DriverContract {
    name: 'AzureStorage'
    adapter: QueueServiceClient
  }
}
