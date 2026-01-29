import { describe, it, expect } from 'vitest'

// Test SSH Configuration validation logic
describe('SSH Configuration', () => {
  interface SSHConfig {
    enabled: boolean
    host: string
    port: number
    username: string
    authMethod: 'password' | 'privateKey'
    password?: string
    privateKey?: string
    privateKeyPassphrase?: string
  }

  function validateSSHConfig(config: SSHConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!config.enabled) {
      return { valid: true, errors: [] }
    }

    if (!config.host || config.host.trim() === '') {
      errors.push('SSH host is required')
    }

    if (!config.port || config.port < 1 || config.port > 65535) {
      errors.push('SSH port must be between 1 and 65535')
    }

    if (!config.username || config.username.trim() === '') {
      errors.push('SSH username is required')
    }

    if (config.authMethod === 'password' && !config.password) {
      errors.push('SSH password is required when using password authentication')
    }

    if (config.authMethod === 'privateKey' && !config.privateKey) {
      errors.push('SSH private key is required when using key authentication')
    }

    return { valid: errors.length === 0, errors }
  }

  it('should validate disabled SSH config', () => {
    const config: SSHConfig = {
      enabled: false,
      host: '',
      port: 22,
      username: '',
      authMethod: 'password'
    }

    const result = validateSSHConfig(config)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should require host when enabled', () => {
    const config: SSHConfig = {
      enabled: true,
      host: '',
      port: 22,
      username: 'user',
      authMethod: 'password',
      password: 'secret'
    }

    const result = validateSSHConfig(config)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('SSH host is required')
  })

  it('should require valid port', () => {
    const config: SSHConfig = {
      enabled: true,
      host: 'server.com',
      port: 0,
      username: 'user',
      authMethod: 'password',
      password: 'secret'
    }

    const result = validateSSHConfig(config)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('SSH port must be between 1 and 65535')
  })

  it('should require username', () => {
    const config: SSHConfig = {
      enabled: true,
      host: 'server.com',
      port: 22,
      username: '',
      authMethod: 'password',
      password: 'secret'
    }

    const result = validateSSHConfig(config)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('SSH username is required')
  })

  it('should require password for password auth', () => {
    const config: SSHConfig = {
      enabled: true,
      host: 'server.com',
      port: 22,
      username: 'user',
      authMethod: 'password'
    }

    const result = validateSSHConfig(config)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('SSH password is required when using password authentication')
  })

  it('should require private key for key auth', () => {
    const config: SSHConfig = {
      enabled: true,
      host: 'server.com',
      port: 22,
      username: 'user',
      authMethod: 'privateKey'
    }

    const result = validateSSHConfig(config)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('SSH private key is required when using key authentication')
  })

  it('should validate complete password config', () => {
    const config: SSHConfig = {
      enabled: true,
      host: 'server.com',
      port: 22,
      username: 'user',
      authMethod: 'password',
      password: 'secret'
    }

    const result = validateSSHConfig(config)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should validate complete key config', () => {
    const config: SSHConfig = {
      enabled: true,
      host: 'server.com',
      port: 22,
      username: 'user',
      authMethod: 'privateKey',
      privateKey: '-----BEGIN RSA PRIVATE KEY-----\n...'
    }

    const result = validateSSHConfig(config)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })
})
