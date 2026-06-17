import { describe, it, expect } from 'vitest'
import {
  parseCustomArgs,
  formatDisplayCommand,
  appendLog,
} from '@main/services/backup/process-args'

describe('parseCustomArgs', () => {
  it('splits on whitespace', () => {
    expect(parseCustomArgs('--a --b')).toEqual(['--a', '--b'])
  })

  it('respects double quotes around spaces', () => {
    expect(parseCustomArgs('--config="/path with spaces/f.ini"')).toEqual([
      '--config=/path with spaces/f.ini',
    ])
  })

  it('respects single quotes', () => {
    expect(parseCustomArgs("--x='a b'")).toEqual(['--x=a b'])
  })

  it('returns empty array for empty input', () => {
    expect(parseCustomArgs('')).toEqual([])
  })
})

describe('formatDisplayCommand', () => {
  it('prefixes env vars and quotes args with spaces', () => {
    const out = formatDisplayCommand('/bin/pg_dump', ['--file=/a b', '--x'], {
      PGPASSWORD: '********',
    })
    expect(out).toBe('PGPASSWORD=******** /bin/pg_dump "--file=/a b" --x')
  })

  it('omits env prefix when env is empty', () => {
    expect(formatDisplayCommand('/bin/x', ['--y'], {})).toBe('/bin/x --y')
  })
})

describe('appendLog', () => {
  it('concatenates under the cap', () => {
    expect(appendLog('a', 'b')).toBe('ab')
  })

  it('truncates the middle but keeps head and tail when over the cap', () => {
    const head = 'HEAD_MARKER' + 'a'.repeat(300 * 1024)
    const tail = 'b'.repeat(300 * 1024) + 'TAIL_MARKER'
    const out = appendLog('', head + tail)
    expect(out).toContain('...(truncated)...')
    // The beginning of the log (where errors usually start) is preserved
    expect(out.startsWith('HEAD_MARKER')).toBe(true)
    // The latest output is preserved
    expect(out.endsWith('TAIL_MARKER')).toBe(true)
    expect(out.length).toBeLessThan((head + tail).length)
  })
})
