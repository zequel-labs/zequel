import keytar from 'keytar'

const SERVICE_NAME = 'zequel'

export class KeychainService {
  async setPassword(connectionId: string, password: string): Promise<void> {
    await keytar.setPassword(SERVICE_NAME, connectionId, password)
  }

  async getPassword(connectionId: string): Promise<string | null> {
    return keytar.getPassword(SERVICE_NAME, connectionId)
  }

  async deletePassword(connectionId: string): Promise<boolean> {
    return keytar.deletePassword(SERVICE_NAME, connectionId)
  }

  async findCredentials(): Promise<Array<{ account: string; password: string }>> {
    return keytar.findCredentials(SERVICE_NAME)
  }
}

export const keychainService = new KeychainService()
