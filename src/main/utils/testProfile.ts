import { app } from 'electron'
import { isAbsolute } from 'node:path'

// Set before services resolve userData, including when testing the packaged app.
const profile = process.env.ZEQUEL_TEST_PROFILE
if (process.env.E2E === '1' && profile) {
  if (!isAbsolute(profile)) throw new Error('The test profile must be an absolute path')
  app.setPath('userData', profile)
}
