// The URL shortener (TinyURL): not a primer question. Pastebin covers its pastes; this one focuses on the
// short link itself: keys handed out by a Key Generation Service, redirects served from a cache in front
// of a key-value store, and a read path that survives the cache going cold. The assumptions are authored:
// 100 million new links a day, ten redirects per link, 100 bytes a record, kept 10 years.
//
// Every link created calls the Key Generation Service in the simulation; the Hints and the deep dive explain
// that it hands keys out in batches kept in memory, which this steady-load model does not draw.
import type { ChallengeInput } from '../../src/core/challenges/challenge'
import type { NodeSelector, Predicate } from '../../src/core/challenges/rules'
import { allConnectedRule, apiPath, edge, ENTRY, node, readReplicas, shardedDatabase } from '../primer-challenges/shared'
import { loadBalancerRule, scaleOutRule } from './shared'

/** Where the short key → long URL mapping lives: a key-value store, or a SQL table. */
const URL_STORE: NodeSelector[] = [{ component: 'nosql-store', config: { kind: 'key-value' } }, 'sql-database']

/** The URL store serves its reads from replicas, or spreads them over shards. */
const READS_SPREAD: Predicate = { type: 'any-of', predicates: [...readReplicas('nosql-store'), ...readReplicas('sql-database'), shardedDatabase] }

export const urlShortener: ChallengeInput = {
  id: 'url-shortener',
  title: 'URL qısaldıcı (TinyURL) dizayn edin',
  kind: 'architecture',
  source: 'authored',
  lessonIds: [
    'design-pastebincom-or-bitly',
    'hypertext-transfer-protocol-http',
    'back-of-the-envelope-calculations',
    'cache',
    'nosql',
    'sql-or-nosql',
    'horizontal-scaling',
  ],
  // The authored average: 100 million new links a day and ten redirects for each.
  loadProfile: { readQps: 12_000, writeQps: 1_200, requestBytes: 100 },
  stages: [
    {
      id: 'requirements',
      type: 'requirements',
      weight: 1,
      prompt:
        'TinyURL kimi URL qısaldıcı servis dizayn edin: istifadəçi uzun URL verir və qısa link alır, qısa linki açan hər kəs uzun URL-ə yönləndirilir. Bu sual primer-dən deyil, amma Pastebin sualına yaxındır: burada diqqət qısa açarın yaradılmasına və yönləndirmənin sürətinə yönəlib. Aşağıdakılardan bu tapşırığa aid olan istifadə hallarını (use case) və məhdudiyyətləri seçin, kənarda qalanları seçməyin.',
      items: [
        {
          section: 'use-case',
          text: 'İstifadəçi uzun URL verir və ondan qısa link alır',
          correct: true,
          explanation: 'Servisin əsas yazma ssenarisi: hər uzun URL üçün unikal qısa açar yaradılır və saxlanılır.',
        },
        {
          section: 'use-case',
          text: 'Qısa linki açan istifadəçi uzun URL-ə yönləndirilir (HTTP redirect)',
          correct: true,
          explanation: 'Servisin əsas oxuma ssenarisi: Redirect Service qısa açara görə uzun URL-i tapır və 301 və ya 302 cavabı qaytarır.',
        },
        {
          section: 'use-case',
          text: 'Qısa link mümkün qədər qısa olur və yalnız rəqəm və hərflərdən ibarətdir',
          correct: true,
          explanation: 'Buna görə açar Base 62 ([0-9a-zA-Z]) ilə yazılır: url-də escape tələb edən simvol yoxdur.',
        },
        {
          section: 'use-case',
          text: 'Servis yüksək əlçatanlığa (high availability) malikdir',
          correct: true,
          explanation: 'Yönləndirmə işləməsə, internetdə paylaşılmış bütün linklər qırılır; Scaling mərhələsində bunun üçün replikalar və bir neçə server nüsxəsi əlavə olunur.',
        },
        {
          section: 'use-case',
          text: 'Eyni qısa link heç vaxt iki fərqli URL-ə verilmir',
          correct: true,
          explanation: 'Unikallıq servisin əsas zəmanətidir: açar ya Key Generation Service-dən bir dəfə götürülür, ya da yaradılanda bazada yoxlanılır.',
        },
        {
          section: 'use-case',
          text: 'İstifadəçi qısa linki sonradan başqa URL-ə dəyişir',
          explanation: 'Linklər dəyişməz qəbul edilir: bu, onları rahat cache-ləməyə və hətta 301 ilə brauzerdə saxlamağa imkan verir.',
        },
        {
          section: 'use-case',
          text: 'Hər linkin klik statistikası real vaxtda göstərilir',
          explanation: 'Analitika bu tapşırıqda kənarda qalır. Lazım olsaydı, yönləndirməni ləngitməmək üçün klik hadisələri asinxron (queue vasitəsilə) toplanardı.',
        },
        {
          section: 'use-case',
          text: 'İstifadəçi hesab yaradır və öz linklərinin siyahısını idarə edir',
          explanation: 'Qeydiyyat və hesab idarəsi bu tapşırıqda kənarda qalır: istifadəçi anonimdir.',
        },
        {
          section: 'use-case',
          text: 'Servis açılan səhifənin məzmununu öz serverlərində saxlayır',
          explanation: 'Servis yalnız ünvanı saxlayır və yönləndirir; məzmunu saxlamaq Pastebin-in işidir.',
        },
        {
          section: 'constraint',
          text: 'Gündə 100 milyon yeni link yaradılır',
          correct: true,
          explanation: 'Fərziyyə: ayda təxminən 3 milyard yazma; estimation mərhələsi bundan başlayır.',
        },
        {
          section: 'constraint',
          text: 'Oxuma:yazma nisbəti 10:1-dir',
          correct: true,
          explanation: 'Hər link orta hesabla 10 dəfə açılır: oxuma yolu yazma yolundan ayrıca miqyaslanmalıdır.',
        },
        {
          section: 'constraint',
          text: 'Bir qeyd (qısa açar, uzun URL, yaradılma vaxtı) təxminən 100 baytdır və 10 il saxlanılır',
          correct: true,
          explanation: 'Bu, yaddaş hesablamasının əsasıdır: 10 ildə 365 milyard qeyd yığılır.',
        },
        {
          section: 'constraint',
          text: 'Yönləndirmə çox sürətli olmalıdır',
          correct: true,
          explanation: 'Yönləndirmə istifadəçi ilə hədəf səhifə arasında əlavə addımdır; populyar linklər yaddaş cache-indən verilməlidir.',
        },
        {
          section: 'constraint',
          text: 'Qısa linklər ardıcıl və təxmin edilə bilən ola bilər',
          explanation: 'Ardıcıl linklər başqalarının linklərini gəzməyə imkan verir və servisin həcmini açır; açarlar təsadüfi görünməlidir.',
        },
        {
          section: 'constraint',
          text: 'Yazmalar oxumalardan çoxdur',
          explanation: 'Əksinədir: hər link bir dəfə yaradılır, amma orta hesabla 10 dəfə açılır.',
        },
      ],
    },
    {
      id: 'estimation',
      type: 'estimation',
      weight: 1,
      prompt:
        'Fərziyyələr: gündə 100 milyon, yəni ayda 3 milyard yeni link yaradılır; hər link orta hesabla 10 dəfə açılır (ayda 30 milyard yönləndirmə). Pik anlarda yük ortalamanın 2 qatıdır. Bir qeyd təxminən 100 baytdır və 10 il saxlanılır. Ayda 2,5 milyon saniyə və 1 KB = min bayt kimi yuvarlaq çevirmələri işlədin. Cavablar referansın 2 qatı daxilində olsa qəbul olunur.',
      explanation:
        'Bu, primer-in "back-of-the-envelope" üsuludur: ayda təxminən 2,5 milyon saniyə var, ona görə ayda 3 milyard yazma saniyədə 1 200 yazma deməkdir. Yaddaş qeydlərin sayı ilə ölçüsünün hasilidir; 10 ildə 365 milyard qeyd yığılır. Bu say qısa açarın uzunluğunu da müəyyən edir: Base 62-də 7 simvol 62^7 ≈ 3,5 trilyon dəyər verir, bu da 365 milyarddan təxminən 10 dəfə çoxdur, 6 simvol (≈ 57 milyard) isə çatmır.',
      inputs: { writesPerMonth: 3_000_000_000, readsPerMonth: 30_000_000_000, bytesPerWrite: 100, peakFactor: 2, years: 10 },
      questions: [
        { id: 'write-qps', quantity: 'writeQps', prompt: 'Orta hesabla saniyədə neçə qısa link yaradılır?' },
        { id: 'read-qps', quantity: 'readQps', prompt: 'Orta hesabla saniyədə neçə yönləndirmə olur?' },
        { id: 'peak-read-qps', quantity: 'peakReadQps', prompt: 'Pik anlarda saniyədə neçə yönləndirmə olur?' },
        { id: 'storage-per-year', quantity: 'storagePerYear', prompt: 'Bir ildə nə qədər yeni qeyd məlumatı yığılır?' },
        { id: 'storage-10-years', quantity: 'storageTotal', prompt: '10 ildə nə qədər qeyd məlumatı yığılır?' },
      ],
    },
    {
      id: 'high-level-design',
      type: 'high-level-design',
      weight: 3,
      prompt:
        'İstifadəçi uzun URL verir və qısa link alır; qısa linki açan hər kəs uzun URL-ə yönləndirilir. Qısa açarlar təsadüfi görünməli və heç vaxt təkrarlanmamalıdır: onları əvvəlcədən yaradılmış açarlar hovuzundan paylayan Key Generation Service (KGS) götürün. Saniyədə orta hesabla 1 200 link yaradılır və 12 000 yönləndirmə olur. Bütün vacib komponentləri kətana qoyun, sorğuların axınını xətlərlə göstərin və "Yoxla" düyməsini basın.',
      rules: [
        {
          id: 'entry-point',
          weight: 2,
          description: 'Client sorğuları tətbiq servislərinə web server (reverse proxy) və ya load balancer vasitəsilə çatır.',
          hints: [
            'Client sorğusu tətbiq kodunun işlədiyi serverə çatmazdan əvvəl ilk olaraq nəyə dəyir?',
            'Client ilə application service arasına web server, reverse proxy və ya load balancer qoyun: hər sorğu ondan keçsin.',
            'Tətbiq serverləri birbaşa internetə açılmır: qarşılarında duran web server və ya reverse proxy SSL-i bitirir, sorğunu yazma və ya oxuma servisinə ötürür və serverləri xaricdən gizlədir. Client-dən application service-ə bu qatdan yan keçən yol olmamalıdır.',
          ],
          check: { type: 'path', from: 'client', to: 'app-service', through: ENTRY },
        },
        {
          id: 'separate-services',
          weight: 2,
          description: 'Link yaratmaq və yönləndirmək ayrı tətbiq servislərindədir.',
          hints: [
            'Yönləndirmələr link yaradılmasından 10 dəfə çoxdur. Hər ikisini eyni server qrupu emal etsə, onları ayrıca miqyaslamaq olarmı?',
            'Kətanda ən azı iki application service olsun: biri linki yaradan Shortening Service, digəri yönləndirən Redirect Service.',
            'Shortening Service açarı KGS-dən alır və qeydi saxlayır; Redirect Service yalnız açara görə uzun URL-i tapır. Ayrı servislər ayrıca miqyaslanır: yönləndirmə yükü artanda yalnız Redirect Service nüsxələri artırılır, yazma yolu isə toxunulmaz qalır.',
          ],
          check: { type: 'node', node: 'app-service', min: 2 },
        },
        {
          id: 'url-store',
          weight: 2,
          description: 'Qısa açarı uzun URL-ə bağlayan qeydlər key-value NoSQL store-da (və ya SQL bazasında) saxlanılır.',
          hints: [
            'Redirect Service qısa açarı aldıqda uzun URL-i haradan tapır?',
            'Qeydlər üçün key-value tipli NoSQL store (və ya SQL database) əlavə edin.',
            'Hər sorğu tək bir açara görə axtarışdır: join, tranzaksiya və mürəkkəb sorğu lazım deyil. Ona görə key-value store (məsələn, DynamoDB, Cassandra) təbii seçimdir və 36 TB-a qədər rahat paylanır. Relational database də işləyər, amma milyardlarla sətirdə onu shard-lamaq daha çox iş tələb edir.',
          ],
          check: { type: 'any-of', predicates: URL_STORE.map((store) => ({ type: 'node', node: store })) },
        },
        {
          id: 'key-generation',
          weight: 2,
          description: 'Yazma servisi qısa açarı ayrıca Key Generation Service-dən alır.',
          hints: [
            'İki server eyni anda link yaratsa, onların eyni açarı seçmədiyinə necə əmin olmaq olar?',
            'Ayrıca application service (Key Generation Service) əlavə edin və Shortening Service-dən ona yazma xətti çəkin. KGS hazır açarları öz bazasında saxlaya bilər.',
            'KGS 7 simvollu təsadüfi açarları əvvəlcədən yaradır və "istifadə olunmamış" kimi saxlayır. Shortening Service açar istəyəndə KGS onu "istifadə olunmuş"a keçirir, ona görə toqquşma yoxlaması və təkrar cəhd lazım olmur. Sürət üçün KGS açarları yaddaşda partiyalarla (məsələn, 1 000-lik) saxlayır; server çöksə, bir neçə açar itir, bu isə 3,5 trilyonluq açar fəzasında problem deyil.',
          ],
          check: { type: 'edge', from: 'app-service', to: 'app-service', traffic: 'write' },
        },
        {
          id: 'write-path',
          weight: 2,
          description: 'Yazma sorğuları tətbiq servisi vasitəsilə qeydlərin anbarına çatır.',
          hints: [
            'Yeni qeyd yazılanda sorğu Client-dən anbara hansı yolla gedir?',
            'Shortening Service-dən qeydlərin anbarına yazma xətti çəkin. Client anbara yalnız application service vasitəsilə çatmalıdır.',
            'Client → Web Server → Shortening Service → URL DB yazma yolu olmalıdır. Client anbara birbaşa yazmamalıdır: uzun URL-in yoxlanılması və açarın KGS-dən alınması məhz servisdə baş verir.',
          ],
          check: apiPath(URL_STORE, 'write'),
        },
        {
          id: 'read-path',
          weight: 2,
          description: 'Yönləndirmə sorğuları tətbiq servisi vasitəsilə qeydlərin anbarından oxuyur.',
          hints: [
            'Qısa linki açan istifadəçini yönləndirmək üçün Redirect Service nəyi oxumalıdır?',
            'Redirect Service-dən qeydlərin anbarına oxuma xətti çəkin. Xəttin trafikini "Oxuma" və ya "Oxuma və yazma" seçin.',
            'Client → Web Server → Redirect Service → URL DB oxuma yolu olmalıdır. Açar tapılsa, servis 301 və ya 302 cavabını Location başlığı ilə qaytarır; tapılmasa, 404 qaytarır.',
          ],
          check: apiPath(URL_STORE, 'read'),
        },
        allConnectedRule('Shortening Service → Key Generation Service'),
      ],
      referenceSolution: {
        nodes: [
          node('client-1', 'client', 'Client', 0, 200),
          node('web-server-1', 'web-server', 'Web Server', 240, 200),
          node('app-service-1', 'app-service', 'Shortening Service', 480, 80),
          node('app-service-2', 'app-service', 'Redirect Service', 480, 320),
          node('app-service-3', 'app-service', 'Key Generation Service', 720, 0),
          node('nosql-store-1', 'nosql-store', 'URL DB', 960, 240),
          node('nosql-store-2', 'nosql-store', 'Key DB', 960, 0),
        ],
        edges: [
          edge('client-1', 'web-server-1', 'both'),
          edge('web-server-1', 'app-service-1', 'write'),
          edge('web-server-1', 'app-service-2', 'read'),
          edge('app-service-1', 'app-service-3', 'write'),
          edge('app-service-3', 'nosql-store-2', 'write'),
          edge('app-service-1', 'nosql-store-1', 'write'),
          edge('app-service-2', 'nosql-store-1', 'read'),
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
          prompt: 'Yönləndirmə üçün hansı HTTP status kodu qaytarılmalıdır, əgər klik statistikasını sonradan toplamaq istəyiriksə?',
          options: [
            {
              text: '302 Found (müvəqqəti yönləndirmə)',
              correct: true,
              explanation: 'Brauzer 302-ni yadda saxlamır, ona görə hər klik servisə gəlir və sayıla bilər. Bunun qiyməti daha çox yükdür.',
            },
            {
              text: '301 Moved Permanently (daimi yönləndirmə)',
              explanation: '301-i brauzer cache-ləyir və növbəti kliklər servisə heç gəlmir: yük azalır, amma kliklər sayılmır. Statistika lazım deyilsə, 301 daha qənaətlidir.',
            },
            {
              text: '200 OK və səhifədə JavaScript ilə yönləndirmə',
              explanation: 'Əlavə səhifə yüklənir və yönləndirmə ləngiyir; axtarış robotları da bunu düzgün izləmir.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Gündə 100 milyon link üçün 10 il kifayət etməsi üçün Base 62 açar ən azı neçə simvol olmalıdır?',
          options: [
            {
              text: '7 simvol: 62^7 ≈ 3,5 trilyon',
              correct: true,
              explanation: '10 ildə 365 milyard link yaranır; 62^7 bundan təxminən 10 dəfə çoxdur, ona görə açar fəzası tükənmir.',
            },
            {
              text: '6 simvol: 62^6 ≈ 57 milyard',
              explanation: '57 milyard açar bir ildən bir az çox çatar (ildə 36,5 milyard link).',
            },
            {
              text: '10 simvol',
              explanation: 'Kifayətdir, amma lazımsız uzundur: qısa link servisinin məqsədi linki mümkün qədər qısa saxlamaqdır.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Uzun URL-dən hash götürüb (məsələn, MD5) ilk 7 simvolu işlətmək KGS ilə müqayisədə hansı problemi yaradır?',
          options: [
            {
              text: 'Toqquşmalar olur: hər yazmada açarın bazada olub-olmadığını yoxlamaq və lazım gələrsə təkrar cəhd etmək lazımdır',
              correct: true,
              explanation: 'Hash-in yalnız bir hissəsi götürüldüyü üçün fərqli URL-lər eyni açarı ala bilər; yoxlama hər yazmaya bir oxuma əlavə edir. KGS isə açarları əvvəlcədən unikal yaradır.',
            },
            {
              text: 'Hash çox yavaş hesablanır',
              explanation: 'MD5 mikrosaniyələr çəkir; problem hesablama deyil, toqquşmaların yoxlanılmasıdır.',
            },
            {
              text: 'Hash Base 62 ilə kodlana bilməz',
              explanation: 'İstənilən ədəd Base 62 ilə yazıla bilər; primer-in Pastebin həlli də məhz belə edir.',
            },
          ],
        },
        {
          type: 'multi-select',
          prompt: 'Key Generation Service-in özü sistemin zəif nöqtəsinə çevrilməsin deyə nə etmək olar?',
          options: [
            {
              text: 'KGS-i bir neçə nüsxədə işlətmək; hər nüsxə öz açar partiyasını götürür',
              correct: true,
              explanation: 'Bir nüsxə çöksə, digərləri açar paylamağa davam edir. Partiyalar üst-üstə düşmədiyi üçün nüsxələr arasında koordinasiya lazım deyil.',
            },
            {
              text: 'Shortening Service-in hər nüsxəsində bir neçə açarı əvvəlcədən yaddaşda saxlamaq',
              correct: true,
              explanation: 'KGS qısa müddət əlçatmaz olsa da, servislər əldəki açarlarla link yaratmağa davam edir; çökəndə itən açarlar isə açar fəzasında əhəmiyyətsizdir.',
            },
            {
              text: 'Hər açarı vermədən əvvəl bütün KGS nüsxələrindən razılıq almaq',
              explanation: 'Bu, hər yazmaya paylanmış razılaşma (consensus) əlavə edir və KGS-i yavaşladır; partiyalarla bölmək bu ehtiyacı aradan qaldırır.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Redirect Service-in cache-i doldurulduqda hansı çıxarma (eviction) siyasəti ən uyğundur?',
          options: [
            {
              text: 'LRU (Least Recently Used)',
              correct: true,
              explanation: 'Linklərin populyarlığı qısa müddətlidir: yeni paylaşılan link çox açılır, sonra unudulur. LRU son vaxtlar açılmayanları çıxarır.',
            },
            {
              text: 'FIFO',
              explanation: 'Ən köhnə daxil olanı çıxarır, hətta o hələ də ən populyar link olsa belə.',
            },
            {
              text: 'Heç vaxt çıxarmamaq: bütün 36 TB-ı yaddaşda saxlamaq',
              explanation: 'Linklərin böyük hissəsi nadir açılır; 36 TB yaddaş çox bahadır və populyar 20% linkin cache-i artıq oxumaların çoxunu udur.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Eyni uzun URL ikinci dəfə qısaldılanda nə etmək olar?',
          options: [
            {
              text: 'Hər dəfə yeni açar vermək; istəyə görə uzun URL üzrə indekslə köhnəsini qaytarmaq',
              correct: true,
              explanation: 'Ən sadəsi yeni açar verməkdir: yaddaşı bir az artırır, amma uzun URL üzrə ikinci indeks tələb etmir. Köhnə açarı qaytarmaq yaddaşa qənaət edir, amma hər yazmaya axtarış əlavə edir; bu bir trade-off-dur.',
            },
            {
              text: 'Sorğunu rədd etmək',
              explanation: 'İstifadəçi üçün mənasızdır: eyni linki fərqli kampaniyalar üçün ayrıca qısaltmaq tez-tez lazımdır.',
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
        'Yüksək səviyyəli dizaynınızdan davam edin və onu pik yükə görə miqyaslayın: saniyədə 24 000 yönləndirmə və 2 400 yeni link. Yönləndirmənin orta gecikməsi 100 ms-i, yazmanınkı 200 ms-i keçməməli, heç bir node həddən artıq yüklənməməli və heç bir sorğu xəta ilə bitməməlidir. Xaos tapşırığı: cache yenidən başladılıb və boşdur (cold cache), bütün yönləndirmələr birbaşa bazaya düşür; onlar yenə xətasız işləməlidir. Bunu trafik simulyasiyası ilə yoxlayın, darboğazları tapın və "Yoxla" düyməsini basın.',
      // The authored peak: twice the average.
      loadProfile: { readQps: 24_000, writeQps: 2_400, requestBytes: 100 },
      chaosTasks: [
        {
          id: 'cache-cold',
          prompt: 'Cache yenidən başladılıb və boşdur: bütün yönləndirmələr bazaya düşür, amma xətasız davam etməlidir.',
          scenario: { type: 'cache-cold', nodes: ['cache'] },
        },
      ],
      rules: [
        {
          id: 'peak-load',
          weight: 3,
          description: 'Pik yükdə (saniyədə 24 000 yönləndirmə, 2 400 yazma) yönləndirmənin orta gecikməsi 100 ms-dən, yazmanınkı 200 ms-dən çox deyil, həddən artıq yüklənən node və xəta yoxdur.',
          hints: [
            'Saniyədə 24 000 yönləndirmə gələndə dizaynınızın hansı node-u ilk tıxanır?',
            'Trafik simulyasiyasını işə salın və "Darboğazlar" siyahısına baxın. Ən çox yüklənən node-ların "instances" sahəsini artırın, oxumaları isə cache və replikalarla bazadan götürün.',
            'Hər node bir nüsxədə məhdud sorğu emal edir (bu modeldə application service-in bir nüsxəsi saniyədə 500 sorğu). 24 000 yönləndirmə üçün Redirect Service-ə 48-dən çox, ehtiyatla 60-dan çox nüsxə lazımdır; web server-lər və load balancer da ümumi yükü daşımalıdır. Populyar linklər cache-dən verilir, cache-də olmayanlar isə bazanın replikalarından oxunur.',
          ],
          check: { type: 'simulation', maxLatencyMs: { read: 100, write: 200 }, maxOverloadedNodes: 0, maxErrorRate: 0 },
        },
        {
          id: 'cache-cold',
          weight: 2,
          description: 'Cache boş olanda pik yükdə yönləndirmələr xətasız davam edir və heç bir node həddən artıq yüklənmir.',
          hints: [
            'Cache yenidən başladılsa, bir anda bütün yönləndirmələr hara gedəcək? Baza buna hazırdırmı?',
            'Trafik simulyasiyasında "Xaos ssenarisi" siyahısından bu tapşırığı seçin və qırmızı node-lara baxın. URL bazasına replikalar əlavə edin, onu shard-layın və ya nüsxələrini artırın ki, bütün oxumaları cache-siz də daşısın.',
            'Cache yükü bazadan götürür, amma onun dolu olacağına arxalanmaq olmaz: yenidən başlama, deploy və ya çıxarma cache-i boşaldır və bütün oxumalar bir anda bazaya düşür ("thundering herd"). Baza pik oxumaları cache-siz də daşıya bilməlidir: məsələn, primary-yə 3 replika və 2 shard ilə 40 000 oxuma/san tutumu yaranır.',
          ],
          check: { type: 'simulation', chaos: 'cache-cold', maxOverloadedNodes: 0, maxErrorRate: { read: 0 } },
        },
        loadBalancerRule,
        scaleOutRule,
        {
          id: 'redirect-cache',
          weight: 2,
          description: 'Redirect Service populyar linkləri yaddaş cache-indən oxuyur.',
          hints: [
            'Eyni populyar link min dəfə açılanda hər dəfə bazaya getmək lazımdırmı?',
            'Redirect Service-dən cache komponentinə oxuma xətti çəkin, bazaya gedən oxuma xəttini də saxlayın.',
            'Linklərin populyarlığı qeyri-bərabərdir: kiçik bir hissəsi kliklərin çoxunu alır. Cache-aside ilə Redirect Service əvvəl cache-ə baxır, tapmasa bazadan oxuyub cache-ə yazır. Linklər dəyişmədiyi üçün cache-dəki dəyər köhnəlmir.',
          ],
          check: { type: 'edge', from: 'app-service', to: 'cache', traffic: 'read' },
        },
        {
          id: 'reads-spread',
          weight: 2,
          description: 'URL bazası oxumaları replikalara paylayır və ya shard-lara bölünüb.',
          hints: [
            '10 ildə 365 milyard qeyd və saniyədə minlərlə oxuma bir baza serverinə sığarmı?',
            'URL bazasının "replicas" sahəsini 1 və ya daha çox edin (ya da "replica" rolunda ayrıca node əlavə edin), və ya "shardKey" (məsələn, short_url) yazıb "instances"-i 2 və daha çox edin.',
            'Replikalar oxumaları bölür, shard-lar isə həm məlumatı, həm də yükü bölür. Qısa açar təsadüfi olduğu üçün shard açarı kimi əladır: qeydlər shard-lar arasında bərabər paylanır və isti shard yaranmır.',
          ],
          check: READS_SPREAD,
        },
        {
          id: 'requests-through-services',
          weight: 2,
          description: 'Yazmalar və yönləndirmələr URL bazasına yalnız tətbiq servisləri vasitəsilə çatır.',
          hints: [
            'Yeni komponentlər əlavə edəndə yazma və oxuma yolları hələ də Shortening və Redirect servislərindən keçirmi?',
            'Shortening Service-dən URL bazasına yazma, Redirect Service-dən oxuma xətlərini saxlayın; Client bazaya servisdən yan keçərək çatmamalıdır.',
            'Miqyaslanmış dizaynda da yazma yolu Load Balancer → Web Server → Shortening Service → URL DB, oxuma yolu isə Load Balancer → Web Server → Redirect Service → Cache / URL DB-dir.',
          ],
          check: { type: 'all-of', predicates: [apiPath(URL_STORE, 'write'), apiPath(URL_STORE, 'read')] },
        },
        allConnectedRule('Redirect Service → Cache'),
      ],
      referenceSolution: {
        nodes: [
          node('client-1', 'client', 'Client', 0, 320),
          node('dns-1', 'dns', 'DNS', 240, 80),
          node('load-balancer-1', 'load-balancer', 'Load Balancer', 240, 320, { instances: 2 }),
          node('web-server-1', 'web-server', 'Web Server', 480, 320, { instances: 40 }),
          node('app-service-1', 'app-service', 'Shortening Service', 720, 160, { instances: 8 }),
          node('app-service-2', 'app-service', 'Redirect Service', 720, 480, { instances: 64 }),
          node('app-service-3', 'app-service', 'Key Generation Service', 960, 0, { instances: 8 }),
          node('cache-1', 'cache', 'Memory Cache', 960, 600, { instances: 2 }),
          node('nosql-store-1', 'nosql-store', 'URL DB', 1200, 360, { replicas: 3, shardKey: 'short_url', instances: 2 }),
          node('nosql-store-2', 'nosql-store', 'Key DB', 1200, 0),
        ],
        edges: [
          edge('client-1', 'dns-1', 'read'),
          edge('client-1', 'load-balancer-1', 'both'),
          edge('load-balancer-1', 'web-server-1', 'both'),
          edge('web-server-1', 'app-service-1', 'write'),
          edge('web-server-1', 'app-service-2', 'read'),
          edge('app-service-1', 'app-service-3', 'write'),
          edge('app-service-3', 'nosql-store-2', 'write'),
          edge('app-service-1', 'nosql-store-1', 'write'),
          edge('app-service-2', 'cache-1', 'read'),
          edge('app-service-2', 'nosql-store-1', 'read'),
        ],
      },
    },
  ],
}
