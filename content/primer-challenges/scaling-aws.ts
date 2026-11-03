// A system that scales to millions of users on AWS, from the primer's solution: it starts as a single box
// (a Web Server and MySQL, behind DNS) and grows step by step. Users+ moves static content to an Object
// Store; Users++ adds a Load Balancer, several Web Servers, separate Read and Write APIs and a CDN; Users+++
// a Memory Cache and MySQL Read Replicas; Users+++++ more SQL scaling and Queues with Workers. Reference
// Solutions mirror the single box of Step 3 and `scaling_aws_5.png`, with the Queue and Worker Service and
// the sharded SQL of `scaling_aws.png`.
//
// The Scaling Stage is checked by simulation at successive user counts, each a target of its own:
// 100 thousand, 1 million and 10 million users. The high-level design is checked at 10 thousand.
import type { ChallengeInput } from '../../src/core/challenges/challenge'
import type { Predicate, Rule } from '../../src/core/challenges/rules'
import type { LoadProfile } from '../../src/core/simulation/simulate'
import { allConnectedRule, dnsRule, edge, loadBalancerRule, node, queuedJobs, readAndWritePaths, readReplicas, scaleOutRule, writesSpread } from './shared'

/** The primer's 10 million users send 40,000 reads and 400 writes a second, of 1 KB: per user, a read every 250 seconds and a write every 25,000. */
const usersLoad = (users: number): LoadProfile => ({ readQps: users / 250, writeQps: users / 25_000, requestBytes: 1_000 })

/** A simulation target at a user count: mean latency at most 200 ms, no overloaded Node and no errors. */
function usersTarget(id: string, users: number, weight: number, description: string, hints: Rule['hints']): Rule {
  return {
    id,
    weight,
    description,
    hints,
    check: { type: 'simulation', load: usersLoad(users), maxLatencyMs: { read: 200, write: 200 }, maxOverloadedNodes: 0, maxErrorRate: 0 },
  }
}

/** User data: reads and writes reach the MySQL database only through a server. */
const USER_DATA: Predicate = {
  type: 'all-of',
  predicates: (['write', 'read'] as const).map((traffic): Predicate => ({ type: 'path', from: 'client', to: 'sql-database', through: ['web-server', 'app-service'], traffic })),
}
/** Static content is served by a CDN from the Object Store. */
const STATIC_CONTENT: Predicate = {
  type: 'all-of',
  predicates: [
    { type: 'edge', from: 'client', to: 'cdn' },
    { type: 'edge', from: 'cdn', to: 'object-store', traffic: 'read' },
  ],
}

export const scalingAws: ChallengeInput = {
  id: 'scaling-aws',
  title: 'Milyonlarla istifadəçiyə miqyaslanan sistemi AWS-də dizayn edin',
  kind: 'architecture',
  source: 'primer',
  solutionId: 'scaling_aws',
  lessonIds: [
    'design-a-system-that-scales-to-millions-of-users-on-aws',
    'horizontal-scaling',
    'domain-name-system',
    'load-balancer',
    'reverse-proxy-web-server',
    'application-layer',
    'content-delivery-network',
    'relational-database-management-system-rdbms',
    'sql-or-nosql',
    'cache',
    'asynchronism',
    'fail-over',
    'security',
  ],
  // The primer's average traffic at 10 million users: 1 billion writes and 100 billion reads a month, 1 KB each.
  loadProfile: usersLoad(10_000_000),
  stages: [
    {
      id: 'requirements',
      type: 'requirements',
      weight: 1,
      prompt:
        'Az sayda istifadəçidən başlayıb milyonlarla istifadəçiyə qədər böyüyən sistemi AWS-də dizayn edin: istifadəçi oxuma və yazma sorğuları göndərir, servis onları emal edir və istifadəçi məlumatını saxlayır. Aşağıdakılardan bu tapşırığa aid olan istifadə hallarını (use case) və məhdudiyyətləri seçin, kənarda qalanları seçməyin. Fikirlərinizi qeydlərə yaza bilərsiniz.',
      solutionAnchor: 'step-1-outline-use-cases-and-constraints',
      items: [
        {
          section: 'use-case',
          text: 'İstifadəçi oxuma və ya yazma sorğusu göndərir: servis onu emal edir, istifadəçi məlumatını saxlayır və nəticəni qaytarır',
          correct: true,
          explanation: 'Tapşırıq ümumidir: konkret məhsul deyil, sorğuları emal edən və məlumat saxlayan istənilən servis.',
        },
        {
          section: 'use-case',
          text: 'Servis az sayda istifadəçiyə xidmət etməkdən milyonlarla istifadəçiyə xidmət etməyə qədər inkişaf etməlidir',
          correct: true,
          explanation: 'Tapşırığın mahiyyəti budur: arxitekturanı istifadəçilər artdıqca addım-addım böyütmək və ümumi miqyaslama nümunələrini müzakirə etmək.',
        },
        {
          section: 'use-case',
          text: 'Servis yüksək əlçatanlığa (high availability) malikdir',
          correct: true,
          explanation: 'Primer bunu servisin tələbi kimi qeyd edir.',
        },
        {
          section: 'use-case',
          text: 'Sistem ilk gündən on milyonlarla istifadəçi üçün tam miqyaslanmış qurulur',
          explanation: 'Primer xəbərdarlıq edir: ilkin dizayndan birbaşa son dizayna tullanmayın. 1-2 istifadəçi üçün sadə qurulum kifayətdir; sistem benchmark, profiling və darboğazları aradan qaldırmaqla iterativ böyüyür.',
        },
        {
          section: 'use-case',
          text: 'Sistem həmişə tək maşında qalır və yalnız daha böyük maşın seçməklə (vertical scaling) böyüyür',
          explanation: 'Vertical scaling çox bahalaşır və nə redundancy, nə də failover verir; müəyyən mərhələdən sonra horizontal scaling lazımdır.',
        },
        {
          section: 'use-case',
          text: 'AWS-ə xas bütün servislərin detallarını bilmək mütləqdir',
          explanation: 'Primer deyir ki, AWS biliyi tələb olunan vəzifə deyilsə, AWS-ə xas detallar vacib deyil: prinsiplərin çoxu AWS-dən kənarda da keçərlidir.',
        },
        {
          section: 'constraint',
          text: 'Trafik zaman üzrə bərabər paylanmayıb',
          correct: true,
          explanation: 'Pik saatlarda yük ortalamadan çox olur; bu, sonradan autoscaling-ə əsas verir.',
        },
        {
          section: 'constraint',
          text: 'Relational məlumat lazımdır',
          correct: true,
          explanation: 'Buna görə MySQL ilə başlanır; NoSQL sonradan, uyğun məlumat üçün düşünülür.',
        },
        {
          section: 'constraint',
          text: '1 istifadəçidən on milyonlarla istifadəçiyə qədər miqyaslanma (Users+, Users++, Users+++, ...)',
          correct: true,
          explanation: 'Hər "+" istifadəçilərin növbəti artımıdır və öz darboğazlarını gətirir.',
        },
        {
          section: 'constraint',
          text: '10 milyon istifadəçi, ayda 1 milyard yazma və 100 milyard oxuma: oxuma:yazma nisbəti 100:1',
          correct: true,
          explanation: 'Servis oxumaya çox meyllidir: buna görə cache və read replica-lar vacibdir.',
        },
        {
          section: 'constraint',
          text: 'Hər yazma 1 KB məzmundur',
          correct: true,
          explanation: 'Bu, ayda 1 TB, 3 ildə 36 TB yeni məzmun deməkdir.',
        },
        {
          section: 'constraint',
          text: 'Yazmalar oxumalardan 100 dəfə çoxdur',
          explanation: 'Əksinədir: oxumalar yazmalardan 100 dəfə çoxdur.',
        },
        {
          section: 'constraint',
          text: 'Məlumat relational deyil, ona görə yalnız NoSQL işlətmək olar',
          explanation: 'Primer relational məlumatın lazım olduğunu fərz edir və MySQL ilə başlayır.',
        },
        {
          section: 'constraint',
          text: 'Hər yazma 1 MB məzmundur',
          explanation: 'Primer hər yazmanı 1 KB sayır: ayda 1 TB, 1 PB deyil.',
        },
      ],
    },
    {
      id: 'estimation',
      type: 'estimation',
      weight: 1,
      prompt:
        'Fərziyyələr: 10 milyon istifadəçi ayda 1 milyard yazma və 100 milyard oxuma sorğusu göndərir; hər yazma 1 KB məzmundur. Yazmaların çoxu yeni məzmundur, köhnənin yenilənməsi deyil. Məlumat 3 il saxlanılır. Primer-in yuvarlaq çevirmələrini işlədin: ayda 2,5 milyon saniyə, 1 KB = min bayt. Cavablar referansın 2 qatı daxilində olsa qəbul olunur.',
      solutionAnchor: 'calculate-usage',
      explanation:
        'Ayda 1 KB × 1 milyard = 1 TB yeni məzmun yığılır. Ayda təxminən 2,5 milyon saniyə var: saniyədə 400 sorğu ayda 1 milyard sorğu deməkdir. Bunlar orta rəqəmlərdir: pik anlarda yük xeyli yüksəkdir. Bir istifadəçiyə düşən yük də buradan çıxır: 10 milyon istifadəçi saniyədə 40 000 oxuma göndərirsə, 1 milyon istifadəçi 4000, 100 min istifadəçi isə 400 oxuma göndərir.',
      inputs: { writesPerMonth: 1_000_000_000, readsPerMonth: 100_000_000_000, bytesPerWrite: 1_000, years: 3 },
      questions: [
        { id: 'write-qps', quantity: 'writeQps', prompt: 'Orta hesabla saniyədə neçə yazma sorğusu gəlir?' },
        { id: 'read-qps', quantity: 'readQps', prompt: 'Orta hesabla saniyədə neçə oxuma sorğusu gəlir?' },
        { id: 'storage-per-month', quantity: 'storagePerMonth', prompt: 'Bir ayda nə qədər yeni məzmun yığılır?' },
        { id: 'storage-3-years', quantity: 'storageTotal', prompt: '3 ildə nə qədər yeni məzmun yığılır?' },
      ],
    },
    {
      id: 'high-level-design',
      type: 'high-level-design',
      weight: 3,
      prompt:
        'Hələlik az istifadəçi var. Sadə başlayın: istifadəçi domen adı ilə servisə müraciət edir, oxuma və yazma sorğuları göndərir, servis istifadəçi məlumatını relational bazada saxlayır. Dizayn ilk 10 000 istifadəçinin yükünə dözməlidir: saniyədə 40 oxuma və 0,4 yazma altında orta gecikmə 200 ms-i keçməməli, heç bir node həddən artıq yüklənməməli və heç bir sorğu xəta ilə bitməməlidir. Komponentləri kətana qoyun, sorğuların axınını xətlərlə göstərin və "Yoxla" düyməsini basın.',
      solutionAnchor: 'step-3-design-core-components',
      loadProfile: usersLoad(10_000),
      rules: [
        {
          id: 'dns',
          weight: 1,
          description: 'Client domen adını DNS ilə maşının ünvanına həll edir.',
          hints: [
            'İstifadəçi domen adını yazanda brauzer hansı IP-yə müraciət edəcəyini haradan bilir?',
            'DNS komponenti əlavə edin və Client-dən ona xətt çəkin.',
            'Primer-ə görə Route 53 kimi DNS domeni maşının public IP-sinə bağlayır. Elastic IP yenidən başlatmada dəyişməyən public ünvan verir: maşın sıradan çıxsa, domeni sadəcə yeni IP-yə yönəltmək kifayətdir.',
          ],
          check: { type: 'edge', from: 'client', to: 'dns' },
        },
        {
          id: 'web-server',
          weight: 2,
          description: 'Client sorğuları web server-ə çatır.',
          hints: [
            'İstifadəçinin sorğusunu nə qəbul edib emal edir?',
            'Web Server əlavə edin və Client-dən ona həm oxuma, həm yazma daşıyan xətt çəkin.',
            'Primer tək maşınla başlayır: EC2 üzərində Web Server. 1-2 istifadəçi üçün sadə qurulum kifayətdir; lazım olanda daha böyük maşın seçilir (vertical scaling) və darboğazları tapmaq üçün metriklər izlənilir.',
          ],
          check: { type: 'path', from: 'client', to: 'web-server' },
        },
        {
          id: 'user-data',
          weight: 3,
          description: 'İstifadəçi məlumatı MySQL (SQL) bazasında saxlanılır və oxunur, yalnız server vasitəsilə.',
          hints: [
            'İstifadəçinin yazdığı məlumat harada saxlanılır? Məlumat relational-dır.',
            'SQL database əlavə edin və Web Server-dən ona həm oxuma, həm yazma daşıyan xətt çəkin; Client bazaya birbaşa qoşulmamalıdır.',
            'Məhdudiyyətlər relational məlumatın lazım olduğunu fərz edir, ona görə primer eyni maşında MySQL Database ilə başlayır. SQL ilə NoSQL arasındakı seçimi müzakirə etmək lazımdır. Baza internetə açılmamalıdır: Client-in sorğuları ona yalnız server vasitəsilə çatır.',
          ],
          check: USER_DATA,
        },
        usersTarget('first-users', 10_000, 2, '10 000 istifadəçidə (saniyədə 40 oxuma, 0,4 yazma) orta gecikmə 200 ms-dən çox deyil, həddən artıq yüklənən node və xəta yoxdur.', [
          'İlk 10 000 istifadəçi üçün neçə maşın lazımdır?',
          'Trafik simulyasiyasını işə salın: Stage bu yükdən başlayır. Hər sorğunun Web Server-dən MySQL-ə çatdığını yoxlayın.',
          'Web server təxminən 1000, SQL bazası 1000 sorğu/san emal edir: saniyədə 40 oxuma tək maşın üçün çox azdır. Primer-in tövsiyəsi budur: sadə başlayın, metrikləri izləyin və yalnız darboğaz görünəndə miqyaslayın.',
        ]),
        allConnectedRule('Web Server → MySQL'),
      ],
      // The single box of Step 3: a Web Server with MySQL behind DNS.
      referenceSolution: {
        nodes: [
          node('client-1', 'client', 'Client', 0, 200),
          node('dns-1', 'dns', 'DNS', 240, 40),
          node('web-server-1', 'web-server', 'Web Server', 240, 200),
          node('sql-database-1', 'sql-database', 'MySQL', 480, 200),
        ],
        edges: [edge('client-1', 'dns-1', 'read'), edge('client-1', 'web-server-1', 'both'), edge('web-server-1', 'sql-database-1', 'both')],
      },
    },
    {
      id: 'deep-dive',
      type: 'deep-dive',
      weight: 2,
      prompt: 'Tək maşından başlayan dizaynın detallarına keçin. Hər sual üçün seçiminizi edin: bitirdikdən sonra hər variantın trade-off-u izah olunacaq.',
      solutionAnchor: 'step-3-design-core-components',
      questions: [
        {
          type: 'multiple-choice',
          prompt: 'Sistem yeni açılanda, cəmi 1-2 istifadəçi varkən necə başlamaq lazımdır?',
          options: [
            {
              text: 'Tək maşın: web server və MySQL eyni yerdə; lazım olanda daha böyük maşın (vertical scaling) və darboğazları görmək üçün monitoring',
              correct: true,
              explanation: 'Primer-in seçimi: sadəlik üçün tək maşın. CPU, yaddaş, IO və şəbəkə metrikləri (CloudWatch, top, statsd) nə vaxt miqyaslamaq lazım olduğunu göstərir.',
            },
            {
              text: 'İlk gündən bir neçə availability zone-da microservice-lər, autoscaling və sharding',
              explanation: 'Hələ olmayan yük üçün mürəkkəblik və xərc: primer son dizayna birbaşa tullanmamağı xüsusi vurğulayır.',
            },
            {
              text: 'Məlumatı web server-in yerli fayllarında saxlamaq, baza sonra əlavə olunsun',
              explanation: 'Məhdudiyyətlər relational məlumat tələb edir; MySQL ilə başlamaq sonrakı miqrasiyanı aradan qaldırır.',
            },
          ],
        },
        {
          type: 'multi-select',
          prompt: 'Vertical scaling-in (daha böyük maşın seçməyin) çatışmazlıqları hansılardır?',
          options: [
            { text: 'Çox bahalaşa bilər', correct: true, explanation: 'Ən böyük maşınlar qeyri-mütənasib bahadır və bir həddən sonra daha böyüyü yoxdur.' },
            { text: 'Redundancy və failover yoxdur', correct: true, explanation: 'Tək maşın sıradan çıxanda bütün servis dayanır.' },
            { text: 'Web server və bazanı ayrıca miqyaslamaq olmur', correct: true, explanation: 'Users+ addımında primer məhz buna görə MySQL-i ayrıca maşına köçürür.' },
            { text: 'Metrikləri izləmək mümkün olmur', explanation: 'Monitoring tək maşında da işləyir; primer məhz metriklərə baxaraq vertical scaling etməyi tövsiyə edir.' },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Maşına Elastic IP (dəyişməyən public IP) vermək nə qazandırır?',
          options: [
            {
              text: 'Yenidən başlatmada dəyişməyən public ünvan: maşın sıradan çıxsa, domeni yeni IP-yə yönəltmək kifayətdir',
              correct: true,
              explanation: 'Primer bunu failover-ə kömək kimi qeyd edir: DNS-də yalnız bir qeyd dəyişir.',
            },
            {
              text: 'Sorğuları daha sürətli edir',
              explanation: 'IP-nin sabitliyi gecikməyə təsir etmir; o, yalnız ünvanın dəyişməməsini təmin edir.',
            },
            {
              text: 'Trafiki şifrələyir',
              explanation: 'Şifrələmə HTTPS-in işidir; Elastic IP sadəcə ünvandır.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Web server-i necə qorumaq olar?',
          options: [
            {
              text: 'Yalnız lazımi portları açmaq: HTTP üçün 80, HTTPS üçün 443, SSH üçün 22 yalnız icazəli IP-lərə; serverin özünün xaricə bağlantı açmasını qadağan etmək',
              correct: true,
              explanation: 'Primer-in tövsiyəsi budur; sonrakı komponentlər də private subnet-də və yalnız icazəli portlarla qorunur.',
            },
            {
              text: 'Rahatlıq üçün SSH-ı hamıya açıq saxlamaq, güclü parol kifayətdir',
              explanation: 'Açıq SSH portu davamlı hücumlara məruz qalır; ona yalnız icazəli IP-lərdən çatmaq olmalıdır.',
            },
            {
              text: 'Bütün portları açıq saxlamaq, təhlükəsizliyi istifadəçilər artandan sonra düşünmək',
              explanation: 'Təhlükəsizlik sonradan əlavə olunacaq xüsusiyyət deyil; primer onu ilk maşından tətbiq edir.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Hansı bazadan başlamaq lazımdır?',
          options: [
            {
              text: 'MySQL kimi relational baza, çünki relational məlumat lazımdır; NoSQL-i sonra, uyğun məlumat üçün düşünmək',
              correct: true,
              explanation: 'Primer belə edir: "Start with SQL, consider NoSQL". Son mərhələdə yüksək oxuma və yazma yükü üçün bəzi məlumat DynamoDB kimi NoSQL-ə köçürülə bilər.',
            },
            {
              text: 'Graph database, çünki istifadəçilər arasında əlaqələr ola bilər',
              explanation: 'Tapşırıqda graph sorğuları yoxdur; relational məlumat üçün SQL daha uyğundur.',
            },
            {
              text: 'Yalnız NoSQL, çünki sistem nə vaxtsa milyonlarla istifadəçiyə çatacaq',
              explanation: 'Gələcək miqyas üçün relational imkanlardan (join, transaction) imtina etmək tezdir; SQL-in öz miqyaslama üsulları var.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Sistemi böyütmək üçün hansı iterativ yanaşmanı izləmək lazımdır?',
          options: [
            {
              text: 'Benchmark və load test, profiling ilə darboğazları tapmaq, alternativ və trade-off-ları müqayisə edərək aradan qaldırmaq, təkrarlamaq',
              correct: true,
              explanation: 'Primer bu dövrü sadə dizaynları miqyaslanan dizaynlara çevirmək üçün yaxşı nümunə sayır.',
            },
            {
              text: 'Son dizaynın bütün komponentlərini bir dəfəyə əlavə etmək',
              explanation: 'Hər komponent mürəkkəblik və xərc gətirir; yalnız ölçülmüş darboğaz üçün lazım olanı əlavə edin.',
            },
            {
              text: 'İstifadəçilər şikayət edəndə serverləri ikiqat artırmaq',
              explanation: 'Darboğaz servisdə deyil, bazada ola bilər: ölçmədən artırmaq problemi həll etməyə bilər.',
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
        'Tək maşınlı dizaynınızdan davam edin və onu istifadəçilər artdıqca addım-addım miqyaslayın. Servis oxumaya çox meyllidir (100:1), trafik qeyri-bərabərdir, servis yüksək əlçatan olmalıdır. Dizayn üç hədəfə dözməlidir: 100 min istifadəçi (saniyədə 400 oxuma, 4 yazma), 1 milyon istifadəçi (4000 oxuma, 40 yazma) və 10 milyon istifadəçi (40 000 oxuma, 400 yazma). Hər hədəfdə oxumanın və yazmanın orta gecikməsi 200 ms-i keçməməli, heç bir node həddən artıq yüklənməməli və heç bir sorğu xəta ilə bitməməlidir. Trafik simulyasiyası 100 min istifadəçidən başlayır: yükü növbəti hədəfə qaldırın, darboğazları tapın, komponent əlavə edin və ya dəyişin, "Yoxla" düyməsini basın.',
      solutionAnchor: 'step-4-scale-the-design',
      loadProfile: usersLoad(100_000),
      rules: [
        usersTarget('users-100k', 100_000, 2, '100 000 istifadəçidə (saniyədə 400 oxuma, 4 yazma) orta gecikmə 200 ms-dən çox deyil, həddən artıq yüklənən node və xəta yoxdur.', [
          'Yüz min istifadəçi saniyədə 400 oxuma və 4 yazma göndərir. Dizaynınız bunu hələ də daşıyırmı?',
          'Trafik simulyasiyasını işə salın: Stage bu yükdən başlayır. "Darboğazlar" siyahısına baxın.',
          'Primer-in Users+ addımında yük hələ bir serverin gücündədir: web server təxminən 1000, SQL bazası 1000 sorğu/san emal edir. Bu mərhələdə statik məzmun Object Store-a, MySQL isə ayrıca maşına köçürülür ki, hər biri ayrıca miqyaslansın. Sonrakı dəyişikliklər də bu yükü pozmamalıdır.',
        ]),
        usersTarget('users-1m', 1_000_000, 3, '1 milyon istifadəçidə (saniyədə 4000 oxuma, 40 yazma) orta gecikmə 200 ms-dən çox deyil, həddən artıq yüklənən node və xəta yoxdur.', [
          'Bir milyon istifadəçidə (saniyədə 4000 oxuma, 40 yazma) tək Web Server və tək MySQL nə olur?',
          'Simulyasiyada oxuma sahəsinə 4000, yazma sahəsinə 40 yazın. Web Server-i load balancer arxasında bir neçə nüsxəyə çıxarın, oxumaları Memory Cache-dən və read replica-lardan verin.',
          'Primer-in Users++ addımında tək Web Server pik saatlarda darboğaz olur: Load Balancer əlavə olunur və Web Server-lər horizontal miqyaslanır (bir nüsxə təxminən 1000 sorğu/san). Users+++ addımında oxumalar 100:1 üstünlük təşkil etdiyi üçün MySQL boğulur: tez-tez oxunan məzmun Memory Cache-ə köçürülür, cache miss-lər MySQL Read Replicas-a gedir.',
        ]),
        usersTarget('users-10m', 10_000_000, 3, '10 milyon istifadəçidə (saniyədə 40 000 oxuma, 400 yazma) orta gecikmə 200 ms-dən çox deyil, həddən artıq yüklənən node və xəta yoxdur.', [
          'On milyon istifadəçidə (saniyədə 40 000 oxuma, 400 yazma) hansı node-lar yenidən tıxanır?',
          'Simulyasiyada oxuma sahəsinə 40 000, yazma sahəsinə 400 yazın. Load Balancer, Web Server, Read API, cache, read replica və CDN arxasındakı Object Store nüsxələrini darboğazlar aradan qalxana qədər artırın.',
          'Primer-in Users+++++ addımında hər darboğaz yenidən benchmark və profiling ilə tapılır. Load balancer təxminən 20 000 sorğu/san daşıyır, ona görə o da bir neçə nüsxədə işləyir; web və tətbiq serverləri onlarla nüsxəyə (autoscaling qrupları) çıxır; Memory Cache böyüdülür; read replica-lar cache miss-ləri daşımalıdır; CDN-in özü cavablamadığı oxumalar (cache miss-lər) Object Store-a çatır, onun oxuması 40 ms-dən başlayır, ona görə o da bir çox nüsxədə işləyir.',
        ]),
        {
          id: 'static-content',
          weight: 2,
          description: 'Statik məzmun Object Store-da saxlanılır və Client-ə CDN vasitəsilə verilir.',
          hints: [
            'JS, CSS, şəkillər və istifadəçi faylları web server-in diskində qalmalıdırmı?',
            'Object Store və CDN əlavə edin: Client-dən CDN-ə, CDN-dən Object Store-a oxuma xətti çəkin.',
            'Primer-in Users+ addımında statik məzmun S3 kimi idarə olunan Object Store-a köçürülür: yüksək miqyaslanan, etibarlı və server tərəfində şifrələnən. Users++ addımında statik (və bəzi dinamik) məzmun CloudFront kimi CDN-ə keçir ki, yük və gecikmə azalsın.',
          ],
          check: STATIC_CONTENT,
        },
        loadBalancerRule,
        scaleOutRule,
        {
          id: 'app-servers',
          weight: 2,
          description: 'Web server-lər tətbiq serverlərindən ayrılıb: bazaya oxuma və yazma yalnız tətbiq serverləri (Read API, Write API) vasitəsilə çatır.',
          hints: [
            'Web server və tətbiq məntiqi eyni maşındadırsa, onları ayrıca miqyaslamaq olarmı?',
            'Web Server ilə baza arasına application service-lər (məsələn, Read API və Write API) qoyun: bazaya gedən hər yol onlardan keçsin.',
            'Primer-in Users++ addımında Web Server-lər Application Server-lərdən ayrılır: iki qat ayrıca miqyaslanır və tənzimlənir, Web Server-lər reverse proxy kimi işləyir. Məsələn, bəzi Application Server-lər Read API-ni, digərləri Write API-ni emal edir.',
          ],
          check: readAndWritePaths(['sql-database']),
        },
        {
          id: 'memory-cache',
          weight: 2,
          description: 'Tez-tez oxunan məzmun yaddaş cache-indən oxunur.',
          hints: [
            'Oxumalar yazmalardan 100 dəfə çoxdur. Hər oxuma MySQL-ə getməlidirmi?',
            'Memory Cache əlavə edin və Read API-dən ona "Oxuma" trafikli xətt çəkin.',
            'Primer-in Users+++ addımında MySQL-dən tez-tez oxunan məzmun və Web Server-lərin sessiya məlumatı ElastiCache kimi Memory Cache-ə köçürülür: Web Server-lər stateless olur və autoscaling mümkün olur. Primer əvvəlcə MySQL-in öz cache-ini tənzimləməyi də təklif edir.',
          ],
          check: { type: 'edge', from: 'app-service', to: 'cache', traffic: 'read' },
        },
        {
          id: 'read-replicas',
          weight: 2,
          description: 'Cache-də olmayan oxumalar MySQL read replica-larına gedir.',
          hints: [
            'Cache miss-ləri yazmaları qəbul edən eyni MySQL master-ə düşməlidirmi?',
            'Ya "replica" rolunda ikinci SQL database əlavə edib Read API-dən ona oxuma xətti çəkin, ya da primary bazanın "replicas" sahəsini 1 və ya daha çox edin.',
            'Primer-in Users+++ addımında MySQL Read Replicas write master-in yükünü azaldır; Web Server-də yazmaları və oxumaları ayıran məntiq olur, replica-ların qarşısında isə (diaqramda göstərilməyən) load balancer-lər durur.',
          ],
          check: { type: 'any-of', predicates: readReplicas('sql-database') },
        },
        {
          id: 'write-scaling',
          weight: 2,
          description: 'Yazmalar bir SQL master-ə yığılmır: baza shard-lara bölünüb (sharding) və ya funksiyalarına görə bir neçə bazaya ayrılıb (federation).',
          hints: [
            'Saniyədə orta hesabla 400 (pikdə xeyli çox) yazmanı tək SQL Write Master-Slave qəbul edə bilərmi?',
            'Bazanın tənzimləməsində "shardKey" sahəsini (məsələn, user_id) yazın və "instances" sahəsini 2 və ya daha çox edin, ya da məlumatı funksiyasına görə ikinci primary bazaya ayırın.',
            'Primer-in Users+++++ addımında saniyədə 400 orta yazma tək SQL Write Master-Slave üçün çətin ola bilər: federation (məsələn, Customers və Products bazaları), sharding (məsələn, müştərilər A-M və N-Z), denormalization, SQL tuning, ya da uyğun məlumatı DynamoDB kimi NoSQL-ə köçürmək lazımdır. Bazanın böyüməsi üçün köhnə məlumat Redshift kimi data warehouse-a köçürülə bilər.',
          ],
          check: writesSpread,
        },
        {
          id: 'async-workers',
          weight: 1,
          description: 'Real vaxtda görülməli olmayan işlər növbəyə qoyulur və Worker Service onları asinxron görür.',
          hints: [
            'Şəkil yüklənəndə onun kiçik nüsxəsini (thumbnail) yaratmaq istifadəçinin sorğusunu gözlətməlidirmi?',
            'Write API-dən Message Queue-ya, növbədən isə yeni Worker Service-ə yazma xətləri çəkin.',
            'Primer-in Users+++++ addımında real vaxtda olmalı olmayan batch işlər Queue və Worker-lərlə asinxron görülür. Məsələn, foto servisində Client şəkli yükləyir, Application Server SQS kimi Queue-ya iş qoyur, EC2 və ya Lambda üzərindəki Worker Service işi növbədən götürür, thumbnail yaradır, bazanı yeniləyir və thumbnail-i Object Store-da saxlayır.',
          ],
          check: queuedJobs,
        },
        dnsRule('example.com'),
        allConnectedRule('Read API → Memory Cache'),
      ],
      // Mirrors scaling_aws_5.png (Users++++), with the Queue, Worker Service and sharded SQL of
      // scaling_aws.png (Users+++++); the primer leaves internal load balancers and autoscaling groups out,
      // and so does this.
      referenceSolution: {
        nodes: [
          node('client-1', 'client', 'Client', 0, 400),
          node('dns-1', 'dns', 'DNS', 240, 40),
          node('cdn-1', 'cdn', 'CDN', 240, 200, { instances: 2 }),
          node('load-balancer-1', 'load-balancer', 'Load Balancer', 240, 400, { instances: 3 }),
          node('web-server-1', 'web-server', 'Web Server', 480, 400, { instances: 60 }),
          node('app-service-1', 'app-service', 'Write API', 720, 280, { instances: 2 }),
          node('app-service-2', 'app-service', 'Read API', 720, 520, { instances: 120 }),
          node('message-queue-1', 'message-queue', 'Queue', 960, 120),
          node('cache-1', 'cache', 'Memory Cache', 960, 600, { instances: 3 }),
          node('app-service-3', 'app-service', 'Worker Service', 1200, 120, { instances: 2 }),
          node('sql-database-1', 'sql-database', 'SQL Write Master-Slave', 1200, 280, { shardKey: 'user_id', instances: 2 }),
          node('sql-database-2', 'sql-database', 'SQL Read Replicas', 1200, 520, { role: 'replica', instances: 12 }),
          // It takes the CDN's misses, and an Object Store read starts at 40 ms: it runs well below capacity.
          node('object-store-1', 'object-store', 'Object Store', 1200, 760, { instances: 10 }),
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
          edge('app-service-1', 'message-queue-1', 'write'),
          edge('message-queue-1', 'app-service-3', 'write'),
          edge('app-service-3', 'sql-database-1', 'write'),
          edge('app-service-3', 'object-store-1', 'write'),
          edge('app-service-2', 'cache-1', 'read'),
          edge('app-service-2', 'sql-database-2', 'read'),
        ],
      },
    },
  ],
}
