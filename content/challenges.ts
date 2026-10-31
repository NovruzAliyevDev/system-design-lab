// Authored Challenges: the primer's system design questions, solved Stage by Stage in interview
// order: requirements, estimation, high-level design, deep dive and scaling. The Content Pipeline
// validates them when it builds the catalog: a schema error, an unknown Lesson or Solution page, or a
// Reference Solution that fails its own Rules fails the build.
//
// Rule descriptions and Hints are Azerbaijani; component and technical names stay English. Every Rule
// has three Hint tiers: a Socratic question, a concrete pointer and the full explanation. Rules accept
// equivalent designs with `any-of` wherever the primer names an alternative. Reference Solutions mirror
// the primer's diagram for the question, laid out left to right as the canvas connects nodes; config
// fields left out take their defaults. Estimation reference values are computed from the Stage's
// inputs, the primer's assumptions; requirement items and deep-dive options are each explained.
//
// Pastebin is authored here; the other primer questions each have a file in `primer-challenges/`,
// sharing the building blocks of `primer-challenges/shared.ts`.
import type { ChallengeInput } from '../src/core/challenges/challenge'
import type { NodeSelector, Predicate } from '../src/core/challenges/rules'
import { mint } from './primer-challenges/mint'
import { anyNode, apiPath, edge, ENTRY, loadBalancerPath, node, readReplicas, scaledOut } from './primer-challenges/shared'
import { socialGraph } from './primer-challenges/social-graph'
import { twitter } from './primer-challenges/twitter'
import { webCrawler } from './primer-challenges/web-crawler'

/** Where the shortlink → paste path mapping lives: the primer's SQL table, or a key-value store. */
const METADATA_STORE: NodeSelector[] = ['sql-database', { component: 'nosql-store', config: { kind: 'key-value' } }]
/** Where paste contents live: an object store, or a NoSQL document store. */
const CONTENT_STORE: NodeSelector[] = ['object-store', { component: 'nosql-store', config: { kind: 'document' } }]

/** A store holding the shortlink table that serves reads from replicas: a replica node, or a primary configured with replicas. */
const READ_REPLICAS: Predicate = { type: 'any-of', predicates: [...readReplicas('sql-database'), ...readReplicas('nosql-store')] }

/** The primary holding the shortlink table: the SQL master, or a key-value store's primary. */
const METADATA_PRIMARY: NodeSelector[] = [
  { component: 'sql-database', config: { role: 'primary' } },
  { component: 'nosql-store', config: { kind: 'key-value', role: 'primary' } },
]

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
    // The primer's average traffic: 100 million reads and 10 million writes a month, about 1 KB each.
    loadProfile: { readQps: 40, writeQps: 4, requestBytes: 1_000 },
    stages: [
      {
        id: 'requirements',
        type: 'requirements',
        weight: 1,
        prompt:
          'Pastebin.com (və ya Bit.ly) kimi servis dizayn edin: istifadəçi mətn yapışdırır və onu paylaşmaq üçün qısa link alır. Müsahibədə ilk addım məsələni daraltmaqdır. Aşağıdakılardan bu tapşırığa aid olan istifadə hallarını (use case) və məhdudiyyətləri seçin, kənarda qalanları seçməyin. Fikirlərinizi qeydlərə yaza bilərsiniz.',
        solutionAnchor: 'step-1-outline-use-cases-and-constraints',
        items: [
          {
            section: 'use-case',
            text: 'İstifadəçi mətn blokunu daxil edir və təsadüfi yaradılmış link alır',
            correct: true,
            explanation: 'Servisin əsas yazma ssenarisi: paste yaradılır və ona unikal qısa link verilir.',
          },
          {
            section: 'use-case',
            text: 'Paste susmaya görə müddətsizdir, amma istəyə görə müddət təyin etmək olar',
            correct: true,
            explanation: 'Primer müddəti (expiration) əsas tələblərə daxil edir: susmaya görə paste silinmir, istifadəçi müddət seçə bilər.',
          },
          {
            section: 'use-case',
            text: 'İstifadəçi paste-in linkini açır və məzmununu görür',
            correct: true,
            explanation: 'Servisin əsas oxuma ssenarisi; oxumalar yazmalardan 10 dəfə çoxdur.',
          },
          {
            section: 'use-case',
            text: 'İstifadəçi anonimdir',
            correct: true,
            explanation: 'Hesab və giriş olmadığı üçün istifadəçi cədvəli, autentifikasiya və icazələr dizayndan çıxır.',
          },
          {
            section: 'use-case',
            text: 'Servis səhifələrin aylıq baxış statistikasını toplayır',
            correct: true,
            explanation: 'Primer analytics-i tələblərə daxil edir, amma yalnız aylıq statistikanı: bu, onu offline hesablamağa imkan verir.',
          },
          {
            section: 'use-case',
            text: 'Servis müddəti bitmiş paste-ləri silir',
            correct: true,
            explanation: 'Müddət seçilə bildiyi üçün müddəti keçmiş paste-ləri təmizləyən bir proses lazımdır.',
          },
          {
            section: 'use-case',
            text: 'Servis yüksək əlçatanlığa (high availability) malikdir',
            correct: true,
            explanation: 'Primer bunu servisin tələbi kimi qeyd edir; Scaling mərhələsində replikalar və bir neçə server nüsxəsi buna xidmət edir.',
          },
          {
            section: 'use-case',
            text: 'İstifadəçi hesab yaradır və e-poçtunu təsdiqləyir',
            explanation: 'Primer qeydiyyatı açıq şəkildə kənarda saxlayır: istifadəçilər anonimdir.',
          },
          {
            section: 'use-case',
            text: 'İstifadəçi paste-i sonradan redaktə edir',
            explanation: 'Redaktə yalnız qeydiyyatlı istifadəçilər üçün mənalıdır və primer onu kənarda saxlayır; paste-lər dəyişməz qalır, bu da cache-i sadələşdirir.',
          },
          {
            section: 'use-case',
            text: 'İstifadəçi paste-in görünürlüyünü (public/private) seçir',
            explanation: 'Primer görünürlük seçimini kənarda saxlayır: linki bilən hər kəs paste-i görür.',
          },
          {
            section: 'use-case',
            text: 'İstifadəçi qısa linki özü seçir',
            explanation: 'Xüsusi link primer-də kənarda qalır; link təsadüfi yaradılır. Dəstəklənsəydi, dublikatı bazada yoxlamaq kifayət edərdi.',
          },
          {
            section: 'constraint',
            text: 'Trafik zaman üzrə bərabər paylanmayıb',
            correct: true,
            explanation: 'Pik anlarda yük ortalamadan çox olur; Scaling mərhələsində cache və bir neçə server nüsxəsi bunu udur.',
          },
          {
            section: 'constraint',
            text: 'Qısa linkin açılması sürətli olmalıdır',
            correct: true,
            explanation: 'Oxuma yolu gecikməyə həssasdır: shortlink üzrə indeks və populyar paste-lər üçün yaddaş cache-i buna görədir.',
          },
          {
            section: 'constraint',
            text: 'Paste-lər yalnız mətndir',
            correct: true,
            explanation: 'Paste kiçikdir (təxminən 1 KB), bu da yaddaş və bandwidth hesablamalarını sadələşdirir.',
          },
          {
            section: 'constraint',
            text: 'Baxış statistikası real vaxtda olmalı deyil',
            correct: true,
            explanation: 'Buna görə statistika Web Server loglarından MapReduce ilə offline hesablanır və sorğu yolunu ləngitmir.',
          },
          {
            section: 'constraint',
            text: '10 milyon istifadəçi, ayda 10 milyon yazma və 100 milyon oxuma (10:1)',
            correct: true,
            explanation: 'Primer-in fərziyyələri: estimation mərhələsindəki hesablamalar bu rəqəmlərdən başlayır.',
          },
          {
            section: 'constraint',
            text: 'Baxış statistikası hər açılışda real vaxtda yenilənməlidir',
            explanation: 'Primer əksini fərz edir: aylıq statistika kifayətdir, real vaxt tələbi yoxdur.',
          },
          {
            section: 'constraint',
            text: 'Paste-lərə şəkil və video da yüklənə bilər',
            explanation: 'Paste-lər yalnız mətndir; media faylları ölçü hesablamalarını və saxlama dizaynını tamam dəyişərdi.',
          },
          {
            section: 'constraint',
            text: 'Yazmalar oxumalardan çoxdur',
            explanation: 'Əksinədir: oxuma:yazma nisbəti 10:1-dir, ona görə oxuma yolu ayrıca miqyaslanır.',
          },
        ],
      },
      {
        id: 'estimation',
        type: 'estimation',
        weight: 1,
        prompt:
          'Fərziyyələr: ayda 10 milyon paste yazılır və 100 milyon dəfə oxunur. Hər paste 1 KB məzmun və bazada bu sahələrdir: shortlink 7 bayt, expiration_length_in_minutes 4 bayt, created_at 5 bayt, paste_path 255 bayt. Məlumat 3 il saxlanılır. Primer-in yuvarlaq çevirmələrini işlədin: ayda 2,5 milyon saniyə, 1 KB = min bayt. Cavablar referansın 2 qatı daxilində olsa qəbul olunur.',
        solutionAnchor: 'calculate-usage',
        explanation:
          'Bir paste-in ölçüsü: 1 KB məzmun + 7 + 4 + 5 + 255 bayt ≈ 1,27 KB. Primer-in "Handy conversion guide"-ına görə ayda təxminən 2,5 milyon saniyə var, yəni saniyədə 1 sorğu ayda 2,5 milyon sorğu deməkdir. Ölçü vahidləri powers of two cədvəlindəki kimidir: 2^10 bayt təxminən min bayt (1 KB), 2^20 təxminən milyon (1 MB) və s.',
        // A write stores the content and its row; a read returns the content.
        inputs: { writesPerMonth: 10_000_000, readsPerMonth: 100_000_000, bytesPerWrite: 1_000 + 7 + 4 + 5 + 255, bytesPerRead: 1_000, years: 3 },
        questions: [
          { id: 'write-qps', quantity: 'writeQps', prompt: 'Orta hesabla saniyədə neçə paste yazılır?' },
          { id: 'read-qps', quantity: 'readQps', prompt: 'Orta hesabla saniyədə neçə oxuma sorğusu gəlir?' },
          { id: 'storage-per-year', quantity: 'storagePerYear', prompt: 'Bir ildə nə qədər yeni paste məlumatı yığılır?' },
          { id: 'storage-3-years', quantity: 'storageTotal', prompt: '3 ildə nə qədər paste məlumatı yığılır?' },
          { id: 'read-bandwidth', quantity: 'readBandwidth', prompt: 'Oxumalar saniyədə orta hesabla nə qədər məlumat qaytarır (bandwidth)?' },
        ],
      },
      {
        id: 'high-level-design',
        type: 'high-level-design',
        weight: 3,
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
      {
        id: 'deep-dive',
        type: 'deep-dive',
        weight: 2,
        prompt: 'Əsas komponentlərin detallarına keçin. Hər sual üçün seçiminizi edin: bitirdikdən sonra hər variantın trade-off-u izah olunacaq.',
        solutionAnchor: 'step-3-design-core-components',
        questions: [
          {
            type: 'multi-select',
            prompt: 'Qısa linki paste-in yerinə bağlayan cədvəl üçün hansı anbarlar uyğundur?',
            options: [
              {
                text: 'Relational database (SQL), shortlink sütunu primary key olmaqla',
                correct: true,
                explanation: 'Primer SQL bazasını böyük hash cədvəli kimi işlədir: primary key shortlink-in unikallığını təmin edir və indeks axtarışı log-time edir.',
              },
              {
                text: 'NoSQL key-value store',
                correct: true,
                explanation: 'Primer bunu alternativ kimi göstərir: açar shortlink, dəyər paste-in yolu və metadata. Join və mürəkkəb sorğu lazım deyil, ona görə key-value rahat miqyaslanır.',
              },
              {
                text: 'Graph database',
                explanation: 'Paste-lər arasında əlaqə yoxdur; graph database-in güclü tərəfi (əlaqələr üzrə gəzmək) burada işə yaramır.',
              },
              {
                text: 'Message queue',
                explanation: 'Queue məlumatı müvəqqəti ötürmək üçündür, açar üzrə axtarış üçün deyil: oxuma linkə görə paste-i dərhal tapmalıdır.',
              },
            ],
          },
          {
            type: 'multiple-choice',
            prompt: 'Paste-in mətnini harada saxlamaq ən sadədir?',
            options: [
              {
                text: 'Amazon S3 kimi idarə olunan Object Store-da, bazada isə yalnız paste_path',
                correct: true,
                explanation: 'Primer fayl serveri idarə etmək əvəzinə idarə olunan Object Store təklif edir: ayda 12,7 GB-ı rahat udur, baza isə kiçik və sürətli qalır.',
              },
              {
                text: 'SQL bazasında BLOB sütunu kimi',
                explanation: 'Mümkündür, amma baza 450 GB-a qədər böyüyür, cache-ə və yaddaşa sığmır; link axtarışı ilə məzmunu ayırmaq bazanı yüngül saxlayır.',
              },
              {
                text: 'Web Server-in lokal diskində',
                explanation: 'Server sıradan çıxanda məlumat itir və başqa serverlər onu görmür: bir neçə server nüsxəsinə keçəndə bu işləmir.',
              },
            ],
          },
          {
            type: 'multiple-choice',
            prompt: 'Unikal qısa link necə yaradılır?',
            options: [
              {
                text: 'MD5(ip_address + timestamp) hash-i Base 62 ilə kodlanır, ilk 7 simvol götürülür, dublikat bazada yoxlanılır',
                correct: true,
                explanation: 'Primer-in yolu: MD5 bərabər paylanır, Base 62 url-ə uyğun simvollar verir, toqquşma olsa yeni link yaradılır.',
              },
              {
                text: 'Hash Base 64 ilə kodlanır',
                explanation: 'Base 64-ün + və / simvolları url-də escape tələb edir; Base 62 yalnız [a-zA-Z0-9] işlədir.',
              },
              {
                text: 'Ardıcıl auto-increment id olduğu kimi göstərilir',
                explanation: 'Ardıcıl linklər təxmin edilə bilir: linki bilən hər kəs paste-i görür, ona görə qonşu paste-ləri tapmaq asan olardı. Tələb təsadüfi linkdir.',
              },
            ],
          },
          {
            type: 'multiple-choice',
            prompt: '7 simvollu Base 62 link 3 ildə yaranacaq 360 milyon link üçün kifayətdirmi?',
            options: [
              {
                text: 'Bəli: 62^7 ≈ 3,5 trilyon mümkün dəyər var',
                correct: true,
                explanation: '62^7 ≈ 3,5 × 10^12 dəyər 3,6 × 10^8 linkdən min dəfələrlə çoxdur, ona görə toqquşmalar nadir olur.',
              },
              {
                text: 'Xeyr: ən azı 10 simvol lazımdır',
                explanation: 'Hesablama bunu göstərmir: 62^7 artıq tələb olunandan təxminən 10 000 dəfə çoxdur.',
              },
            ],
          },
          {
            type: 'multiple-choice',
            prompt: 'Aylıq baxış statistikası necə hesablanmalıdır?',
            options: [
              {
                text: 'Web Server loglarını MapReduce ilə offline emal etməklə',
                correct: true,
                explanation: 'Statistika real vaxtda lazım olmadığı üçün primer logları MapReduce ilə (ay, url) üzrə sayır; sorğu yolu heç nə gözləmir.',
              },
              {
                text: 'Hər oxumada SQL bazasında sayğacı artırmaqla',
                explanation: 'Hər oxuma bir yazmaya çevrilir: 40 oxuma/san bazaya 40 yazma/san əlavə edir və populyar paste-lərin sətirləri üçün rəqabət yaranır.',
              },
              {
                text: 'Stream processing ilə real vaxtda',
                explanation: 'İşləyər, amma tələb olunmayan mürəkkəblik və xərcdir: aylıq statistika üçün batch emal kifayətdir.',
              },
            ],
          },
          {
            type: 'multiple-choice',
            prompt: 'Müddəti bitmiş paste-lər necə silinir?',
            options: [
              {
                text: 'Bazanı mütəmadi skan edib müddəti keçmiş sətirləri silmək və ya expired kimi işarələmək',
                correct: true,
                explanation: 'Primer məhz bunu təklif edir; created_at üzrə indeks skanı sürətləndirir.',
              },
              {
                text: 'Hər paste üçün yaradılanda ayrıca taymer işə salmaq',
                explanation: 'Milyonlarla taymeri yaddaşda saxlamaq etibarsızdır: server yenidən başlayanda taymerlər itir.',
              },
            ],
          },
          {
            type: 'multiple-choice',
            prompt: 'Populyar paste-lər üçün yaddaş cache-i hansı strategiya ilə doldurulmalıdır?',
            options: [
              {
                text: 'Cache-aside: Read API əvvəl cache-ə baxır, tapmasa bazadan oxuyub cache-ə yazır',
                correct: true,
                explanation: 'Cache-də yalnız həqiqətən oxunan paste-lər olur; paste-lər dəyişmədiyi üçün köhnəlmiş məlumat problemi demək olar ki, yoxdur.',
              },
              {
                text: 'Write-through: hər yeni paste dərhal cache-ə də yazılır',
                explanation: 'Paste-lərin çoxu nadir oxunur; hamısını cache-ə yazmaq yaddaşı soyuq məlumatla doldurur və yazmanı ləngidir.',
              },
              {
                text: 'Write-behind: paste əvvəl cache-ə yazılır, bazaya sonra asinxron',
                explanation: 'Cache sıradan çıxsa təsdiqlənmiş paste-lər itə bilər; yazmalar az olduğu üçün bu riskə dəyməz.',
              },
            ],
          },
        ],
      },
      {
        id: 'scaling',
        type: 'scaling',
        weight: 3,
        prompt:
          'Yüksək səviyyəli dizaynınızdan davam edin və onu məhdudiyyətlərə görə miqyaslayın: trafik qeyri-bərabərdir və pik anlarda çoxalır, oxumalar yazmalardan 10 dəfə çoxdur, populyar paste-lər təkrar-təkrar açılır, statistika ayrıca analitik bazada saxlanılmalıdır. Dizayn pik yükə dözməlidir: saniyədə 1000 oxuma və 100 yazma altında oxumanın və yazmanın orta gecikməsi 200 ms-i keçməməli, heç bir node həddən artıq yüklənməməli və heç bir sorğu xəta ilə bitməməlidir. Xaos tapşırığı: link bazasının primary-si sıradan çıxanda oxumalar xətasız davam etməlidir. Bunu trafik simulyasiyası ilə yoxlayın. Darboğazları tapın, komponent əlavə edin və ya dəyişin, "Yoxla" düyməsini basın.',
        solutionAnchor: 'step-4-scale-the-design',
        // An authored peak, not the primer's: 25 times its average, keeping the 10:1 read/write mix.
        loadProfile: { readQps: 1_000, writeQps: 100, requestBytes: 1_000 },
        chaosTasks: [
          {
            id: 'primary-db-down',
            prompt: 'Link bazasının primary-si sıradan çıxıb: oxumalar xətasız işləməyə davam etməlidir.',
            scenario: { type: 'node-down', nodes: METADATA_PRIMARY },
          },
        ],
        rules: [
          {
            id: 'peak-load',
            weight: 3,
            description: 'Pik yükdə (saniyədə 1000 oxuma, 100 yazma) orta gecikmə 200 ms-dən çox deyil, həddən artıq yüklənən node və xəta yoxdur.',
            hints: [
              'Saniyədə 1000 oxuma gələndə dizaynınızın hansı node-u ilk tıxanır?',
              'Trafik simulyasiyasını işə salın və "Darboğazlar" siyahısına baxın. Ən çox yüklənən node-un "instances" sahəsini artırın və ya yükü cache, CDN və read replica-larla ondan götürün.',
              'Hər node bir nüsxədə məhdud sorğu emal edir; yük tutumu keçəndə node həddən artıq yüklənir, artıq sorğular atılır, gecikmə kəskin artır. Pik yükdə web server-lər və Read API kimi stateless serverlər horizontal miqyaslanır, populyar paste-lər cache-dən verilir, cache-də olmayan oxumalar read replica-lara gedir, paste mətni isə bir neçə nüsxəli Object Store-dan oxunur.',
            ],
            check: { type: 'simulation', maxLatencyMs: { read: 200, write: 200 }, maxOverloadedNodes: 0, maxErrorRate: 0 },
          },
          {
            id: 'primary-db-down',
            weight: 2,
            description: 'Link bazasının primary-si sıradan çıxanda pik yükdə oxumalar xətasız davam edir.',
            hints: [
              'Yazmaları qəbul edən baza birdən sıradan çıxsa, istifadəçilər paste-ləri hələ də oxuya bilərmi?',
              'Trafik simulyasiyasında "Xaos ssenarisi" siyahısından bu tapşırığı seçin və qırmızı oxuma yollarına baxın. Read API link oxumalarını primary-dən yox, read replica-dan almalıdır.',
              'Primer master-slave replication-da master sıradan çıxanda sistemin, slave master-ə yüksəldilənə qədər, yalnız oxuma rejimində işləyə bildiyini deyir. Oxumalar read replica-lara gedirsə (ayrıca replica node-u, ya da primary-nin "replicas" sahəsi), primary-nin itməsi yalnız yazmaları dayandırır; oxumalar primary-dən keçirsə, onlar da xəta ilə bitir.',
            ],
            check: { type: 'simulation', chaos: 'primary-db-down', maxErrorRate: { read: 0 } },
          },
          {
            id: 'load-balancer',
            weight: 2,
            description: 'Client sorğuları tətbiq serverlərinə load balancer vasitəsilə çatır.',
            hints: [
              'Bir web server pik yükü daşıya bilməsə, sorğuları bir neçə serverə kim paylayacaq?',
              'Client ilə web server arasına load balancer qoyun ki, tətbiq serverlərinə gedən hər yol ondan keçsin.',
              'Primer-in miqyaslanmış diaqramında Client sorğuları Load Balancer-ə göndərir, o da onları bir neçə Web Server arasında paylayır. Bu, həm yükü bölür, həm də bir serverin sıradan çıxması servisi dayandırmır.',
            ],
            check: loadBalancerPath,
          },
          {
            id: 'scale-out',
            weight: 2,
            description: 'Web server və tətbiq servisləri üfüqi miqyaslanıb: hər biri bir neçə nüsxədə işləyir.',
            hints: [
              'Load balancer arxasında yalnız bir server nüsxəsi olsa, nə qazanırsınız?',
              'Web server-in və hər application service-in tənzimləməsində "instances" sahəsini 2 və ya daha çox edin.',
              'Primer horizontal scaling-i seçir: eyni serverin bir neçə nüsxəsi load balancer arxasında işləyir. Write API və Read API ayrıca miqyaslanır: oxuma yükü artanda yalnız Read API nüsxələri artırılır.',
            ],
            check: scaledOut,
          },
          {
            id: 'memory-cache',
            weight: 2,
            description: 'Read API populyar paste-ləri yaddaş cache-indən oxuyur.',
            hints: [
              'Eyni populyar paste min dəfə açılanda hər dəfə bazaya getmək lazımdırmı?',
              'Read API-dən cache komponentinə oxuma xətti çəkin.',
              'Primer-ə görə populyar məzmunun trafiki bazaya yox, Memory Cache-ə getməlidir. Cache qeyri-bərabər trafikə və qəfil sıçrayışlara qarşı da bufer olur; cache-də olmayan sorğuları read replica-lar emal edir.',
            ],
            check: { type: 'edge', from: 'app-service', to: 'cache', traffic: 'read' },
          },
          {
            id: 'read-replicas',
            weight: 2,
            description: 'Link cədvəlinin oxumaları read replica-lara gedir.',
            hints: [
              'Oxumalar yazmalardan 10 dəfə çoxdur. Hər ikisini bir baza serveri emal etməlidirmi?',
              'Ya "replica" rolunda ikinci SQL database əlavə edib Read API-dən ona oxuma xətti çəkin, ya da primary bazanın "replicas" sahəsini 1 və ya daha çox edin.',
              'Primer master-slave replication işlədir: yazmalar SQL Write Master-Slave-ə, oxumalar (cache-də olmayanlar) SQL Read Replicas-a gedir. Replikalar yazmaların replikasiyası ilə yüklənmədikcə cache miss-ləri rahat emal edir.',
            ],
            check: READ_REPLICAS,
          },
          {
            id: 'requests-through-apis',
            weight: 2,
            description: 'Yazmalar və link oxumaları anbarlara yalnız tətbiq servisləri vasitəsilə çatır; Read API paste mətnini anbardan oxuyur.',
            hints: [
              'Yeni komponentlər əlavə edəndə yazma və oxuma yolları hələ də Write API və Read API-dən keçirmi?',
              'Write API-dən link bazasına və paste anbarına yazma, Read API-dən link bazasına və paste anbarına oxuma xətləri saxlayın. Client anbarlara tətbiq servisindən yan keçərək yaza bilməməlidir.',
              'Miqyaslanmış diaqramda da Write API SQL Write Master-Slave-ə və Object Store-a yazır, Read API isə SQL Read Replicas-dan, Memory Cache-dən və Object Store-dan oxuyur. Yalnız CDN statik məzmunu Object Store-dan birbaşa götürür.',
            ],
            check: {
              type: 'all-of',
              predicates: [
                apiPath(METADATA_STORE, 'write'),
                apiPath(CONTENT_STORE, 'write'),
                apiPath(METADATA_STORE, 'read'),
                { type: 'any-of', predicates: CONTENT_STORE.map((store) => ({ type: 'edge', from: 'app-service', to: store, traffic: 'read' })) },
              ],
            },
          },
          {
            id: 'cdn',
            weight: 1,
            description: 'Client statik məzmunu CDN-dən alır.',
            hints: [
              'Bütün istifadəçilərə eyni olan statik fayllar (JS, CSS) hər dəfə serverlərinizdən verilməlidirmi?',
              'CDN komponenti əlavə edin, Client-dən ona və ondan Object Store-a xətt çəkin.',
              'Primer-in diaqramında Client statik məzmunu CDN-dən alır, CDN isə onu Object Store-dan götürür. Bu, serverlərin yükünü azaldır və məzmunu istifadəçiyə yaxın verir.',
            ],
            check: { type: 'edge', from: 'client', to: 'cdn' },
          },
          {
            id: 'dns',
            weight: 1,
            description: 'Client domen adını DNS ilə həll edir.',
            hints: [
              'Client pastebin.com ünvanını hansı IP-yə göndərəcəyini haradan bilir?',
              'DNS komponenti əlavə edin və Client-dən ona xətt çəkin.',
              'Miqyaslanmış diaqram DNS ilə başlayır: Client əvvəlcə domeni DNS-də həll edir. DNS sorğuları coğrafiyaya və ya gecikməyə görə yönləndirə də bilər.',
            ],
            check: { type: 'edge', from: 'client', to: 'dns' },
          },
          {
            id: 'analytics-database',
            weight: 1,
            description: 'Analytics nəticələrini ayrıca analitik bazaya (data warehouse) yazır.',
            hints: [
              'MapReduce-un hesabladığı aylıq statistikanı harada saxlayıb sorğulamaq rahatdır?',
              'Data warehouse komponenti əlavə edin və Analytics-dən ona xətt çəkin.',
              'Primer-ə görə Analytics Database Amazon Redshift və ya Google BigQuery kimi data warehouse ola bilər: analitik sorğular əsas bazanı yükləmir.',
            ],
            check: { type: 'edge', from: 'analytics', to: 'data-warehouse' },
          },
          {
            id: 'all-connected',
            weight: 1,
            description: 'Dizaynda kənarda qalan, heç nəyə bağlı olmayan komponent yoxdur.',
            hints: [
              'Kətandakı hər komponent nə üçündür? Onlardan hansısa heç bir məlumat axınında iştirak etmirmi?',
              'Hər komponenti ən azı bir xətlə dizaynın qalanına bağlayın və ya artıq olanı silin.',
              'Bağlantısı olmayan komponent sistemdə heç bir iş görmür. Ya onun rolunu xətlərlə göstərin (məsələn, Read API → Memory Cache), ya da onu silin.',
            ],
            check: { type: 'custom', name: 'all-connected' },
          },
        ],
        // Mirrors pastebin.png; the primer leaves internal load balancers out, and so does this.
        referenceSolution: {
          nodes: [
            node('client-1', 'client', 'Client', 0, 320),
            node('dns-1', 'dns', 'DNS', 240, 40),
            node('cdn-1', 'cdn', 'CDN', 240, 180),
            node('load-balancer-1', 'load-balancer', 'Load Balancer', 240, 320, { instances: 2 }),
            node('web-server-1', 'web-server', 'Web Server', 480, 320, { instances: 3 }),
            node('app-service-1', 'app-service', 'Write API', 720, 200, { instances: 3 }),
            node('app-service-2', 'app-service', 'Read API', 720, 440, { instances: 3 }),
            node('analytics-1', 'analytics', 'Analytics', 720, 680, { instances: 3 }),
            node('cache-1', 'cache', 'Memory Cache', 960, 520, { instances: 3 }),
            node('sql-database-1', 'sql-database', 'SQL Write Master-Slave', 1200, 120, { instances: 2 }),
            node('sql-database-2', 'sql-database', 'SQL Read Replicas', 1200, 360, { role: 'replica', instances: 3 }),
            // Serves the CDN's and the Read API's reads at the peak load.
            node('object-store-1', 'object-store', 'Object Store', 1200, 600, { instances: 3 }),
            node('data-warehouse-1', 'data-warehouse', 'SQL Analytics', 1200, 800),
          ],
          edges: [
            edge('client-1', 'dns-1', 'read'),
            edge('client-1', 'cdn-1', 'read'),
            edge('client-1', 'load-balancer-1', 'both'),
            edge('cdn-1', 'object-store-1', 'read'),
            edge('load-balancer-1', 'web-server-1', 'both'),
            edge('web-server-1', 'app-service-1', 'write'),
            edge('web-server-1', 'app-service-2', 'read'),
            edge('app-service-1', 'sql-database-1', 'write'),
            edge('app-service-1', 'object-store-1', 'write'),
            edge('app-service-2', 'cache-1', 'read'),
            edge('app-service-2', 'sql-database-2', 'read'),
            edge('app-service-2', 'object-store-1', 'read'),
            edge('analytics-1', 'object-store-1', 'read'),
            edge('analytics-1', 'data-warehouse-1', 'write'),
          ],
        },
      },
    ],
  },
  twitter,
  webCrawler,
  mint,
  socialGraph,
]
