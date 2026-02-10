import keytar from 'keytar'
import { logger } from '../utils/logger'

const SERVICE_NAME = 'zequel'

/** Timeout (ms) for keytar calls – prevents hangs on headless Linux without a secret service. */
const KEYTAR_TIMEOUT = 3_000

const withTimeout = <T>(promise: Promise<T>, fallback: T): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => {
      logger.warn('Keychain operation timed out – secret service may not be available')
      resolve(fallback)
    }, KEYTAR_TIMEOUT))
  ])

export class KeychainService {
  async setPassword(connectionId: string, password: string): Promise<void> {
    try {
      await withTimeout(keytar.setPassword(SERVICE_NAME, connectionId, password), undefined)
    } catch (error) {
      logger.warn('Keychain setPassword failed', error)
    }
  }

  async getPassword(connectionId: string): Promise<string | null> {
    try {
      return await withTimeout(keytar.getPassword(SERVICE_NAME, connectionId), null)
    } catch (error) {
      logger.warn('Keychain getPassword failed', error)
      return null
    }
  }

  async deletePassword(connectionId: string): Promise<boolean> {
    try {
      return await withTimeout(keytar.deletePassword(SERVICE_NAME, connectionId), false)
    } catch (error) {
      logger.warn('Keychain deletePassword failed', error)
      return false
    }
  }

  async findCredentials(): Promise<Array<{ account: string; password: string }>> {
    try {
      return await withTimeout(keytar.findCredentials(SERVICE_NAME), [])
    } catch (error) {
      logger.warn('Keychain findCredentials failed', error)
      return []
    }
  }
}

export const keychainService = new KeychainService()
