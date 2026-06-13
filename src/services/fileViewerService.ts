import type { ExamAttachment, FileRecord } from '../types'

export type PreviewKind =
  | 'pdf'
  | 'docx'
  | 'html'
  | 'text'
  | 'markdown'
  | 'image'
  | 'unsupported'

const IMAGE_EXTENSIONS = ['.apng', '.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp']

function normalizeFile(file: ExamAttachment | FileRecord) {
  return {
    name: file.name.toLowerCase(),
    type: file.type.toLowerCase(),
  }
}

export function getPreviewKind(file: ExamAttachment | FileRecord): PreviewKind {
  const normalized = normalizeFile(file)

  if (normalized.type === 'application/pdf' || normalized.name.endsWith('.pdf')) {
    return 'pdf'
  }

  if (
    normalized.type ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    normalized.name.endsWith('.docx')
  ) {
    return 'docx'
  }

  if (
    normalized.type === 'text/html' ||
    normalized.name.endsWith('.html') ||
    normalized.name.endsWith('.htm')
  ) {
    return 'html'
  }

  if (
    normalized.type === 'text/markdown' ||
    normalized.type === 'text/x-markdown' ||
    normalized.name.endsWith('.md') ||
    normalized.name.endsWith('.markdown')
  ) {
    return 'markdown'
  }

  if (
    normalized.type === 'text/plain' ||
    normalized.name.endsWith('.txt') ||
    normalized.name.endsWith('.text')
  ) {
    return 'text'
  }

  if (
    normalized.type.startsWith('image/') ||
    IMAGE_EXTENSIONS.some((extension) => normalized.name.endsWith(extension))
  ) {
    return 'image'
  }

  return 'unsupported'
}

export function isPreviewSupported(file: ExamAttachment | FileRecord): boolean {
  return getPreviewKind(file) !== 'unsupported'
}

export function prepareHtmlForIframe(html: string): string {
  const baseTag = '<base href="about:srcdoc">'

  if (html.includes(baseTag)) return html

  const headTagMatch = html.match(/<head\b[^>]*>/i)
  if (headTagMatch) {
    return html.replace(headTagMatch[0], `${headTagMatch[0]}${baseTag}`)
  }

  const htmlTagMatch = html.match(/<html\b[^>]*>/i)
  if (htmlTagMatch) {
    return html.replace(htmlTagMatch[0], `${htmlTagMatch[0]}<head>${baseTag}</head>`)
  }

  return `${baseTag}${html}`
}
