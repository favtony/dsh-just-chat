import { describe, expect, it } from 'vitest'
import { DEFAULT_TEMPLATE, parseTemplate, renderTemplate } from '../../src/shared/template.ts'
import { JustChatError } from '../../src/shared/errors.ts'

describe('directory templates', () => {
  it('renders the default date, time, and first sentence parameters', () => {
    expect(renderTemplate(DEFAULT_TEMPLATE, 'Hello, world.', new Date(2024, 0, 2, 3, 4, 5))).toBe('2024-01-02/03-04-05-Hello')
  })

  it('takes the first non-empty sentence and strips unsafe derived characters', () => {
    expect(renderTemplate('fixed/${message.firstSentence}', '  , A/B: C。later', new Date(2024, 0, 2))).toBe('fixed/ABC')
  })

  it('joins the first n ASCII words and accepts apostrophes', () => {
    expect(renderTemplate('${date.yyyy}/${message.words(3)}', "It's a test, then more", new Date(2024, 0, 2))).toBe("2024/It's-a-test")
  })

  it('rejects unsupported expressions, backslashes, and malformed expressions', () => {
    expect(() => parseTemplate('${cwd}/x')).toThrowError(JustChatError)
    expect(() => parseTemplate('a\\b')).toThrowError(JustChatError)
    expect(() => parseTemplate('${message.words(3)}')).toThrowError(JustChatError)
    expect(() => parseTemplate('${message.words(3)')).toThrowError(JustChatError)
    expect(() => parseTemplate('fixed/${message.words(0)}')).toThrowError(JustChatError)
    expect(() => parseTemplate('fixed/${message.words(33)}')).toThrowError(JustChatError)
  })

  it('rejects an empty rendered segment even when the template parses', () => {
    expect(() => renderTemplate('${date.yyyy}/${message.words(3)}', '中文', new Date(2024, 0, 2))).toThrowError(JustChatError)
  })
})
