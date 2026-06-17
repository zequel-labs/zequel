import { describe, it, expect } from 'vitest'
import { KNOWN_RESTORE_EXTENSIONS } from '@main/services/backup/archive'

describe('KNOWN_RESTORE_EXTENSIONS', () => {
  it('includes the dump extensions we restore from', () => {
    expect(KNOWN_RESTORE_EXTENSIONS).toEqual(['.sql', '.dump', '.bson', '.rdb', '.bak'])
  })
})
