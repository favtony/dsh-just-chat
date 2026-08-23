import { JustChatError } from './errors.ts'

const WINDOWS_RESERVED_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  ...Array.from({ length: 9 }, (_, index) => 'COM' + String(index + 1)),
  ...Array.from({ length: 9 }, (_, index) => 'LPT' + String(index + 1)),
])

const WINDOWS_INVALID = /[\u0000-\u001f<>:"/\\|?*]/u
const DRIVE_PATH = /^[A-Za-z]:[\\/]/u

/** Validate a configured absolute root path without touching the filesystem. */
export function validateRootPath(rootDirectory: string): string {
  if (typeof rootDirectory !== 'string' || rootDirectory.length === 0) {
    throw new JustChatError('settings-invalid-root', 'The conversation root directory is required.')
  }
  if (/[\u0000-\u001f]/u.test(rootDirectory)) {
    throw new JustChatError('settings-invalid-root', 'The conversation root directory contains control characters.')
  }
  const absolute = rootDirectory.startsWith('/') || rootDirectory.startsWith('\\\\') || DRIVE_PATH.test(rootDirectory)
  if (!absolute) {
    throw new JustChatError('settings-invalid-root', 'The conversation root directory must be absolute.')
  }
  const normalized = rootDirectory.replaceAll('\\', '/')
  const remainder = DRIVE_PATH.test(rootDirectory)
    ? normalized.slice(3)
    : normalized.replace(/^\/+/, '')
  for (const segment of remainder.split('/').filter(Boolean)) {
    try {
      validateSegment(segment)
    } catch {
      throw new JustChatError('settings-invalid-root', 'The conversation root directory contains an invalid path segment.')
    }
  }
  return rootDirectory
}

/** Validate a rendered path relative to the configured root. */
export function validateRelativePath(relativePath: string): string {
  if (typeof relativePath !== 'string' || relativePath.length === 0) {
    throw new JustChatError('template-empty-path', 'The template produced an empty directory path.')
  }
  if (relativePath.includes('\\')) {
    throw new JustChatError('path-invalid', 'Backslashes are not allowed in directory templates.')
  }
  if (relativePath.startsWith('/') || relativePath.endsWith('/') || relativePath.includes('//')) {
    throw new JustChatError('path-invalid', 'The rendered path must contain non-empty relative segments.')
  }
  const segments = relativePath.split('/')
  for (const segment of segments) validateSegment(segment)
  if ([...relativePath].length > 32767) {
    throw new JustChatError('path-too-long', 'The rendered directory path is too long.')
  }
  return relativePath
}

/** Validate one Windows-compatible directory name. */
export function validateSegment(segment: string): string {
  if (segment.length === 0 || segment === '.' || segment === '..') {
    throw new JustChatError('path-invalid', 'Directory segments must not be empty or traversal markers.')
  }
  if ([...segment].length > 80) {
    throw new JustChatError('path-invalid', 'A directory segment is longer than 80 characters.')
  }
  if (WINDOWS_INVALID.test(segment) || /[\u0000-\u001f]/u.test(segment)) {
    throw new JustChatError('path-invalid', 'A directory segment contains an invalid Windows filename character.')
  }
  if (/[ .]$/u.test(segment)) {
    throw new JustChatError('path-invalid', 'A directory segment cannot end with a space or period.')
  }
  const reservedBase = segment.split('.')[0]?.toUpperCase()
  if (reservedBase !== undefined && WINDOWS_RESERVED_NAMES.has(reservedBase)) {
    throw new JustChatError('path-invalid', 'A directory segment uses a reserved Windows name.')
  }
  return segment
}

/** Confirm that a resolved child path remains a strict descendant of its root. */
export function isStrictDescendant(rootDirectory: string, childPath: string, relativePath: string): boolean {
  if (relativePath.length === 0 || relativePath === '.' || relativePath.startsWith('../') || relativePath.startsWith('..\\')) return false
  const root = rootDirectory.replaceAll('\\', '/').replace(/\/+$/u, '')
  const child = childPath.replaceAll('\\', '/').replace(/\/+$/u, '')
  const rootKey = root.toLowerCase()
  const childKey = child.toLowerCase()
  if (childKey === rootKey) return false
  if (rootKey.endsWith(':')) {
    if (!childKey.startsWith(rootKey + '/')) return false
    return child.slice(root.length + 1) === relativePath
  }
  if (rootKey === '') {
    if (!childKey.startsWith('/') || childKey.length <= 1) return false
    return child.slice(1) === relativePath
  }
  if (!childKey.startsWith(rootKey + '/')) return false
  return child.slice(root.length + 1) === relativePath
}
