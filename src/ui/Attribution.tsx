import type { ReactNode } from 'react'
import { tRich, type StringKey } from './i18n'

const PRIMER_URL = 'https://github.com/donnemartin/system-design-primer'
const LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/'

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">
      {children}
    </a>
  )
}

/** CC BY 4.0 credit for primer content, as a sentence with links to the primer and the license. */
export function Attribution({ textKey }: { textKey: Extract<StringKey, 'lessonAttribution' | 'siteAttribution'> }) {
  // The project and license names are proper names, the same in every UI language.
  return (
    <>
      {tRich(textKey, {
        primer: <ExternalLink href={PRIMER_URL}>system-design-primer</ExternalLink>,
        license: <ExternalLink href={LICENSE_URL}>CC BY 4.0</ExternalLink>,
      })}
    </>
  )
}
