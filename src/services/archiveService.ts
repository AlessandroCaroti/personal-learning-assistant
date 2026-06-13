import { v4 as uuidv4 } from 'uuid'
import type { ExamAttachment } from '../types'

type CreateExamAttachmentInput = {
  data: ArrayBuffer
  name: string
  type: string
  id?: string
  createdAt?: string
}

export function createExamAttachment({
  data,
  name,
  type,
  id = uuidv4(),
  createdAt = new Date().toISOString(),
}: CreateExamAttachmentInput): ExamAttachment {
  return {
    id,
    createdAt,
    name,
    type,
    data,
  }
}

export function sortAttachmentsNewestFirst(attachments: ExamAttachment[]): ExamAttachment[] {
  return [...attachments].sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  })
}

export function removeExamAttachment(
  attachments: ExamAttachment[],
  attachmentId: string,
): ExamAttachment[] {
  return attachments.filter((attachment) => attachment.id !== attachmentId)
}

export function downloadAttachment(attachment: ExamAttachment): void {
  const blob = new Blob([attachment.data], { type: attachment.type })
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = objectUrl
  anchor.download = attachment.name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}
