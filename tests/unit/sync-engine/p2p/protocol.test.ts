import { describe, it, expect } from 'vitest'
import {
  serializeMessage,
  deserializeMessage,
  splitFileIntoChunks,
  reassembleChunks,
  createManifestMessage,
  createFileRequestMessage,
  createFileDataMessage,
  createFileDataEndMessage,
  createFolderConfigMessage,
  CHUNK_SIZE,
} from '../../../../src/sync-engine/p2p/protocol'
import type { PeerMessage, FileManifestEntry, FolderConfigPayload } from '../../../../src/shared/types/peer'

describe('protocol', () => {
  describe('serializeMessage / deserializeMessage', () => {
    it('should round-trip a message', () => {
      const msg: PeerMessage = {
        type: 'manifest',
        id: 'test-id',
        payload: { files: ['a.txt'] },
      }
      const buf = serializeMessage(msg)
      const result = deserializeMessage(buf)
      expect(result).toEqual(msg)
    })

    it('should handle string input', () => {
      const msg: PeerMessage = { type: 'ack', id: 'abc', payload: null }
      const json = JSON.stringify(msg)
      const result = deserializeMessage(json)
      expect(result).toEqual(msg)
    })
  })

  describe('splitFileIntoChunks / reassembleChunks', () => {
    it('should split and reassemble a small file', () => {
      const data = Buffer.from('Hello, World!')
      const chunks = splitFileIntoChunks(data)
      expect(chunks).toHaveLength(1)
      const reassembled = reassembleChunks(chunks)
      expect(reassembled).toEqual(data)
    })

    it('should split a file larger than chunk size', () => {
      const data = Buffer.alloc(CHUNK_SIZE * 2 + 100, 42)
      const chunks = splitFileIntoChunks(data)
      expect(chunks).toHaveLength(3)
      expect(chunks[0]).toHaveLength(CHUNK_SIZE)
      expect(chunks[1]).toHaveLength(CHUNK_SIZE)
      expect(chunks[2]).toHaveLength(100)
      const reassembled = reassembleChunks(chunks)
      expect(reassembled).toEqual(data)
    })

    it('should handle exact chunk boundary', () => {
      const data = Buffer.alloc(CHUNK_SIZE * 3, 99)
      const chunks = splitFileIntoChunks(data)
      expect(chunks).toHaveLength(3)
      const reassembled = reassembleChunks(chunks)
      expect(reassembled).toEqual(data)
    })

    it('should handle empty buffer', () => {
      const data = Buffer.alloc(0)
      const chunks = splitFileIntoChunks(data)
      expect(chunks).toHaveLength(0)
      const reassembled = reassembleChunks(chunks)
      expect(reassembled).toEqual(data)
    })
  })

  describe('message factory functions', () => {
    it('should create a manifest message', () => {
      const entries: FileManifestEntry[] = [
        { relativePath: 'test.txt', size: 100, modifiedAt: Date.now(), checksum: 'abc', clock: { dev1: 1 } },
      ]
      const msg = createManifestMessage(entries)
      expect(msg.type).toBe('manifest')
      expect(msg.id).toBeTruthy()
      expect(msg.payload).toEqual(entries)
    })

    it('should create a file request message', () => {
      const msg = createFileRequestMessage('docs/readme.md')
      expect(msg.type).toBe('file-request')
      const payload = msg.payload as { relativePath: string; syncRoot?: string }
      expect(payload.relativePath).toBe('docs/readme.md')
    })

    it('should create a file request message with syncRoot', () => {
      const msg = createFileRequestMessage('docs/readme.md', '/sync/root')
      expect(msg.type).toBe('file-request')
      const payload = msg.payload as { relativePath: string; syncRoot?: string }
      expect(payload.relativePath).toBe('docs/readme.md')
      expect(payload.syncRoot).toBe('/sync/root')
    })

    it('should create file data messages', () => {
      const chunk = Buffer.from('some data')
      const msg = createFileDataMessage('req-1', 0, chunk)
      expect(msg.type).toBe('file-data')
      const payload = msg.payload as { requestId: string; chunkIndex: number; data: string }
      expect(payload.requestId).toBe('req-1')
      expect(payload.chunkIndex).toBe(0)
      expect(Buffer.from(payload.data, 'base64').toString()).toBe('some data')
    })

    it('should create file data end message', () => {
      const msg = createFileDataEndMessage('req-1', 3, 'sha256hash')
      expect(msg.type).toBe('file-data-end')
      const payload = msg.payload as { requestId: string; totalChunks: number; checksum: string }
      expect(payload.totalChunks).toBe(3)
      expect(payload.checksum).toBe('sha256hash')
    })

    it('should create a folder config message', () => {
      const folders = ['/path/to/folder1', '/path/to/folder2']
      const msg = createFolderConfigMessage(folders, 'full-sync')
      expect(msg.type).toBe('folder-config')
      expect(msg.id).toBeTruthy()
      const payload = msg.payload as FolderConfigPayload
      expect(payload.folders).toEqual(folders)
      expect(payload.action).toBe('full-sync')
    })

    it('should create a folder config message with add action', () => {
      const msg = createFolderConfigMessage(['/new/folder'], 'add')
      const payload = msg.payload as FolderConfigPayload
      expect(payload.action).toBe('add')
      expect(payload.folders).toEqual(['/new/folder'])
    })

    it('should create a folder config message with remove action', () => {
      const msg = createFolderConfigMessage(['/old/folder'], 'remove')
      const payload = msg.payload as FolderConfigPayload
      expect(payload.action).toBe('remove')
      expect(payload.folders).toEqual(['/old/folder'])
    })

    it('should include syncRoot in manifest entries', () => {
      const entries: FileManifestEntry[] = [
        { relativePath: 'test.txt', size: 100, modifiedAt: Date.now(), checksum: 'abc', clock: { dev1: 1 }, syncRoot: '/sync/root' },
      ]
      const msg = createManifestMessage(entries)
      const payload = msg.payload as FileManifestEntry[]
      expect(payload[0].syncRoot).toBe('/sync/root')
    })
  })
})
