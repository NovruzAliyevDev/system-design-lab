import { isImagePath } from './links'

/**
 * Checks the authored image mirrors: image URLs used in primer text → the same image in the primer
 * repo, so it is served with the site and works offline.
 */
export function validateImageMirrors(input: unknown): { mirrors: Record<string, string>; problems: string[] } {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { mirrors: {}, problems: ['Image mirrors: must map image URLs to primer paths'] }
  }
  const mirrors: Record<string, string> = {}
  const problems: string[] = []
  for (const [url, path] of Object.entries(input)) {
    if (typeof path === 'string' && isImagePath(path) && !path.startsWith('/') && !path.split('/').includes('..')) {
      mirrors[url] = path
    } else {
      problems.push(`Image mirror "${url}": must be the path of an image in the primer`)
    }
  }
  return { mirrors, problems }
}
