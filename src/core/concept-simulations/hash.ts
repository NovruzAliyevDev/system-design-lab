/**
 * A 32-bit hash of a string, spread evenly: FNV-1a, then Murmur3's finaliser, since FNV alone puts
 * strings that differ only at the end (`node-a#1`, `node-a#2`) close together.
 */
export function hash32(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  hash ^= hash >>> 16
  hash = Math.imul(hash, 0x85ebca6b)
  hash ^= hash >>> 13
  hash = Math.imul(hash, 0xc2b2ae35)
  hash ^= hash >>> 16
  return hash >>> 0
}
