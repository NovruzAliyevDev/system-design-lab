// Authored Challenges: the primer's system design questions, solved Stage by Stage. The Content
// Pipeline validates them when it builds the catalog: a schema error, an unknown Lesson or Solution
// page, or a Reference Solution that fails its own Rules fails the build.
//
// Rule descriptions and Hints are Azerbaijani; component and technical names stay English. Every Rule
// has three Hint tiers: a Socratic question, a concrete pointer and the full explanation. Rules accept
// equivalent designs with `any-of` wherever the primer names an alternative. Reference Solutions mirror
// the primer's diagram for the question, laid out left to right as the canvas connects nodes; config
// fields left out take their defaults.
import type { ChallengeInput } from '../src/core/challenges/challenge'
import type { NodeSelector, Predicate, TrafficKind } from '../src/core/challenges/rules'
import type { ComponentType } from '../src/core/design/components'
import type { EdgeTraffic } from '../src/core/design/design'

/** Whatever sits in front of the application servers and forwards requests to them. */
const ENTRY: NodeSelector = ['web-server', 'reverse-proxy', 'load-balancer']
/** Where the shortlink → paste path mapping lives: the primer's SQL table, or a key-value store. */
const METADATA_STORE: NodeSelector[] = ['sql-database', { component: 'nosql-store', config: { kind: 'key-value' } }]
/** Where paste contents live: an object store, or a NoSQL document store. */
const CONTENT_STORE: NodeSelector[] = ['object-store', { component: 'nosql-store', config: { kind: 'document' } }]

/** Some node matches one of the selectors. */
const anyNode = (selectors: NodeSelector[]): Predicate => ({ type: 'any-of', predicates: selectors.map((selector) => ({ type: 'node', node: selector })) })

/** Client requests carrying `traffic` reach a node of one of the selectors, every path through an application service. */
const apiPath = (selectors: NodeSelector[], traffic: TrafficKind): Predicate => ({
  type: 'any-of',
  predicates: selectors.map((selector) => ({ type: 'path', from: 'client', to: selector, through: 'app-service', traffic })),
})

const node = (id: string, componentType: ComponentType, label: string, x: number, y: number) => ({
  id,
  componentType,
  label,
  notes: '',
  config: {},
  position: { x, y },
})
const edge = (source: string, target: string, traffic: EdgeTraffic) => ({
  id: `${source}->${target}`,
  source,
  target,
  mode: 'sync',
  traffic,
})

export const challenges: ChallengeInput[] = [
  {
    id: 'pastebin',
    title: 'Pastebin.com (və ya Bit.ly) dizayn edin',
    kind: 'architecture',
    source: 'primer',
    solutionId: 'pastebin',
    lessonIds: [
      'design-pastebincom-or-bitly',
      'reverse-proxy-web-server',
      'application-layer',
      'relational-database-management-system-rdbms',
      'nosql',
      'sql-or-nosql',
    ],
    stages: [
      {
        id: 'high-level-design',
        type: 'high-level-design',
        prompt:
          'İstifadəçi mətn yapışdırır və təsadüfi qısa link alır; linki açan hər kəs mətni görür. İstifadəçilər anonimdir, səhifə baxışlarının aylıq statistikası lazımdır (real vaxtda yox), müddəti bitən paste-lər silinir. Ayda 10 milyon yazma və 100 milyon oxuma gözlənilir (10:1). Bütün vacib komponentləri kətana qoyun, sorğuların axınını xətlərlə göstərin və "Yoxla" düyməsini basın.',
        solutionAnchor: 'step-2-create-a-high-level-design',
        rules: [
          {
            id: 'entry-point',
            weight: 2,
            description: 'Client sorğuları tətbiq serverlərinə web server (reverse proxy) və ya load balancer vasitəsilə çatır.',
            hints: [
              'Client sorğusu tətbiq kodunun işlədiyi serverə çatmazdan əvvəl ilk olaraq nəyə dəyir?',
              'Client ilə application service arasına web server, reverse proxy və ya load balancer qoyun: hər sorğu ondan keçsin.',
              'Primer-də Client sorğuları reverse proxy rolunda işləyən Web Server-ə göndərir, o da sorğunu Write API və ya Read API serverinə ötürür. Bu qat SSL, sıxılma və statik məzmunu öz üzərinə götürür və tətbiq serverlərini xaricdən gizlədir. Client-dən application service-ə bu qatdan yan keçən yol olmamalıdır.',
            ],
            check: { type: 'path', from: 'client', to: 'app-service', through: ENTRY },
          },
          {
            id: 'separate-apis',
            weight: 2,
            description: 'Yazma və oxuma ayrı tətbiq servislərindədir: Write API və Read API.',
            hints: [
              'Oxumalar yazmalardan 10 dəfə çoxdur. Hər ikisini eyni server qrupu emal etsə, onları ayrıca miqyaslamaq olarmı?',
              'Kətanda ən azı iki application service olsun: biri paste yaradan Write API, digəri paste-i qaytaran Read API.',
              'Primer Write API və Read API-ni ayırır. Write API unikal link yaradır və paste-i saxlayır, Read API linkə görə paste-i tapıb qaytarır. Ayrı servislər ayrıca miqyaslanır: oxuma yükü artanda yalnız Read API nüsxələri əlavə olunur.',
            ],
            check: { type: 'node', node: 'app-service', min: 2 },
          },
          {
            id: 'metadata-store',
            weight: 2,
            description: 'Qısa linki paste-in yerinə bağlayan cədvəl SQL bazasında (və ya key-value store-da) saxlanılır.',
            hints: [
              'Read API linki aldıqda paste-in harada olduğunu haradan öyrənir? Linkin unikallığını kim yoxlayır?',
              'Linkləri saxlamaq üçün SQL database (və ya key-value tipli NoSQL store) əlavə edin.',
              'Primer relational database-i böyük hash cədvəli kimi işlədir: `pastes` cədvəli shortlink, müddət, yaradılma vaxtı və paste faylının yolunu saxlayır, primary key isə shortlink-in unikallığını təmin edir. Alternativ olaraq key-value NoSQL store da uyğundur: SQL və NoSQL arasındakı trade-off-u müzakirə etmək lazımdır.',
            ],
            check: anyNode(METADATA_STORE),
          },
          {
            id: 'content-store',
            weight: 2,
            description: 'Paste-in mətni object store-da (və ya NoSQL document store-da) saxlanılır.',
            hints: [
              '450 GB-a qədər böyüyən paste mətnlərini harada saxlamaq ən sadədir? Fayl serverini özünüz idarə etmək istəyirsinizmi?',
              'Paste mətnləri üçün object store (məsələn, Amazon S3) və ya document tipli NoSQL store əlavə edin.',
              'Primer fayl serveri idarə etmək əvəzinə Amazon S3 kimi idarə olunan Object Store və ya NoSQL document store təklif edir. Bazada yalnız paste-in yolu (paste_path) qalır, mətnin özü isə object store-dadır.',
            ],
            check: anyNode(CONTENT_STORE),
          },
          {
            id: 'write-path',
            weight: 2,
            description: 'Yazma sorğuları tətbiq servisi vasitəsilə həm link cədvəlinə, həm də paste mətninin anbarına çatır.',
            hints: [
              'Paste yaradılanda iki şey saxlanılmalıdır. Hansılardır və yazma sorğusu onlara hansı yolla çatır?',
              'Write API-dən həm link bazasına, həm də object store-a yazan xətt çəkin. Client bu anbarlara yalnız application service vasitəsilə çatmalıdır.',
              'Primer-də Write API unikal url yaradır, SQL bazasında dublikat yoxlayır, `pastes` cədvəlinə sətir yazır və paste məzmununu Object Store-a saxlayır. Yəni Client → Web Server → Write API → SQL Database və Write API → Object Store yazma yolları olmalıdır, və anbarlara application service-dən yan keçən yol olmamalıdır.',
            ],
            check: { type: 'all-of', predicates: [apiPath(METADATA_STORE, 'write'), apiPath(CONTENT_STORE, 'write')] },
          },
          {
            id: 'read-path',
            weight: 2,
            description: 'Oxuma sorğuları tətbiq servisi vasitəsilə link cədvəlinə və paste mətninin anbarına çatır.',
            hints: [
              'Linki açan istifadəçiyə mətni qaytarmaq üçün Read API nəyi, hansı ardıcıllıqla oxumalıdır?',
              'Read API-dən link bazasına və object store-a oxuyan xətlər çəkin. Xətlərin trafikini "Oxuma" və ya "Oxuma və yazma" seçin.',
              'Primer-də Read API əvvəlcə SQL bazasında url-i yoxlayır; tapılarsa, paste məzmununu Object Store-dan götürür, tapılmazsa səhv qaytarır. Yəni Client → Web Server → Read API → SQL Database və Read API → Object Store oxuma yolları olmalıdır.',
            ],
            check: { type: 'all-of', predicates: [apiPath(METADATA_STORE, 'read'), apiPath(CONTENT_STORE, 'read')] },
          },
          {
            id: 'offline-analytics',
            weight: 1,
            description:
              'Statistikanı sorğu yolundan kənarda işləyən analytics (MapReduce) hesablayır: o, saxlanılan məlumatı özü oxuyur və ya Web Server loglarını asinxron alır.',
            hints: [
              'Aylıq baxış statistikası real vaxtda lazım deyil. Onu hər sorğu zamanı hesablamaq lazımdırmı?',
              'Analytics / MapReduce komponenti əlavə edin. Ya ondan saxlanılan məlumata (object store və ya baza) xətt çəkin və onu Client-in sorğu yolundan kənarda saxlayın, ya da Web Server-dən ona asinxron xətt çəkin.',
              'Primer-ə görə analytics real vaxtda olmadığı üçün Web Server loglarını MapReduce ilə emal edib baxış saylarını hesablamaq kifayətdir. Diaqramda Analytics Object Store-dakı loglardan və SQL bazasından oxuyur; Client sorğuları ona heç vaxt çatmır. Loglar Web Server-dən göndərilirsə, bu, asinxron olmalıdır: sorğu analytics-i gözləməməlidir, ona görə statistika sorğuların gecikməsini artırmır.',
            ],
            check: {
              type: 'any-of',
              predicates: [
                // Analytics pulls stored data and is never reached by requests.
                {
                  type: 'all-of',
                  predicates: [
                    { type: 'edge', from: 'analytics', to: ['object-store', 'sql-database', 'nosql-store'] },
                    { type: 'not', predicate: { type: 'path', from: 'client', to: 'analytics' } },
                  ],
                },
                // Logs are pushed to analytics without the request waiting for it.
                { type: 'edge-mode', from: ['web-server', 'object-store', 'sql-database', 'nosql-store'], to: 'analytics', mode: 'async' },
              ],
            },
          },
          {
            id: 'all-connected',
            weight: 1,
            description: 'Dizaynda kənarda qalan, heç nəyə bağlı olmayan komponent yoxdur.',
            hints: [
              'Kətandakı hər komponent nə üçündür? Onlardan hansısa heç bir məlumat axınında iştirak etmirmi?',
              'Hər komponenti ən azı bir xətlə dizaynın qalanına bağlayın və ya artıq olanı silin.',
              'Bağlantısı olmayan komponent sistemdə heç bir iş görmür: ona sorğu gəlmir və o, heç nəyi oxumur. Ya onun rolunu xətlərlə göstərin (məsələn, Analytics → Object Store), ya da onu silin.',
            ],
            check: { type: 'custom', name: 'all-connected' },
          },
        ],
        referenceSolution: {
          nodes: [
            node('client-1', 'client', 'Client', 0, 160),
            node('web-server-1', 'web-server', 'Web Server', 240, 160),
            node('app-service-1', 'app-service', 'Write API', 480, 40),
            node('app-service-2', 'app-service', 'Read API', 480, 240),
            node('analytics-1', 'analytics', 'Analytics', 480, 440),
            node('sql-database-1', 'sql-database', 'SQL', 760, 120),
            node('object-store-1', 'object-store', 'Object Store', 760, 340),
          ],
          edges: [
            edge('client-1', 'web-server-1', 'both'),
            edge('web-server-1', 'app-service-1', 'write'),
            edge('web-server-1', 'app-service-2', 'read'),
            edge('app-service-1', 'sql-database-1', 'write'),
            edge('app-service-1', 'object-store-1', 'write'),
            edge('app-service-2', 'sql-database-1', 'read'),
            edge('app-service-2', 'object-store-1', 'read'),
            edge('analytics-1', 'object-store-1', 'read'),
            edge('analytics-1', 'sql-database-1', 'read'),
          ],
        },
      },
    ],
  },
]
