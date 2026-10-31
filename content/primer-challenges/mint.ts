// Mint.com, from the primer's solution: the Accounts API stores linked accounts and queues extraction
// jobs; the Transaction Extraction Service keeps raw transaction logs in an Object Store, categorises
// and aggregates them with its helper services, and writes them to SQL. Reference Solutions mirror
// `mint_basic.png` and `mint.png`.
//
// The simulation sends the transactions as Client writes through the Accounts API and its queue: the
// primer's extraction is triggered by the user or by a daily job for active users.
import type { ChallengeInput } from '../../src/core/challenges/challenge'
import type { NodeSelector, Predicate } from '../../src/core/challenges/rules'
import { allConnectedRule, apiPath, dnsRule, edge, entryPath, loadBalancerRule, node, QUEUES, readReplicas, scaleOutRule, writesSpread } from './shared'

/** Where accounts, transactions and monthly spending live: the primer's SQL database, or NoSQL. */
const DATABASE: NodeSelector[] = ['sql-database', 'nosql-store']

const ACCOUNTS_TABLE: Predicate = apiPath(DATABASE, 'write')
/** The Accounts API puts extraction jobs on a queue, which a service pulls from. */
const EXTRACTION_QUEUE: Predicate = {
  type: 'all-of',
  predicates: [
    { type: 'path', from: 'client', to: QUEUES, through: 'app-service', traffic: 'write' },
    { type: 'edge', from: QUEUES, to: 'app-service', traffic: 'write' },
  ],
}
/** Raw transaction logs reach the Object Store, only through the queue. */
const RAW_LOGS: Predicate = { type: 'path', from: 'client', to: 'object-store', through: QUEUES, traffic: 'write' }
/** What the extraction pulls from the queue ends up in the database. */
const TRANSACTIONS_TABLE: Predicate = { type: 'any-of', predicates: DATABASE.map((store) => ({ type: 'path', from: QUEUES, to: store, traffic: 'write' })) }

export const mint: ChallengeInput = {
  id: 'mint',
  title: 'Mint.com dizayn edin',
  kind: 'architecture',
  source: 'primer',
  solutionId: 'mint',
  lessonIds: [
    'design-mintcom',
    'reverse-proxy-web-server',
    'application-layer',
    'relational-database-management-system-rdbms',
    'sql-or-nosql',
    'asynchronism',
    'message-queues',
    'cache',
  ],
  // The primer's average traffic: 5 billion transactions and 500 million reads a month, about 50 bytes a transaction.
  loadProfile: { readQps: 200, writeQps: 2_000, requestBytes: 50 },
  stages: [
    {
      id: 'requirements',
      type: 'requirements',
      weight: 1,
      prompt:
        'Mint.com kimi şəxsi maliyyə servisi dizayn edin: istifadəçi bank hesablarını bağlayır, servis əməliyyatları çəkir, kateqoriyalara bölür, aylıq xərcləri təhlil edir və büdcə təklif edir. Aşağıdakılardan bu tapşırığa aid olan istifadə hallarını (use case) və məhdudiyyətləri seçin, kənarda qalanları seçməyin. Fikirlərinizi qeydlərə yaza bilərsiniz.',
      solutionAnchor: 'step-1-outline-use-cases-and-constraints',
      items: [
        {
          section: 'use-case',
          text: 'İstifadəçi maliyyə hesabını bağlayır',
          correct: true,
          explanation: 'Hər şey bundan başlayır: hesab məlumatları accounts cədvəlinə yazılır.',
        },
        {
          section: 'use-case',
          text: 'Servis hesabdan əməliyyatları çəkir və gündəlik yeniləyir',
          correct: true,
          explanation: 'Əməliyyatlar hesab ilk bağlananda, istifadəçi əl ilə yeniləyəndə və aktiv istifadəçilər üçün hər gün çəkilir.',
        },
        {
          section: 'use-case',
          text: 'Servis əməliyyatları kateqoriyalara bölür; istifadəçi kateqoriyanı əl ilə dəyişə bilər',
          correct: true,
          explanation: 'Kateqoriya satıcıya görə təyin olunur; istifadəçinin dəyişiklikləri digər istifadəçilər üçün də satıcının kateqoriyasını təxmin etməyə kömək edir.',
        },
        {
          section: 'use-case',
          text: 'Servis aylıq xərcləri kateqoriyalar üzrə təhlil edir',
          correct: true,
          explanation: 'monthly_spending aqreqatları budget-in əsasıdır.',
        },
        {
          section: 'use-case',
          text: 'Servis büdcə təklif edir; istifadəçi büdcəni əl ilə təyin edə bilər',
          correct: true,
          explanation: 'Primer gəlir səviyyəsinə görə ümumi şablon təklif edir və yalnız istifadəçinin dəyişdirdiyi kateqoriyaları saxlayır.',
        },
        {
          section: 'use-case',
          text: 'Servis büdcəyə yaxınlaşanda və ya onu keçəndə bildiriş göndərir',
          correct: true,
          explanation: 'Budget Service Notification Service vasitəsilə istifadəçini xəbərdar edir.',
        },
        {
          section: 'use-case',
          text: 'Servis yüksək əlçatanlığa (high availability) malikdir',
          correct: true,
          explanation: 'Primer bunu servisin tələbi kimi qeyd edir.',
        },
        {
          section: 'use-case',
          text: 'Servis əlavə logging və analytics aparır',
          explanation: 'Primer bunu açıq şəkildə kənarda saxlayır.',
        },
        {
          section: 'use-case',
          text: 'Kateqoriya qaydaları dəyişəndə köhnə əməliyyatlar avtomatik yenidən kateqoriyalaşdırılır',
          explanation: 'Primer avtomatik yenidən kateqoriyalaşdırmanı istisna edir: yalnız istifadəçinin əl ilə dəyişikliyi var.',
        },
        {
          section: 'use-case',
          text: 'Servis istifadəçinin adından hesabları ödəyir',
          explanation: 'Ödənişlər tapşırığın hüdudundan kənardadır: servis yalnız əməliyyatları oxuyur və təhlil edir.',
        },
        {
          section: 'constraint',
          text: 'Trafik zaman üzrə bərabər paylanmayıb',
          correct: true,
          explanation: 'Pik anlarda yük ortalamadan çox olur; cache və bir neçə server nüsxəsi bunu udur.',
        },
        {
          section: 'constraint',
          text: 'Gündəlik avtomatik yeniləmə yalnız son 30 gündə aktiv olan istifadəçilərə aiddir',
          correct: true,
          explanation: 'Bu, gündəlik çəkilən əməliyyatların sayını xeyli azaldır.',
        },
        {
          section: 'constraint',
          text: 'Hesab əlavə etmək və ya silmək nisbətən nadirdir',
          correct: true,
          explanation: 'accounts cədvəlinə yazmalar azdır; yazma yükünün çoxu əməliyyatlardır.',
        },
        {
          section: 'constraint',
          text: 'Büdcə bildirişləri dərhal getməli deyil',
          correct: true,
          explanation: 'Buna görə bildirişlər növbə vasitəsilə asinxron göndərilə və aqreqatlar batch ilə hesablana bilər.',
        },
        {
          section: 'constraint',
          text: '10 milyon istifadəçi, 30 milyon maliyyə hesabı, 50 000 satıcı',
          correct: true,
          explanation: 'Hər istifadəçinin 10 büdcə kateqoriyası 100 milyon büdcə elementi deməkdir; satıcılar kateqoriyanı müəyyən edir.',
        },
        {
          section: 'constraint',
          text: 'Ayda 5 milyard əməliyyat və 500 milyon oxuma sorğusu: yazma:oxuma nisbəti 10:1',
          correct: true,
          explanation: 'Servis yazmaya meyllidir: istifadəçilər hər gün əməliyyat edir, amma sayta az-az baxırlar.',
        },
        {
          section: 'constraint',
          text: 'Oxumalar yazmalardan 10 dəfə çoxdur',
          explanation: 'Əksinədir: yazmalar oxumalardan 10 dəfə çoxdur.',
        },
        {
          section: 'constraint',
          text: 'Büdcə bildirişləri əməliyyatdan sonra saniyələr içində çatmalıdır',
          explanation: 'Primer bildirişlərin dərhal getməli olmadığını fərz edir.',
        },
        {
          section: 'constraint',
          text: 'Bütün 30 milyon hesab hər gün yenilənir',
          explanation: 'Yalnız son 30 gündə aktiv olan istifadəçilərin hesabları avtomatik yenilənir.',
        },
      ],
    },
    {
      id: 'estimation',
      type: 'estimation',
      weight: 1,
      prompt:
        'Fərziyyələr: ayda 5 milyard əməliyyat yazılır və 500 milyon oxuma sorğusu gəlir. Bir əməliyyat bu sahələrdir: user_id 8 bayt, created_at 5 bayt, seller 32 bayt, amount 5 bayt. Əməliyyatların çoxu yenidir, köhnələrin yenilənməsi deyil. Məlumat 3 il saxlanılır. Primer-in yuvarlaq çevirmələrini işlədin: ayda 2,5 milyon saniyə, 1 KB = min bayt. Cavablar referansın 2 qatı daxilində olsa qəbul olunur.',
      solutionAnchor: 'calculate-usage',
      explanation:
        'Bir əməliyyat: 8 + 5 + 32 + 5 = 50 bayt. Ayda təxminən 2,5 milyon saniyə var: saniyədə 400 sorğu ayda 1 milyard sorğu deməkdir. Primer qeyd edir ki, bunlar orta rəqəmlərdir: pik anlarda yük daha yüksəkdir.',
      inputs: { writesPerMonth: 5_000_000_000, readsPerMonth: 500_000_000, bytesPerWrite: 8 + 5 + 32 + 5, years: 3 },
      questions: [
        { id: 'write-qps', quantity: 'writeQps', prompt: 'Orta hesabla saniyədə neçə əməliyyat yazılır?' },
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
        'İstifadəçi maliyyə hesabını bağlayır; servis əməliyyatları bankdan çəkir (uzun çəkə bilər), xam loglarını saxlayır, hər əməliyyatı kateqoriyaya bölür, aylıq xərcləri kateqoriyalar üzrə hesablayır, büdcəyə yaxınlaşanda bildiriş göndərir. Ayda 5 milyard əməliyyat gözlənilir. Bütün vacib komponentləri kətana qoyun, sorğuların axınını xətlərlə göstərin və "Yoxla" düyməsini basın.',
      solutionAnchor: 'step-2-create-a-high-level-design',
      rules: [
        {
          id: 'entry-point',
          weight: 2,
          description: 'Client sorğuları tətbiq serverlərinə web server (reverse proxy) və ya load balancer vasitəsilə çatır.',
          hints: [
            'Client sorğusu tətbiq kodunun işlədiyi serverə çatmazdan əvvəl ilk olaraq nəyə dəyir?',
            'Client ilə application service arasına web server, reverse proxy və ya load balancer qoyun: hər sorğu ondan keçsin.',
            'Primer-də Client sorğuları reverse proxy rolunda işləyən Web Server-ə göndərir, o da sorğunu Accounts API serverinə ötürür. Client-dən application service-ə bu qatdan yan keçən yol olmamalıdır.',
          ],
          check: entryPath,
        },
        {
          id: 'accounts-table',
          weight: 2,
          description: 'Accounts API bağlanan hesabı SQL bazasının accounts cədvəlinə (və ya NoSQL-ə) yazır.',
          hints: [
            'İstifadəçi hesabını bağlayanda onun məlumatı harada saxlanılır?',
            'SQL database əlavə edin və Accounts API-dən ona yazma xətti çəkin.',
            'Primer 10 milyon istifadəçinin məlumatını relational database-də saxlayır: Accounts API yeni hesabı accounts cədvəlinə yazır (id, created_at, last_update, account_url, account_login, account_password_hash, user_id). SQL ilə NoSQL arasındakı trade-off-u müzakirə etmək lazımdır.',
          ],
          check: ACCOUNTS_TABLE,
        },
        {
          id: 'extraction-queue',
          weight: 3,
          description: 'Accounts API əməliyyat çəkmə işini növbəyə (queue) qoyur, Transaction Extraction Service onu növbədən götürür.',
          hints: [
            'Bankdan əməliyyatları çəkmək uzun çəkə bilər. İstifadəçinin sorğusu bu iş bitənə qədər gözləməlidirmi?',
            'Accounts API-dən Message Queue-ya, növbədən isə yeni Transaction Extraction Service-ə yazma xətləri çəkin.',
            'Primer-də Accounts API Amazon SQS və ya RabbitMQ kimi Queue-ya iş qoyur: əməliyyatları çəkmək vaxt aparır, ona görə bu iş asinxron görülür, baxmayaraq ki, əlavə mürəkkəblik yaradır. Transaction Extraction Service işləri növbədən götürür.',
          ],
          check: EXTRACTION_QUEUE,
        },
        {
          id: 'raw-logs',
          weight: 2,
          description: 'Çəkilən əməliyyatların xam logları növbədən sonra object store-da saxlanılır.',
          hints: [
            'Bankdan gələn xam əməliyyat faylları harada saxlanılsın ki, sonra yenidən emal etmək mümkün olsun?',
            'Object Store əlavə edin və Transaction Extraction Service-dən ona yazma xətti çəkin.',
            'Primer-də Transaction Extraction Service əməliyyatları çəkib xam log faylları kimi Object Store-da saxlayır: Amazon S3 kimi object store ayda 250 GB-ı rahat udur, MapReduce isə bu fayllardan aylıq aqreqatları hesablaya bilər.',
          ],
          check: RAW_LOGS,
        },
        {
          id: 'transactions-table',
          weight: 2,
          description: 'Kateqoriyalaşdırılmış əməliyyatlar və aylıq xərclər növbədən sonra bazaya yazılır.',
          hints: [
            'İstifadəçi xərclərinə baxanda kateqoriyalaşdırılmış əməliyyatlar haradan oxunacaq?',
            'Transaction Extraction Service-dən SQL bazasına yazma xətti çəkin.',
            'Primer-də Transaction Extraction Service transactions cədvəlini kateqoriyalaşdırılmış əməliyyatlarla, monthly_spending cədvəlini isə kateqoriyalar üzrə aylıq aqreqatlarla yeniləyir; id, user_id və created_at üzrə indekslər axtarışı log-time edir.',
          ],
          check: TRANSACTIONS_TABLE,
        },
        {
          id: 'helper-services',
          weight: 2,
          description: 'Kateqoriya, büdcə və bildiriş işləri ayrıca servislərdədir və çəkmə servisi onları çağırır.',
          hints: [
            'Əməliyyatı kateqoriyaya bölmək, büdcəni hesablamaq və bildiriş göndərmək bir servisin işidirmi?',
            'Category Service, Budget Service və Notification Service əlavə edin və Transaction Extraction Service-dən onlara yazma xətləri çəkin.',
            'Primer-də Transaction Extraction Service hər əməliyyatı Category Service ilə kateqoriyalaşdırır, Budget Service ilə aylıq xərcləri hesablayır, Notification Service ilə istifadəçiyə büdcə və əməliyyatların çəkilməsi barədə xəbər verir. Ayrı servislər ayrıca miqyaslanır və dəyişdirilir.',
          ],
          check: { type: 'edge', from: 'app-service', to: 'app-service', traffic: 'write' },
        },
        allConnectedRule('Queue → Transaction Extraction Service'),
      ],
      referenceSolution: {
        nodes: [
          node('client-1', 'client', 'Client', 0, 200),
          node('web-server-1', 'web-server', 'Web Server', 240, 200),
          node('app-service-1', 'app-service', 'Accounts API', 480, 200),
          node('message-queue-1', 'message-queue', 'Queue', 720, 200),
          node('app-service-2', 'app-service', 'Transaction Extraction Service', 960, 200),
          node('sql-database-1', 'sql-database', 'SQL', 960, 440),
          node('app-service-3', 'app-service', 'Category Service', 1200, 40),
          node('app-service-4', 'app-service', 'Budget Service', 1200, 200),
          node('app-service-5', 'app-service', 'Notification Service', 1200, 360),
          node('object-store-1', 'object-store', 'Object Store', 1200, 520),
        ],
        edges: [
          edge('client-1', 'web-server-1', 'write'),
          edge('web-server-1', 'app-service-1', 'write'),
          edge('app-service-1', 'message-queue-1', 'write'),
          edge('app-service-1', 'sql-database-1', 'write'),
          edge('message-queue-1', 'app-service-2', 'write'),
          edge('app-service-2', 'app-service-3', 'write'),
          edge('app-service-2', 'app-service-4', 'write'),
          edge('app-service-2', 'app-service-5', 'write'),
          edge('app-service-2', 'sql-database-1', 'write'),
          edge('app-service-2', 'object-store-1', 'write'),
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
          prompt: 'Əməliyyatları bankdan çəkmək işi necə icra olunmalıdır?',
          options: [
            {
              text: 'Asinxron: Accounts API işi növbəyə qoyur, Transaction Extraction Service onu götürür',
              correct: true,
              explanation: 'Primer-in seçimi: çəkmə uzun çəkir, növbə istifadəçinin sorğusunu dərhal cavablamağa və yükü bərabərləşdirməyə imkan verir. Bədəli əlavə mürəkkəblikdir.',
            },
            {
              text: 'Sinxron: Accounts API bankdan bütün əməliyyatları çəkib sonra cavab qaytarır',
              explanation: 'Sorğu dəqiqələrlə gözləyə və timeout ola bilər, bankın yavaşlığı birbaşa istifadəçiyə keçir.',
            },
            {
              text: 'Web Server-də cron işi kimi',
              explanation: 'Web Server sorğuları ötürmək üçündür; uzun işlər onu yükləyir və ayrıca miqyaslanmır.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Category Service əməliyyatın kateqoriyasını necə müəyyən edir?',
          options: [
            {
              text: 'Populyar satıcılarla doldurulmuş satıcı → kateqoriya lüğəti; qalan satıcılar üçün istifadəçilərin əl ilə dəyişiklikləri (crowdsourcing)',
              correct: true,
              explanation: 'Primer-in Categorizer-i belədir: 50 000 satıcı, hər biri 255 baytdan az, cəmi təxminən 12 MB yaddaş. Ən çox seçilən dəyişikliyi heap ilə O(1) tapmaq olar.',
            },
            {
              text: 'İstifadəçidən hər əməliyyatı özü kateqoriyalaşdırmağı istəmək',
              explanation: 'Ayda 5 milyard əməliyyatı əl ilə bölmək real deyil; əl ilə dəyişiklik yalnız istisnalar üçündür.',
            },
            {
              text: 'Hər əməliyyat üçün bütün əməliyyat tarixçəsini SQL-də skan etmək',
              explanation: 'Saniyədə 2000 əməliyyatda bu, bazanı boğar; 12 MB-lıq lüğət yaddaşda saxlanılır.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: '100 milyon büdcə elementini necə saxlamaq olar?',
          options: [
            {
              text: 'Gəlir səviyyəsinə görə ümumi şablon işlətmək və yalnız istifadəçinin dəyişdirdiyi kateqoriyaları budget_overrides cədvəlində saxlamaq',
              correct: true,
              explanation: 'Primer belə təklif edir: əksər istifadəçilər şablonu dəyişmir, ona görə 100 milyon sətir saxlamaq lazım deyil.',
            },
            {
              text: 'Hər istifadəçi üçün 10 kateqoriyanın hamısını cədvəldə saxlamaq',
              explanation: 'İşləyər, amma 100 milyon sətrin çoxu şablonun təkrarıdır.',
            },
          ],
        },
        {
          type: 'multi-select',
          prompt: 'Kateqoriyalar üzrə aylıq xərcləri (monthly_spending) necə hesablamaq olar?',
          options: [
            {
              text: 'Object Store-dakı xam əməliyyat faylları üzərində MapReduce işləri ilə',
              correct: true,
              explanation: 'Primer-in SpendingByCategory işi (user_id, ay, kateqoriya) üzrə məbləğləri cəmləyir; bu, bazanın yükünü xeyli azaldır.',
            },
            {
              text: 'transactions cədvəli üzərində SQL sorğuları ilə',
              correct: true,
              explanation: 'Primer bunu da mümkün sayır: monthly_spending cədvəli 5 milyard əməliyyatdan çox az sətirdir.',
            },
            {
              text: 'İstifadəçi səhifəni hər açanda bütün əməliyyatları yenidən cəmləməklə',
              explanation: 'Hər oxuma bahalı aqreqasiyaya çevrilir; aqreqat əvvəlcədən hesablanmalıdır.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'transactions cədvəlində axtarışı necə sürətləndirmək olar?',
          options: [
            {
              text: 'id, user_id və created_at üzrə indekslər yaratmaq',
              correct: true,
              explanation: 'Primer bunu təklif edir: indeks axtarışı bütün cədvəli skan etmək əvəzinə log-time edir və məlumatı yaddaşda saxlamağa kömək edir.',
            },
            {
              text: 'Bütün sütunlar üzrə ayrıca indeks yaratmaq',
              explanation: 'Hər indeks hər yazmanı ləngidir; yazmaya meylli servisdə yalnız lazım olan indekslər saxlanılır.',
            },
            {
              text: 'İndeks olmadan saxlamaq, çünki yazmalar çoxdur',
              explanation: 'Onda istifadəçinin əməliyyatlarını tapmaq üçün milyardlarla sətir skan ediləcək.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Köhnə əməliyyatları harada saxlamaq olar?',
          options: [
            {
              text: 'Bazada yalnız son bir ayı, qalanını data warehouse-da və ya Object Store-da',
              correct: true,
              explanation: 'Primer belə təklif edir: əsas baza kiçik və sürətli qalır, Object Store isə ayda 250 GB-ı rahat udur.',
            },
            {
              text: 'Hamısını əsas SQL bazasında, əbədi',
              explanation: '9 TB-a qədər böyüyən cədvəl indeksləri yaddaşa sığmır və bazanı ləngidir.',
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
        'Yüksək səviyyəli dizaynınızdan davam edin və onu məhdudiyyətlərə görə miqyaslayın: trafik qeyri-bərabərdir, servis yazmaya meyllidir, tək SQL master saniyədə 2000 əməliyyatı çətin daşıyır. Yeni istifadə halı: istifadəçi xülasələrə və əməliyyatlarına baxır. Dizayn primer-in orta yükünə dözməlidir: saniyədə 2000 yazma və 200 oxuma altında oxumanın və yazmanın orta gecikməsi 200 ms-i keçməməli, heç bir node həddən artıq yüklənməməli və heç bir sorğu xəta ilə bitməməlidir. Bunu trafik simulyasiyası ilə yoxlayın. Darboğazları tapın, komponent əlavə edin və ya dəyişin, "Yoxla" düyməsini basın.',
      solutionAnchor: 'step-4-scale-the-design',
      rules: [
        {
          id: 'average-load',
          weight: 3,
          description: 'Orta yükdə (saniyədə 2000 yazma, 200 oxuma) orta gecikmə 200 ms-dən çox deyil, həddən artıq yüklənən node və xəta yoxdur.',
          hints: [
            'Saniyədə 2000 əməliyyat gələndə dizaynınızın hansı node-u ilk tıxanır?',
            'Trafik simulyasiyasını işə salın və "Darboğazlar" siyahısına baxın. Ən çox yüklənən node-ların "instances" sahəsini artırın. Növbədən sonrakı servislər də sayılır: onların artığı xəta vermir, amma yığılır və node yenə də həddən artıq yüklənmiş sayılır.',
            'Hər node bir nüsxədə məhdud sorğu emal edir: məsələn, application service təxminən 500, SQL bazası 1000 sorğu/san. Saniyədə 2000 yazmada Accounts API, Transaction Extraction Service və onun köməkçi servisləri horizontal miqyaslanır, SQL yazmaları shard-lara bölünür, oxumalar isə cache-dən və read replica-lardan verilir.',
          ],
          check: { type: 'simulation', maxLatencyMs: { read: 200, write: 200 }, maxOverloadedNodes: 0, maxErrorRate: 0 },
        },
        loadBalancerRule,
        scaleOutRule,
        {
          id: 'memory-cache',
          weight: 2,
          description: 'Read API xülasələri və son əməliyyatları yaddaş cache-indən oxuyur.',
          hints: [
            'İstifadəçi xülasəsini hər dəfə bazadan yığmaq lazımdırmı?',
            'Read API (application service) əlavə edin və ondan Memory Cache-ə "Oxuma" trafikli xətt çəkin.',
            'Primer-ə görə istifadəçi sessiyaları, kateqoriyalar üzrə aqreqat statistika və son əməliyyatlar Redis və ya Memcached kimi Memory Cache-də saxlanıla bilər. Read API cache-aside işləyir: əvvəl cache-ə baxır, tapmasa bazadan oxuyub cache-i yeniləyir.',
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
            'Primer-ə görə SQL Read Replicas cache miss-lərini emal edə bilər, bir şərtlə ki, replikalar yazmaların replikasiyası ilə boğulmasın. Yazmalar SQL Write Master-Slave-ə gedir.',
          ],
          check: { type: 'any-of', predicates: [...readReplicas('sql-database'), ...readReplicas('nosql-store')] },
        },
        {
          id: 'write-scaling',
          weight: 2,
          description: 'Yazmalar bir SQL master-ə yığılmır: baza shard-lara bölünüb (sharding) və ya funksiyalarına görə bir neçə bazaya ayrılıb (federation).',
          hints: [
            'Saniyədə orta hesabla 2000 (pikdə daha çox) əməliyyatı tək SQL Write Master qəbul edə bilərmi?',
            'Əməliyyat bazasının tənzimləməsində "shardKey" sahəsini (məsələn, user_id) yazın və "instances" sahəsini 2 və ya daha çox edin, ya da məlumatı funksiyasına görə ikinci primary bazaya ayırın.',
            'Primer deyir ki, saniyədə 2000 orta yazma tək SQL Write Master-Slave üçün çətin ola bilər və əlavə SQL miqyaslama üsulları lazımdır: federation, sharding, denormalization, SQL tuning, ya da məlumatın bir hissəsini NoSQL-ə köçürmək.',
          ],
          check: writesSpread,
        },
        {
          id: 'pipeline',
          weight: 2,
          description: 'Yeni komponentlərlə də hesablar bazaya yazılır, əməliyyatlar növbə vasitəsilə çəkilir, Object Store-a və bazaya yazılır.',
          hints: [
            'Komponent əlavə edəndən sonra əməliyyat çəkmə hələ də növbədən keçirmi?',
            'Accounts API → baza, Accounts API → Queue → Transaction Extraction Service, ondan Object Store-a və bazaya yazma xətlərini saxlayın.',
            'Miqyaslanmış diaqram yüksək səviyyəli dizaynın bütün axınlarını saxlayır, sadəcə hər servis və növbə bir neçə nüsxədə işləyir; yeni Read API isə oxumaları Memory Cache və SQL Read Replicas-dan verir.',
          ],
          check: { type: 'all-of', predicates: [ACCOUNTS_TABLE, EXTRACTION_QUEUE, RAW_LOGS, TRANSACTIONS_TABLE] },
        },
        {
          id: 'cdn',
          weight: 1,
          description: 'Client statik məzmunu CDN-dən alır.',
          hints: [
            'Bütün istifadəçilərə eyni olan statik fayllar (JS, CSS) hər dəfə serverlərinizdən verilməlidirmi?',
            'CDN komponenti əlavə edin, Client-dən ona və ondan Object Store-a xətt çəkin.',
            'Primer-ə görə statik məzmun S3 kimi Object Store-dan verilə və CDN-də cache-lənə bilər: serverlərin yükü azalır, məzmun istifadəçiyə yaxın verilir.',
          ],
          check: { type: 'edge', from: 'client', to: 'cdn' },
        },
        dnsRule('mint.com'),
        allConnectedRule('Read API → Memory Cache'),
      ],
      // Mirrors mint.png; the primer leaves internal load balancers out, and so does this.
      referenceSolution: {
        nodes: [
          node('client-1', 'client', 'Client', 0, 400),
          node('dns-1', 'dns', 'DNS', 240, 40),
          node('cdn-1', 'cdn', 'CDN', 240, 200),
          node('load-balancer-1', 'load-balancer', 'Load Balancer', 240, 400, { instances: 3 }),
          node('web-server-1', 'web-server', 'Web Server', 480, 400, { instances: 4 }),
          node('app-service-1', 'app-service', 'Accounts API', 720, 320, { instances: 6 }),
          node('app-service-6', 'app-service', 'Read API', 720, 560, { instances: 3 }),
          node('message-queue-1', 'message-queue', 'Queue', 960, 320, { instances: 3 }),
          node('cache-1', 'cache', 'Memory Cache', 960, 600, { instances: 3 }),
          node('app-service-2', 'app-service', 'Transaction Extraction Service', 1200, 320, { instances: 6 }),
          node('sql-database-1', 'sql-database', 'SQL Write Master-Slave', 1200, 600, { shardKey: 'user_id', instances: 6 }),
          node('app-service-3', 'app-service', 'Category Service', 1440, 160, { instances: 6 }),
          node('app-service-4', 'app-service', 'Budget Service', 1440, 320, { instances: 6 }),
          node('app-service-5', 'app-service', 'Notification Service', 1440, 480, { instances: 6 }),
          node('sql-database-2', 'sql-database', 'SQL Read Replicas', 1440, 640, { role: 'replica', instances: 3 }),
          // An Object Store read starts at 40 ms, so it runs well below capacity.
          node('object-store-1', 'object-store', 'Object Store', 1440, 800, { instances: 4 }),
        ],
        edges: [
          edge('client-1', 'dns-1', 'read'),
          edge('client-1', 'cdn-1', 'read'),
          edge('client-1', 'load-balancer-1', 'both'),
          edge('cdn-1', 'object-store-1', 'read'),
          edge('load-balancer-1', 'web-server-1', 'both'),
          edge('web-server-1', 'app-service-1', 'write'),
          edge('web-server-1', 'app-service-6', 'read'),
          edge('app-service-1', 'message-queue-1', 'write'),
          edge('app-service-1', 'sql-database-1', 'write'),
          edge('app-service-1', 'sql-database-2', 'read'),
          edge('message-queue-1', 'app-service-2', 'write'),
          edge('app-service-2', 'app-service-3', 'write'),
          edge('app-service-2', 'app-service-4', 'write'),
          edge('app-service-2', 'app-service-5', 'write'),
          edge('app-service-2', 'sql-database-1', 'write'),
          edge('app-service-2', 'sql-database-2', 'read'),
          edge('app-service-2', 'object-store-1', 'write'),
          edge('app-service-6', 'cache-1', 'read'),
          edge('app-service-6', 'sql-database-2', 'read'),
        ],
      },
    },
  ],
}
