import { describe, it, expect } from 'vitest'
import { Command } from '@main/services/backup/models'

describe('Command', () => {
  it('builds a shell command with defaults', () => {
    const c = new Command({ mainCommand: '/bin/pg_dump', options: ['--x'] })
    expect(c.isSql).toBe(false)
    expect(c.env).toEqual({})
    expect(c.options).toEqual(['--x'])
    expect(c.postCommand).toBeUndefined()
  })

  it('builds a SQL command', () => {
    const c = new Command({ isSql: true, mainCommand: "BACKUP DATABASE [x] TO DISK = N'/p'" })
    expect(c.isSql).toBe(true)
    expect(c.options).toEqual([])
  })

  it('chains a postCommand', () => {
    const post = new Command({ mainCommand: 'docker', options: ['cp', 'a', 'b'] })
    const c = new Command({ mainCommand: '/bin/sqlcmd', options: ['-Q'], postCommand: post })
    expect(c.postCommand).toBe(post)
  })
})
