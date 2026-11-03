// Amazon's sales rank by category, from the primer's solution: the Sales API keeps raw sales logs in an
// Object Store; the Sales Rank Service runs MapReduce over them every hour and writes the past week's rank
// per category to a SQL `sales_rank` table, which the Read API serves. Reference Solutions mirror
// `sales_rank_basic.png` and `sales_rank.png`.
//
// Only Clients send traffic, so the Sales Rank Service, which no request reaches, is checked by structure
// and not load-tested.
import type { ChallengeInput } from '../../src/core/challenges/challenge'
import type { NodeSelector, Predicate } from '../../src/core/challenges/rules'
import { allConnectedRule, apiPath, dnsRule, edge, entryPath, loadBalancerRule, node, readReplicas, scaleOutRule, writesSpread } from './shared'

/** Where the `sales_rank` table lives: the primer's SQL database, or NoSQL. */
const DATABASE: NodeSelector[] = ['sql-database', 'nosql-store']
/** What runs the ranking: an application service, or a MapReduce (analytics) job. */
const RANKER: NodeSelector[] = ['app-service', 'analytics']

/** The Sales API keeps the raw sales logs in an Object Store. */
const SALES_LOGS: Predicate = apiPath(['object-store'], 'write')
/** A ranker reads the logs from the Object Store and writes the rank to the database. */
const RANK_JOB: Predicate = {
  type: 'any-of',
  predicates: RANKER.flatMap((ranker) =>
    DATABASE.map((store): Predicate => ({
      type: 'all-of',
      predicates: [
        { type: 'edge', from: ranker, to: 'object-store', traffic: 'read' },
        { type: 'edge', from: ranker, to: store, traffic: 'write' },
      ],
    })),
  ),
}
/** The Read API reads the rank from the database. */
const RANK_READS: Predicate = apiPath(DATABASE, 'read')

export const salesRank: ChallengeInput = {
  id: 'sales-rank',
  title: 'Amazon-un kateqoriya üzrə satış reytinqini dizayn edin',
  kind: 'architecture',
  source: 'primer',
  solutionId: 'sales_rank',
  lessonIds: [
    'design-amazons-sales-ranking-by-category-feature',
    'reverse-proxy-web-server',
    'application-layer',
    'relational-database-management-system-rdbms',
    'sql-or-nosql',
    'cache',
    'content-delivery-network',
    'representational-state-transfer-rest',
  ],
  // The primer's average traffic: 1 billion sales and 100 billion reads a month, about 40 bytes a sale.
  loadProfile: { readQps: 40_000, writeQps: 400, requestBytes: 40 },
  stages: [
    {
      id: 'requirements',
      type: 'requirements',
      weight: 1,
      prompt:
        'Amazon-un "kateqoriya üzrə ən çox satılanlar" funksiyasını dizayn edin: servis keçən həftənin ən populyar məhsullarını hər kateqoriya üçün hesablayır, istifadəçi onlara baxır. Aşağıdakılardan bu tapşırığa aid olan istifadə hallarını (use case) və məhdudiyyətləri seçin, kənarda qalanları seçməyin. Fikirlərinizi qeydlərə yaza bilərsiniz.',
      solutionAnchor: 'step-1-outline-use-cases-and-constraints',
      items: [
        {
          section: 'use-case',
          text: 'Servis keçən həftənin ən populyar məhsullarını kateqoriyalar üzrə hesablayır',
          correct: true,
          explanation: 'Bu, tapşırığın əsasıdır: satış loglarından hər kateqoriya üçün reytinq qurulur.',
        },
        {
          section: 'use-case',
          text: 'İstifadəçi keçən həftənin ən populyar məhsullarına kateqoriya üzrə baxır',
          correct: true,
          explanation: 'Hazır reytinq sales_rank cədvəlindən oxunur.',
        },
        {
          section: 'use-case',
          text: 'Servis yüksək əlçatanlığa (high availability) malikdir',
          correct: true,
          explanation: 'Primer bunu servisin tələbi kimi qeyd edir.',
        },
        {
          section: 'use-case',
          text: 'İstifadəçi məhsulu səbətə atır və ödəniş edir',
          explanation: 'Ümumi e-ticarət saytı açıq şəkildə kənarda qalır: yalnız satış reytinqini hesablayan komponentlər dizayn olunur.',
        },
        {
          section: 'use-case',
          text: 'Servis hər istifadəçiyə alış tarixçəsinə görə fərdi tövsiyələr verir',
          explanation: 'Reytinq hamı üçün eynidir və kateqoriyaya görədir; fərdi tövsiyələr başqa tapşırıqdır.',
        },
        {
          section: 'constraint',
          text: 'Trafik zaman üzrə bərabər paylanmayıb',
          correct: true,
          explanation: 'Pik anlarda oxumalar ortalamadan xeyli çox olur; cache bunu udur.',
        },
        {
          section: 'constraint',
          text: 'Məhsul bir neçə kateqoriyada ola bilər, amma kateqoriyasını dəyişə bilməz',
          correct: true,
          explanation: 'Buna görə hər satış (kateqoriya, məhsul) cütləri üzrə sayılır və köhnə satışları başqa kateqoriyaya köçürmək lazım gəlmir.',
        },
        {
          section: 'constraint',
          text: 'Alt kateqoriyalar (foo/bar/baz kimi) yoxdur',
          correct: true,
          explanation: 'Reytinq düz 1000 kateqoriya üzrə hesablanır, iyerarxiya boyunca cəmləmək lazım deyil.',
        },
        {
          section: 'constraint',
          text: 'Nəticələr saatda bir yenilənməlidir; populyar məhsullar daha tez-tez yenilənə bilər',
          correct: true,
          explanation: 'Reytinq real vaxtda deyil, periodik batch işi (MapReduce) ilə hesablana bilər.',
        },
        {
          section: 'constraint',
          text: '10 milyon məhsul, 1000 kateqoriya',
          correct: true,
          explanation: 'Reytinq cədvəli kiçikdir: hər kateqoriya üçün ən çox satılanlar.',
        },
        {
          section: 'constraint',
          text: 'Ayda 1 milyard satış və 100 milyard oxuma sorğusu: oxuma:yazma nisbəti 100:1',
          correct: true,
          explanation: 'Servis oxumaya çox meyllidir: oxumalar cache-dən və replica-lardan verilməlidir.',
        },
        {
          section: 'constraint',
          text: 'Reytinq hər satışdan dərhal sonra yenilənməlidir',
          explanation: 'Primer saatda bir yeniləməni kifayət sayır; hər satışda yeniləmək lazım deyil.',
        },
        {
          section: 'constraint',
          text: 'Kateqoriyaların alt kateqoriyaları var və reytinq hər səviyyədə hesablanır',
          explanation: 'Primer alt kateqoriyaların olmadığını fərz edir.',
        },
        {
          section: 'constraint',
          text: 'Yazmalar oxumalardan 100 dəfə çoxdur',
          explanation: 'Əksinədir: oxumalar yazmalardan 100 dəfə çoxdur.',
        },
      ],
    },
    {
      id: 'estimation',
      type: 'estimation',
      weight: 1,
      prompt:
        'Fərziyyələr: ayda 1 milyard satış (əməliyyat) yazılır və 100 milyard oxuma sorğusu gəlir. Bir əməliyyat bu sahələrdir: created_at 5 bayt, product_id 8 bayt, category_id 4 bayt, seller_id 8 bayt, buyer_id 8 bayt, quantity 4 bayt, total_price 5 bayt; primer bunu təxminən 40 bayt sayır. Əməliyyatların çoxu yenidir, köhnələrin yenilənməsi deyil. Məlumat 3 il saxlanılır. Primer-in yuvarlaq çevirmələrini işlədin: ayda 2,5 milyon saniyə, 1 KB = min bayt. Cavablar referansın 2 qatı daxilində olsa qəbul olunur.',
      solutionAnchor: 'calculate-usage',
      explanation:
        'Bir əməliyyat: 5 + 8 + 4 + 8 + 8 + 4 + 5 = 42 bayt, primer bunu təxminən 40 bayta yuvarlaqlaşdırır. Ayda təxminən 2,5 milyon saniyə var: saniyədə 400 sorğu ayda 1 milyard sorğu deməkdir. Primer qeyd edir ki, bunlar orta rəqəmlərdir: pik anlarda yük daha yüksəkdir.',
      // The primer rounds the 42 bytes of a sale to about 40.
      inputs: { writesPerMonth: 1_000_000_000, readsPerMonth: 100_000_000_000, bytesPerWrite: 40, years: 3 },
      questions: [
        { id: 'write-qps', quantity: 'writeQps', prompt: 'Orta hesabla saniyədə neçə satış yazılır?' },
        { id: 'read-qps', quantity: 'readQps', prompt: 'Orta hesabla saniyədə neçə oxuma sorğusu gəlir?' },
        { id: 'storage-per-month', quantity: 'storagePerMonth', prompt: 'Bir ayda nə qədər yeni əməliyyat məlumatı yığılır?' },
        { id: 'storage-3-years', quantity: 'storageTotal', prompt: '3 ildə nə qədər əməliyyat məlumatı yığılır?' },
      ],
    },
    {
      id: 'high-level-design',
      type: 'high-level-design',
      weight: 3,
      prompt:
        'Satışlar sistemə yazılır; servis saatda bir keçən həftənin satışlarından hər kateqoriya üçün ən populyar məhsulların reytinqini hesablayır; istifadəçi kateqoriyanın reytinqinə baxır. Ayda 1 milyard satış və 100 milyard oxuma gözlənilir. Bütün vacib komponentləri kətana qoyun, sorğuların axınını xətlərlə göstərin və "Yoxla" düyməsini basın.',
      solutionAnchor: 'step-2-create-a-high-level-design',
      rules: [
        {
          id: 'entry-point',
          weight: 2,
          description: 'Client sorğuları tətbiq serverlərinə web server (reverse proxy) və ya load balancer vasitəsilə çatır.',
          hints: [
            'Client sorğusu tətbiq kodunun işlədiyi serverə çatmazdan əvvəl ilk olaraq nəyə dəyir?',
            'Client ilə application service arasına web server, reverse proxy və ya load balancer qoyun: hər sorğu ondan keçsin.',
            'Primer-də Client sorğuları reverse proxy rolunda işləyən Web Server-ə göndərir, o da satışları Sales API-yə, oxumaları Read API-yə ötürür. Client-dən application service-ə bu qatdan yan keçən yol olmamalıdır.',
          ],
          check: entryPath,
        },
        {
          id: 'sales-logs',
          weight: 2,
          description: 'Sales API satışların xam loglarını object store-da saxlayır.',
          hints: [
            'Reytinqi hesablamaq üçün keçən həftənin bütün satışları harada saxlanılsın?',
            'Object Store əlavə edin və Sales API-dən (application service) ona yazma xətti çəkin.',
            'Primer-ə görə Sales API server log faylları öz paylanmış fayl sistemimizi idarə etmək əvəzinə Amazon S3 kimi idarə olunan Object Store-da saxlanıla bilər: o, ayda 40 GB yeni məzmunu rahat udur.',
          ],
          check: SALES_LOGS,
        },
        {
          id: 'rank-job',
          weight: 3,
          description: 'Sales Rank Service (və ya MapReduce işi) logları object store-dan oxuyur və reytinqi bazanın sales_rank cədvəlinə yazır.',
          hints: [
            'Milyardlarla satışdan kateqoriya reytinqini kim, nə vaxt hesablayır? Bu iş istifadəçi sorğusunun içində olmalıdırmı?',
            'Sales Rank Service (application service və ya Analytics) əlavə edin: ondan Object Store-a oxuma, SQL bazasına isə yazma xətti çəkin.',
            'Primer-də Sales Rank Service Sales API loglarını giriş kimi götürüb çoxaddımlı MapReduce işlədir: əvvəl (kateqoriya, məhsul) üzrə satış sayını cəmləyir, sonra paylanmış sıralama edir, nəticəni SQL bazasının sales_rank aqreqat cədvəlinə yazır. Bu iş heç bir istifadəçi sorğusunun yolunda deyil.',
          ],
          check: RANK_JOB,
        },
        {
          id: 'rank-reads',
          weight: 2,
          description: 'Read API kateqoriyanın reytinqini bazadan oxuyur.',
          hints: [
            'İstifadəçi kateqoriyanın reytinqini açanda nəticə haradan gəlir?',
            'Read API (application service) əlavə edin, Web Server-dən ona və ondan SQL bazasına "Oxuma" trafikli xətlər çəkin.',
            'Primer-də Web Server oxuma sorğusunu Read API-yə ötürür, o da sales_rank cədvəlindən oxuyur: curl https://amazon.com/api/v1/popular?category_id=1234. Cədvəldə id, category_id və product_id üzrə indekslər axtarışı log-time edir.',
          ],
          check: RANK_READS,
        },
        allConnectedRule('Sales Rank Service → Object Store'),
      ],
      referenceSolution: {
        nodes: [
          node('client-1', 'client', 'Client', 0, 200),
          node('web-server-1', 'web-server', 'Web Server', 240, 200),
          node('app-service-1', 'app-service', 'Sales API', 480, 80),
          node('app-service-2', 'app-service', 'Read API', 480, 320),
          node('app-service-3', 'app-service', 'Sales Rank Service', 480, 520),
          node('sql-database-1', 'sql-database', 'SQL', 720, 200),
          node('object-store-1', 'object-store', 'Object Store', 720, 440),
        ],
        edges: [
          edge('client-1', 'web-server-1', 'both'),
          edge('web-server-1', 'app-service-1', 'write'),
          edge('web-server-1', 'app-service-2', 'read'),
          edge('app-service-1', 'sql-database-1', 'write'),
          edge('app-service-1', 'object-store-1', 'write'),
          edge('app-service-2', 'sql-database-1', 'read'),
          edge('app-service-3', 'object-store-1', 'read'),
          edge('app-service-3', 'sql-database-1', 'write'),
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
          prompt: 'Xam satış loglarını harada saxlamaq olar?',
          options: [
            {
              text: 'Amazon S3 kimi idarə olunan Object Store-da',
              correct: true,
              explanation: 'Primer-in seçimi: öz paylanmış fayl sistemimizi idarə etmək lazım deyil, ayda 40 GB rahat sığır və MapReduce faylları birbaşa oxuyur.',
            },
            {
              text: 'Öz idarə etdiyimiz paylanmış fayl sistemində',
              explanation: 'İşləyər, amma replikasiya, disk və nasazlıqlarla özümüz məşğul olmalıyıq; idarə olunan servis bu yükü götürür.',
            },
            {
              text: 'Hər satışı reytinq cədvəlinin olduğu SQL bazasında sətir kimi',
              explanation: 'Baza həm saniyədə 400 yazmanı, həm də həftəlik böyük aqreqasiyanı daşımalı olardı; xam loglar ucuz object store-da daha yaxşı yerləşir.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Keçən həftənin reytinqini necə hesablamaq olar?',
          options: [
            {
              text: 'Çoxaddımlı MapReduce: əvvəl (kateqoriya, məhsul) üzrə satış sayını cəmləmək, sonra paylanmış sıralama',
              correct: true,
              explanation: 'Primer-in SalesRanker işi belədir: mapper keçən həftənin satışlarını seçir, reducer cəmləyir, ikinci addım isə açarı (kateqoriya, say) edib shuffle/sort ilə sıralayır.',
            },
            {
              text: 'Read API hər sorğuda keçən həftənin satışlarını cəmləyib sıralayır',
              explanation: 'Saniyədə 40 000 oxumada hər biri milyonlarla satışı skan edərdi; reytinq əvvəlcədən hesablanmalıdır.',
            },
            {
              text: 'Bir maşında bütün logları yaddaşa yükləyib sıralamaq',
              explanation: 'Həftəlik loglar 10 GB-a yaxındır və böyüyür: paylanmış emal daha etibarlı miqyaslanır.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'MapReduce-un ikinci addımında açar niyə (kateqoriya, say) edilir?',
          options: [
            {
              text: 'Shuffle/sort mərhələsi açarları sıralayır: beləcə hər kateqoriyanın məhsulları satış sayına görə sıralanmış gəlir',
              correct: true,
              explanation: 'Primer-in mapper_sort addımı belədir: sıralamanı MapReduce-un özü paylanmış şəkildə görür.',
            },
            {
              text: 'Məhsulun id-sini gizlətmək üçün',
              explanation: 'Məhsul id-si dəyər kimi qalır; açarın dəyişməsi yalnız sıralama üçündür.',
            },
            {
              text: 'Bir məhsulun bir neçə kateqoriyada sayılmaması üçün',
              explanation: 'Əksinə, məhsul bir neçə kateqoriyada ola bilər və hər birində ayrıca sayılır.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'sales_rank cədvəlində axtarışı necə sürətləndirmək olar?',
          options: [
            {
              text: 'id, category_id və product_id üzrə indekslər yaratmaq',
              correct: true,
              explanation: 'Primer bunu təklif edir: indeks axtarışı bütün cədvəli skan etmək əvəzinə log-time edir və məlumatı yaddaşda saxlamağa kömək edir.',
            },
            {
              text: 'total_sold üzrə yalnız bir indeks',
              explanation: 'Sorğu kateqoriyaya görədir: category_id indeksi olmadan hər kateqoriya üçün cədvəl skan olunar.',
            },
            {
              text: 'İndeks olmadan, çünki cədvəl saatda bir yenilənir',
              explanation: 'Cədvəl az yenilənir, amma çox oxunur: indekslər məhz belə cədvəllər üçün sərfəlidir.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Client-lər reytinqi hansı API ilə alır, servislər öz aralarında necə danışır?',
          options: [
            {
              text: 'Xaricdən public REST API (GET /api/v1/popular?category_id=1234), daxildə RPC',
              correct: true,
              explanation: 'Primer belə təklif edir: REST xarici client-lər üçün sadə və cache-lənəndir, RPC isə daxili çağırışlar üçün səmərəlidir.',
            },
            {
              text: 'Client-lər birbaşa SQL bazasına qoşulur',
              explanation: 'Baza internetə açılır, sxem dəyişikliyi client-ləri sındırır və yükü idarə etmək olmur.',
            },
            {
              text: 'Hər yerdə, o cümlədən public client-lər üçün RPC',
              explanation: 'RPC client ilə servis arasında sıx bağlılıq yaradır; public API üçün REST daha sadə və cache-lənəndir.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Reytinq nə qədər tez-tez yenidən hesablanmalıdır?',
          options: [
            {
              text: 'Saatda bir; daha populyar məhsullar üçün daha tez-tez',
              correct: true,
              explanation: 'Məhdudiyyət belədir: batch işi saatda bir işləyir, reytinq bir saatadək köhnə ola bilər.',
            },
            {
              text: 'Hər satışdan sonra',
              explanation: 'Saniyədə 400 satışda həftəlik aqreqasiyanı hər dəfə yenidən hesablamaq lazımsız bahalıdır.',
            },
            {
              text: 'Həftədə bir',
              explanation: 'Reytinq "keçən həftə" üzrədir, amma tələb saatlıq yeniləmədir: həftəlik iş çox köhnə nəticə verərdi.',
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
        'Yüksək səviyyəli dizaynınızdan davam edin və onu məhdudiyyətlərə görə miqyaslayın: trafik qeyri-bərabərdir, servis oxumaya çox meyllidir, tək SQL Write Master-Slave saniyədə 400 yazmanı çətin daşıyır. Dizayn primer-in orta yükünə dözməlidir: saniyədə 40 000 oxuma və 400 yazma altında oxumanın və yazmanın orta gecikməsi 200 ms-i keçməməli, heç bir node həddən artıq yüklənməməli və heç bir sorğu xəta ilə bitməməlidir. Bunu trafik simulyasiyası ilə yoxlayın. Darboğazları tapın, komponent əlavə edin və ya dəyişin, "Yoxla" düyməsini basın.',
      solutionAnchor: 'step-4-scale-the-design',
      rules: [
        {
          id: 'average-load',
          weight: 3,
          description: 'Orta yükdə (saniyədə 40 000 oxuma, 400 yazma) orta gecikmə 200 ms-dən çox deyil, həddən artıq yüklənən node və xəta yoxdur.',
          hints: [
            'Saniyədə 40 000 oxuma gələndə dizaynınızın hansı node-u ilk tıxanır?',
            'Trafik simulyasiyasını işə salın və "Darboğazlar" siyahısına baxın. Ən çox yüklənən node-ların "instances" sahəsini artırın, oxumaları isə cache-dən və read replica-lardan verin.',
            'Hər node bir nüsxədə məhdud sorğu emal edir: məsələn, load balancer təxminən 20 000, web server 1000, application service 500, SQL bazası 1000 sorğu/san. Saniyədə 40 000 oxumada web server-lər və Read API onlarla nüsxəyə qədər horizontal miqyaslanır, cache oxumaların çoxunu götürür, qalanlar read replica-lara gedir; CDN-in özü cavablamadığı oxumalar Object Store-a çatır, onun oxuması 40 ms-dən başlayır, ona görə o da bir çox nüsxədə işləməlidir.',
          ],
          check: { type: 'simulation', maxLatencyMs: { read: 200, write: 200 }, maxOverloadedNodes: 0, maxErrorRate: 0 },
        },
        loadBalancerRule,
        scaleOutRule,
        {
          id: 'memory-cache',
          weight: 2,
          description: 'Read API populyar kateqoriyaların reytinqini yaddaş cache-indən oxuyur.',
          hints: [
            'Saatda bir dəyişən reytinqi hər oxumada bazadan götürmək lazımdırmı?',
            'Memory Cache əlavə edin və Read API-dən ona "Oxuma" trafikli xətt çəkin.',
            'Primer-ə görə saniyədə orta hesabla 40 000 oxumanı (pikdə daha çox) daşımaq üçün populyar məzmunun və onun reytinqinin trafiki bazadan yox, Memory Cache-dən verilməlidir. Cache qeyri-bərabər trafiki və sıçrayışları da udur.',
          ],
          check: { type: 'edge', from: 'app-service', to: 'cache', traffic: 'read' },
        },
        {
          id: 'read-replicas',
          weight: 2,
          description: 'Cache-də olmayan oxumalar read replica-lara gedir.',
          hints: [
            'Cache miss-ləri yazmaları qəbul edən eyni baza serverinə düşməlidirmi?',
            'Ya "replica" rolunda ikinci SQL database əlavə edib Read API-dən ona oxuma xətti çəkin, ya da primary bazanın "replicas" sahəsini 1 və ya daha çox edin.',
            'Primer-in diaqramında Read API cache miss-lərini SQL Read Replicas-dan oxuyur. Primer xəbərdarlıq edir ki, oxumalar çox olduğundan replica-lar da cache miss-lərini çətin daşıya bilər və əlavə SQL miqyaslama üsulları lazım ola bilər.',
          ],
          check: { type: 'any-of', predicates: [...readReplicas('sql-database'), ...readReplicas('nosql-store')] },
        },
        {
          id: 'write-scaling',
          weight: 2,
          description: 'Yazmalar bir SQL master-ə yığılmır: baza shard-lara bölünüb (sharding) və ya funksiyalarına görə bir neçə bazaya ayrılıb (federation).',
          hints: [
            'Saniyədə orta hesabla 400 (pikdə daha çox) yazmanı tək SQL Write Master-Slave qəbul edə bilərmi?',
            'Bazanın tənzimləməsində "shardKey" sahəsini (məsələn, category_id) yazın və "instances" sahəsini 2 və ya daha çox edin, ya da məlumatı funksiyasına görə ikinci primary bazaya ayırın.',
            'Primer deyir ki, saniyədə 400 orta yazma tək SQL Write Master-Slave üçün çətin ola bilər və əlavə SQL miqyaslama üsulları lazımdır: federation, sharding, denormalization, SQL tuning, ya da məlumatın bir hissəsini NoSQL-ə köçürmək.',
          ],
          check: writesSpread,
        },
        {
          id: 'pipeline',
          weight: 2,
          description: 'Yeni komponentlərlə də satış logları Object Store-a yazılır, reytinq oradan hesablanıb bazaya yazılır və Read API onu oxuyur.',
          hints: [
            'Komponent əlavə edəndən sonra reytinq hələ də satış loglarından hesablanırmı?',
            'Sales API → Object Store, Sales Rank Service → Object Store (oxuma) və → baza (yazma), Read API → baza (oxuma) xətlərini saxlayın.',
            'Miqyaslanmış diaqram yüksək səviyyəli dizaynın bütün axınlarını saxlayır, sadəcə hər servis bir neçə nüsxədə işləyir; Read API isə oxumaları Memory Cache və SQL Read Replicas-dan verir.',
          ],
          check: { type: 'all-of', predicates: [SALES_LOGS, RANK_JOB, RANK_READS] },
        },
        {
          id: 'cdn',
          weight: 1,
          description: 'Client statik məzmunu CDN-dən alır.',
          hints: [
            'Bütün istifadəçilərə eyni olan statik fayllar (JS, CSS, şəkillər) hər dəfə serverlərinizdən verilməlidirmi?',
            'CDN komponenti əlavə edin, Client-dən ona və ondan Object Store-a xətt çəkin.',
            'Primer-in miqyaslanmış diaqramında Client statik məzmunu CDN-dən alır, CDN isə onu Object Store-dan götürür: serverlərin yükü azalır, məzmun istifadəçiyə yaxın verilir.',
          ],
          check: { type: 'edge', from: 'client', to: 'cdn' },
        },
        dnsRule('amazon.com'),
        allConnectedRule('Read API → Memory Cache'),
      ],
      // Mirrors sales_rank.png; the primer leaves internal load balancers out, and so does this. The Sales Rank
      // Service writes to the master, which takes the writes. The Web Server → Object Store edge is left out:
      // every read would take it.
      referenceSolution: {
        nodes: [
          node('client-1', 'client', 'Client', 0, 400),
          node('dns-1', 'dns', 'DNS', 240, 40),
          node('cdn-1', 'cdn', 'CDN', 240, 200, { instances: 2 }),
          node('load-balancer-1', 'load-balancer', 'Load Balancer', 240, 400, { instances: 3 }),
          node('web-server-1', 'web-server', 'Web Server', 480, 400, { instances: 60 }),
          node('app-service-1', 'app-service', 'Sales API', 720, 280, { instances: 2 }),
          node('app-service-2', 'app-service', 'Read API', 720, 520, { instances: 120 }),
          node('app-service-3', 'app-service', 'Sales Rank Service', 960, 120, { instances: 3 }),
          node('cache-1', 'cache', 'Memory Cache', 960, 600, { instances: 3 }),
          node('sql-database-1', 'sql-database', 'SQL Write Master-Slave', 1200, 280, { shardKey: 'category_id', instances: 2 }),
          node('sql-database-2', 'sql-database', 'SQL Read Replicas', 1200, 520, { role: 'replica', instances: 12 }),
          // It takes the CDN's misses, and an Object Store read starts at 40 ms: it runs well below capacity.
          node('object-store-1', 'object-store', 'Object Store', 1200, 760, { instances: 5 }),
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
          edge('app-service-3', 'object-store-1', 'read'),
          edge('app-service-3', 'sql-database-1', 'write'),
        ],
      },
    },
  ],
}
