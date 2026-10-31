// A web crawler, from the primer's solution: the Crawler Service works through the ranked links in a
// NoSQL store and hands each page to queues that feed the Reverse Index Service and the Document
// Service, which the Query API reads to answer searches. Reference Solutions mirror
// `web_crawler_basic.png` and `web_crawler.png`; the Reverse Index Service is a search index.
//
// Traffic enters the simulation only at Clients, so the crawler's writes are not simulated: the Load
// Profiles carry the searches, and the crawling side is checked by structure.
import type { ChallengeInput } from '../../src/core/challenges/challenge'
import type { NodeSelector, Predicate } from '../../src/core/challenges/rules'
import { allConnectedRule, apiPath, dnsRule, edge, entryPath, loadBalancerRule, node, QUEUES, scaleOutRule } from './shared'

/** Where `links_to_crawl` and `crawled_links` live: the primer's key-value NoSQL store, or SQL. */
const CRAWL_STORE: NodeSelector[] = [{ component: 'nosql-store', config: { kind: 'key-value' } }, 'sql-database']

const CRAWL_STORE_USED: Predicate = { type: 'any-of', predicates: CRAWL_STORE.map((store) => ({ type: 'edge', from: 'app-service', to: store })) }
/** Every write from a service to the reverse index goes through a queue. */
const INDEX_THROUGH_QUEUE: Predicate = { type: 'path', from: 'app-service', to: 'search-index', through: QUEUES, traffic: 'write' }
/** A service takes its jobs from a queue: the Document Service. */
const DOCUMENTS_FROM_QUEUE: Predicate = { type: 'edge', from: QUEUES, to: 'app-service', traffic: 'write' }
/** Searches read the reverse index through the Query API, which also asks another service (the Document Service). */
const QUERY_READS: Predicate = {
  type: 'all-of',
  predicates: [apiPath(['search-index'], 'read'), { type: 'edge', from: 'app-service', to: 'app-service', traffic: 'read' }],
}

export const webCrawler: ChallengeInput = {
  id: 'web-crawler',
  title: 'Web crawler dizayn edin',
  kind: 'architecture',
  source: 'primer',
  solutionId: 'web_crawler',
  lessonIds: [
    'design-a-web-crawler',
    'reverse-proxy-web-server',
    'application-layer',
    'nosql',
    'sql-or-nosql',
    'asynchronism',
    'message-queues',
    'cache',
  ],
  // The primer's average searches: 100 billion a month. A request carries a page of results, an authored 1 KB.
  loadProfile: { readQps: 40_000, writeQps: 0, requestBytes: 1_000 },
  stages: [
    {
      id: 'requirements',
      type: 'requirements',
      weight: 1,
      prompt:
        'Web crawler dizayn edin: servis link siyahısını gəzir, səhifələrdən axtarış üçün reverse index, başlıq və snippet hazırlayır; istifadəçi axtarış sözü yazır və uyğun səhifələrin siyahısını görür. Aşağıdakılardan bu tapşırığa aid olan istifadə hallarını (use case) və məhdudiyyətləri seçin, kənarda qalanları seçməyin. Fikirlərinizi qeydlərə yaza bilərsiniz.',
      solutionAnchor: 'step-1-outline-use-cases-and-constraints',
      items: [
        {
          section: 'use-case',
          text: 'Servis link siyahısını gəzir (crawl edir)',
          correct: true,
          explanation: 'Servisin əsas işi: link-ləri bir-bir götürüb səhifələri yükləmək.',
        },
        {
          section: 'use-case',
          text: 'Servis sözlərdən onları ehtiva edən səhifələrə reverse index qurur',
          correct: true,
          explanation: 'Reverse index axtarış sözündən uyğun səhifələri tez tapmağa imkan verir.',
        },
        {
          section: 'use-case',
          text: 'Servis səhifələr üçün statik başlıq və snippet hazırlayır',
          correct: true,
          explanation: 'Primer başlıq və snippet-ləri statik saxlayır: onlar axtarış sorğusundan asılı deyil, ona görə əvvəlcədən hazırlanır.',
        },
        {
          section: 'use-case',
          text: 'İstifadəçi axtarış sözü yazır və başlıq və snippet-li uyğun səhifələrin siyahısını görür',
          correct: true,
          explanation: 'Primer bu ssenari üçün yalnız əsas komponentləri və əlaqələri çəkməyi istəyir.',
        },
        {
          section: 'use-case',
          text: 'Servis yüksək əlçatanlığa (high availability) malikdir',
          correct: true,
          explanation: 'Primer bunu servisin tələbi kimi qeyd edir.',
        },
        {
          section: 'use-case',
          text: 'Servis axtarış analytics-i toplayır',
          explanation: 'Axtarış analytics-i primer-də kənarda qalır.',
        },
        {
          section: 'use-case',
          text: 'Axtarış nəticələri istifadəçiyə görə fərdiləşdirilir',
          explanation: 'Fərdiləşdirilmiş nəticələr primer-də açıq şəkildə kənarda saxlanılır.',
        },
        {
          section: 'use-case',
          text: 'Servis səhifələri PageRank ilə sıralayır',
          explanation: 'PageRank primer-də kənarda qalır; link-lər əvvəlcə saytın populyarlığına görə sıralanır.',
        },
        {
          section: 'use-case',
          text: 'Snippet hər axtarış sorğusuna görə yenidən yaradılır',
          explanation: 'Əksinədir: primer başlıq və snippet-lərin statik olduğunu və sorğudan asılı olmadığını fərz edir.',
        },
        {
          section: 'constraint',
          text: 'Trafik bərabər paylanmayıb: bəzi axtarışlar çox populyardır, bəziləri isə bir dəfə edilir',
          correct: true,
          explanation: 'Buna görə Scaling mərhələsində populyar sorğular Memory Cache-dən verilir.',
        },
        {
          section: 'constraint',
          text: 'Yalnız anonim istifadəçilər',
          correct: true,
          explanation: 'Hesab olmadığı üçün autentifikasiya və fərdi məlumat dizayndan çıxır.',
        },
        {
          section: 'constraint',
          text: 'Axtarış nəticələri sürətlə qaytarılmalıdır',
          correct: true,
          explanation: 'Axtarış yolu gecikməyə həssasdır: nəticələr əvvəlcədən hazırlanmış index-dən və cache-dən verilir.',
        },
        {
          section: 'constraint',
          text: 'Crawler sonsuz dövrəyə düşməməlidir',
          correct: true,
          explanation: 'Link qrafında dövrə ola bilər; primer bunu səhifə imzalarını müqayisə edərək həll edir.',
        },
        {
          section: 'constraint',
          text: '1 milyard link; səhifələr orta hesabla həftədə bir yenilənir, yəni ayda 4 milyard crawl',
          correct: true,
          explanation: 'Primer-in fərziyyəsi: populyar saytlar daha tez-tez yenilənir, dəyişikliklər yeni səhifə kimi sayılır.',
        },
        {
          section: 'constraint',
          text: 'Saxlanılan səhifənin orta ölçüsü 500 KB; ayda 100 milyard axtarış',
          correct: true,
          explanation: 'Estimation mərhələsindəki hesablamalar bu rəqəmlərdən başlayır.',
        },
        {
          section: 'constraint',
          text: 'Ənənəvi sistemlərdən istifadə edilir, Solr və ya Nutch kimi hazır sistemlərdən yox',
          correct: true,
          explanation: 'Primer məqsədli şəkildə hazır axtarış sistemlərini qadağan edir ki, komponentləri özünüz dizayn edəsiniz.',
        },
        {
          section: 'constraint',
          text: 'Səhifələr bir dəfə crawl edilir və heç vaxt yenilənmir',
          explanation: 'Primer səhifələrin təzə qalması üçün müntəzəm yenilənməsini tələb edir.',
        },
        {
          section: 'constraint',
          text: 'Axtarış üçün Solr kimi hazır search engine götürmək olar',
          explanation: 'Primer bunu açıq şəkildə istisna edir: "ənənəvi sistemlərlə" işləmək lazımdır.',
        },
      ],
    },
    {
      id: 'estimation',
      type: 'estimation',
      weight: 1,
      prompt:
        'Fərziyyələr: ayda 4 milyard link crawl edilir (dəyişikliklər yeni səhifə kimi sayılır) və 100 milyard axtarış gəlir. Saxlanılan səhifənin orta ölçüsü 500 KB-dır. Məlumat 3 il saxlanılır. Primer-in yuvarlaq çevirmələrini işlədin: ayda 2,5 milyon saniyə, 1 KB = min bayt. Cavablar referansın 2 qatı daxilində olsa qəbul olunur.',
      solutionAnchor: 'calculate-usage',
      explanation:
        'Hər crawl bir səhifə yazır: 500 KB. Ayda təxminən 2,5 milyon saniyə var: saniyədə 400 sorğu ayda 1 milyard sorğu deməkdir. Primer crawl-ları "yazma sorğusu", axtarışları oxuma kimi sayır.',
      // A write is a crawled page; searches are counted, not sized.
      inputs: { writesPerMonth: 4_000_000_000, readsPerMonth: 100_000_000_000, bytesPerWrite: 500_000, years: 3 },
      questions: [
        { id: 'write-qps', quantity: 'writeQps', prompt: 'Orta hesabla saniyədə neçə səhifə crawl edilir (yazma sorğusu)?' },
        { id: 'read-qps', quantity: 'readQps', prompt: 'Orta hesabla saniyədə neçə axtarış sorğusu gəlir?' },
        { id: 'storage-per-month', quantity: 'storagePerMonth', prompt: 'Bir ayda nə qədər səhifə məzmunu saxlanılır?' },
        { id: 'storage-3-years', quantity: 'storageTotal', prompt: '3 ildə nə qədər səhifə məzmunu yığılır?' },
      ],
    },
    {
      id: 'high-level-design',
      type: 'high-level-design',
      weight: 3,
      prompt:
        'Crawler Service ən yüksək prioritetli link-i götürür, səhifəni yükləyir, onun reverse index-ini və statik başlıq və snippet-ini hazırlamaq üçün işlər yaradır, crawl edilmiş link-ləri və onların imzasını saxlayır. İstifadəçi axtarış sözü yazır və uyğun səhifələri başlıq və snippet ilə görür. Ayda 4 milyard crawl və 100 milyard axtarış gözlənilir. Bütün vacib komponentləri kətana qoyun, axınları xətlərlə göstərin (crawl axını "Yazma", axtarış "Oxuma" trafiki daşısın) və "Yoxla" düyməsini basın.',
      solutionAnchor: 'step-2-create-a-high-level-design',
      rules: [
        {
          id: 'entry-point',
          weight: 2,
          description: 'Axtarış sorğuları tətbiq serverlərinə web server (reverse proxy) və ya load balancer vasitəsilə çatır.',
          hints: [
            'İstifadəçinin axtarış sorğusu Query API-yə çatmazdan əvvəl ilk olaraq nəyə dəyir?',
            'Client ilə application service-lər arasına web server, reverse proxy və ya load balancer qoyun: hər sorğu ondan keçsin.',
            'Primer-də Client axtarış sorğusunu reverse proxy rolunda işləyən Web Server-ə göndərir, o da onu Query API serverinə ötürür. Client-dən application service-ə bu qatdan yan keçən yol olmamalıdır.',
          ],
          check: entryPath,
        },
        {
          id: 'crawl-store',
          weight: 2,
          description: 'Crawler links_to_crawl və crawled_links cədvəllərini key-value NoSQL store-da (və ya SQL-də) saxlayır.',
          hints: [
            'Crawler növbəti link-i haradan götürür və hansı səhifələri artıq crawl etdiyini haradan bilir?',
            'Key-value tipli NoSQL store əlavə edin və Crawler Service-dən ona xətt çəkin.',
            'Primer links_to_crawl və crawled_links cədvəllərini key-value NoSQL bazasında saxlamağı təklif edir; sıralanmış link-lər üçün Redis-in sorted set-i prioriteti saxlayır. SQL ilə NoSQL arasındakı trade-off-u müzakirə etmək lazımdır, ona görə SQL da qəbul olunur.',
          ],
          check: CRAWL_STORE_USED,
        },
        {
          id: 'reverse-index-queue',
          weight: 3,
          description: 'Crawler reverse index işlərini növbə (queue) vasitəsilə search index-ə ötürür.',
          hints: [
            'Crawler hər səhifənin index-lənməsi bitənə qədər gözləsə, saniyədə 1600 səhifəyə çata bilərmi?',
            'Search Index (Reverse Index Service) əlavə edin, Crawler Service ilə onun arasına Message Queue qoyun və xətlərin trafikini "Yazma" seçin.',
            'Primer-də Crawler hər səhifə üçün Reverse Index Service-in növbəsinə iş əlavə edir və növbəti link-ə keçir: index asinxron qurulur. Növbə yükü bərabərləşdirir və index servisi yavaşlasa da crawler dayanmır. Crawler-dən index-ə növbədən yan keçən yazma yolu olmamalıdır.',
          ],
          check: INDEX_THROUGH_QUEUE,
        },
        {
          id: 'document-queue',
          weight: 2,
          description: 'Document Service başlıq və snippet işlərini növbədən götürür.',
          hints: [
            'Səhifənin başlığını və snippet-ini kim, nə vaxt hazırlayır? Bu iş crawler-i ləngitməlidirmi?',
            'Document Service (application service) əlavə edin, ikinci Message Queue-dan ona "Yazma" trafikli xətt çəkin və Crawler Service-i həmin növbəyə bağlayın.',
            'Primer-də Crawler Document Service-in növbəsinə statik başlıq və snippet yaratmaq işi əlavə edir. Hər servisin öz növbəsi var: biri yavaşlayanda o birinin işi dayanmır.',
          ],
          check: DOCUMENTS_FROM_QUEUE,
        },
        {
          id: 'query-api',
          weight: 2,
          description: 'Query API axtarış sorğusunu search index-dən və Document Service-dən cavablayır.',
          hints: [
            'Uyğun səhifələri tapandan sonra Query API onların başlıq və snippet-ini haradan alır?',
            'Query API-dən Search Index-ə və Document Service-ə "Oxuma" trafikli xətlər çəkin.',
            'Primer-də Query API sorğunu təhlil edir (markup-u silir, sözlərə bölür, səhvləri düzəldir, boolean əməliyyatlara çevirir), Reverse Index Service-dən uyğun səhifələri sıralanmış şəkildə alır və Document Service-dən onların başlıq və snippet-ini qaytarır.',
          ],
          check: QUERY_READS,
        },
        {
          id: 'crawling-apart',
          weight: 1,
          description: 'Axtarış sorğuları crawl növbələrinə çatmır: crawl və axtarış ayrı axınlardır.',
          hints: [
            'İstifadəçinin axtarışı yeni crawl işi yaratmalıdırmı?',
            'Client-dən növbələrə gedən yol olmasın: növbələri yalnız Crawler Service doldursun.',
            'Primer-in diaqramında iki ayrı axın var: istifadəçi axtarışı (Client → Web Server → Query API → index və Document Service) və crawler axını (Crawler Service → növbələr → index və Document Service, Crawler Service → NoSQL). Axtarış crawler-in işinə qarışmır.',
          ],
          check: { type: 'not', predicate: { type: 'path', from: 'client', to: QUEUES } },
        },
        allConnectedRule('Crawler Service → Queue'),
      ],
      referenceSolution: {
        nodes: [
          node('client-1', 'client', 'Client', 0, 200),
          node('web-server-1', 'web-server', 'Web Server', 240, 200),
          node('app-service-1', 'app-service', 'Query API', 480, 200),
          node('search-index-1', 'search-index', 'Reverse Index Service', 720, 120),
          node('app-service-2', 'app-service', 'Document Service', 720, 280),
          node('message-queue-1', 'message-queue', 'Queue', 960, 120),
          node('message-queue-2', 'message-queue', 'Queue', 960, 280),
          node('app-service-3', 'app-service', 'Crawler Service', 1200, 200),
          node('nosql-store-1', 'nosql-store', 'NoSQL', 1200, 440),
        ],
        edges: [
          edge('client-1', 'web-server-1', 'read'),
          edge('web-server-1', 'app-service-1', 'read'),
          edge('app-service-1', 'search-index-1', 'read'),
          edge('app-service-1', 'app-service-2', 'read'),
          edge('app-service-3', 'message-queue-1', 'write'),
          edge('app-service-3', 'message-queue-2', 'write'),
          edge('message-queue-1', 'search-index-1', 'write'),
          edge('message-queue-2', 'app-service-2', 'write'),
          edge('app-service-3', 'nosql-store-1', 'both'),
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
          prompt: 'links_to_crawl siyahısını prioritetə görə necə saxlamaq olar?',
          options: [
            {
              text: 'Key-value NoSQL-də; sıralanmış link-lər üçün Redis-in sorted set-i',
              correct: true,
              explanation: 'Primer-in təklifi: sorted set ən yüksək prioritetli link-i tez götürməyə və prioriteti azaltmağa imkan verir.',
            },
            {
              text: 'Object Store-da hər link üçün ayrıca fayl',
              explanation: 'Object Store "ən yüksək prioritetli link hansıdır?" sualına cavab verə bilmir: hər dəfə hamısını oxumaq lazım olar.',
            },
            {
              text: 'Yalnız Crawler Service-in yaddaşında',
              explanation: '1 milyard link bir serverin yaddaşına sığmaz və server yenidən başlayanda itər; bir neçə crawler nüsxəsi də onu bölüşə bilməz.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Crawler sonsuz dövrəyə düşməsin deyə nə edir?',
          options: [
            {
              text: 'crawled_links-də oxşar imzalı səhifə varsa, link-in prioritetini azaldır və onu keçir',
              correct: true,
              explanation: 'Primer-in Crawler sinfi məhz belə işləyir: crawled_similar(signature) doğrudursa, reduce_priority_link_to_crawl çağırılır.',
            },
            {
              text: 'Hər link-i crawl edir, dövrə özü bitəcək',
              explanation: 'Link qrafında dövrə varsa, eyni səhifələr sonsuza qədər təkrar crawl ediləcək.',
            },
            {
              text: 'Yalnız eyni URL-i yoxlayır',
              explanation: 'Fərqli URL-lərdə eyni məzmun ola bilər; primer məzmuna əsaslanan imzanı müqayisə edir.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: '1 milyard link arasında təkrarlanan URL-ləri necə silmək olar?',
          options: [
            {
              text: 'MapReduce ilə: tezliyi 1 olan URL-ləri saxlamaq',
              correct: true,
              explanation: 'Primer-in RemoveDuplicateUrls işi: mapper hər URL üçün (url, 1) verir, reducer cəmi sayır.',
            },
            {
              text: 'Bir serverdə sort | unique',
              explanation: 'Kiçik siyahılar üçün işləyir, amma primer qeyd edir ki, 1 milyard link üçün paylanmış emal lazımdır.',
            },
            {
              text: 'Hər yeni URL-i bütün siyahı ilə bir-bir müqayisə etmək',
              explanation: 'Bu O(n²) əməliyyatdır: 1 milyard link üçün mümkün deyil.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Təkrarlanan məzmunu (fərqli URL-lərdə eyni səhifə) necə aşkar etmək olar?',
          options: [
            {
              text: 'Məzmundan imza (signature) yaradıb imzaları Jaccard index və ya cosine similarity ilə müqayisə etmək',
              correct: true,
              explanation: 'Primer bu alqoritmləri təklif edir: oxşar, amma eyni olmayan səhifələr də tapılır.',
            },
            {
              text: 'Səhifələri bayt-bayt müqayisə etmək',
              explanation: 'Bir reklam və ya tarix fərqi səhifəni "fərqli" edər, həm də hər səhifəni hər biri ilə müqayisə etmək çox bahadır.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Səhifələrin nə vaxt yenidən crawl ediləcəyini necə müəyyən etmək olar?',
          options: [
            {
              text: 'Hər nəticədə timestamp saxlamaq, susmaya görə həftədə bir, populyar və tez dəyişən saytları daha tez-tez yeniləmək',
              correct: true,
              explanation: 'Primer belə təklif edir; data mining ilə səhifənin orta dəyişmə müddəti hesablana bilər, Robots.txt isə sayt sahiblərinə crawl tezliyini idarə etməyə imkan verir.',
            },
            {
              text: 'Hər gün bütün 1 milyard səhifəni yeniləmək',
              explanation: 'Bu, crawl həcmini 7 dəfə artırır, halbuki səhifələrin çoxu bir gündə dəyişmir.',
            },
            {
              text: 'Yalnız istifadəçi səhifəni axtaranda yeniləmək',
              explanation: 'Axtarış sürətli olmalıdır: crawl axtarış yolunda olmamalıdır.',
            },
          ],
        },
        {
          type: 'multi-select',
          prompt: 'Crawler Service-in performansını necə artırmaq olar?',
          options: [
            {
              text: 'Öz DNS lookup cache-ini saxlamaq və onu vaxtaşırı yeniləmək',
              correct: true,
              explanation: 'Primer qeyd edir ki, DNS lookup darboğaz ola bilər.',
            },
            {
              text: 'Eyni anda çoxlu açıq bağlantı saxlamaq (connection pooling)',
              correct: true,
              explanation: 'Bağlantı qurmaq bahadır; pool həm performansı artırır, həm yaddaşı azaldır.',
            },
            {
              text: 'Kifayət qədər bandwidth təmin etmək',
              correct: true,
              explanation: 'Primer qeyd edir ki, crawl bandwidth tələb edir; hesablasaq, saniyədə 1600 səhifə × 500 KB ≈ 800 MB-dır.',
            },
            {
              text: 'Səhifələri bir-bir, növbəti bağlantını əvvəlki bitəndən sonra açaraq yükləmək',
              explanation: 'Bu, şəbəkə gözləməsini ardıcıl toplayır: crawler vaxtının çoxunu boş gözləməyə sərf edər.',
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
        'Yüksək səviyyəli dizaynınızdan davam edin və onu məhdudiyyətlərə görə miqyaslayın: bəzi axtarışlar çox populyardır, trafik qeyri-bərabərdir, index və sənədlər bir maşına sığmır. Dizayn primer-in orta axtarış yükünə dözməlidir: saniyədə 40 000 axtarış altında oxumanın orta gecikməsi 200 ms-i keçməməli, heç bir node həddən artıq yüklənməməli və heç bir sorğu xəta ilə bitməməlidir. Bunu trafik simulyasiyası ilə yoxlayın (simulyasiya yalnız Client-dən gələn axtarışları göndərir). Darboğazları tapın, komponent əlavə edin və ya dəyişin, "Yoxla" düyməsini basın.',
      solutionAnchor: 'step-4-scale-the-design',
      rules: [
        {
          id: 'average-load',
          weight: 3,
          description: 'Orta yükdə (saniyədə 40 000 axtarış) orta gecikmə 200 ms-dən çox deyil, həddən artıq yüklənən node və xəta yoxdur.',
          hints: [
            'Saniyədə 40 000 axtarış gələndə dizaynınızın hansı node-u ilk tıxanır?',
            'Trafik simulyasiyasını işə salın və "Darboğazlar" siyahısına baxın. Ən çox yüklənən node-ların "instances" sahəsini artırın: Web Server, Query API, Search Index və Document Service.',
            'Hər node bir nüsxədə məhdud sorğu emal edir: məsələn, web server təxminən 1000, application service 500, search index 1000 sorğu/san. Saniyədə 40 000 axtarışda web server-lər və Query API kimi stateless serverlər horizontal miqyaslanır, index və sənədlər isə bir çox shard-a bölünür.',
          ],
          check: { type: 'simulation', maxLatencyMs: { read: 200 }, maxOverloadedNodes: 0, maxErrorRate: 0 },
        },
        loadBalancerRule,
        scaleOutRule,
        {
          id: 'memory-cache',
          weight: 2,
          description: 'Query API populyar sorğuların nəticələrini yaddaş cache-indən verir.',
          hints: [
            'Eyni populyar sorğu min dəfə gələndə hər dəfə index-də axtarmaq lazımdırmı?',
            'Memory Cache əlavə edin və Query API-dən ona "Oxuma" trafikli xətt çəkin.',
            'Primer-ə görə populyar sorğular Redis və ya Memcached kimi Memory Cache-dən verilməlidir: cavab vaxtı azalır, Reverse Index Service və Document Service həddən artıq yüklənmir. Cache qeyri-bərabər trafikə və qəfil sıçrayışlara qarşı da bufer olur: yaddaşdan oxumaq SSD-dən 4, diskdən 80 dəfə sürətlidir.',
          ],
          check: { type: 'edge', from: 'app-service', to: 'cache', traffic: 'read' },
        },
        {
          id: 'sharded-index',
          weight: 1,
          description: 'Search index shard-lara bölünüb: onun shard key-i təyin olunub və o, bir neçə nüsxədə işləyir.',
          hints: [
            '72 PB-a qədər böyüyən məlumatın index-i bir serverə sığarmı?',
            'Search Index-in tənzimləməsində "shardKey" sahəsini (məsələn, term) yazın və "instances" sahəsini 2 və ya daha çox edin.',
            'Primer-ə görə Reverse Index Service və Document Service məlumatın ölçüsü və sorğu yükü üçün sharding və federation-dan geniş istifadə etməlidir: hər shard index-in bir hissəsini saxlayır və sorğular shard-lar arasında bölünür.',
          ],
          check: {
            type: 'all-of',
            predicates: [
              { type: 'node', node: 'search-index' },
              { type: 'node', node: { component: 'search-index', config: { shardKey: '' } }, max: 0 },
              { type: 'node', node: { component: 'search-index', config: { instances: 1 } }, max: 0 },
            ],
          },
        },
        {
          id: 'pipeline',
          weight: 2,
          description: 'Yeni komponentlərlə də crawler NoSQL-dən işləyir və işləri növbələrlə ötürür, Query API isə index-dən və Document Service-dən oxuyur.',
          hints: [
            'Komponent əlavə edəndən sonra crawl axını hələ də növbələrdən keçirmi?',
            'Crawler Service → NoSQL, Crawler Service → növbələr → Search Index və Document Service, Query API → Search Index və Document Service xətlərini saxlayın.',
            'Miqyaslanmış diaqram yüksək səviyyəli dizaynın bütün axınlarını saxlayır, sadəcə hər servis və növbə bir neçə nüsxədə işləyir və Query API-yə Memory Cache əlavə olunur.',
          ],
          check: { type: 'all-of', predicates: [CRAWL_STORE_USED, INDEX_THROUGH_QUEUE, DOCUMENTS_FROM_QUEUE, QUERY_READS] },
        },
        dnsRule('search.com'),
        allConnectedRule('Query API → Memory Cache'),
      ],
      // Mirrors web_crawler.png; the primer leaves internal load balancers out, and so does this.
      referenceSolution: {
        nodes: [
          node('client-1', 'client', 'Client', 0, 200),
          node('dns-1', 'dns', 'DNS', 240, 40),
          node('load-balancer-1', 'load-balancer', 'Load Balancer', 240, 200, { instances: 3 }),
          node('web-server-1', 'web-server', 'Web Server', 480, 200, { instances: 55 }),
          node('app-service-1', 'app-service', 'Query API', 720, 200, { instances: 100 }),
          node('search-index-1', 'search-index', 'Reverse Index Service', 960, 120, { shardKey: 'term', instances: 55 }),
          node('app-service-2', 'app-service', 'Document Service', 960, 280, { instances: 100 }),
          node('cache-1', 'cache', 'Memory Cache', 960, 440, { instances: 3 }),
          node('message-queue-1', 'message-queue', 'Queue', 1200, 120, { instances: 3 }),
          node('message-queue-2', 'message-queue', 'Queue', 1200, 280, { instances: 3 }),
          node('app-service-3', 'app-service', 'Crawler Service', 1440, 200, { instances: 3 }),
          node('nosql-store-1', 'nosql-store', 'NoSQL', 1440, 440),
        ],
        edges: [
          edge('client-1', 'dns-1', 'read'),
          edge('client-1', 'load-balancer-1', 'read'),
          edge('load-balancer-1', 'web-server-1', 'read'),
          edge('web-server-1', 'app-service-1', 'read'),
          edge('app-service-1', 'search-index-1', 'read'),
          edge('app-service-1', 'app-service-2', 'read'),
          edge('app-service-1', 'cache-1', 'read'),
          edge('app-service-3', 'message-queue-1', 'write'),
          edge('app-service-3', 'message-queue-2', 'write'),
          edge('message-queue-1', 'search-index-1', 'write'),
          edge('message-queue-2', 'app-service-2', 'write'),
          edge('app-service-3', 'nosql-store-1', 'both'),
        ],
      },
    },
  ],
}
