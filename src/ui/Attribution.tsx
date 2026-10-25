import { tRich, type StringKey } from './i18n'

const PRIMER_URL = 'https://github.com/donnemartin/system-design-primer'
const LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/'

/** CC BY 4.0 credit for primer content, as a sentence with links to the primer and the license. */
export function Attribution({ textKey }: { textKey: Extract<StringKey, 'lessonAttribution' | 'siteAttribution'> }) {
  return (
    <>
      {tRich(textKey, {
        primer: (
          <a href={PRIMER_URL} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">
            system-design-primer
          </a>
        ),
        license: (
          <a href={LICENSE_URL} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">
            CC BY 4.0
          </a>
        ),
      })}
    </>
  )
}
