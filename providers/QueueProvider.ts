import { ApplicationContract } from '@ioc:Adonis/Core/Application'
import Logger from '@ioc:Adonis/Core/Logger'
import Queue from '@ioc:Cavai/Adonis-Queue'

export default class AzureStorageProvider {
  constructor(protected app: ApplicationContract) {
    Logger.info('constructor')
    Logger.debug('constructor')
    Logger.error('constructor')
  }

  public async boot() {
    Logger.debug('boot')
    this.app.container.withBindings(['Cavai/Adonis-Queue'], (QueueBinding) => {
      QueueBinding.extend('AzureStorage', (config: any) => {
        const AzureStorageQueue = require('../src/drivers')
        return new AzureStorageQueue(config)
      })
    })

    Queue.extend('AzureStorage', (config: any) => {
      const AzureStorageQueue = require('../src/drivers')
      return new AzureStorageQueue(config)
    })
  }
  public register() {
    Logger.debug('register')
    // IoC container is ready
    this.app.container.withBindings(['Cavai/Adonis-Queue'], (QueueBinding) => {
      QueueBinding.extend('AzureStorage', (config: any) => {
        const AzureStorageQueue = require('../src/drivers')
        return new AzureStorageQueue(config)
      })
    })

    Queue.extend('AzureStorage', (config: any) => {
      const AzureStorageQueue = require('../src/drivers')
      return new AzureStorageQueue(config)
    })
  }
}
