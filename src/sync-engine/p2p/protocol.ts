import crypto from 'node:crypto'
import type { PeerMessage, FileManifestEntry } from '../../shared/types/peer'

const CHUNK_SIZE = 64 * 1024 // 64KB

export function createMessageId(): string {
  return crypto.randomUUID()
}

export function serializeMessage(msg: PeerMessage): Buffer {
  return Buffer.from(JSON.stringify(msg))
}

export function deserializeMessage(data: Buffer | string): PeerMessage {
  const str = typeof data === 'string' ? data : data.toString('utf-8')
  return JSON.parse(str) as PeerMessage
}

export function splitFileIntoChunks(data: Buffer): Buffer[] {
  const chunks: Buffer[] = []
  for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
    chunks.push(data.subarray(offset, offset + CHUNK_SIZE))
  }
  return chunks
}

export function reassembleChunks(chunks: Buffer[]): Buffer {
  return Buffer.concat(chunks)
}

export function createManifestMessage(
  entries: FileManifestEntry[],
): PeerMessage {
  return {
    type: 'manifest',
    id: createMessageId(),
    payload: entries,
  }
}

export function createFileRequestMessage(relativePath: string): PeerMessage {
  return {
    type: 'file-request',
    id: createMessageId(),
    payload: { relativePath },
  }
}

export function createFileDataMessage(
  requestId: string,
  chunkIndex: number,
  chunk: Buffer,
): PeerMessage {
  return {
    type: 'file-data',
    id: createMessageId(),
    payload: {
      requestId,
      chunkIndex,
      data: chunk.toString('base64'),
    },
  }
}

export function createFileDataEndMessage(
  requestId: string,
  totalChunks: number,
  checksum: string,
): PeerMessage {
  return {
    type: 'file-data-end',
    id: createMessageId(),
    payload: { requestId, totalChunks, checksum },
  }
}

export { CHUNK_SIZE }
