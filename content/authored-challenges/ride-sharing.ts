// Ride sharing (Uber): not a primer question. Drivers keep a WebSocket open and send their location every
// few seconds; a location service keeps each driver's last location in an in-memory geospatial index and puts
// every update on a stream, from which the location history is written for routes, fares and ETA models.
// Riders search the index for the drivers nearby, and the ride service records the trip in a relational
// database. The assumptions are authored: 50,000 drivers online on average, each sending its location every
// 5 seconds, 2,000 riders' requests a second, 100 bytes an update, twice the average at rush hour.
//
// In the simulation a location update is a write and a rider's request (a search for drivers nearby, a ride
// request among them) is a read of the index. Trips, a few hundred a second, are too few next to the updates
// to matter: the trip store is drawn with a write Edge from the ride service, which the load does not reach.
import type { ChallengeInput } from '../../src/core/challenges/challenge'
import type { NodeSelector, Predicate } from '../../src/core/challenges/rules'
import { allConnectedRule, apiPath, edge, node } from '../primer-challenges/shared'
import { loadBalancerRule, queuedWrites, scaledOutNodes, scaleOutRule } from './shared'

/** Where the location history can be kept: a NoSQL store (wide-column fits), files in an object store, or a warehouse. */
const HISTORY_STORE: NodeSelector[] = ['nosql-store', 'object-store', 'data-warehouse']

/** The geospatial index is split into shards: a shard key set, over more than one instance. */
const GEO_INDEX_SHARDED: Predicate = {
  type: 'all-of',
  predicates: [scaledOutNodes('geo-index'), { type: 'node', node: { component: 'geo-index', config: { shardKey: '' } }, max: 0 }],
}

export const rideSharing: ChallengeInput = {
  id: 'ride-sharing',
  title: 'Taksi çağırma servisi (Uber kimi) dizayn edin',
  kind: 'architecture',
  source: 'authored',
  lessonIds: [
    'additional-system-design-interview-questions',
    'communication',
    'nosql',
    'sql-or-nosql',
    'asynchronism',
    'message-queues',
    'back-of-the-envelope-calculations',
    'horizontal-scaling',
  ],
  // The authored average: 25 billion location updates and 5 billion riders' requests a month.
  loadProfile: { readQps: 2_000, writeQps: 10_000, requestBytes: 100 },
  stages: [
    {
      id: 'requirements',
      type: 'requirements',
      weight: 1,
      prompt:
        'Uber kimi taksi çağırma servisi dizayn edin: sərnişin yaxınlıqdakı sürücüləri görür və maşın çağırır, sistem isə onu yaxın sürücü ilə uyğunlaşdırır. Bu sual primer-dən deyil. Aşağıdakılardan bu tapşırığa aid olan istifadə hallarını (use case) və məhdudiyyətləri seçin, kənarda qalanları seçməyin.',
      items: [
        {
          section: 'use-case',
          text: 'Sürücü tətbiqi bir neçə saniyədən bir sürücünün yerini göndərir',
          correct: true,
          explanation: 'Sistemin ən böyük yükü budur: hər onlayn sürücü hər 5 saniyədə bir yer yeniləməsi göndərir.',
        },
        {
          section: 'use-case',
          text: 'Sərnişin xəritədə yaxınlıqdakı sürücüləri görür',
          correct: true,
          explanation: '"Bu nöqtənin yaxınlığında kim var?" sualı geospatial index-ə gedir: bütün sürücüləri gəzmədən yalnız yaxın xanalara baxılır.',
        },
        {
          section: 'use-case',
          text: 'Sərnişin maşın çağırır və sistem onu yaxın, boş sürücü ilə uyğunlaşdırır',
          correct: true,
          explanation: 'Matching: yaxın sürücülər tapılır, təklif onlardan birinə göndərilir, qəbul edəndə səfər yaradılır.',
        },
        {
          section: 'use-case',
          text: 'Səfər başa çatanda gediş haqqı keçilən yola görə hesablanır',
          correct: true,
          explanation: 'Yol sürücünün yer tarixçəsindən (location history) bərpa olunur, ona görə yer yeniləmələri həm də saxlanılır.',
        },
        {
          section: 'use-case',
          text: 'Sürücü və sərnişin tətbiqdə bir-birinə mesaj yazır',
          explanation: 'Chat ayrıca sistemdir (onun üçün ayrıca Çağırış var): bu tapşırıqda kənarda qalır.',
        },
        {
          section: 'use-case',
          text: 'Qiymət tələbə görə real vaxtda dəyişir (surge pricing)',
          explanation: 'Dinamik qiymət maraqlı mövzudur, amma ayrıca analitik sistemdir: bu tapşırıqda kənarda qalır.',
        },
        {
          section: 'constraint',
          text: 'Orta hesabla 50 000 sürücü onlayndır və hər biri 5 saniyədən bir yerini göndərir',
          correct: true,
          explanation: 'Fərziyyə: bu, saniyədə 10 000 yer yeniləməsi, ayda isə 25 milyard deməkdir.',
        },
        {
          section: 'constraint',
          text: 'Sərnişinlər saniyədə orta hesabla 2 000 sorğu göndərir (axtarış və sifariş)',
          correct: true,
          explanation: 'Oxumalar yazmalardan azdır: bu sistem əksər veb sistemlərdən fərqli olaraq yazmaya görə ağırdır.',
        },
        {
          section: 'constraint',
          text: 'Pik saatlarda yük ortalamanın 2 qatıdır; bir yer yeniləməsi təxminən 100 baytdır',
          correct: true,
          explanation: 'Miqyaslama pikə görə yoxlanılır: saniyədə 20 000 yeniləmə. 100 bayt: sürücünün id-si, koordinatlar, vaxt və istiqamət.',
        },
        {
          section: 'constraint',
          text: 'Hər yer yeniləməsi dərhal relational bazaya yazılmalı və transaction ilə təsdiqlənməlidir',
          explanation: 'Sürücünün son yeri 5 saniyə sonra köhnəlir: onu transaction ilə qorumağa dəyməz. Son yer yaddaşda saxlanılır, tarixçə isə asinxron yazılır.',
        },
        {
          section: 'constraint',
          text: 'Sərnişinin gördüyü sürücü yeri millimetr dəqiqliyində və gecikməsiz olmalıdır',
          explanation: 'Bir neçə saniyəlik gecikmə və bir neçə metrlik xəta qəbulediləndir: xəritədəki maşın onsuz da hər 5 saniyədə yenilənir.',
        },
      ],
    },
    {
      id: 'estimation',
      type: 'estimation',
      weight: 1,
      prompt:
        'Fərziyyələr: ayda 25 milyard yer yeniləməsi (orta hesabla 50 000 onlayn sürücü, hər biri 5 saniyədən bir) və 5 milyard sərnişin sorğusu gəlir. Bir yeniləmə 100 baytdır və tarixçədə saxlanılır; pik saatlarda yük ortalamanın 2 qatıdır. Ayda 2,5 milyon saniyə və 1 KB = min bayt kimi yuvarlaq çevirmələri işlədin. Cavablar referansın 2 qatı daxilində olsa qəbul olunur.',
      explanation:
        'Bu, primer-in "back-of-the-envelope" üsuludur: ayda təxminən 2,5 milyon saniyə var, ona görə ayda 25 milyard yeniləmə saniyədə 10 000 (50 000 sürücü ÷ 5 saniyə ilə eyni), pikdə isə 20 000 deməkdir; 5 milyard sorğu saniyədə 2 000-dir. Tarixçə yeniləmələrin sayı ilə ölçüsünün hasilidir: ayda 2,5 TB, ildə 30 TB. Bütün sürücülərin son yeri isə cəmi 50 000 × 100 bayt = 5 MB-dır: problem həcm deyil, saniyədə on minlərlə yazmadır.',
      inputs: { writesPerMonth: 25_000_000_000, readsPerMonth: 5_000_000_000, bytesPerWrite: 100, peakFactor: 2 },
      questions: [
        { id: 'write-qps', quantity: 'writeQps', prompt: 'Orta hesabla saniyədə neçə yer yeniləməsi gəlir?' },
        { id: 'read-qps', quantity: 'readQps', prompt: 'Orta hesabla saniyədə neçə sərnişin sorğusu gəlir?' },
        { id: 'peak-write-qps', quantity: 'peakWriteQps', prompt: 'Pik saatlarda saniyədə neçə yer yeniləməsi gəlir?' },
        { id: 'storage-per-month', quantity: 'storagePerMonth', prompt: 'Bir ayda yer tarixçəsi nə qədər yer tutur?' },
        { id: 'storage-per-year', quantity: 'storagePerYear', prompt: 'Bir ildə yer tarixçəsi nə qədər yer tutur?' },
      ],
    },
    {
      id: 'high-level-design',
      type: 'high-level-design',
      weight: 3,
      prompt:
        'Sürücülər yerlərini WebSocket gateway vasitəsilə göndərir; location service hər sürücünün son yerini geospatial index-də saxlayır və tarixçəni ayrıca yazır. Sərnişinlərin sorğuları ride service-ə gedir, o da yaxın sürücüləri index-dən oxuyur və səfəri bazaya yazır. Bu modeldə yer yeniləməsi yazmadır, sərnişinin sorğusu isə oxumadır. Saniyədə orta hesabla 10 000 yeniləmə və 2 000 sorğu gəlir. Bütün vacib komponentləri kətana qoyun, sorğuların axınını xətlərlə göstərin və "Yoxla" düyməsini basın.',
      rules: [
        {
          id: 'websocket-updates',
          weight: 2,
          description: 'Sürücülərin yer yeniləmələri geospatial index-ə WebSocket gateway vasitəsilə çatır.',
          hints: [
            'Sürücü tətbiqi hər 5 saniyədə yer göndərir, sistem isə ona istənilən an sifariş təklifi göndərməlidir. Hər dəfə yeni HTTP bağlantısı açmaq lazımdırmı?',
            'Client-dən WebSocket gateway-ə, ondan location service-ə (application service), ondan isə geospatial index-ə yazma xətləri çəkin.',
            'WebSocket bağlantısı bir dəfə qurulur və açıq qalır: yeniləmələr handshake olmadan gedir, server isə sürücüyə sifariş təklifini dərhal göndərə bilir. Bu modeldə gateway-in bir nüsxəsi saniyədə 20 000 mesaj ötürür, web server isə 1 000 sorğu.',
          ],
          check: { type: 'path', from: 'client', to: 'geo-index', through: 'websocket-gateway', traffic: 'write' },
        },
        {
          id: 'locations-in-memory',
          weight: 3,
          description: 'Sürücülərin yeri yaddaşdakı geospatial index-də saxlanılır: WebSocket gateway-dən gələn heç bir yer yeniləməsi SQL bazasına yazılmır.',
          hints: [
            'Saniyədə 10 000 yeniləmə, hər biri 5 saniyə sonra köhnəlir. SQL bazası onları yazmağa dəyərmi?',
            'Yer yeniləmələrini geospatial index-ə göndərin və location service-dən SQL database-ə heç bir xətt çəkməyin.',
            'Bütün sürücülərin son yeri cəmi bir neçə MB-dır, amma saniyədə on minlərlə dəfə dəyişir: bu, yaddaşdakı index (məsələn, Redis GEO) üçün işdir. Bu modeldə SQL nüsxəsi saniyədə 1 000 yazma daşıyır, geospatial index isə 20 000. Son yeri itirmək də qorxulu deyil: 5 saniyə sonra yenisi gəlir.',
          ],
          check: {
            type: 'all-of',
            predicates: [
              { type: 'node', node: 'geo-index' },
              { type: 'not', predicate: { type: 'path', from: 'websocket-gateway', to: 'sql-database', traffic: 'write' } },
            ],
          },
        },
        {
          id: 'nearby-search',
          weight: 3,
          description: 'Sərnişinlərin sorğuları yaxın sürücüləri ride service vasitəsilə geospatial index-dən oxuyur.',
          hints: [
            'Sərnişin "yaxınlıqdakı sürücülər" istəyəndə 50 000 sürücünün hamısının məsafəsi hesablanmalıdırmı?',
            'Client-dən web server-ə, ondan ride service-ə (application service), ondan isə geospatial index-ə oxuma xətləri çəkin.',
            'Geospatial index xəritəni xanalara bölür (geohash, quadtree, H3): sərnişinin xanasına və qonşu xanalara baxmaq kifayətdir. Ride service tapılan sürücüləri məsafəyə və gəlmə vaxtına (ETA) görə sıralayıb təklifi ən uyğun boş sürücüyə göndərir.',
          ],
          check: apiPath(['geo-index'], 'read'),
        },
        {
          id: 'trip-store',
          weight: 2,
          description: 'Səfərlər relational bazada (SQL) saxlanılır: bir servis onları ora yazır.',
          hints: [
            'Səfər, onun statusu və ödənişi harada saxlanılır? Bir səfərin bir neçə sətri birlikdə dəyişməlidirmi?',
            'Ride service-dən SQL database-ə xətt çəkin: səfərlər bazası.',
            'Səfər yaradılanda sürücünün statusu, səfərin sətri və ödəniş birlikdə dəyişir: bunu ACID transaction təmin edir. Səfərlər yer yeniləmələrindən çox-çox azdır, ona görə relational baza onları rahat daşıyır.',
          ],
          check: { type: 'edge', from: 'app-service', to: 'sql-database' },
        },
        {
          id: 'location-history',
          weight: 2,
          description: 'Yer tarixçəsi növbə (stream) vasitəsilə ayrıca anbara yazılır: yeniləmələr onu gözləmir.',
          hints: [
            'Gediş haqqı keçilən yola görə hesablanır. Sürücünün keçmiş yerləri harada saxlanılır və yeniləmə onları yazana qədər gözləməlidirmi?',
            'Location service-dən message queue-ya (məsələn, Kafka), ondan tarixçəni yazan worker-ə, ondan isə NoSQL store-a (wide-column) yazma xətləri çəkin.',
            'Tarixçə hər yeniləmədə yazılır, amma nadir oxunur: səfərin yolu, gediş haqqı və ETA modelləri üçün. Növbə onu yeniləmənin yolundan çıxarır: tarixçə anbarı yavaşlasa və ya sıradan çıxsa, yeniləmələr növbədə gözləyir, sürücülərin son yeri isə yenilənməyə davam edir.',
          ],
          check: queuedWrites(HISTORY_STORE),
        },
        allConnectedRule('Location Stream → History Writer'),
      ],
      referenceSolution: {
        nodes: [
          node('client-1', 'client', 'Drivers & Riders', 0, 240),
          node('websocket-gateway-1', 'websocket-gateway', 'WebSocket Gateway', 240, 120),
          node('app-service-1', 'app-service', 'Location Service', 480, 120),
          node('geo-index-1', 'geo-index', 'Driver Locations', 720, 240),
          node('message-queue-1', 'message-queue', 'Location Stream', 720, 0),
          node('app-service-3', 'app-service', 'History Writer', 960, 0),
          node('nosql-store-1', 'nosql-store', 'Location History', 1200, 0, { kind: 'wide-column' }),
          node('web-server-1', 'web-server', 'Web Server', 240, 360),
          node('app-service-2', 'app-service', 'Ride Service', 480, 360),
          node('sql-database-1', 'sql-database', 'Trips', 720, 440),
        ],
        edges: [
          edge('client-1', 'websocket-gateway-1', 'write'),
          edge('websocket-gateway-1', 'app-service-1', 'write'),
          edge('app-service-1', 'geo-index-1', 'write'),
          edge('app-service-1', 'message-queue-1', 'write'),
          edge('message-queue-1', 'app-service-3', 'write'),
          edge('app-service-3', 'nosql-store-1', 'write'),
          edge('client-1', 'web-server-1', 'read'),
          edge('web-server-1', 'app-service-2', 'read'),
          edge('app-service-2', 'geo-index-1', 'read'),
          edge('app-service-2', 'sql-database-1', 'write'),
        ],
      },
    },
    {
      id: 'deep-dive',
      type: 'deep-dive',
      weight: 2,
      prompt: 'Əsas komponentlərin detallarına keçin. Hər sual üçün seçiminizi edin: bitirdikdən sonra hər variantın trade-off-u izah olunacaq.',
      questions: [
        {
          type: 'multiple-choice',
          prompt: 'Sərnişinin yaxınlığındakı sürücüləri necə sürətlə tapmaq olar?',
          options: [
            {
              text: 'Xəritəni xanalara bölmək (məsələn, geohash) və sərnişinin xanası ilə 8 qonşu xanadakı sürücülərə baxmaq',
              correct: true,
              explanation: 'Hər sürücü xanasının açarı altında saxlanılır: axtarış 9 açarı oxuyur, sonra yalnız onların sürücülərinin məsafəsi hesablanır. Qonşu xanalar lazımdır, çünki sərnişin xananın kənarında ola bilər və ən yaxın sürücü qonşu xanadadır.',
            },
            {
              text: 'Bazadakı bütün sürücülərin məsafəsini hesablayıb ən yaxınlarını seçmək',
              explanation: 'Hər axtarış 50 000 sürücünü gəzir: saniyədə 2 000 axtarışda bu, saniyədə 100 milyon məsafə hesabı deməkdir.',
            },
            {
              text: 'SQL-də enlik və uzunluq sütunlarına ayrıca index qoyub hər ikisinə aralıqla sorğu vermək',
              explanation: 'Hər index yalnız bir ölçünü daraldır: enlik aralığı bütün şəhərin şərqdən qərbə zolağını, uzunluq aralığı isə şimaldan cənuba zolağını qaytarır və baza onların böyük kəsişməsini tapmalı olur. Üstəlik hər yeniləmə iki index-i dəyişir.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Tez-tez hərəkət edən sürücülər üçün hansı index daha uyğundur?',
          options: [
            {
              text: 'Sabit xanalar (geohash və ya H3) yaddaşdakı açar-dəyər anbarında: yeniləmə sürücünü bir xananın açarından digərinə keçirir',
              correct: true,
              explanation: 'Xanaların sərhədləri dəyişmir, ona görə yeniləmə ucuzdur: bir silmə və bir əlavə. H3-ün altıbucaqlıları bütün qonşulara bərabər məsafədədir, bu da yaxınlıq hesabını dəqiqləşdirir.',
            },
            {
              text: 'Quadtree: sıx yerləri kiçik xanalara bölən ağac',
              explanation: 'Quadtree sıxlığa uyğunlaşır və restoranlar kimi az dəyişən nöqtələr üçün çox yaxşıdır. Amma saniyədə on minlərlə hərəkətdə ağacı bölmək və birləşdirmək bahalıdır; onu adətən dövri olaraq yenidən qururlar.',
            },
            {
              text: 'Hər yeniləmədə R-tree index-li SQL cədvəlini yeniləmək',
              explanation: 'Fəza sorğuları üçün R-tree yaxşıdır, amma diskdəki index-i saniyədə on minlərlə dəfə yeniləmək bazanı yazmalarla boğur.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Böyük konsertdən sonra bir neçə küçədə minlərlə sərnişin və sürücü var. Geospatial index necə shard-lanmalıdır?',
          options: [
            {
              text: 'Xana prefiksinə (geohash) görə: isti xanalar daha kiçik xanalara bölünür və oxumalar üçün replika alır',
              correct: true,
              explanation: 'Coğrafi shard axtarışı bir-iki shard-da saxlayır. Shard-ı şəhər səviyyəsində seçmək bütün meqapolisi bir node-a yığar; incə xanalar və isti yerlərin bölünməsi yükü yayır.',
            },
            {
              text: 'Sürücünün id-sinə görə hash',
              explanation: 'Yazmalar bərabər paylanır, amma yaxın sürücülər bütün shard-lara səpələnir: hər axtarış hamısına getməlidir (scatter-gather) və ən yavaş shard-ı gözləyir.',
            },
            {
              text: 'Hamısını bir böyük maşında saxlamaq',
              explanation: 'Yaddaş kifayət edir (cəmi bir neçə MB), amma saniyədə on minlərlə yazma və oxuma bir maşının gücünü keçir, onun çökməsi isə bütün servisi dayandırır.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'İki sərnişin eyni anda eyni sürücünü almamalıdır. Bunu necə təmin etmək olar?',
          options: [
            {
              text: 'Sürücünün statusunu atomik dəyişmək (compare-and-set): "boş"dan "təklif olunub"a, qısa müddətli kilidlə (TTL); sürücü cavab verməsə, kilid açılır',
              correct: true,
              explanation: 'Statusu yalnız bir sorğu dəyişə bilir: ikinci sərnişin növbəti sürücüyə keçir. TTL cavab verməyən sürücünün sonsuz kilidli qalmasının qarşısını alır.',
            },
            {
              text: 'Kilid lazım deyil: belə toqquşma nadir olur',
              explanation: 'Pik saatlarda və sıx yerlərdə toqquşma tez-tez olur: iki sərnişin eyni maşını gözləyir, biri isə boş yerə gözləmiş olur.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Sürücünün telefonu söndü və o, xəbərdarlıq etmədən yox oldu. Index-də nə olmalıdır?',
          options: [
            {
              text: 'Hər yerin vaxt möhürü və TTL-i var: 30 saniyə yenilənməyən sürücü axtarışlarda görünmür',
              correct: true,
              explanation: 'Sürücü çıxdığını bildirə bilməyəndə də onun yeri özü köhnəlir: sərnişinə artıq yolda olmayan maşın təklif edilmir.',
            },
            {
              text: 'Sürücü tətbiqi yenidən açıb çıxış edənə qədər onun son yeri qalır',
              explanation: 'Sərnişinlər saatlarla orada olmayan "xəyali" maşını görür və sifariş təklifi cavabsız qalır.',
            },
          ],
        },
        {
          type: 'multi-select',
          prompt: 'Yer tarixçəsi (location history) nə üçün lazımdır?',
          options: [
            {
              text: 'Səfərin real yolunu bərpa edib gediş haqqını hesablamaq',
              correct: true,
              explanation: 'Gediş haqqı keçilən məsafəyə və vaxta görədir: onu sürücünün tarixçəsindən hesablamaq lazımdır.',
            },
            {
              text: 'Gəlmə vaxtını (ETA) proqnozlaşdıran modelləri öyrətmək',
              correct: true,
              explanation: 'Keçmiş səfərlərin sürətləri hər küçənin günün hər saatında necə hərəkət etdiyini göstərir.',
            },
            {
              text: 'Hər axtarışda yaxın sürücüləri tarixçədən tapmaq',
              explanation: 'Axtarış yalnız son yerə baxır və o, yaddaşdakı index-dədir; milyardlarla sətirli tarixçədən oxumaq həm yavaş, həm də lazımsızdır.',
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
        'Yüksək səviyyəli dizaynınızdan davam edin və onu pik saata görə miqyaslayın: saniyədə 20 000 yer yeniləməsi və 4 000 sərnişin sorğusu. Sərnişin sorğusunun orta gecikməsi 20 ms-i keçməməli, heç bir node, o cümlədən worker-lər, həddən artıq yüklənməməli və heç bir sorğu xəta ilə bitməməlidir. Xaos tapşırığı: yer tarixçəsinin anbarı sıradan çıxıb; yeniləmələr və axtarışlar yenə xətasız davam etməlidir. Bunu trafik simulyasiyası ilə yoxlayın, darboğazları tapın və "Yoxla" düyməsini basın.',
      // The authored peak: twice the average, at rush hour.
      loadProfile: { readQps: 4_000, writeQps: 20_000, requestBytes: 100 },
      chaosTasks: [
        {
          id: 'history-down',
          prompt: 'Yer tarixçəsinin anbarı sıradan çıxıb: yer yeniləmələri və axtarışlar xətasız davam etməlidir.',
          scenario: { type: 'node-down', nodes: HISTORY_STORE },
        },
      ],
      rules: [
        {
          id: 'peak-load',
          weight: 3,
          description: 'Pik saatda (saniyədə 20 000 yeniləmə və 4 000 sorğu) sərnişin sorğusunun orta gecikməsi 20 ms-dən çox deyil, həddən artıq yüklənən node və xəta yoxdur.',
          hints: [
            'Saniyədə 20 000 yeniləmə gələndə dizaynınızın hansı node-u ilk tıxanır?',
            'Trafik simulyasiyasını işə salın və "Darboğazlar" siyahısına baxın. Ən çox yüklənən node-ların, o cümlədən növbədən sonrakı worker-lərin "instances" sahəsini artırın.',
            'Bu modeldə application service-in bir nüsxəsi saniyədə 500 sorğu emal edir: 20 000 yeniləmə üçün location service-ə və tarixçə worker-inə 40-dan çox nüsxə, 4 000 sorğu üçün ride service-ə 8-dən çox nüsxə lazımdır; web server 1 000 sorğu emal edir, ona görə 4-dən çox. WebSocket gateway-in və geospatial index-in bir nüsxəsi saniyədə 20 000 sorğu daşıyır: onlara 1-dən çox nüsxə lazımdır. Message queue-nun bir nüsxəsi 10 000 mesaj qəbul edir (2-dən çox nüsxə), wide-column store-unku isə 5 000 yazma (4-dən çox).',
          ],
          check: { type: 'simulation', maxLatencyMs: { read: 20 }, maxOverloadedNodes: 0, maxErrorRate: 0 },
        },
        {
          id: 'history-down',
          weight: 2,
          description: 'Yer tarixçəsinin anbarı sıradan çıxanda pik saatda yeniləmələr və axtarışlar xətasız davam edir.',
          hints: [
            'Tarixçə anbarı sıradan çıxsa, sürücünün yer yeniləməsi xəta alırmı?',
            'Trafik simulyasiyasında "Xaos ssenarisi" siyahısından bu tapşırığı seçin. Tarixçə anbarına gedən hər yolun növbədən keçdiyinə əmin olun.',
            'Növbədən sonrakı iş təxirə salınmış işdir: anbar sıradan çıxanda tarixçə növbədə gözləyir (backlog), son yerlər isə index-də yenilənməyə davam edir. Kafka kimi stream mesajları günlərlə saxlayır, ona görə anbar qayıdanda heç nə itmir.',
          ],
          check: { type: 'simulation', chaos: 'history-down', maxErrorRate: 0 },
        },
        loadBalancerRule,
        scaleOutRule,
        {
          id: 'geo-index-sharded',
          weight: 2,
          description: 'Geospatial index shard-lara bölünüb: shard açarı verilib və o, bir neçə nüsxədə işləyir.',
          hints: [
            'Pikdə index-ə saniyədə 24 000 sorğu düşür. Bir nüsxə bunu daşıyırmı, və o çöksə nə olur?',
            'Geospatial index-in "shardKey" sahəsinə coğrafi açar (məsələn, geohash_prefix) yazın və "instances"-i 2 və ya daha çox edin.',
            'Coğrafi açar yaxın sürücüləri eyni shard-da saxlayır: axtarış bir-iki shard-a gedir, yazmalar isə bütün dünyaya yayılır. Hər şəhər öz shard-larında olduğu üçün bir shard-ın problemi yalnız onun bölgəsinə təsir edir.',
          ],
          check: GEO_INDEX_SHARDED,
        },
        allConnectedRule('Location Stream → History Writer'),
      ],
      referenceSolution: {
        nodes: [
          node('client-1', 'client', 'Drivers & Riders', 0, 280),
          node('load-balancer-1', 'load-balancer', 'Load Balancer', 240, 280, { instances: 2 }),
          node('websocket-gateway-1', 'websocket-gateway', 'WebSocket Gateway', 480, 120, { instances: 2 }),
          node('app-service-1', 'app-service', 'Location Service', 720, 120, { instances: 50 }),
          node('geo-index-1', 'geo-index', 'Driver Locations', 960, 280, { shardKey: 'geohash_prefix', instances: 2 }),
          node('message-queue-1', 'message-queue', 'Location Stream', 960, 0, { instances: 3 }),
          node('app-service-3', 'app-service', 'History Writer', 1200, 0, { instances: 50 }),
          node('nosql-store-1', 'nosql-store', 'Location History', 1440, 0, { kind: 'wide-column', shardKey: 'driver_id', instances: 5 }),
          node('web-server-1', 'web-server', 'Web Server', 480, 440, { instances: 5 }),
          node('app-service-2', 'app-service', 'Ride Service', 720, 440, { instances: 10 }),
          node('sql-database-1', 'sql-database', 'Trips', 960, 520),
        ],
        edges: [
          edge('client-1', 'load-balancer-1', 'both'),
          edge('load-balancer-1', 'websocket-gateway-1', 'write'),
          edge('load-balancer-1', 'web-server-1', 'read'),
          edge('websocket-gateway-1', 'app-service-1', 'write'),
          edge('app-service-1', 'geo-index-1', 'write'),
          edge('app-service-1', 'message-queue-1', 'write'),
          edge('message-queue-1', 'app-service-3', 'write'),
          edge('app-service-3', 'nosql-store-1', 'write'),
          edge('web-server-1', 'app-service-2', 'read'),
          edge('app-service-2', 'geo-index-1', 'read'),
          edge('app-service-2', 'sql-database-1', 'write'),
        ],
      },
    },
  ],
}
