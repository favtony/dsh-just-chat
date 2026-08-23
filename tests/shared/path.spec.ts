import { describe, expect, it } from 'vitest'
import { isStrictDescendant, validateRelativePath, validateRootPath, validateSegment } from '../../src/shared/path.ts'
import { JustChatError } from '../../src/shared/errors.ts'

describe('directory path validation', () => {
  it('accepts absolute roots and safe descendant segments', () => {
    expect(validateRootPath('C:\\Users\\demo')).toBe('C:\\Users\\demo')
    expect(validateRelativePath('2024/01/hello-world')).toBe('2024/01/hello-world')
  })

  it('rejects relative roots and traversal or malformed segments', () => {
    expect(() => validateRootPath('relative/path')).toThrowError(JustChatError)
    expect(() => validateRootPath('C:\\root\\CON')).toThrowError(JustChatError)
    for (const value of ['../x', './x', '/x', 'x/', 'x//y', 'x/../y', 'CON', 'name.', 'name ']) {
      expect(() => validateRelativePath(value)).toThrowError(JustChatError)
    }
  })

  it('checks strict descendants by both root and rendered relative path', () => {
    expect(isStrictDescendant('C:\\root', 'C:\\root\\child', 'child')).toBe(true)
    expect(isStrictDescendant('C:\\root', 'C:\\root2\\child', 'child')).toBe(false)
    expect(isStrictDescendant('C:\\root', 'C:\\root\\child', 'other')).toBe(false)
  })

  it('rejects reserved and invalid Windows names', () => {
    expect(() => validateSegment('NUL.txt')).toThrowError(JustChatError)
    expect(() => validateSegment('a:b')).toThrowError(JustChatError)
    expect(() => validateSegment('😀'.repeat(81))).toThrowError(JustChatError)
  })
})
