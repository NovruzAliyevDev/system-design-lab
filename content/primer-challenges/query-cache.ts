// The key-value store for a search engine (query cache), from the primer's solution: the Query API parses a
// query and looks it up in a Memory Cache; on a miss it finds the documents with the Reverse Index Service,
// takes titles and snippets from the Document Service and puts the results in the cache, evicting the least
// recently used. Reference Solutions mirror `query_cache_basic.png` and `query_cache.png`.
//
// The Reverse Index Service is a search index, as in the web crawler. Simple mode takes reads off a store
// beside a cache only for databases, so the Reverse Index and Document Services still get every read: the
// Reference gives them the capacity of the Query API. The cache write on a miss is not drawn: only Clients send
// traffic, and the load is the queries alone.
import type { ChallengeInput } from '../../src/core/challenges/challenge'
import type { Predicate } from '../../src/core/challenges/rules'
import { allConnectedRule, apiPath, dnsRule, edge, entryPath, loadBalancerRule, node, scaleOutRule } from './shared'

/** The Query API looks the query up in the Memory Cache. */
const CACHE_LOOKUP: Predicate = apiPath(['cache'], 'read')
/** On a miss, the Query API finds the matching documents in the reverse index. */
const REVERSE_INDEX: Predicate = { type: 'path', from: 'client', to: 'search-index', through: 'app-service', traffic: 'read' }
/** Titles and snippets come from a Document Service, or from a document store. */
const DOCUMENTS: Predicate = {
  type: 'any-of',
  predicates: [{ type: 'edge', from: 'app-service', to: 'app-service', traffic: 'read' }, apiPath([{ component: 'nosql-store', config: { kind: 'document' } }], 'read')],
}

export const queryCache: ChallengeInput = {
  id: 'query-cache',
  title: 'Axtarış sistemi üçün key-value cache dizayn edin',
  kind: 'architecture',
  source: 'primer',
  solutionId: 'query_cache',
  lessonIds: [
    'design-a-key-value-store-for-a-search-engine',
    'cache',
    'when-to-update-the-cache',
    'caching-at-the-database-query-level',
    'reverse-proxy-web-server',
    'application-layer',
    'horizontal-scaling',
    'latency-numbers-every-programmer-should-know',
  ],
  // The primer's average traffic: 10 billion queries a month, 270 bytes of results each.
  loadProfile: { readQps: 4_000, writeQps: 0, requestBytes: 270 },
  stages: [
    {
      id: 'requirements',
      type: 'requirements',
      weight: 1,
      prompt:
        'Axtarış sistemi üçün ən son sorğuların nəticələrini saxlayan key-value cache dizayn edin: istifadəçi axtarış sorğusu göndərir, nəticə ya cache-dən, ya da index-dən gəlir. Aşağıdakılardan bu tapşırığa aid olan istifadə hallarını (use case) və məhdudiyyətləri seçin, kənarda qalanları seçməyin. Fikirlərinizi qeydlərə yaza bilərsiniz.',
      solutionAnchor: 'step-1-outline-use-cases-and-constraints',
      items: [
        {
          section: 'use-case',
          text: 'İstifadəçi axtarış sorğusu göndərir və nəticə cache-də tapılır (cache hit)',
          correct: true,
          explanation: 'Populyar sorğular cache-dən verilir: bu, həm gecikməni azaldır, həm də index servislərini yükdən qoruyur.',
        },
        {
          section: 'use-case',
          text: 'İstifadəçi axtarış sorğusu göndərir və nəticə cache-də yoxdur (cache miss)',
          correct: true,
          explanation: 'Onda nəticə Reverse Index Service və Document Service-dən yığılır və cache-ə yazılır ki, növbəti dəfə tapılsın.',
        },
        {
          section: 'use-case',
          text: 'Servis yüksək əlçatanlığa (high availability) malikdir',
          correct: true,
          explanation: 'Primer bunu servisin tələbi kimi qeyd edir.',
        },
        {
          section: 'use-case',
          text: 'Servis internetdəki səhifələri çəkir (crawl) və reverse index-i qurur',
          explanation: 'Bu, web crawler tapşırığıdır: burada index artıq var, tapşırıq yalnız sorğu nəticələrini cache-ləməkdir.',
        },
        {
          section: 'use-case',
          text: 'İstifadəçi öz axtarış tarixçəsinə baxır və onu silir',
          explanation: 'Primer yalnız cache hit və cache miss hallarını götürür; tarixçə tapşırığa daxil deyil.',
        },
        {
          section: 'use-case',
          text: 'Servis nəticələri hər istifadəçinin maraqlarına görə fərdiləşdirir',
          explanation: 'Fərdi nəticələr eyni sorğunu müxtəlif açarlara bölər və cache-in faydasını azaldardı; tapşırıq bunu tələb etmir.',
        },
        {
          section: 'constraint',
          text: 'Trafik bərabər paylanmayıb: populyar sorğular demək olar ki, həmişə cache-də olmalıdır',
          correct: true,
          explanation: 'Cache-in faydası buradan gəlir: az sayda populyar sorğu trafikin böyük hissəsini təşkil edir. Elementlərin nə vaxt köhnəldiyini və yeniləndiyini də müəyyən etmək lazımdır.',
        },
        {
          section: 'constraint',
          text: 'Cache-dən vermək sürətli axtarış (lookup) tələb edir',
          correct: true,
          explanation: 'Buna görə cache yaddaşdadır və açar üzrə O(1) axtarış üçün hash table işlədir.',
        },
        {
          section: 'constraint',
          text: 'Maşınlar arasında gecikmə aşağıdır',
          correct: true,
          explanation: 'Primer bunu fərz edir: Query API, cache və index servisləri eyni data center-dədir.',
        },
        {
          section: 'constraint',
          text: 'Cache yaddaşı məhduddur, amma milyonlarla sorğunu cache-ləmək lazımdır',
          correct: true,
          explanation: 'Hər şey sığmır, ona görə nəyi saxlayıb nəyi silmək lazım olduğunu (eviction) seçmək lazımdır.',
        },
        {
          section: 'constraint',
          text: '10 milyon istifadəçi, ayda 10 milyard sorğu',
          correct: true,
          explanation: 'Bu, orta hesabla saniyədə 4000 sorğu deməkdir.',
        },
        {
          section: 'constraint',
          text: 'Bütün sorğuların nəticələri cache-də əbədi saxlanılır',
          explanation: 'Yaddaş məhduddur: hər sorğu unikal olsa, ayda 2,7 TB yığılardı. Köhnə elementlər silinməli və ya TTL ilə yenilənməlidir.',
        },
        {
          section: 'constraint',
          text: 'Cache-dəki nəticələr heç vaxt köhnəlmir',
          explanation: 'Səhifənin məzmunu, səhifə əlavə olunanda və ya silinəndə və onun reytinqi dəyişəndə nəticə köhnəlir; cache yenilənməlidir.',
        },
        {
          section: 'constraint',
          text: 'Sorğuların hamısı fərqlidir, ona görə eyni sorğu təkrarlanmır',
          explanation: 'Əksinə, trafik qeyri-bərabərdir və populyar sorğular təkrarlanır: cache məhz buna görə işləyir.',
        },
      ],
    },
    {
      id: 'estimation',
      type: 'estimation',
      weight: 1,
      prompt:
        'Fərziyyələr: ayda 10 milyard axtarış sorğusu gəlir. Cache açarı query-dir (50 bayt), dəyəri nəticələrdir: title 20 bayt, snippet 200 bayt. Ən pis halda hər sorğu unikaldır və hamısı cache-də saxlanılır. Primer-in yuvarlaq çevirmələrini işlədin: ayda 2,5 milyon saniyə, 1 KB = min bayt. Cavablar referansın 2 qatı daxilində olsa qəbul olunur.',
      solutionAnchor: 'calculate-usage',
      explanation:
        'Bir cache elementi: 50 + 20 + 200 = 270 bayt. Hər sorğu unikal olub saxlansaydı, ayda 270 bayt × 10 milyard = 2,7 TB yığılardı: bu, yaddaşa sığmır, ona görə köhnə elementləri silmək lazımdır. Ayda təxminən 2,5 milyon saniyə var: saniyədə 400 sorğu ayda 1 milyard sorğu deməkdir.',
      // Each of the 10 billion queries is a read; in the worst case its results are also stored once.
      inputs: { writesPerMonth: 10_000_000_000, readsPerMonth: 10_000_000_000, bytesPerWrite: 50 + 20 + 200 },
      questions: [
        { id: 'read-qps', quantity: 'readQps', prompt: 'Orta hesabla saniyədə neçə axtarış sorğusu gəlir?' },
        { id: 'storage-per-month', quantity: 'storagePerMonth', prompt: 'Hər sorğu unikal olub saxlansaydı, bir ayda nə qədər cache məlumatı yığılardı?' },
      ],
    },
    {
      id: 'high-level-design',
      type: 'high-level-design',
      weight: 3,
      prompt:
        'İstifadəçi axtarış sorğusu göndərir. Servis sorğunu normallaşdırır və nəticəni əvvəlcə cache-də axtarır; tapmasa, uyğun sənədləri reverse index-də tapır, onların başlıq və snippet-lərini alır, nəticəni cache-ə yazır və qaytarır. Ayda 10 milyard sorğu gözlənilir. Bütün vacib komponentləri kətana qoyun, sorğuların axınını xətlərlə göstərin və "Yoxla" düyməsini basın.',
      solutionAnchor: 'step-2-create-a-high-level-design',
      rules: [
        {
          id: 'entry-point',
          weight: 2,
          description: 'Client sorğuları tətbiq serverlərinə web server (reverse proxy) və ya load balancer vasitəsilə çatır.',
          hints: [
            'Client sorğusu tətbiq kodunun işlədiyi serverə çatmazdan əvvəl ilk olaraq nəyə dəyir?',
            'Client ilə application service arasına web server, reverse proxy və ya load balancer qoyun: hər sorğu ondan keçsin.',
            'Primer-də Client sorğuları reverse proxy rolunda işləyən Web Server-ə göndərir, o da sorğunu Query API serverinə ötürür. Client-dən application service-ə bu qatdan yan keçən yol olmamalıdır.',
          ],
          check: entryPath,
        },
        {
          id: 'cache-lookup',
          weight: 3,
          description: 'Query API sorğunun nəticəsini əvvəlcə yaddaş cache-ində axtarır.',
          hints: [
            'Populyar sorğunun nəticəsini hər dəfə index-dən yenidən yığmaq lazımdırmı?',
            'Memory Cache əlavə edin və Query API-dən (application service) ona "Oxuma" trafikli xətt çəkin.',
            'Primer-də Query API sorğunu təhlil edir (markup-ı silir, terminlərə bölür, yazı səhvlərini düzəldir, hərfləri normallaşdırır) və nəticəni Redis və ya Memcached kimi Memory Cache-də axtarır. Yaddaşdan 1 MB oxumaq təxminən 250 mikrosaniyə çəkir: SSD-dən 4, diskdən 80 dəfə tez.',
          ],
          check: CACHE_LOOKUP,
        },
        {
          id: 'reverse-index',
          weight: 2,
          description: 'Cache miss olanda Query API uyğun sənədləri reverse index-də (search index) tapır.',
          hints: [
            'Nəticə cache-də yoxdursa, sorğuya uyğun sənədləri haradan tapmaq olar?',
            'Search Index (Reverse Index Service) əlavə edin və Query API-dən ona "Oxuma" trafikli xətt çəkin.',
            'Primer-də Query API cache miss olanda Reverse Index Service-dən sorğuya uyğun sənədləri tapmağı istəyir; o, nəticələri reytinqə görə sıralayır və ən yaxşılarını qaytarır.',
          ],
          check: REVERSE_INDEX,
        },
        {
          id: 'documents',
          weight: 2,
          description: 'Nəticələrin başlıq və snippet-ləri ayrıca Document Service-dən (və ya document store-dan) alınır.',
          hints: [
            'Reverse index sənədlərin yalnız id-lərini qaytarır. İstifadəçiyə göstərilən başlıq və qısa mətn haradan gəlir?',
            'Document Service (application service) əlavə edin və Query API-dən ona "Oxuma" trafikli xətt çəkin.',
            'Primer-də Query API tapılan sənədlərin title və snippet-lərini Document Service-dən alır, nəticəni Memory Cache-ə yazır və LRU siyahısının əvvəlinə qoyur.',
          ],
          check: DOCUMENTS,
        },
        allConnectedRule('Query API → Memory Cache'),
      ],
      referenceSolution: {
        nodes: [
          node('client-1', 'client', 'Client', 0, 200),
          node('web-server-1', 'web-server', 'Web Server', 240, 200),
          node('app-service-1', 'app-service', 'Query API', 480, 200),
          node('search-index-1', 'search-index', 'Reverse Index Service', 720, 80),
          node('app-service-2', 'app-service', 'Document Service', 720, 200),
          node('cache-1', 'cache', 'Memory Cache', 720, 320),
        ],
        edges: [
          edge('client-1', 'web-server-1', 'read'),
          edge('web-server-1', 'app-service-1', 'read'),
          edge('app-service-1', 'search-index-1', 'read'),
          edge('app-service-1', 'app-service-2', 'read'),
          edge('app-service-1', 'cache-1', 'read'),
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
          type: 'multiple-choice',
          prompt: 'Cache hansı məlumat strukturu ilə qurulmalıdır ki, həm axtarış, həm də köhnə elementin silinməsi sürətli olsun?',
          options: [
            {
              text: 'Hash table və ikiqat əlaqəli siyahı (doubly-linked list): hash table açara görə siyahı node-unu tapır',
              correct: true,
              explanation: 'Primer-in seçimi: yeni element siyahının başına əlavə olunur, köhnə element sonundan silinir, hash table isə istənilən node-u O(1) tapır. Hər əməliyyat O(1)-dir.',
            },
            {
              text: 'Yalnız hash table',
              explanation: 'Axtarış O(1)-dir, amma hansı elementin ən çoxdan istifadə olunmadığını bilmək üçün sıra yoxdur: silinəcək elementi tapmaq bütün cədvəli gəzmək deməkdir.',
            },
            {
              text: 'Son istifadə vaxtına görə sıralanmış massiv',
              explanation: 'Hər istifadədə elementi massivin əvvəlinə köçürmək O(n)-dir; saniyədə minlərlə sorğuda bu, çox yavaşdır.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Cache dolanda hansı element silinməlidir?',
          options: [
            {
              text: 'Ən çoxdan istifadə olunmayan (LRU)',
              correct: true,
              explanation: 'Primer LRU seçir: populyar sorğular tez-tez istifadə olunduğu üçün siyahının başında qalır, unudulmuşlar isə sonundan silinir.',
            },
            {
              text: 'Ən əvvəl əlavə olunan (FIFO)',
              explanation: 'Çoxdan əlavə olunmuş, amma hər gün istifadə olunan populyar sorğu da silinərdi və cache miss-lər artardı.',
            },
            {
              text: 'Təsadüfi element',
              explanation: 'Sadədir, amma populyarlığı nəzərə almır: populyar sorğuların silinmə ehtimalı digərləri ilə eynidir.',
            },
          ],
        },
        {
          type: 'multi-select',
          prompt: 'Cache-dəki nəticə hansı hallarda yenilənməlidir?',
          options: [
            { text: 'Səhifənin məzmunu dəyişəndə', correct: true, explanation: 'Snippet və başlıq köhnəlir.' },
            { text: 'Səhifə silinəndə və ya yeni səhifə əlavə olunanda', correct: true, explanation: 'Nəticələr siyahısı artıq düzgün deyil.' },
            { text: 'Səhifənin reytinqi (page rank) dəyişəndə', correct: true, explanation: 'Nəticələrin sırası dəyişir.' },
            {
              text: 'İstifadəçi nəticəyə hər baxanda',
              explanation: 'Baxmaq məzmunu dəyişmir; hər baxışda yeniləmək cache-in faydasını yox edərdi. Baxış yalnız elementi LRU siyahısının başına keçirir.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Bu hallarda cache-i yeniləməyin ən sadə yolu hansıdır?',
          options: [
            {
              text: 'Hər elementə TTL (time to live) vermək: vaxtı keçən element yenidən index-dən yığılır',
              correct: true,
              explanation: 'Primer bunu ən sadə yol sayır. Bu, cache-aside-dır: element bir müddət köhnə qala bilər, amma dəyişiklikləri izləmək lazım deyil.',
            },
            {
              text: 'Hər səhifə dəyişəndə həmin səhifəni ehtiva edən bütün sorğuları tapıb cache-də yeniləmək',
              explanation: 'Dəqiqdir, amma hansı sorğuların hansı səhifəni qaytardığını izləmək çox mürəkkəb və bahalıdır.',
            },
            {
              text: 'Cache-i heç vaxt yeniləməmək, yalnız LRU ilə silmək',
              explanation: 'Populyar sorğu siyahının başında qalır və heç vaxt silinmir: onun nəticəsi sonsuza qədər köhnə qalardı.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Query API sorğunu cache-də axtarmazdan əvvəl niyə təhlil edib normallaşdırır?',
          options: [
            {
              text: 'Eyni mənalı sorğular ("Kitab", "kitab ", yazı səhvi ilə "ktiab") eyni cache açarına düşsün və hit ratio artsın',
              correct: true,
              explanation: 'Primer-də Query API markup-ı silir, mətni terminlərə bölür, yazı səhvlərini düzəldir, hərfləri normallaşdırır və sorğunu boolean əməliyyatlara çevirir.',
            },
            {
              text: 'Cache yalnız kiçik hərflərlə yazılmış açarları saxlaya bildiyi üçün',
              explanation: 'Cache istənilən açarı saxlayır; normallaşdırmanın məqsədi eyni sorğuların eyni açara düşməsidir.',
            },
            {
              text: 'Cache-də yeri qənaət etmək üçün sorğunu sıxışdırmaq',
              explanation: 'Normallaşdırma sıxışdırma deyil; bir az yer qənaət olunsa da, əsas fayda hit ratio-nun artmasıdır.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Nəticələri niyə SSD-də deyil, yaddaşda (memory cache) saxlayırıq?',
          options: [
            {
              text: 'Yaddaşdan 1 MB ardıcıl oxumaq təxminən 250 µs çəkir: SSD-dən 4, diskdən 80 dəfə tez',
              correct: true,
              explanation: 'Primer-in latency rəqəmləri: sürətli lookup tələbi yaddaşı seçdirir. Bədəli yaddaşın məhdud və baha olmasıdır.',
            },
            {
              text: 'Yaddaş SSD-dən ucuzdur',
              explanation: 'Əksinə, yaddaş bayt başına daha bahadır: buna görə cache məhduddur və eviction lazımdır.',
            },
            {
              text: 'Yaddaşdakı məlumat restart-dan sonra itmir',
              explanation: 'Əksinə, yaddaş dəyişkəndir; cache itəndə nəticələr index-dən yenidən yığılır.',
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
        'Yüksək səviyyəli dizaynınızdan davam edin və onu məhdudiyyətlərə görə miqyaslayın: trafik qeyri-bərabərdir, cache bir maşının yaddaşına sığmır, servis yüksək əlçatan olmalıdır. Dizayn primer-in orta yükünə dözməlidir: saniyədə 4000 axtarış altında oxumanın orta gecikməsi 200 ms-i keçməməli, heç bir node həddən artıq yüklənməməli və heç bir sorğu xəta ilə bitməməlidir. Bunu trafik simulyasiyası ilə yoxlayın. Darboğazları tapın, komponent əlavə edin və ya dəyişin, "Yoxla" düyməsini basın.',
      solutionAnchor: 'step-4-scale-the-design',
      rules: [
        {
          id: 'average-load',
          weight: 3,
          description: 'Orta yükdə (saniyədə 4000 axtarış) orta gecikmə 200 ms-dən çox deyil, həddən artıq yüklənən node və xəta yoxdur.',
          hints: [
            'Saniyədə 4000 axtarış gələndə dizaynınızın hansı node-u ilk tıxanır?',
            'Trafik simulyasiyasını işə salın və "Darboğazlar" siyahısına baxın. Ən çox yüklənən node-ların "instances" sahəsini artırın: Web Server, Query API, Reverse Index Service və Document Service.',
            'Hər node bir nüsxədə məhdud sorğu emal edir: məsələn, web server təxminən 1000, application service 500, search index 1000 sorğu/san. Sadə simulyasiyada Query API hər oxumada çağırdığı bütün servisləri çağırır, cache yalnız bazalardan yükü götürür: ona görə Reverse Index və Document Service-lər də hər sorğunu alır və horizontal miqyaslanmalıdır.',
          ],
          check: { type: 'simulation', maxLatencyMs: { read: 200 }, maxOverloadedNodes: 0, maxErrorRate: 0 },
        },
        loadBalancerRule,
        scaleOutRule,
        {
          id: 'cache-cluster',
          weight: 2,
          description: 'Memory Cache bir neçə maşından ibarət klasterdir.',
          hints: [
            'Milyonlarla sorğunun nəticəsi bir maşının yaddaşına sığarmı?',
            'Memory Cache-in tənzimləməsində "instances" sahəsini 2 və ya daha çox edin.',
            'Primer-ə görə ağır yük və böyük yaddaş üçün cache horizontal miqyaslanır. Üç yol var: hər maşının öz cache-i (sadə, amma hit ratio aşağı), hər maşında tam nüsxə (sadə, amma yaddaş israfı) və ya cache-i bütün maşınlara shard-lamaq: machine = hash(query), daha yaxşısı consistent hashing ilə. Sonuncu ən mürəkkəbdir, amma çox güman ki, ən yaxşısıdır.',
          ],
          check: {
            type: 'all-of',
            predicates: [
              { type: 'node', node: 'cache' },
              { type: 'node', node: { component: 'cache', config: { instances: 1 } }, max: 0 },
            ],
          },
        },
        {
          id: 'pipeline',
          weight: 2,
          description: 'Yeni komponentlərlə də Query API cache-ə baxır, reverse index-dən və Document Service-dən oxuyur.',
          hints: [
            'Komponent əlavə edəndən sonra Query API hələ də əvvəlcə cache-ə baxırmı?',
            'Query API-dən Memory Cache-ə, Reverse Index Service-ə və Document Service-ə oxuma xətlərini saxlayın.',
            'Miqyaslanmış diaqram yüksək səviyyəli dizaynın bütün yollarını saxlayır, sadəcə hər servis və cache bir neçə nüsxədə işləyir; primer daxili load balancer-ləri göstərmir.',
          ],
          check: { type: 'all-of', predicates: [CACHE_LOOKUP, REVERSE_INDEX, DOCUMENTS] },
        },
        dnsRule('search.com'),
        allConnectedRule('Query API → Memory Cache'),
      ],
      // Mirrors query_cache.png; the primer leaves internal load balancers out, and so does this.
      referenceSolution: {
        nodes: [
          node('client-1', 'client', 'Client', 0, 200),
          node('dns-1', 'dns', 'DNS', 240, 40),
          node('load-balancer-1', 'load-balancer', 'Load Balancer', 240, 200, { instances: 2 }),
          node('web-server-1', 'web-server', 'Web Server', 480, 200, { instances: 6 }),
          node('app-service-1', 'app-service', 'Query API', 720, 200, { instances: 12 }),
          node('search-index-1', 'search-index', 'Reverse Index Service', 960, 80, { instances: 6 }),
          node('app-service-2', 'app-service', 'Document Service', 960, 200, { instances: 12 }),
          node('cache-1', 'cache', 'Memory Cache', 960, 320, { instances: 3 }),
        ],
        edges: [
          edge('client-1', 'dns-1', 'read'),
          edge('client-1', 'load-balancer-1', 'read'),
          edge('load-balancer-1', 'web-server-1', 'read'),
          edge('web-server-1', 'app-service-1', 'read'),
          edge('app-service-1', 'search-index-1', 'read'),
          edge('app-service-1', 'app-service-2', 'read'),
          edge('app-service-1', 'cache-1', 'read'),
        ],
      },
    },
  ],
}
