import { JustChatError } from './errors.ts'
import { validateRelativePath } from './path.ts'

const DEFAULT_TEMPLATE = '$' + '{date.yyyy}-$' + '{date.MM}-$' + '{date.dd}/$' + '{time.HH}-$' + '{time.mm}-$' + '{time.ss}-$' + '{message.firstSentence}'
const EXPRESSION = /\$\{([^{}]*)\}/gu
const ENGLISH_WORD = /[A-Za-z]+(?:'[A-Za-z]+)?/gu
const SPLIT_SENTENCE = /[,，.。]/u

type TemplateToken =
  | { readonly kind: 'literal'; readonly value: string }
  | { readonly kind: 'parameter'; readonly value: TemplateParameter }

type TemplateParameter =
  | 'date.yyyy'
  | 'date.MM'
  | 'date.dd'
  | 'time.HH'
  | 'time.mm'
  | 'time.ss'
  | 'message.firstSentence'
  | { readonly kind: 'message.words'; readonly count: number }

/** The default directory template from the product specification. */
export { DEFAULT_TEMPLATE }

/** Parse one restricted template without evaluating arbitrary expressions. */
export function parseTemplate(template: string): readonly TemplateToken[] {
  if (typeof template !== 'string' || template.length === 0) {
    throw new JustChatError('template-invalid', 'The directory template is required.')
  }
  if (template.includes('\\')) {
    throw new JustChatError('template-invalid', 'Backslashes are not allowed in directory templates.')
  }
  const tokens: TemplateToken[] = []
  let cursor = 0
  let match: RegExpExecArray | null
  EXPRESSION.lastIndex = 0
  while ((match = EXPRESSION.exec(template)) !== null) {
    if (match.index > cursor) tokens.push({ kind: 'literal', value: template.slice(cursor, match.index) })
    tokens.push({ kind: 'parameter', value: parseParameter(match[1] ?? '') })
    cursor = match.index + match[0].length
  }
  if (cursor < template.length) tokens.push({ kind: 'literal', value: template.slice(cursor) })
  if (template.slice(cursor).includes('$' + '{')) {
    throw new JustChatError('template-invalid', 'The directory template contains an unfinished expression.')
  }
  if (tokens.length === 0 || !tokens.some(token =>
    (token.kind === 'literal' && token.value.length > 0) ||
    (token.kind === 'parameter' && token.value !== 'message.firstSentence' && typeof token.value !== 'object') ||
    (token.kind === 'parameter' && typeof token.value === 'object' && token.value.kind !== 'message.words')
  )) {
    throw new JustChatError('template-invalid', 'The directory template must contain static or time text for a leaf directory.')
  }
  if (tokens.some(token => token.kind === 'literal' && token.value.includes('\\'))) {
    throw new JustChatError('template-invalid', 'Backslashes are not allowed in directory templates.')
  }
  return tokens
}

function parseParameter(expression: string): TemplateParameter {
  if (expression === 'date.yyyy' || expression === 'date.MM' || expression === 'date.dd' || expression === 'time.HH' || expression === 'time.mm' || expression === 'time.ss' || expression === 'message.firstSentence') return expression
  const words = /^message\.words\(([1-9]|[12]\d|3[0-2])\)$/u.exec(expression)
  if (words !== null) return { kind: 'message.words', count: Number(words[1]) }
  throw new JustChatError('template-invalid', 'The directory template contains an unsupported expression.')
}

/** Render a parsed template with the host-local time and one message. */
export function renderTemplate(template: string, message: string, now = new Date()): string {
  const tokens = parseTemplate(template)
  if (typeof message !== 'string' || message.trim().length === 0) {
    throw new JustChatError('empty-message', 'The first message must contain text.')
  }
  const values = {
    'date.yyyy': String(now.getFullYear()).padStart(4, '0'),
    'date.MM': String(now.getMonth() + 1).padStart(2, '0'),
    'date.dd': String(now.getDate()).padStart(2, '0'),
    'time.HH': String(now.getHours()).padStart(2, '0'),
    'time.mm': String(now.getMinutes()).padStart(2, '0'),
    'time.ss': String(now.getSeconds()).padStart(2, '0'),
  } as const
  const rendered = tokens.map(token => {
    if (token.kind === 'literal') return token.value
    if (typeof token.value === 'object') return deriveWords(message, token.value.count)
    if (token.value === 'message.firstSentence') return deriveFirstSentence(message)
    return values[token.value]
  }).join('')
  return validateRelativePath(rendered)
}

/** Validate a template against a sample message and return its rendered path. */
export function previewTemplate(template: string, sampleText: string, now = new Date()): string {
  return renderTemplate(template, sampleText, now)
}

function normalizeDerived(value: string): string {
  const normalized = value.normalize('NFKC').replace(/[\s\p{Cc}]+/gu, '').replace(/[<>:"/\\|?*]/gu, '')
  return [...normalized].slice(0, 48).join('')
}

function deriveFirstSentence(message: string): string {
  const parts = message.split(SPLIT_SENTENCE)
  const first = parts.find(part => part.replace(/[\s\p{Cc}]+/gu, '').length > 0)
  if (first === undefined) throw new JustChatError('template-empty-path', 'The first sentence is empty.')
  return normalizeDerived(first)
}

function deriveWords(message: string, count: number): string {
  ENGLISH_WORD.lastIndex = 0
  const words = [...message.matchAll(ENGLISH_WORD)].slice(0, count).map(match => match[0]).join('-')
  return normalizeDerived(words)
}
