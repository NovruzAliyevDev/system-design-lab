// The Twitter timeline and search, from the primer's solution: tweets are fanned out to the home
// timelines of followers held in a memory cache, the user timeline lives in SQL, and a search index
// serves keyword searches. Reference Solutions mirror `twitter_basic.png` and `twitter.png`.
import type { ChallengeInput } from '../../src/core/challenges/challenge'
import type { NodeSelector, Predicate } from '../../src/core/challenges/rules'
import {
  allConnectedRule,
  apiPath,
  dnsRule,
  edge,
  entryPath,
  loadBalancerRule,
  node,
  QUEUES,
  readAndWritePaths,
  readReplicas,
  scaleOutRule,
  writesSpread,
} from './shared'

/** Where the user timeline (the user's own tweets) lives: the primer's SQL database, or a NoSQL store. */
const TWEET_STORE: NodeSelector[] = ['sql-database', 'nosql-store']
/** Where home timelines live: the primer's Memory Cache, or a NoSQL store with fast writes. */
const HOME_TIMELINES: NodeSelector[] = ['cache', 'nosql-store']

/** The Write API stores the tweet in the user timeline, and the Read API reads it from there. */
const TWEET_PATHS = readAndWritePaths(TWEET_STORE)
/** The fan-out writes the tweet into the home timelines, and the Timeline Service reads them. */
const HOME_TIMELINE_PATHS = readAndWritePaths(HOME_TIMELINES)
/** The fan-out indexes the tweet, and the Search API searches the index. */
const SEARCH_PATHS = readAndWritePaths(['search-index'])
/** The Write API hands the tweet on to a separate service that fans it out. */
const FAN_OUT: Predicate = { type: 'edge', from: 'app-service', to: 'app-service', traffic: 'write' }

export const twitter: ChallengeInput = {
  id: 'twitter',
  title: 'Twitter-in timeline və axtarışını dizayn edin',
  kind: 'architecture',
  source: 'primer',
  solutionId: 'twitter',
  lessonIds: [
    'design-the-twitter-timeline-and-search-or-facebook-feed-and-search',
    'reverse-proxy-web-server',
    'application-layer',
    'microservices',
    'cache',
    'relational-database-management-system-rdbms',
    'sql-or-nosql',
    'message-queues',
  ],
  // The primer's average traffic: 250 billion reads and 15 billion tweets a month, about 10 KB each.
  loadProfile: { readQps: 100_000, writeQps: 6_000, requestBytes: 10_000 },
  stages: [
    {
      id: 'requirements',
      type: 'requirements',
      weight: 1,
      prompt:
        'Twitter-in timeline və axtarış hissəsini dizayn edin: istifadəçi tweet yazır, öz timeline-ını və izlədiyi insanların timeline-ını (home timeline) görür, açar sözlərlə axtarış edir. Aşağıdakılardan bu tapşırığa aid olan istifadə hallarını (use case) və məhdudiyyətləri seçin, kənarda qalanları seçməyin. Fikirlərinizi qeydlərə yaza bilərsiniz.',
      solutionAnchor: 'step-1-outline-use-cases-and-constraints',
      items: [
        {
          section: 'use-case',
          text: 'İstifadəçi tweet yazır',
          correct: true,
          explanation: 'Servisin əsas yazma ssenarisi: tweet saxlanılır və izləyicilərə çatdırılır.',
        },
        {
          section: 'use-case',
          text: 'Servis tweet-i izləyicilərə çatdırır, push bildirişləri və e-poçt göndərir',
          correct: true,
          explanation: 'Primer fan-out-u əsas tələblərə daxil edir: tweet izləyicilərin home timeline-ına yazılır və onlara bildiriş gedir.',
        },
        {
          section: 'use-case',
          text: 'İstifadəçi öz timeline-ını (user timeline) görür',
          correct: true,
          explanation: 'İstifadəçinin öz tweet-lərindən ibarət timeline; primer onu SQL bazasından oxuyur.',
        },
        {
          section: 'use-case',
          text: 'İstifadəçi izlədiyi insanların timeline-ını (home timeline) görür',
          correct: true,
          explanation: 'Ən çətin hissə: home timeline izlənən hər kəsin tweet-lərindən yığılır, ona görə primer onu yazma zamanı fan-out ilə əvvəlcədən hazırlayır.',
        },
        {
          section: 'use-case',
          text: 'İstifadəçi açar sözlərlə axtarış edir',
          correct: true,
          explanation: 'Axtarış tapşırığın ikinci yarısıdır: tweet-lər search index-ə yazılır və oradan axtarılır.',
        },
        {
          section: 'use-case',
          text: 'Servis yüksək əlçatanlığa (high availability) malikdir',
          correct: true,
          explanation: 'Primer bunu servisin tələbi kimi qeyd edir; Scaling mərhələsində bir neçə server nüsxəsi və replikalar buna xidmət edir.',
        },
        {
          section: 'use-case',
          text: 'Servis tweet-ləri Twitter Firehose-a və digər axınlara ötürür',
          explanation: 'Primer Firehose-u açıq şəkildə kənarda saxlayır.',
        },
        {
          section: 'use-case',
          text: 'Servis tweet-ləri istifadəçinin görünürlük ayarlarına görə süzür (məsələn, @reply-ları gizlədir)',
          explanation: 'Görünürlük ayarları (@reply-ları, retweet-ləri gizlətmək) primer-də kənarda qalır.',
        },
        {
          section: 'use-case',
          text: 'Servis tweet-lər üzrə analytics hesablayır',
          explanation: 'Analytics bu tapşırığın hüdudundan kənardadır.',
        },
        {
          section: 'use-case',
          text: 'İstifadəçilər bir-birinə şəxsi mesaj (direct message) göndərir',
          explanation: 'Şəxsi mesajlar primer-in istifadə hallarında yoxdur: tapşırıq timeline və axtarışdır.',
        },
        {
          section: 'constraint',
          text: 'Trafik zaman üzrə bərabər paylanmayıb',
          correct: true,
          explanation: 'Pik anlarda yük ortalamadan çox olur; cache və bir neçə server nüsxəsi bunu udur.',
        },
        {
          section: 'constraint',
          text: 'Tweet yazmaq sürətli olmalıdır; milyonlarla izləyicisi olmayanlar üçün fan-out da sürətli olmalıdır',
          correct: true,
          explanation: 'Buna görə fan-out ayrıca servisdədir və çox izlənən istifadəçilər üçün ayrıca yanaşma lazım olur.',
        },
        {
          section: 'constraint',
          text: '100 milyon aktiv istifadəçi, gündə 500 milyon tweet (ayda 15 milyard), hər tweet orta hesabla 10 izləyiciyə çatdırılır',
          correct: true,
          explanation: 'Primer-in fərziyyələri: ayda 150 milyard fan-out çatdırılması, estimation bu rəqəmlərdən başlayır.',
        },
        {
          section: 'constraint',
          text: 'Ayda 250 milyard oxuma sorğusu və 10 milyard axtarış',
          correct: true,
          explanation: 'Oxumalar yazmalardan çox-çox artıqdır: timeline oxumaları sürətli olmalıdır.',
        },
        {
          section: 'constraint',
          text: 'Timeline oxumaları sürətli olmalıdır; Twitter oxumaya meyllidir, tweet qəbulu isə yazmaya meyllidir',
          correct: true,
          explanation: 'Oxuma yolu üçün home timeline-lar yaddaşda hazır saxlanılır; yazma yolu isə fan-out ilə çoxlu yazmaya çevrilir.',
        },
        {
          section: 'constraint',
          text: 'Axtarış sürətli olmalıdır və oxumaya meyllidir',
          correct: true,
          explanation: 'Axtarış search index-dən verilir; primer index-in gecikməni azaltmaq üçün yaddaşda saxlanılmalı olduğunu deyir.',
        },
        {
          section: 'constraint',
          text: 'Twitter-də yazmalar oxumalardan çoxdur',
          explanation: 'Əksinədir: ayda 250 milyard oxuma və 15 milyard tweet var, timeline oxumaya meyllidir.',
        },
        {
          section: 'constraint',
          text: 'Hər tweet orta hesabla 1000 izləyiciyə çatdırılır',
          explanation: 'Primer orta fan-out-u 10 çatdırılma fərz edir; 1000 izləyicili hesablar istisnadır və ayrıca həll olunur.',
        },
        {
          section: 'constraint',
          text: 'Axtarış nəticələri bir neçə dəqiqə gecikə bilər',
          explanation: 'Primer axtarışın sürətli olmasını tələb edir.',
        },
      ],
    },
    {
      id: 'estimation',
      type: 'estimation',
      weight: 1,
      prompt:
        'Fərziyyələr: ayda 15 milyard tweet yazılır və 250 milyard oxuma sorğusu gəlir. Bir tweet təxminən 10 KB-dır: tweet_id 8 bayt, user_id 32 bayt, mətn 140 bayt, media isə orta hesabla 10 KB. Məlumat 3 il saxlanılır. Primer-in yuvarlaq çevirmələrini işlədin: ayda 2,5 milyon saniyə, 1 KB = min bayt. Cavablar referansın 2 qatı daxilində olsa qəbul olunur.',
      solutionAnchor: 'calculate-usage',
      explanation:
        'Bir tweet: 8 + 32 + 140 bayt + 10 KB media ≈ 10 KB, primer hesablamada 10 KB götürür. Ayda təxminən 2,5 milyon saniyə var: saniyədə 400 sorğu ayda 1 milyard sorğu deməkdir. Primer eyni yolla ayda 150 milyard fan-out çatdırılmasını saniyədə 60 min, 10 milyard axtarışı isə saniyədə 4000 sorğu kimi hesablayır.',
      // A write stores a tweet with its media; reads are counted, not sized.
      inputs: { writesPerMonth: 15_000_000_000, readsPerMonth: 250_000_000_000, bytesPerWrite: 10_000, years: 3 },
      questions: [
        { id: 'write-qps', quantity: 'writeQps', prompt: 'Orta hesabla saniyədə neçə tweet yazılır?' },
        { id: 'read-qps', quantity: 'readQps', prompt: 'Orta hesabla saniyədə neçə oxuma sorğusu gəlir?' },
        { id: 'storage-per-month', quantity: 'storagePerMonth', prompt: 'Bir ayda nə qədər yeni tweet məzmunu yığılır?' },
        { id: 'storage-3-years', quantity: 'storageTotal', prompt: '3 ildə nə qədər tweet məzmunu yığılır?' },
      ],
    },
    {
      id: 'high-level-design',
      type: 'high-level-design',
      weight: 3,
      prompt:
        'İstifadəçi tweet yazır; tweet onun öz timeline-ına yazılır, izləyicilərinin home timeline-ına çatdırılır, axtarış üçün index-lənir, izləyicilərə bildiriş gedir. İstifadəçi öz timeline-ını və home timeline-ı görür, açar sözlərlə axtarış edir. Ayda 15 milyard tweet və 250 milyard oxuma gözlənilir. Bütün vacib komponentləri kətana qoyun, sorğuların axınını xətlərlə göstərin və "Yoxla" düyməsini basın.',
      solutionAnchor: 'step-2-create-a-high-level-design',
      rules: [
        {
          id: 'entry-point',
          weight: 2,
          description: 'Client sorğuları tətbiq serverlərinə web server (reverse proxy) və ya load balancer vasitəsilə çatır.',
          hints: [
            'Client sorğusu tətbiq kodunun işlədiyi serverə çatmazdan əvvəl ilk olaraq nəyə dəyir?',
            'Client ilə application service-lər arasına web server, reverse proxy və ya load balancer qoyun: hər sorğu ondan keçsin.',
            'Primer-də Client sorğuları reverse proxy rolunda işləyən Web Server-ə göndərir, o da sorğunu Read API, Write API və ya Search API serverinə ötürür. Client-dən application service-ə bu qatdan yan keçən yol olmamalıdır.',
          ],
          check: entryPath,
        },
        {
          id: 'user-timeline',
          weight: 2,
          description: 'Tweet tətbiq servisi vasitəsilə istifadəçinin timeline-ını saxlayan bazaya (SQL və ya NoSQL) yazılır və user timeline oradan oxunur.',
          hints: [
            'İstifadəçinin öz tweet-ləri harada saxlanılır ki, onun profilini açanda göstərilsin?',
            'SQL database əlavə edin: Write API-dən ona yazma, Read API-dən ona oxuma xətti çəkin.',
            'Primer istifadəçinin öz tweet-lərini (user timeline) relational database-də saxlayır: Write API tweet-i SQL bazasına yazır, Read API user timeline-ı oradan oxuyur. SQL ilə NoSQL arasındakı trade-off-u müzakirə etmək lazımdır, ona görə NoSQL store da qəbul olunur.',
          ],
          check: TWEET_PATHS,
        },
        {
          id: 'fan-out-service',
          weight: 2,
          description: 'Write API tweet-i ayrıca Fan Out Service-ə ötürür.',
          hints: [
            'Tweet-i 10 (və ya 1000) izləyicinin timeline-ına yaymaq işini Write API özü görməlidirmi?',
            'Yeni application service (Fan Out Service) əlavə edin və Write API-dən ona yazma xətti çəkin.',
            'Primer-də Write API tweet-i saxladıqdan sonra Fan Out Service ilə əlaqə saxlayır. O, izləyiciləri User Graph Service-dən öyrənir, tweet-i onların home timeline-ına yazır, search index-ə və Object Store-a ötürür, bildirişləri göndərir. Bu ağır və O(n) işi ayrıca servisə çıxarmaq onu ayrıca miqyaslamağa imkan verir.',
          ],
          check: FAN_OUT,
        },
        {
          id: 'home-timeline-cache',
          weight: 3,
          description: 'Home timeline-lar yaddaş cache-ində (və ya NoSQL-də) saxlanılır: fan-out tweet-i ora yazır, home timeline oradan oxunur.',
          hints: [
            'Saniyədə 60 min fan-out çatdırılmasını adi relational baza daşıya bilərmi? Home timeline hər açılışda yenidən yığılmalıdırmı?',
            'Memory Cache əlavə edin: fan-out servisindən ona yazma, home timeline-ı qaytaran servisdən (məsələn, Timeline Service) ona oxuma xətti çəkin.',
            'Primer-ə görə fan-out relational bazanı boğar, ona görə sürətli yazan anbar lazımdır: Memory Cache (məsələn, Redis siyahısı: tweet_id, user_id, meta) və ya NoSQL. Fan Out Service tweet-i izləyicilərin home timeline-ına yazır; Read API Timeline Service-ə müraciət edir, o da timeline-ı cache-dən O(1) ilə götürür.',
          ],
          check: HOME_TIMELINE_PATHS,
        },
        {
          id: 'search-index',
          weight: 2,
          description: 'Tweet-lər search index-ə yazılır və axtarış sorğuları tətbiq servisi vasitəsilə oradan oxunur.',
          hints: [
            'İstifadəçi "hello world" axtaranda milyardlarla tweet-i bir-bir yoxlamaq olarmı?',
            'Search Index komponenti əlavə edin: fan-out servisindən ona yazma, Search API-dən ona oxuma xətti çəkin.',
            'Primer-də Fan Out Service tweet-i Search Index Service-ə yazır ki, sürətli axtarmaq olsun. Search API Search Service-ə müraciət edir: o, sorğunu təhlil edir (markup-u silir, sözlərə bölür, səhvləri düzəldir) və Search Cluster-də (məsələn, Lucene) nəticələri scatter-gather ilə yığıb sıralayır.',
          ],
          check: SEARCH_PATHS,
        },
        {
          id: 'media-store',
          weight: 1,
          description: 'Foto və video kimi media object store-da saxlanılır.',
          hints: [
            'Tweet-in orta hesabla 10 KB-lıq mediası harada saxlanılmalıdır?',
            'Object Store əlavə edin və yazma yolunu ona qədər çəkin (məsələn, Fan Out Service-dən).',
            'Primer media-nı Object Store-da saxlamağı təklif edir: ayda 150 TB, 3 ildə 5,4 PB məzmunu idarə olunan object store rahat udur, bazalar isə kiçik qalır.',
          ],
          check: apiPath(['object-store'], 'write'),
        },
        {
          id: 'notification-queue',
          weight: 1,
          description: 'Bildirişlər növbə (queue) vasitəsilə asinxron göndərilir.',
          hints: [
            'Tweet yazan istifadəçi bütün izləyicilərə bildiriş gedənə qədər gözləməlidirmi?',
            'Fan-out servisi ilə Notification Service arasına Message Queue (və ya Task Queue) qoyun.',
            'Primer-də Notification Service push bildirişlərini və e-poçtları diaqramda göstərilməyən bir Queue vasitəsilə asinxron göndərir: tweet yazmaq sürətli qalır, bildirişlər isə arxa planda gedir.',
          ],
          check: { type: 'path', from: 'client', to: QUEUES, through: 'app-service', traffic: 'write' },
        },
        allConnectedRule('Fan Out Service → Memory Cache'),
      ],
      referenceSolution: {
        nodes: [
          node('client-1', 'client', 'Client', 0, 400),
          node('web-server-1', 'web-server', 'Web Server', 240, 400),
          node('app-service-1', 'app-service', 'Read API', 480, 160),
          node('app-service-2', 'app-service', 'Write API', 480, 440),
          node('app-service-3', 'app-service', 'Search API', 480, 720),
          node('app-service-4', 'app-service', 'Timeline Service', 720, 80),
          node('app-service-5', 'app-service', 'Fan Out Service', 720, 440),
          node('app-service-6', 'app-service', 'Tweet Info Service', 960, 0),
          node('app-service-7', 'app-service', 'User Info Service', 960, 120),
          node('cache-1', 'cache', 'Memory Cache', 960, 260),
          node('app-service-8', 'app-service', 'User Graph Service', 960, 400),
          // The primer's Notification Service sends through a queue it leaves out of the diagram.
          node('message-queue-1', 'message-queue', 'Queue', 960, 540),
          node('search-index-1', 'search-index', 'Search Service', 960, 720),
          node('sql-database-1', 'sql-database', 'MySQL', 1200, 240),
          node('app-service-9', 'app-service', 'Notification Service', 1200, 540),
          node('object-store-1', 'object-store', 'Object Store', 1200, 800),
        ],
        edges: [
          edge('client-1', 'web-server-1', 'both'),
          edge('web-server-1', 'app-service-1', 'read'),
          edge('web-server-1', 'app-service-2', 'write'),
          edge('web-server-1', 'app-service-3', 'read'),
          edge('app-service-1', 'app-service-4', 'read'),
          edge('app-service-1', 'sql-database-1', 'read'),
          edge('app-service-4', 'app-service-6', 'read'),
          edge('app-service-4', 'app-service-7', 'read'),
          edge('app-service-4', 'cache-1', 'read'),
          edge('app-service-2', 'sql-database-1', 'write'),
          edge('app-service-2', 'app-service-5', 'write'),
          edge('app-service-5', 'app-service-8', 'write'),
          edge('app-service-5', 'cache-1', 'write'),
          edge('app-service-5', 'search-index-1', 'write'),
          edge('app-service-5', 'message-queue-1', 'write'),
          edge('app-service-5', 'object-store-1', 'write'),
          edge('message-queue-1', 'app-service-9', 'write'),
          edge('app-service-3', 'search-index-1', 'read'),
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
          prompt: 'İzləyicilərin home timeline-ları hansı anbarlarda saxlanıla bilər ki, fan-out-un yazmalarına dözsün?',
          options: [
            {
              text: 'Memory Cache (məsələn, Redis siyahısı)',
              correct: true,
              explanation: 'Primer-in seçimi: yaddaşdan 1 MB oxumaq təxminən 250 mikrosaniyədir, SSD-dən 4 dəfə, diskdən 80 dəfə yavaş. Yazmalar da sürətlidir.',
            },
            {
              text: 'Sürətli yazan NoSQL database',
              correct: true,
              explanation: 'Primer bunu alternativ kimi göstərir: NoSQL yazmaları üfüqi miqyaslanır.',
            },
            {
              text: 'Tək relational database',
              explanation: 'Saniyədə 60 min fan-out çatdırılması adi relational bazanı həddən artıq yükləyər; primer məhz buna görə başqa anbar seçir.',
            },
            {
              text: 'Object Store',
              explanation: 'Object Store böyük faylları ucuz saxlayır, amma kiçik və tez-tez yazılan siyahılar üçün gecikməsi yüksəkdir.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Milyonlarla izləyicisi olan istifadəçinin tweet-i fan-out-da dəqiqələrlə ilişirsə, nə etmək olar?',
          options: [
            {
              text: 'Belə istifadəçilərin tweet-lərini fan-out etməmək; oxuma zamanı onları axtarışla tapıb home timeline ilə birləşdirmək',
              correct: true,
              explanation: 'Primer-in təklifi: çox izlənən hesabların tweet-ləri oxuma zamanı birləşdirilir və tweet-lər göstəriləndə yenidən sıralanır.',
            },
            {
              text: 'Fan-out-u Write API daxilində sinxron etmək ki, tweet hamıya çatanda cavab qayıtsın',
              explanation: 'Milyonlarla yazma bitənə qədər istifadəçi gözləyər; tweet yazmaq sürətli olmalıdır.',
            },
            {
              text: 'Belə istifadəçilərin izləyici sayını məhdudlaşdırmaq',
              explanation: 'Bu, məhsul tələbini dəyişir, texniki problemi həll etmir.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Home timeline necə oxunur?',
          options: [
            {
              text: 'Timeline Service cache-dən tweet və user id-lərini O(1) götürür, sonra Tweet Info və User Info servislərindən multiget ilə detalları alır',
              correct: true,
              explanation: 'Primer-in axını: timeline yaddaşda hazırdır, detallar isə n id üçün bir multiget sorğusu ilə O(n) gəlir.',
            },
            {
              text: 'Hər açılışda izlənən bütün istifadəçilərin tweet-lərini SQL-də join ilə yığmaq',
              explanation: 'Saniyədə 100 min oxumada bu join-lər bazanı boğar; primer timeline-ı yazma zamanı əvvəlcədən hazırlayır.',
            },
            {
              text: 'Bütün tweet-ləri tarixə görə skan edib izlənənləri süzmək',
              explanation: 'Milyardlarla tweet-i skan etmək çox yavaşdır.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Memory Cache-də nə saxlanılmalıdır ki, yaddaş kifayət etsin?',
          options: [
            {
              text: 'Hər home timeline üçün bir neçə yüz tweet, yalnız son 30 gündə aktiv olan istifadəçilər üçün',
              correct: true,
              explanation: 'Primer belə optimallaşdırır; aktiv olmayan istifadəçinin timeline-ı lazım olanda User Graph Service və SQL bazasından yenidən qurulur.',
            },
            {
              text: 'Hər istifadəçinin bütün tweet tarixçəsi',
              explanation: 'Petabaytlarla məlumat yaddaşa sığmaz; köhnə tweet-lər nadir oxunur.',
            },
            {
              text: 'Heç nə: hər oxuma bazadan',
              explanation: 'Onda saniyədə 100 min oxuma birbaşa bazaya düşər və timeline yavaşlayar.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Açar söz axtarışı necə işləyir?',
          options: [
            {
              text: 'Search Service sorğunu təhlil edir, Search Cluster-in hər serverində scatter-gather ilə axtarır, nəticələri birləşdirib sıralayır',
              correct: true,
              explanation: 'Primer-in axını: markup silinir, mətn sözlərə bölünür, səhvlər düzəlir, sorğu boolean əməliyyatlara çevrilir; Lucene kimi cluster cavab verir.',
            },
            {
              text: 'SQL bazasında LIKE \'%hello%\' sorğusu ilə',
              explanation: 'LIKE ilə axtarış index-dən istifadə etmir və hər sətri yoxlayır: saniyədə 4000 axtarışda işləməz.',
            },
            {
              text: 'Object Store-dakı bütün tweet fayllarını oxumaqla',
              explanation: 'Bu, hər axtarışda petabaytları oxumaq deməkdir.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Xarici və daxili əlaqə üçün hansı protokollar uyğundur?',
          options: [
            {
              text: 'Client-lər üçün public REST API, servislər arasında RPC',
              correct: true,
              explanation: 'Primer xarici API üçün REST-i (məsələn, POST /api/v1/tweet), daxili əlaqə üçün Remote Procedure Call-u təklif edir.',
            },
            {
              text: 'Hər yerdə yalnız RPC, client-lər də daxil',
              explanation: 'RPC client ilə servis arasında sıx bağlılıq yaradır; public API üçün REST daha sadə və cache-lənəndir.',
            },
            {
              text: 'Servislər arasında da hər dəfə public REST API vasitəsilə',
              explanation: 'İşləyər, amma daxili əlaqədə RPC daha sürətli və yığcamdır.',
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
        'Yüksək səviyyəli dizaynınızdan davam edin və onu məhdudiyyətlərə görə miqyaslayın: trafik qeyri-bərabərdir, oxumalar çox-çox artıqdır, tək SQL master bu qədər yazmanı daşımır. Dizayn primer-in orta yükünə dözməlidir: saniyədə 100 000 oxuma və 6 000 yazma altında oxumanın və yazmanın orta gecikməsi 200 ms-i keçməməli, heç bir node həddən artıq yüklənməməli və heç bir sorğu xəta ilə bitməməlidir. Bunu trafik simulyasiyası ilə yoxlayın. Darboğazları tapın, komponent əlavə edin və ya dəyişin, "Yoxla" düyməsini basın.',
      solutionAnchor: 'step-4-scale-the-design',
      rules: [
        {
          id: 'average-load',
          weight: 3,
          description: 'Orta yükdə (saniyədə 100 000 oxuma, 6 000 yazma) orta gecikmə 200 ms-dən çox deyil, həddən artıq yüklənən node və xəta yoxdur.',
          hints: [
            'Saniyədə 100 000 oxuma gələndə dizaynınızın hansı node-ları ilk tıxanır?',
            'Trafik simulyasiyasını işə salın və "Darboğazlar" siyahısına baxın. Ən çox yüklənən node-ların "instances" sahəsini artırın. Sadə simulyasiyada hər oxuma oxuma xətti olan bütün servislərə gedir, ona görə Search API də, Timeline Service də bütün oxumaları alır.',
            'Hər node bir nüsxədə məhdud sorğu emal edir: məsələn, web server təxminən 1000, application service 500, SQL bazası 1000 sorğu/san. Saniyədə 100 000 oxumada stateless servislər yüzlərlə nüsxəyə qədər horizontal miqyaslanır, home timeline-lar cache-dən verilir, user timeline oxumaları read replica-lara gedir, SQL yazmaları shard-lara bölünür, media isə bir neçə nüsxəli Object Store-dan oxunur.',
          ],
          check: { type: 'simulation', maxLatencyMs: { read: 200, write: 200 }, maxOverloadedNodes: 0, maxErrorRate: 0 },
        },
        loadBalancerRule,
        scaleOutRule,
        {
          id: 'read-replicas',
          weight: 2,
          description: 'User timeline oxumaları read replica-lara gedir.',
          hints: [
            'User timeline oxumalarını yazmaları qəbul edən eyni baza serveri emal etməlidirmi?',
            'Ya "replica" rolunda ikinci SQL database əlavə edib Read API-dən ona oxuma xətti çəkin, ya da primary bazanın "replicas" sahəsini 1 və ya daha çox edin.',
            'Primer-in miqyaslanmış diaqramında Read API SQL Read Replicas-dan oxuyur, yazmalar isə SQL Write Master-Slave-ə gedir. Primer xəbərdarlıq edir ki, cache bazanın yükünü azaltsa da, cache miss-ləri üçün təkcə read replica-lar kifayət etməyə bilər.',
          ],
          check: { type: 'any-of', predicates: [...readReplicas('sql-database'), ...readReplicas('nosql-store')] },
        },
        {
          id: 'write-scaling',
          weight: 2,
          description: 'Yazmalar bir SQL master-ə yığılmır: baza shard-lara bölünüb (sharding) və ya funksiyalarına görə bir neçə bazaya ayrılıb (federation).',
          hints: [
            'Saniyədə 6000 tweet-i tək SQL Write Master qəbul edə bilərmi?',
            'Tweet bazasının tənzimləməsində "shardKey" sahəsini (məsələn, user_id) yazın və "instances" sahəsini 2 və ya daha çox edin, ya da məlumatı funksiyasına görə ikinci primary bazaya ayırın.',
            'Primer deyir ki, yüksək yazma həcmi tək SQL Write Master-Slave-i boğar və əlavə SQL miqyaslama üsulları lazımdır: federation, sharding, denormalization, SQL tuning, ya da məlumatın bir hissəsini NoSQL-ə köçürmək. Sharding-də hər shard məlumatın bir hissəsini (məsələn, user_id-yə görə) saxlayır və yazmalar shard-lar arasında bölünür.',
          ],
          check: writesSpread,
        },
        {
          id: 'core-paths',
          weight: 2,
          description: 'Yeni komponentlərlə də tweet user timeline-a, fan-out ilə home timeline-lara və search index-ə çatır, oxumalar isə tətbiq servisləri vasitəsilə gedir.',
          hints: [
            'Komponent əlavə edəndən sonra tweet hələ də hər üç yerə (user timeline, home timeline, search index) çatırmı?',
            'Write API → Fan Out Service, fan-out-dan cache-ə və search index-ə yazma, Read API-dən baza və timeline-a, Search API-dən search index-ə oxuma xətlərini saxlayın.',
            'Miqyaslanmış diaqram yüksək səviyyəli dizaynın bütün yollarını saxlayır, sadəcə hər servis bir neçə nüsxədə işləyir: Write API SQL Write Master-Slave-ə yazır və Fan Out Service-ə ötürür, Fan Out Service Memory Cache-ə və Search Service-ə yazır, Read API Timeline Service və SQL Read Replicas-dan, Search API Search Service-dən oxuyur.',
          ],
          check: { type: 'all-of', predicates: [TWEET_PATHS, FAN_OUT, HOME_TIMELINE_PATHS, SEARCH_PATHS] },
        },
        {
          id: 'cdn',
          weight: 1,
          description: 'Client statik məzmunu və media-nı CDN-dən alır.',
          hints: [
            'Populyar tweet-in şəklini hər dəfə Object Store-dan vermək lazımdırmı?',
            'CDN komponenti əlavə edin, Client-dən ona və ondan Object Store-a xətt çəkin.',
            'Primer-in diaqramında Client statik məzmunu CDN-dən alır, CDN isə onu Object Store-dan götürür: media istifadəçiyə yaxın verilir, serverlərin yükü azalır.',
          ],
          check: { type: 'edge', from: 'client', to: 'cdn' },
        },
        dnsRule('twitter.com'),
        allConnectedRule('Read API → Timeline Service'),
      ],
      // Mirrors twitter.png; the primer leaves internal load balancers out, and so does this. At the average
      // load each read reaches every Node a read can go to, so the read services run on hundreds of instances.
      referenceSolution: {
        nodes: [
          node('client-1', 'client', 'Client', 0, 480),
          node('dns-1', 'dns', 'DNS', 240, 40, { instances: 2 }),
          node('cdn-1', 'cdn', 'CDN', 240, 200, { instances: 3 }),
          node('load-balancer-1', 'load-balancer', 'Load Balancer', 240, 480, { instances: 8 }),
          node('web-server-1', 'web-server', 'Web Server', 480, 480, { instances: 140 }),
          node('app-service-1', 'app-service', 'Read API', 720, 240, { instances: 250 }),
          node('app-service-2', 'app-service', 'Write API', 720, 520, { instances: 15 }),
          node('app-service-3', 'app-service', 'Search API', 720, 800, { instances: 250 }),
          node('app-service-4', 'app-service', 'Timeline Service', 960, 120, { instances: 250 }),
          node('app-service-5', 'app-service', 'Fan Out Service', 960, 520, { instances: 15 }),
          node('app-service-6', 'app-service', 'Tweet Info Service', 1200, 0, { instances: 250 }),
          node('app-service-7', 'app-service', 'User Info Service', 1200, 120, { instances: 250 }),
          node('cache-1', 'cache', 'Memory Cache', 1200, 260, { instances: 3 }),
          node('app-service-8', 'app-service', 'User Graph Service', 1200, 400, { instances: 15 }),
          node('message-queue-1', 'message-queue', 'Queue', 1200, 540),
          node('search-index-1', 'search-index', 'Search Service', 1200, 800, { instances: 140 }),
          node('sql-database-2', 'sql-database', 'SQL Read Replicas', 1440, 120, { role: 'replica', instances: 140 }),
          node('sql-database-1', 'sql-database', 'SQL Write Master-Slave', 1440, 300, { shardKey: 'user_id', instances: 8 }),
          node('app-service-9', 'app-service', 'Notification Service', 1440, 540, { instances: 15 }),
          // The CDN passes every read on, and an Object Store read starts at 40 ms: it runs well below capacity.
          node('object-store-1', 'object-store', 'Object Store', 1440, 800, { instances: 200 }),
        ],
        edges: [
          edge('client-1', 'dns-1', 'read'),
          edge('client-1', 'cdn-1', 'read'),
          edge('client-1', 'load-balancer-1', 'both'),
          edge('cdn-1', 'object-store-1', 'read'),
          edge('load-balancer-1', 'web-server-1', 'both'),
          edge('web-server-1', 'app-service-1', 'read'),
          edge('web-server-1', 'app-service-2', 'write'),
          edge('web-server-1', 'app-service-3', 'read'),
          edge('app-service-1', 'app-service-4', 'read'),
          edge('app-service-1', 'sql-database-2', 'read'),
          edge('app-service-4', 'app-service-6', 'read'),
          edge('app-service-4', 'app-service-7', 'read'),
          edge('app-service-4', 'cache-1', 'read'),
          edge('app-service-2', 'sql-database-1', 'write'),
          edge('app-service-2', 'app-service-5', 'write'),
          edge('app-service-5', 'app-service-8', 'write'),
          edge('app-service-5', 'cache-1', 'write'),
          edge('app-service-5', 'search-index-1', 'write'),
          edge('app-service-5', 'message-queue-1', 'write'),
          edge('app-service-5', 'object-store-1', 'write'),
          edge('message-queue-1', 'app-service-9', 'write'),
          edge('app-service-3', 'search-index-1', 'read'),
        ],
      },
    },
  ],
}
