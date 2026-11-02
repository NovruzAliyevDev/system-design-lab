// The distributed unique ID generator (Twitter Snowflake): not a primer question, though the primer lists it
// among its additional questions. Services ask for 64-bit IDs roughly sorted by time; generator nodes make
// them from a timestamp, their worker id and a sequence number, with no database or other shared counter in
// the request path. A coordination service (ZooKeeper) hands out the worker ids, off the request path, so
// that losing it stops no ID. The assumptions are authored: 10,000 IDs a second on average.
//
// An ID request is a write: it changes the generator's sequence, and nothing is read back. The Clients
// stand for the services asking for IDs. The edge from the coordination service to the generators carries
// no request: nothing reaches the coordination service. Edges stand for requests, so the generator's call
// at startup to fetch its worker id is drawn as the coordination service handing it out.
//
// A generator does no I/O, so the Reference raises its capacity above an application service's default
// (500 requests a second), as a learner can in the config panel; adding instances passes as well.
import type { ChallengeInput } from '../../src/core/challenges/challenge'
import type { Predicate } from '../../src/core/challenges/rules'
import { allConnectedRule, edge, loadBalancerPath, node, scaledOut } from '../primer-challenges/shared'

/** Requests a second one generator instance serves: bound by its RPC handling, not by the 4,096 IDs a millisecond its sequence allows. */
const GENERATOR_CAPACITY = { capacityQps: 10_000 }

/** Ensemble sizes that tolerate a failure: odd, so that no node is added without adding to the quorum's tolerance. */
const ODD_ENSEMBLES = [3, 5, 7, 9, 11, 13, 15]

/** No ID request waits on a database, a cache or the coordination service: nothing shared counts the IDs. */
const NO_SHARED_COUNTER: Predicate = {
  type: 'not',
  predicate: { type: 'path', from: 'client', to: ['sql-database', 'nosql-store', 'cache', 'coordination-service'], traffic: 'write' },
}

/** A coordination service and the generators are joined, so that it can hand out their worker ids. */
const WORKER_IDS: Predicate = {
  type: 'any-of',
  predicates: [
    { type: 'edge', from: 'coordination-service', to: 'app-service' },
    { type: 'edge', from: 'app-service', to: 'coordination-service' },
  ],
}

/** The ID requests reach a generator, an application service. */
const GENERATOR: Predicate = { type: 'path', from: 'client', to: 'app-service', traffic: 'write' }

export const idGenerator: ChallengeInput = {
  id: 'id-generator',
  title: 'Paylanmış unikal ID generatoru dizayn edin',
  kind: 'architecture',
  source: 'authored',
  lessonIds: [
    'additional-system-design-interview-questions',
    'application-layer',
    'service-discovery',
    'horizontal-scaling',
    'relational-database-management-system-rdbms',
    'availability-patterns',
    'powers-of-two-table',
  ],
  // The authored average: 10,000 IDs a second, each 8 bytes.
  loadProfile: { readQps: 0, writeQps: 10_000, requestBytes: 8 },
  stages: [
    {
      id: 'requirements',
      type: 'requirements',
      weight: 1,
      prompt:
        'Paylanmış sistem üçün unikal ID generatoru dizayn edin: tweet, sifariş, mesaj kimi obyektləri yaradan servislər ondan ID alır. Tək bir verilənlər bazasının auto-increment sütunu bu miqyasda işləmir. Bu sual primer-dən deyil (primer onu əlavə suallar siyahısında adlandırır). Aşağıdakılardan bu tapşırığa aid olan istifadə hallarını (use case) və məhdudiyyətləri seçin, kənarda qalanları seçməyin.',
      items: [
        {
          section: 'use-case',
          text: 'Servis istədiyi anda yeni ID alır və hər ID bütün sistemdə unikaldır',
          correct: true,
          explanation: 'Əsas tələb: iki fərqli obyekt heç vaxt eyni ID-ni almamalıdır, ID-ni hansı node yaratmasından asılı olmayaraq.',
        },
        {
          section: 'use-case',
          text: 'ID-lər təxminən yaradılma vaxtına görə sıralanır: sonra yaradılan ID daha böyükdür',
          correct: true,
          explanation: 'Bu, obyektləri ID-yə görə vaxt sırası ilə göstərməyə (məsələn, timeline) və indeksi səmərəli saxlamağa imkan verir. Sıralama təxminidir (k-sorted): eyni millisaniyədə fərqli node-ların ID-ləri ixtiyari sırada ola bilər.',
        },
        {
          section: 'use-case',
          text: 'ID-lər yalnız rəqəmdən ibarətdir və 64 bitə sığır',
          correct: true,
          explanation: '64 bitlik ədəd bazada BIGINT kimi saxlanılır və indeksdə kiçik yer tutur; 128 bitlik UUID iki dəfə çox yer tutur və vaxta görə sıralanmır.',
        },
        {
          section: 'use-case',
          text: 'Servis yüksək əlçatanlığa malikdir: bir node-un və ya bir komponentin sıradan çıxması ID yaradılmasını dayandırmır',
          correct: true,
          explanation: 'ID generatoru hər yazmanın yolundadır: o dayansa, heç bir yeni obyekt yaradıla bilməz.',
        },
        {
          section: 'use-case',
          text: 'ID-lər boşluqsuz ardıcıl olmalıdır: 1, 2, 3, …',
          explanation: 'Boşluqsuz ardıcıllıq bütün node-ların hər ID üçün razılaşmasını tələb edir və miqyaslanmır; unikallıq və təxmini sıralama kifayətdir.',
        },
        {
          section: 'use-case',
          text: 'ID-lər bütün node-lar üzrə millisaniyəyə qədər tam sıralanmalıdır',
          explanation: 'Fərqli maşınların saatları tam sinxron deyil; qlobal tam sıra mərkəzi sayğac tələb edir. Təxmini (k-sorted) sıra kifayətdir.',
        },
        {
          section: 'use-case',
          text: 'ID təsadüfi 128 bitlik mətn (UUID) ola bilər',
          explanation: 'UUID koordinasiyasız unikallıq verir, amma 128 bitdir, rəqəm deyil və vaxta görə sıralanmır: tələblərdən ikisini pozur.',
        },
        {
          section: 'use-case',
          text: 'ID-dən onu yaradan istifadəçinin adını oxumaq mümkündür',
          explanation: 'ID-də yalnız vaxt, datacenter, maşın və sıra nömrəsi olur; şəxsi məlumatı ID-yə yazmaq həm lazımsız, həm də təhlükəlidir.',
        },
        {
          section: 'constraint',
          text: 'Saniyədə orta hesabla 10 000 ID tələb olunur, pik anlarda 3 qat çox',
          correct: true,
          explanation: 'Fərziyyə: estimation mərhələsi bundan başlayır.',
        },
        {
          section: 'constraint',
          text: 'ID almaq çox sürətli olmalıdır (bir neçə millisaniyə)',
          correct: true,
          explanation: 'ID hər yazmanın əvvəlində lazımdır; ona görə generator hər ID üçün şəbəkə üzərindən bazaya və ya başqa servisə getməməlidir.',
        },
        {
          section: 'constraint',
          text: 'Maşınların saatları NTP ilə sinxronlaşdırılır, amma tam dəqiq deyil',
          correct: true,
          explanation: 'Vaxta əsaslanan ID-lərin əsas riski budur: saat geri gedərsə, generator təkrar ID yarada bilər, ona görə bunu aşkarlamalıdır.',
        },
        {
          section: 'constraint',
          text: 'Bütün ID-lər bir verilənlər bazası serverində auto-increment ilə yaradılmalıdır',
          explanation: 'Tək server həm darboğaz, həm də tək nöqtədir (single point of failure); bu, tapşırığın aradan qaldırmalı olduğu problemdir.',
        },
      ],
    },
    {
      id: 'estimation',
      type: 'estimation',
      weight: 1,
      prompt:
        'Fərziyyələr: saniyədə orta hesabla 10 000 ID tələb olunur, yəni ayda 25 milyard; pik anlarda yük ortalamanın 3 qatıdır. Hər ID 64 bit, yəni 8 baytdır. Ayda 2,5 milyon saniyə kimi yuvarlaq çevirməni işlədin. Cavablar referansın 2 qatı daxilində olsa qəbul olunur.',
      explanation:
        'Ayda təxminən 2,5 milyon saniyə var, ona görə ayda 25 milyard ID saniyədə 10 000 ID deməkdir. Yaddaş: ID-lərin özü ildə 25 milyard × 12 × 8 bayt ≈ 2,4 TB yer tutur (hər cədvəlin primary key-i kimi); 128 bitlik UUID ilə bu, iki dəfə çox olardı. Bit hesabı da vacibdir: 41 bitlik millisaniyə vaxt damğası 2^41 ms ≈ 69 il çatır, 12 bitlik sıra nömrəsi isə bir maşına millisaniyədə 4 096 ID verir.',
      // An ID is a write of 8 bytes; nothing is read back.
      inputs: { writesPerMonth: 25_000_000_000, readsPerMonth: 0, bytesPerWrite: 8, peakFactor: 3 },
      questions: [
        { id: 'write-qps', quantity: 'writeQps', prompt: 'Orta hesabla saniyədə neçə ID tələb olunur?' },
        { id: 'peak-write-qps', quantity: 'peakWriteQps', prompt: 'Pik anlarda saniyədə neçə ID tələb olunur?' },
        { id: 'storage-per-year', quantity: 'storagePerYear', prompt: 'Hər ID 8 bayt saxlanılırsa, bir ildə yaradılan ID-lər nə qədər yer tutur?' },
      ],
    },
    {
      id: 'high-level-design',
      type: 'high-level-design',
      weight: 3,
      prompt:
        'Servislər (Client) ID generatorundan 64 bitlik, vaxta görə təxminən sıralanan unikal ID-lər alır. ID-lər Twitter Snowflake kimi yaradılır: vaxt damğası + datacenter id + maşın (worker) id + sıra nömrəsi. Hər generator node-unun unikal worker id-si olmalıdır, onu koordinasiya servisi (ZooKeeper) paylayır. Saniyədə orta hesabla 10 000 ID tələb olunur. Bütün vacib komponentləri kətana qoyun, sorğuların axınını xətlərlə göstərin və "Yoxla" düyməsini basın.',
      rules: [
        {
          id: 'generator',
          weight: 2,
          description: 'ID sorğuları generator servisinə (application service) çatır.',
          hints: [
            'Servislər ID-ni kimdən istəyir? Bu işi görən komponent kətanda varmı?',
            'Application service (ID Generator) əlavə edin və Client-dən ona yazma (və ya "Oxuma və yazma") xətti çəkin.',
            'ID generatoru ayrıca stateless servisdir: hər node ID-ni öz yaddaşındakı vaxt, worker id və sıra nömrəsindən yaradır. Bəzi sistemlər generatoru kitabxana kimi hər servisin içinə yerləşdirir; ayrıca servis isə onu bir yerdə idarə etməyə imkan verir.',
          ],
          check: GENERATOR,
        },
        {
          id: 'no-shared-counter',
          weight: 3,
          description: 'ID sorğusu heç bir bazanı, cache-i və ya koordinasiya servisini gözləmir: ortaq sayğac yoxdur.',
          hints: [
            'Hər ID üçün mərkəzi bir sayğaca (məsələn, bazanın auto-increment-inə) getmək saniyədə 30 000 ID-də nəyə səbəb olar?',
            'Client-dən SQL/NoSQL bazasına, cache-ə və ya koordinasiya servisinə gedən yazma yolunu silin: generator ID-ni özü yaratmalıdır. Koordinasiya servisi ilə generator arasındakı xətti koordinasiya servisindən generatora doğru çəkin.',
            'Ticket server (Flickr-in bir baza ilə auto-increment yanaşması) və ya hər ID üçün Redis INCR sadədir, amma hər ID bir şəbəkə səfəri və tək bir node deməkdir: həm darboğaz, həm də tək nöqtə. Snowflake-də generator ID-ni yerli olaraq yaradır: vaxt damğası millisaniyədir, worker id unikallığı node-lar arasında, sıra nömrəsi isə eyni millisaniyə daxilində təmin edir. ZooKeeper yalnız node başlayanda worker id verir, ID sorğularının yolunda deyil.',
          ],
          check: NO_SHARED_COUNTER,
        },
        {
          id: 'worker-ids',
          weight: 2,
          description: 'Koordinasiya servisi generator node-larına unikal worker id-lər paylayır.',
          hints: [
            'İki generator node-u eyni worker id ilə işləsə, nə baş verər? Bunu kim önləyir?',
            'Coordination service (ZooKeeper) komponenti əlavə edin və ondan ID Generator-a xətt çəkin.',
            'Worker id-ni hər node-a əllə yazmaq səhvə açıqdır: iki node eyni id ilə eyni millisaniyədə eyni ID-ni yarada bilər. ZooKeeper-də node başlayanda ephemeral node yaradıb boş worker id-ni götürür; node çöksə, onun id-si azad olur. Bu, nadir hadisədir, ona görə ZooKeeper ID sorğularının yükünü görmür.',
          ],
          check: WORKER_IDS,
        },
        {
          id: 'several-generators',
          weight: 2,
          description: 'ID-ləri bir neçə generator nüsxəsi yaradır.',
          hints: [
            'Tək generator node-u sıradan çıxsa, servislər ID-ni haradan alacaq?',
            'ID Generator-un "instances" sahəsini 2 və ya daha çox edin, ya da ikinci generator node-u əlavə edin.',
            'Snowflake-də hər generator müstəqildir: bir-biri ilə danışmadan unikal ID yaradır, ona görə nüsxələri artırmaq həm tutumu artırır, həm də tək nöqtəni aradan qaldırır. Hədd worker id-nin bit sayıdır: 10 bit (5 datacenter + 5 maşın) 1 024 node-a qədər imkan verir.',
          ],
          check: {
            type: 'any-of',
            predicates: [
              { type: 'node', node: 'app-service', min: 2 },
              {
                type: 'all-of',
                predicates: [
                  { type: 'node', node: 'app-service' },
                  { type: 'node', node: { component: 'app-service', config: { instances: 1 } }, max: 0 },
                ],
              },
            ],
          },
        },
        allConnectedRule('ZooKeeper → ID Generator'),
      ],
      referenceSolution: {
        nodes: [
          node('client-1', 'client', 'Services', 0, 120),
          node('load-balancer-1', 'load-balancer', 'Load Balancer', 240, 120),
          { ...node('app-service-1', 'app-service', 'ID Generator', 480, 120, { instances: 2 }), simulation: GENERATOR_CAPACITY },
          node('coordination-service-1', 'coordination-service', 'ZooKeeper', 240, 320, { instances: 3 }),
        ],
        edges: [
          edge('client-1', 'load-balancer-1', 'write'),
          edge('load-balancer-1', 'app-service-1', 'write'),
          edge('coordination-service-1', 'app-service-1', 'both'),
        ],
      },
    },
    {
      id: 'deep-dive',
      type: 'deep-dive',
      weight: 2,
      prompt: 'ID-nin quruluşuna və generatorun detallarına keçin. Hər sual üçün seçiminizi edin: bitirdikdən sonra hər variantın trade-off-u izah olunacaq.',
      questions: [
        {
          type: 'multiple-choice',
          prompt: 'Tələblərə (64 bit, rəqəm, vaxta görə sıralı, saniyədə 10 000+, yüksək əlçatanlıq) hansı yanaşma ən uyğundur?',
          options: [
            {
              text: 'Snowflake: vaxt damğası + datacenter id + worker id + sıra nömrəsi',
              correct: true,
              explanation: 'Hər node koordinasiyasız ID yaradır, ID 64 bitə sığır və vaxta görə sıralanır. Qiyməti: saatların sinxronluğundan asılılıq.',
            },
            {
              text: 'UUID',
              explanation: 'Koordinasiyasız və sadədir, amma 128 bitdir, rəqəm deyil və vaxta görə sıralanmır.',
            },
            {
              text: 'Ticket server: bir bazanın auto-increment-i',
              explanation: 'Rəqəmlidir və sadədir, amma tək server həm darboğaz, həm də tək nöqtədir; ikinci server əlavə etmək sinxronizasiya problemi yaradır.',
            },
            {
              text: 'Multi-master: k bazanın hər biri auto-increment-i k addımla artırır',
              explanation: 'Darboğazı bölür, amma ID-lər vaxta görə sıralanmır və server əlavə edəndə addımları dəyişmək çətindir.',
            },
          ],
        },
        {
          type: 'multi-select',
          prompt: 'Snowflake ID-nin 64 biti necə bölünür?',
          options: [
            {
              text: '1 bit işarə (həmişə 0), ID müsbət qalsın deyə',
              correct: true,
              explanation: 'İşarəli 64 bitlik tiplərdə (məsələn, Java long, SQL BIGINT) ID müsbət qalır.',
            },
            {
              text: '41 bit millisaniyə vaxt damğası, öz başlanğıc nöqtəsindən (custom epoch) sayılır',
              correct: true,
              explanation: '2^41 ms ≈ 69 il. 1970 əvəzinə servisin başlanğıc tarixindən saymaq bu 69 ili tam istifadə etməyə imkan verir.',
            },
            {
              text: '10 bit maşın identifikatoru: 5 bit datacenter id + 5 bit worker id',
              correct: true,
              explanation: '32 datacenter × 32 maşın = 1 024 generator node-u eyni anda işləyə bilər.',
            },
            {
              text: '12 bit sıra nömrəsi, hər millisaniyədə sıfırlanır',
              correct: true,
              explanation: 'Bir node millisaniyədə 4 096 ID yarada bilər, yəni saniyədə 4 milyondan çox.',
            },
            {
              text: '32 bit istifadəçi id-si',
              explanation: 'ID-də yer yoxdur və lazım deyil: unikallığı vaxt, maşın və sıra nömrəsi birlikdə təmin edir.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Bir node eyni millisaniyədə 4 096-dan çox ID istəsə nə etməlidir?',
          options: [
            {
              text: 'Növbəti millisaniyəni gözləmək və sıra nömrəsini sıfırdan başlamaq',
              correct: true,
              explanation: 'Gözləmə ən çox 1 ms-dir və unikallıq qorunur; bu qədər yük adətən daha çox node əlavə etmək lazım olduğunu göstərir.',
            },
            {
              text: 'Sıra nömrəsini 4 096-dan sonra da artırmağa davam etmək',
              explanation: 'Sıra nömrəsi 12 bitə sığmır və worker id bitlərinin üstünə düşür: ID başqa node-un ID-si ilə toqquşa bilər.',
            },
            {
              text: 'Təsadüfi sıra nömrəsi seçmək',
              explanation: 'Eyni millisaniyədə eyni təsadüfi ədədin iki dəfə seçilməsi mümkündür: unikallıq zəmanəti itir.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'NTP sinxronizasiyasından sonra node-un saatı 5 ms geri getdi. Generator nə etməlidir?',
          options: [
            {
              text: 'Son istifadə olunmuş vaxt damğasını yadda saxlamaq və saat ona çatana qədər ID verməmək (və ya səhv qaytarmaq)',
              correct: true,
              explanation: 'Geri gedən saatla generator artıq verilmiş vaxt damğasını təkrar işlədə və eyni ID-ni yarada bilər. Kiçik geriləmədə gözləmək, böyükdə node-u dövrədən çıxarıb xəbərdarlıq etmək adi yanaşmadır.',
            },
            {
              text: 'Heç nə etməmək: sıra nömrəsi unikallığı təmin edir',
              explanation: 'Sıra nömrəsi hər millisaniyədə sıfırlanır; eyni millisaniyə ikinci dəfə gəlsə, eyni ID-lər yenidən yaranar.',
            },
            {
              text: 'Saatı hər ID üçün koordinasiya servisindən soruşmaq',
              explanation: 'Hər ID-yə şəbəkə səfəri əlavə olunur və koordinasiya servisi sorğuların yoluna düşür: məhz Snowflake-in qaçdığı problem.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Koordinasiya servisi (ZooKeeper) bir müddət əlçatmaz olsa, nə baş verir?',
          options: [
            {
              text: 'İşləyən generatorlar ID yaratmağa davam edir; yalnız yeni node-lar worker id ala bilmir',
              correct: true,
              explanation: 'Worker id node başlayanda bir dəfə alınır və yaddaşda saxlanılır, ona görə ZooKeeper ID sorğularının yolunda deyil. Bu, Scaling mərhələsindəki xaos tapşırığının yoxladığı xüsusiyyətdir.',
            },
            {
              text: 'Bütün ID yaradılması dayanır',
              explanation: 'Bu, yalnız generator hər ID üçün ZooKeeper-ə müraciət etsəydi baş verərdi, bu isə həm yavaş, həm də etibarsız dizayndır.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'ZooKeeper ansamblı niyə adətən tək sayda (3 və ya 5) node-dan ibarət olur?',
          options: [
            {
              text: 'Yazma üçün çoxluğun (quorum) razılığı lazımdır; 4 node 3 node-dan çox nasazlığa dözmür',
              correct: true,
              explanation: '3 node-dan 1-i, 5-dən 2-si sıradan çıxa bilər, çünki qalanlar yenə çoxluqdur. 4 node da yalnız 1 nasazlığa dözür, amma bir node artıq xərcdir.',
            },
            {
              text: 'ZooKeeper cüt sayda node ilə işə düşmür',
              explanation: 'İşə düşür, sadəcə əlavə node heç bir əlavə dözümlülük vermir.',
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
        'Yüksək səviyyəli dizaynınızdan davam edin və onu pik yükə görə miqyaslayın: saniyədə 30 000 ID. ID almağın orta gecikməsi 10 ms-i keçməməli, heç bir node həddən artıq yüklənməməli və heç bir sorğu xəta ilə bitməməlidir. Koordinasiya servisi özü də nasazlığa dözməlidir. Xaos tapşırığı: koordinasiya servisi tamamilə sıradan çıxanda ID-lər xətasız yaradılmağa davam etməlidir. Bunu trafik simulyasiyası ilə yoxlayın və "Yoxla" düyməsini basın.',
      // The authored peak: three times the average.
      loadProfile: { readQps: 0, writeQps: 30_000, requestBytes: 8 },
      chaosTasks: [
        {
          id: 'coordination-down',
          prompt: 'Koordinasiya servisi (ZooKeeper) sıradan çıxıb: ID-lər xətasız yaradılmağa davam etməlidir.',
          scenario: { type: 'node-down', nodes: ['coordination-service'] },
        },
      ],
      rules: [
        {
          id: 'peak-load',
          weight: 3,
          description: 'Pik yükdə (saniyədə 30 000 ID) orta gecikmə 10 ms-dən çox deyil, həddən artıq yüklənən node və xəta yoxdur.',
          hints: [
            'Saniyədə 30 000 ID gələndə dizaynınızın hansı node-u ilk tıxanır?',
            'Trafik simulyasiyasını işə salın və "Darboğazlar" siyahısına baxın. ID Generator-un tənzimləməsində simulyasiya tutumunu qaldırın (o, disk və şəbəkə çağırışı etmir) və ya "instances" sahəsini artırın; load balancer-in nüsxələrini də artırın.',
            'Application service-in susmaya görə tutumu (bir nüsxədə saniyədə 500 sorğu) bazaya və başqa servislərə müraciət edən adi servis üçündür. ID generatoru isə yalnız yaddaşdakı üç ədədi birləşdirir: onun sıra nömrəsi millisaniyədə 4 096 ID-yə imkan verir, real həddi isə RPC emalıdır, nüsxə başına saniyədə on minlərlə sorğu. Məsələn, tutumu 10 000-ə qaldırıb iki datacenter-də 3-ər nüsxə işlətmək 30 000 ID-ni 50% yüklə daşıyır. Yük artdıqca node-un gecikməsi 1 / (1 − ρ) qədər böyüyür, ona görə 10 ms hədəfi üçün ehtiyat saxlayın. Load balancer-in bir nüsxəsi 20 000 sorğu daşıyır.',
          ],
          check: { type: 'simulation', maxLatencyMs: { write: 10 }, maxOverloadedNodes: 0, maxErrorRate: 0 },
        },
        {
          id: 'coordination-down',
          weight: 2,
          description: 'Koordinasiya servisi sıradan çıxanda ID-lər xətasız yaradılmağa davam edir.',
          hints: [
            'Generator worker id-ni nə vaxt alır: hər ID üçün, yoxsa yalnız başlayanda?',
            'Trafik simulyasiyasında "Xaos ssenarisi" siyahısından bu tapşırığı seçin. Xətalar varsa, ID sorğularının koordinasiya servisindən keçmədiyinə əmin olun: xətt ZooKeeper-dən generatora doğru olmalıdır.',
            'Worker id node başlayanda alınır və yaddaşda qalır, ona görə ZooKeeper-in çökməsi işləyən generatorları dayandırmır: yalnız bu müddətdə yeni node-lar qoşula bilmir. Generator hər ID üçün ZooKeeper-ə müraciət etsəydi, ZooKeeper həm darboğaz, həm də bütün sistemin tək nöqtəsi olardı.',
          ],
          check: { type: 'simulation', chaos: 'coordination-down', maxErrorRate: 0 },
        },
        {
          id: 'load-balancer',
          weight: 2,
          description: 'ID sorğuları generatorlara load balancer vasitəsilə çatır.',
          hints: [
            'Servislər onlarla generator nüsxəsindən hansına müraciət edəcəyini necə bilir?',
            'Client ilə ID Generator arasına load balancer qoyun ki, generatorlara gedən hər yol ondan keçsin.',
            'Generatorlar stateless-dir və istənilən biri istənilən sorğuya cavab verə bilər, ona görə load balancer yükü bərabər bölür və sıradan çıxan nüsxəni dövrədən çıxarır. Alternativ olaraq servislər generatorların siyahısını service discovery ilə alıb özləri seçə bilər.',
          ],
          check: loadBalancerPath,
        },
        {
          id: 'generators-scaled-out',
          weight: 2,
          description: 'Hər generator node-u bir neçə nüsxədə işləyir.',
          hints: [
            'Tək nüsxəli generator sıradan çıxanda onun payına düşən sorğulara nə olur?',
            'Hər ID Generator node-unun "instances" sahəsini 2 və ya daha çox edin.',
            'Generator nüsxələri bir-birindən asılı deyil: hər biri öz worker id-si ilə işləyir. Nüsxə əlavə etmək həm tutumu artırır, həm də bir nüsxənin çökməsini görünməz edir; yalnız worker id-lərin sayı (1 024) həddi qoyur.',
          ],
          check: scaledOut,
        },
        {
          id: 'no-shared-counter',
          weight: 2,
          description: 'ID sorğusu heç bir bazanı, cache-i və ya koordinasiya servisini gözləmir.',
          hints: [
            'Miqyaslananda ID-ləri hələ də generatorlar özləri yaradırmı?',
            'Client-dən baza, cache və ya koordinasiya servisinə gedən yazma yolu olmamalıdır.',
            'Miqyaslanmış dizaynda da ID-nin yaradılması tam yerli qalır: ortaq sayğac əlavə etmək bütün generatorları bir node-un sürətinə və əlçatanlığına bağlayardı.',
          ],
          check: NO_SHARED_COUNTER,
        },
        {
          id: 'worker-ids',
          weight: 1,
          description: 'Koordinasiya servisi bütün generatorlara worker id-lər paylayır.',
          hints: [
            'Yeni generator nüsxələri unikal worker id-ni haradan alır?',
            'Koordinasiya servisindən generator node-larına xətt saxlayın.',
            'Nüsxə sayı artdıqca worker id-ləri əllə idarə etmək mümkünsüzləşir; ZooKeeper hər yeni nüsxəyə boş id verir və çökən nüsxənin id-sini azad edir.',
          ],
          check: WORKER_IDS,
        },
        {
          id: 'coordination-quorum',
          weight: 1,
          description: 'Koordinasiya servisi tək sayda, ən azı 3 node-luq ansambl kimi işləyir.',
          hints: [
            'ZooKeeper bir serverdə işləsə və o server çöksə, yeni generatorlar worker id-ni haradan alacaq?',
            'Koordinasiya servisinin "instances" sahəsini 3, 5 və ya 7 edin.',
            'ZooKeeper yazmanı ansamblın çoxluğu (quorum) təsdiqləyəndə qəbul edir. 3 node 1, 5 node 2 nasazlığa dözür; cüt say (məsələn, 4) əlavə dözümlülük vermir, sadəcə xərci artırır.',
          ],
          check: { type: 'node', node: { component: 'coordination-service', config: { instances: ODD_ENSEMBLES } } },
        },
        allConnectedRule('ZooKeeper → ID Generator'),
      ],
      referenceSolution: {
        nodes: [
          node('client-1', 'client', 'Services', 0, 200),
          node('load-balancer-1', 'load-balancer', 'Load Balancer', 240, 200, { instances: 3 }),
          { ...node('app-service-1', 'app-service', 'ID Generator (DC 1)', 480, 80, { instances: 3 }), simulation: GENERATOR_CAPACITY },
          { ...node('app-service-2', 'app-service', 'ID Generator (DC 2)', 480, 320, { instances: 3 }), simulation: GENERATOR_CAPACITY },
          node('coordination-service-1', 'coordination-service', 'ZooKeeper', 240, 440, { instances: 3 }),
        ],
        edges: [
          edge('client-1', 'load-balancer-1', 'write'),
          edge('load-balancer-1', 'app-service-1', 'write'),
          edge('load-balancer-1', 'app-service-2', 'write'),
          edge('coordination-service-1', 'app-service-1', 'both'),
          edge('coordination-service-1', 'app-service-2', 'both'),
        ],
      },
    },
  ],
}
