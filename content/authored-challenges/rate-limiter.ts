// The API rate limiter: not a primer question, though the primer lists it among its additional questions.
// A rate limiter sits in every request's path in front of the API servers and checks each request against
// a counter shared by all its instances in an in-memory store (Redis); workers load the limit rules from a
// rules store into that cache. Scaling tunes the limit between the legitimate peak and what the API servers
// can take, sizes the limiter for a burst of abusive traffic, and decides what happens when the counters
// are lost: failing open keeps the API available.
//
// The simulation's rate limiter lets one total number of requests a second through, standing for the sum of
// every client's allowance, and the load's clients for all of them together: an abusive burst is extra load
// the limit cuts off. It checks the counters for every request, those it rejects too. The rules worker is
// reached by no request, so it carries no load. The limiter's algorithm changes nothing in the simulation:
// the deep dive weighs the algorithms.
import type { ChallengeInput } from '../../src/core/challenges/challenge'
import type { NodeSelector, Predicate } from '../../src/core/challenges/rules'
import { allConnectedRule, edge, node } from '../primer-challenges/shared'
import { scaleOutRule } from './shared'

/** Where the counters live: an in-memory cache (Redis), or a NoSQL store, as the simulation's rate limiter takes them. */
const COUNTER_STORE: NodeSelector[] = ['cache', 'nosql-store']
/** Where the limit rules are kept on disk. */
const RULES_STORE: NodeSelector[] = [['sql-database', 'object-store'], { component: 'nosql-store', config: { kind: 'document' } }]

/** Every request reaches the API servers through a rate limiter. */
const LIMITED: Predicate = { type: 'path', from: 'client', to: 'app-service', through: 'rate-limiter' }

/** A rate limiter keeps its counters in memory, and none of them in a SQL database. */
const COUNTERS_IN_MEMORY: Predicate = {
  type: 'all-of',
  predicates: [
    { type: 'any-of', predicates: COUNTER_STORE.map((store) => ({ type: 'edge', from: 'rate-limiter', to: store })) },
    { type: 'no-edge', from: 'rate-limiter', to: 'sql-database' },
  ],
}

/** An abusive burst: four times the peak, the same mix. */
const BURST = { readQps: 32_000, writeQps: 8_000, requestBytes: 1_000 }

export const rateLimiter: ChallengeInput = {
  id: 'rate-limiter',
  title: 'API rate limiter dizayn edin',
  kind: 'architecture',
  source: 'authored',
  lessonIds: [
    'additional-system-design-interview-questions',
    'reverse-proxy-web-server',
    'cache',
    'application-layer',
    'hypertext-transfer-protocol-http',
    'fail-over',
    'horizontal-scaling',
  ],
  // The authored average: 4 billion reads and 1 billion writes a month reach the API.
  loadProfile: { readQps: 1_600, writeQps: 400, requestBytes: 1_000 },
  stages: [
    {
      id: 'requirements',
      type: 'requirements',
      weight: 1,
      prompt:
        'Böyük bir API platforması üçün server tərəfində işləyən rate limiter dizayn edin: hər client müəyyən müddətdə yalnız müəyyən sayda sorğu göndərə bilər, artığı rədd edilir. Bu sual primer-dən deyil (primer onu əlavə suallar siyahısında adlandırır). Aşağıdakılardan bu tapşırığa aid olan istifadə hallarını (use case) və məhdudiyyətləri seçin, kənarda qalanları seçməyin.',
      items: [
        {
          section: 'use-case',
          text: 'Limiti keçən sorğu dərhal rədd edilir və client-ə HTTP 429 (Too Many Requests) qaytarılır',
          correct: true,
          explanation: 'Rate limiter-in əsas işi: artıq sorğu API serverlərinə çatmamalıdır, client isə nə baş verdiyini status kodundan bilməlidir.',
        },
        {
          section: 'use-case',
          text: 'Limitlər qaydalarla təyin olunur: məsələn, istifadəçi başına dəqiqədə 100 sorğu, IP başına saniyədə 10 login cəhdi',
          correct: true,
          explanation: 'Fərqli API-lər və client-lər üçün fərqli limitlər lazımdır; qaydalar konfiqurasiya kimi saxlanılır və koddan ayrıdır.',
        },
        {
          section: 'use-case',
          text: 'Limit bütün serverlər üzrə birlikdə tətbiq olunur (distributed rate limiting)',
          correct: true,
          explanation: 'Client-in sorğuları load balancer arxasında fərqli serverlərə düşür; limit hər serverdə ayrıca sayılsa, client N serverdə N qat limit alardı. Ona görə sayğaclar ortaq olmalıdır.',
        },
        {
          section: 'use-case',
          text: 'Client neçə sorğusu qaldığını və nə vaxt yenidən cəhd edə biləcəyini cavab başlıqlarından bilir',
          correct: true,
          explanation: 'X-Ratelimit-Remaining, X-Ratelimit-Limit və Retry-After kimi başlıqlar client-ə özünü tənzimləməyə imkan verir.',
        },
        {
          section: 'use-case',
          text: 'Rate limiter istifadəçinin brauzerində (client tərəfində) işləyir',
          explanation: 'Client tərəfini istənilən istifadəçi dəyişə və ya keçə bilər; etibarlı limit yalnız server tərəfində tətbiq olunur.',
        },
        {
          section: 'use-case',
          text: 'Rate limiter API sorğularının məzmununu yoxlayır və zərərli olanları süzür',
          explanation: 'Bu, WAF-ın (web application firewall) işidir. Rate limiter yalnız sorğuların sayına baxır.',
        },
        {
          section: 'use-case',
          text: 'Limiti keçən sorğular gizli şəkildə növbəyə qoyulur və həmişə sonradan icra edilir',
          explanation: 'Bəzi sistemlər bunu edir, amma bu tapşırığın tələbi sorğunu 429 ilə rədd etməkdir; gizli növbə client-i çaşdırır və yaddaşı doldurur.',
        },
        {
          section: 'constraint',
          text: 'Rate limiter hər sorğunun yolundadır, ona görə gecikməyə çox az əlavə etməlidir',
          correct: true,
          explanation: 'Hər sorğu limiterdən keçir: sayğac disk bazasında yox, yaddaşda (Redis kimi) saxlanılmalıdır.',
        },
        {
          section: 'constraint',
          text: 'Rate limiter sıradan çıxsa da, API əlçatan qalmalıdır',
          correct: true,
          explanation: 'Limiter qoruyucu qatdır; onun çökməsi bütün API-ni dayandırmamalıdır. Bu, fail-open qərarına və limiterin bir neçə nüsxəsinə aparır.',
        },
        {
          section: 'constraint',
          text: 'Ayda 4 milyard oxuma və 1 milyard yazma sorğusu, pik anlarda ortalamanın 5 qatı',
          correct: true,
          explanation: 'Fərziyyə: estimation mərhələsindəki hesablamalar bu rəqəmlərdən başlayır.',
        },
        {
          section: 'constraint',
          text: '10 milyon aktiv istifadəçinin sayğacları yaddaşa sığmalıdır',
          correct: true,
          explanation: 'Bir sayğac (açar, say, müddət) on baytlarla ölçülür: 10 milyon istifadəçi və bir neçə qayda üçün bu, bir neçə GB-dır, bir Redis klasterinə rahat sığır.',
        },
        {
          section: 'constraint',
          text: 'Limit millisaniyə dəqiqliyi ilə, heç bir artıq sorğu buraxmadan tətbiq olunmalıdır',
          explanation: 'Paylanmış sistemdə tam dəqiqlik çox baha başa gəlir; bir neçə artıq sorğunun keçməsi adətən qəbul ediləndir, bu da sliding window counter kimi təqribi alqoritmlərə imkan verir.',
        },
        {
          section: 'constraint',
          text: 'Sayğaclar hər sorğuda SQL bazasına yazılmalıdır ki, itməsin',
          explanation: 'Sayğaclar qısa ömürlüdür (bir pəncərə müddəti); onları diskə yazmaq hər sorğuya millisaniyələr əlavə edər. İtən sayğac yalnız bir pəncərəlik limiti sıfırlayır.',
        },
      ],
    },
    {
      id: 'estimation',
      type: 'estimation',
      weight: 1,
      prompt:
        'Fərziyyələr: API-yə ayda 4 milyard oxuma və 1 milyard yazma sorğusu gəlir; pik anlarda yük ortalamanın 5 qatıdır. Hər sorğu rate limiter-dən keçir və onun sayğacını yeniləyir. Ayda 2,5 milyon saniyə kimi yuvarlaq çevirməni işlədin. Cavablar referansın 2 qatı daxilində olsa qəbul olunur.',
      explanation:
        'Ayda təxminən 2,5 milyon saniyə var, ona görə ayda 4 milyard oxuma saniyədə 1 600 oxuma deməkdir. Pik yük limiterin və sayğac anbarının ölçüsünü müəyyən edir: limiter hər sorğuya, hətta rədd etdiyi sorğuya da baxmalıdır. Yaddaş üçün ayrıca hesab: 10 milyon istifadəçi × 2 qayda × təxminən 50 bayt (açar, say, müddət) ≈ 1 GB, bu da bir Redis-ə sığır.',
      // Requests are the API's: a write stores its body; reads are not stored.
      inputs: { writesPerMonth: 1_000_000_000, readsPerMonth: 4_000_000_000, bytesPerWrite: 1_000, peakFactor: 5 },
      questions: [
        { id: 'read-qps', quantity: 'readQps', prompt: 'Orta hesabla saniyədə neçə oxuma sorğusu gəlir?' },
        { id: 'write-qps', quantity: 'writeQps', prompt: 'Orta hesabla saniyədə neçə yazma sorğusu gəlir?' },
        { id: 'peak-read-qps', quantity: 'peakReadQps', prompt: 'Pik anlarda saniyədə neçə oxuma sorğusu gəlir?' },
        { id: 'peak-write-qps', quantity: 'peakWriteQps', prompt: 'Pik anlarda saniyədə neçə yazma sorğusu gəlir?' },
      ],
    },
    {
      id: 'high-level-design',
      type: 'high-level-design',
      weight: 3,
      prompt:
        'API serverlərini qoruyan rate limiter dizayn edin: hər sorğu API-yə çatmazdan əvvəl yoxlanılır, limiti keçənlər 429 ilə rədd edilir. Limit bütün serverlər üzrə birlikdə tətbiq olunur, limit qaydaları isə diskdə saxlanılır və işçi proseslər (workers) tərəfindən cache-ə yüklənir. Saniyədə orta hesabla 2 000 sorğu gəlir. Bütün vacib komponentləri kətana qoyun, sorğuların axınını xətlərlə göstərin və "Yoxla" düyməsini basın.',
      rules: [
        {
          id: 'limiter-in-path',
          weight: 3,
          description: 'Bütün client sorğuları API serverlərinə rate limiter vasitəsilə çatır.',
          hints: [
            'Limiti keçən sorğunun API serverinə çatmaması üçün yoxlama harada olmalıdır?',
            'Rate limiter komponenti əlavə edin, Client-dən ona, ondan isə API serverlərinə (application service) xətt çəkin. Client-dən API-yə limiterdən yan keçən yol olmamalıdır.',
            'Rate limiter API serverlərinin qarşısında middleware kimi (çox vaxt API gateway-in içində) işləyir: hər sorğunu sayğacla yoxlayır, limit daxilindəkiləri API-yə ötürür, artığını isə 429 ilə dərhal rədd edir. Limiterdən yan keçən tək bir yol bütün qorumanı mənasız edir.',
          ],
          check: LIMITED,
        },
        {
          id: 'counters-in-memory',
          weight: 3,
          description: 'Rate limiter sayğacları ortaq yaddaş anbarında (Redis kimi cache və ya key-value store) saxlayır, SQL bazasında yox.',
          hints: [
            'Limiter hər sorğuda sayğacı oxuyub artırmalıdır. Bu sayğac harada saxlanılsa, sorğu ən az gözləyər?',
            'Cache komponenti (və ya key-value NoSQL store) əlavə edin və rate limiter-dən ona xətt çəkin. Limiterdən SQL bazasına xətt olmamalıdır.',
            'Sayğac hər sorğuda yenilənir və bir pəncərə ömür sürür: disk bazası buna görə həm yavaş, həm də lazımsızdır. Redis kimi yaddaş anbarı INCR və EXPIRE əmrləri ilə sayğacı atomik artırır və müddəti bitəndə özü silir. Anbar bütün limiter nüsxələri üçün ortaqdır, ona görə limit bütün serverlər üzrə birlikdə tətbiq olunur.',
          ],
          check: COUNTERS_IN_MEMORY,
        },
        {
          id: 'limit-rules',
          weight: 2,
          description: 'Limit qaydaları diskdəki anbarda saxlanılır, işçi servis onları oxuyub cache-ə yazır.',
          hints: [
            'Limitləri dəyişmək üçün hər dəfə rate limiter-in kodunu yenidən yerləşdirmək lazımdırmı? Qaydalar harada saxlanılsın?',
            'Qaydalar üçün SQL database (və ya object store) əlavə edin. Ayrıca application service (Rules Worker) ondan oxusun və cache-ə yazsın.',
            'Qaydalar (məsələn, YAML faylları: domen, açar, dəqiqədə N sorğu) diskdə saxlanılır, çünki nadir dəyişir və itməməlidir. İşçi proses onları mütəmadi oxuyub limiterin baxdığı cache-ə yazır: limiter hər sorğuda diskə getmir, qaydaları dəyişmək isə deploy tələb etmir.',
          ],
          check: {
            type: 'all-of',
            predicates: [
              { type: 'any-of', predicates: RULES_STORE.map((store) => ({ type: 'edge', from: 'app-service', to: store, traffic: 'read' })) },
              { type: 'any-of', predicates: COUNTER_STORE.map((store) => ({ type: 'edge', from: 'app-service', to: store, traffic: 'write' })) },
            ],
          },
        },
        allConnectedRule('Rules Worker → Cache'),
      ],
      referenceSolution: {
        nodes: [
          node('client-1', 'client', 'Client', 0, 160),
          node('rate-limiter-1', 'rate-limiter', 'Rate Limiter', 240, 160, { limitQps: 2_500 }),
          node('app-service-1', 'app-service', 'API Servers', 480, 40, { instances: 5 }),
          node('cache-1', 'cache', 'Redis', 480, 240),
          node('app-service-2', 'app-service', 'Rules Worker', 240, 400),
          node('sql-database-1', 'sql-database', 'Rules DB', 480, 440),
        ],
        edges: [
          edge('client-1', 'rate-limiter-1', 'both'),
          edge('rate-limiter-1', 'app-service-1', 'both'),
          edge('rate-limiter-1', 'cache-1', 'both'),
          edge('app-service-2', 'sql-database-1', 'read'),
          edge('app-service-2', 'cache-1', 'write'),
        ],
      },
    },
    {
      id: 'deep-dive',
      type: 'deep-dive',
      weight: 2,
      prompt: 'Rate limiter-in detallarına keçin. Hər sual üçün seçiminizi edin: bitirdikdən sonra hər variantın trade-off-u izah olunacaq.',
      questions: [
        {
          type: 'multiple-choice',
          prompt: 'API qısa sıçrayışlara (burst) icazə verməli, amma uzunmüddətli orta sürəti məhdudlaşdırmalıdır. Hansı alqoritm buna ən uyğundur?',
          options: [
            {
              text: 'Token bucket: vedrə sabit sürətlə token-lərlə dolur, hər sorğu bir token götürür',
              correct: true,
              explanation: 'Vedrənin tutumu burst-ün ölçüsünü, doldurma sürəti isə orta limiti verir. Sadədir, yaddaşa qənaət edir (iki ədəd) və Amazon, Stripe kimi şirkətlər tərəfindən işlədilir.',
            },
            {
              text: 'Leaking bucket: sorğular növbəyə düşür və sabit sürətlə emal olunur',
              explanation: 'Çıxış sürəti sabitdir, burst-lər hamarlanır: sabit emal sürəti lazım olanda yaxşıdır, amma burst-ə icazə vermir və köhnə sorğular növbədə yeniləri gözlədir.',
            },
            {
              text: 'Fixed window counter: hər dəqiqə üçün bir sayğac',
              explanation: 'Ən sadəsidir, amma pəncərələrin sərhədində iki pəncərənin limiti ard-arda keçə bilər: dəqiqənin sonunda və növbətinin əvvəlində, yəni qısa müddətdə limitin 2 qatı.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Fixed window counter-in pəncərə sərhədindəki problemini həll edən, amma hər sorğunun vaxtını saxlayan alqoritm hansıdır?',
          options: [
            {
              text: 'Sliding window log',
              correct: true,
              explanation: 'Hər sorğunun vaxt damğası (məsələn, Redis sorted set-də) saxlanılır və son pəncərədəkilər sayılır: limit dəqiqdir, amma rədd edilən sorğuların da vaxtı saxlandığı üçün çox yaddaş tələb edir.',
            },
            {
              text: 'Sliding window counter',
              explanation: 'Bu, cari və əvvəlki pəncərənin sayğaclarını çəki ilə birləşdirən təqribi alqoritmdir: vaxt damğalarını saxlamır, yaddaşa qənaət edir, amma dəqiq deyil.',
            },
            {
              text: 'Token bucket',
              explanation: 'Token bucket da vaxt damğası saxlamır: yalnız token sayı və son doldurma vaxtı.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'İki limiter nüsxəsi eyni istifadəçinin sayğacını eyni anda oxuyub (say 3), hər biri 4 yazsa nə baş verir və bunu necə həll etmək olar?',
          options: [
            {
              text: 'Race condition: bir sorğu sayılmır; sayğacı atomik əmrlə (INCR) və ya Lua skripti ilə yeniləmək lazımdır',
              correct: true,
              explanation: 'Oxu-dəyiş-yaz ardıcıllığı atomik deyil. Redis-in INCR əmri və ya oxuma ilə yazmanı bir Lua skriptində birləşdirmək onu bir əməliyyata çevirir, kilid (lock) lazım olmur.',
            },
            {
              text: 'Problem yoxdur: Redis tək axınlıdır',
              explanation: 'Hər əmr ayrıca atomikdir, amma GET və SET ayrı əmrlərdir: aralarına başqa nüsxənin əmri girə bilər.',
            },
            {
              text: 'Hər sayğac üçün paylanmış kilid (distributed lock) götürmək',
              explanation: 'İşləyər, amma hər sorğuya kilidin götürülməsi və buraxılması əlavə olunur və limiter ciddi ləngiyir.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Sayğac anbarı (Redis) əlçatmaz olanda rate limiter nə etməlidir, əgər API-nin əlçatanlığı əsasdırsa?',
          options: [
            {
              text: 'Fail-open: sorğuları yoxlamadan buraxmaq və problemi monitorinqə bildirmək',
              correct: true,
              explanation: 'API işləməyə davam edir; qısa müddət limit tətbiq olunmur, bu da adətən bütün API-ni dayandırmaqdan yaxşıdır. Qiyməti: həmin müddətdə sui-istifadəyə qarşı qoruma yoxdur.',
            },
            {
              text: 'Fail-closed: bütün sorğuları 429 ilə rədd etmək',
              explanation: 'Qoruma ciddi saxlanılır (məsələn, ödəniş və ya login API-ləri üçün mənalı ola bilər), amma limiterin problemi bütün API-nin dayanmasına çevrilir.',
            },
            {
              text: 'Sayğacları hər nüsxənin öz yaddaşında saymağa keçmək və heç nə bildirməmək',
              explanation: 'Limit nüsxə sayına vurulur və heç kim problemi görmür; ən azı monitorinqə bildirmək lazımdır.',
            },
          ],
        },
        {
          type: 'multi-select',
          prompt: 'Limit nəyə görə tətbiq oluna bilər (sayğacın açarı nə ola bilər)?',
          options: [
            {
              text: 'İstifadəçi id-si və ya API açarı',
              correct: true,
              explanation: 'Girişli API-lər üçün ən ədalətli açardır: hər client öz payını alır.',
            },
            {
              text: 'IP ünvanı',
              correct: true,
              explanation: 'Girişsiz sorğular (məsələn, login cəhdləri) üçün yeganə açardır, amma NAT arxasındakı çox istifadəçi bir IP-ni bölüşür.',
            },
            {
              text: 'API endpoint-i ilə birlikdə (məsələn, user_id + /login)',
              correct: true,
              explanation: 'Fərqli endpoint-lərin fərqli limitləri olur: login cəhdi oxumadan çox daha ciddi məhdudlaşdırılır.',
            },
            {
              text: 'Sorğunun tam mətni',
              explanation: 'Hər sorğu fərqli olduğu üçün sayğac heç vaxt artmaz; limit mənasını itirir.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Rate limiter harada yerləşdirilməlidir?',
          options: [
            {
              text: 'Server tərəfində, API serverlərinin qarşısında middleware kimi (məsələn, API gateway-də)',
              correct: true,
              explanation: 'Bütün sorğular oradan keçir və client onu keçə bilməz; API gateway artıq auth, SSL və marşrutlaşdırma ilə məşğuldursa, limiti də orada saxlamaq rahatdır.',
            },
            {
              text: 'Hər API serverinin öz kodunda, yerli sayğacla',
              explanation: 'Sayğaclar ortaq olmadığı üçün limit server sayına vurulur; üstəlik hər servis məntiqi təkrar yazmalıdır.',
            },
            {
              text: 'Client tətbiqində',
              explanation: 'Client-i istənilən kəs dəyişə bilər: bu, yalnız nəzakət qaydasıdır, qoruma deyil.',
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
        'Yüksək səviyyəli dizaynınızdan davam edin və onu pik yükə görə miqyaslayın: saniyədə 8 000 oxuma və 2 000 yazma. Pik anlarda legitim sorğuların heç biri rədd edilməməli, orta gecikmə 100 ms-i keçməməli və heç bir node həddən artıq yüklənməməlidir. Bundan əlavə, pikin 4 qatı həcmində sui-istifadə dalğası (saniyədə 40 000 sorğu) gəlsə, limiter artığı rədd etməli və heç bir node, o cümlədən limiterin özü, həddən artıq yüklənməməlidir. Xaos tapşırığı: sayğac anbarı sıradan çıxanda API pik yükdə xətasız işləməyə davam etməlidir. Bunu trafik simulyasiyası ilə yoxlayın və "Yoxla" düyməsini basın.',
      // The authored peak: five times the average.
      loadProfile: { readQps: 8_000, writeQps: 2_000, requestBytes: 1_000 },
      chaosTasks: [
        {
          id: 'counters-down',
          prompt: 'Sayğac anbarı sıradan çıxıb: API pik yükdə xətasız işləməyə davam etməlidir.',
          scenario: { type: 'node-down', nodes: COUNTER_STORE },
        },
      ],
      rules: [
        {
          id: 'peak-load',
          weight: 3,
          description: 'Pik yükdə (saniyədə 10 000 sorğu) heç bir sorğu rədd edilmir və ya atılmır, orta gecikmə 100 ms-dən çox deyil, həddən artıq yüklənən node yoxdur.',
          hints: [
            'Pik anlarda gələn 10 000 sorğunun hamısı legitimdir. Limitiniz və API serverləriniz onları buraxmağa hazırdırmı?',
            'Trafik simulyasiyasını işə salın: "Limitə görə rədd edilən" sorğular varsa, rate limiter-in "Limit" sahəsini pik yükdən yuxarı qaldırın; həddən artıq yüklənən node varsa, onun "instances" sahəsini artırın.',
            'Limit iki sərhəd arasında olmalıdır: legitim pikdən (10 000 sorğu/san) yuxarı, ki, heç bir normal sorğu rədd edilməsin, və API serverlərinin tutumundan aşağı, ki, onlar heç vaxt boğulmasın. Bu modeldə API serverinin bir nüsxəsi saniyədə 500 sorğu emal edir: 10 000 üçün ən azı 20, ehtiyatla 30 nüsxə (15 000 tutum), limit isə məsələn 12 000.',
          ],
          check: { type: 'simulation', maxLatencyMs: { read: 100, write: 100 }, maxOverloadedNodes: 0, maxErrorRate: 0 },
        },
        {
          id: 'abusive-burst',
          weight: 3,
          description: 'Saniyədə 40 000 sorğuluq sui-istifadə dalğasında heç bir node, o cümlədən limiter və sayğac anbarı, həddən artıq yüklənmir.',
          hints: [
            'Pikin 4 qatı sorğu gəlsə, limiter API serverlərinə nə qədərini buraxacaq? Limiterin özü 40 000 sorğuya tab gətirəcəkmi?',
            'Rate limiter-in "Limit" sahəsini API serverlərinin tutumundan aşağı saxlayın. Limiterin və onun qarşısındakı load balancer-in "instances" sahəsini artırın: onlar hər sorğuya, rədd etdiklərinə də baxır.',
            'Rədd etmək ucuzdur, amma pulsuz deyil: hər sorğu limiterə çatır və sayğacla yoxlanılır, ona görə limiter də, sayğac anbarı da bütün dalğanı görür. Bu modeldə limiterin və load balancer-in bir nüsxəsi saniyədə 20 000 sorğu emal edir, ona görə 40 000 üçün hər birinə ən azı 3 nüsxə lazımdır; cache-in bir nüsxəsi isə 50 000 sorğu daşıyır. API serverləri yalnız limit qədər sorğu görür: limit onların tutumundan aşağıdırsa, dalğa onları boğmur, artıq sorğular 429 alır. API serverlərini dalğanın hamısını daşıyacaq qədər artırmaq da işləyər, amma bu, sui-istifadəyə görə hər ay pul ödəmək deməkdir.',
          ],
          check: { type: 'simulation', load: BURST, maxOverloadedNodes: 0 },
        },
        {
          id: 'counters-down',
          weight: 2,
          description: 'Sayğac anbarı sıradan çıxanda API pik yükdə xətasız işləyir: limiter fail-open rejimindədir.',
          hints: [
            'Limiter sayğacları görə bilmirsə, sorğunu buraxmalıdır, yoxsa rədd etməli? API-nin əlçatanlığı üçün hansı daha yaxşıdır?',
            'Trafik simulyasiyasında "Xaos ssenarisi" siyahısından bu tapşırığı seçin. Rate limiter-in "Sayğaclar əlçatmaz olanda" sahəsini "Fail-open" edin.',
            'Fail-closed limiter sayğacları itirəndə bütün sorğuları rədd edir: kiçik bir Redis problemi bütün API-nin dayanmasına çevrilir. Fail-open limiter isə sorğuları yoxlamadan buraxır: qısa müddət limit yoxdur, amma API işləyir və problem monitorinqə düşür. API serverləri pik yükü limitsiz də daşıya bilməlidir.',
          ],
          check: { type: 'simulation', chaos: 'counters-down', maxErrorRate: 0 },
        },
        {
          id: 'limiter-in-path',
          weight: 2,
          description: 'Bütün client sorğuları API serverlərinə hələ də rate limiter vasitəsilə çatır.',
          hints: [
            'Yeni komponentlər əlavə edəndə API-yə limiterdən yan keçən yol yarandımı?',
            'Load balancer-i limiterin qarşısına qoyun və bütün xətləri limiter vasitəsilə API serverlərinə aparın.',
            'Miqyaslanmış dizaynda da hər sorğu Load Balancer → Rate Limiter → API Servers yolu ilə gedir; limiterdən yan keçən tək yol bütün qorumanı keçməyə imkan verir.',
          ],
          check: LIMITED,
        },
        {
          id: 'limiter-scaled-out',
          weight: 2,
          description: 'Rate limiter bir neçə nüsxədə işləyir və onlara sorğular load balancer vasitəsilə gəlir.',
          hints: [
            'Hər sorğu limiterdən keçirsə, limiterin tək nüsxəsi sıradan çıxanda nə olur?',
            'Rate limiter-in "instances" sahəsini 2 və ya daha çox edin və Client ilə limiter arasına load balancer qoyun.',
            'Limiter hər sorğunun yolundadır, ona görə onun tək nüsxəsi bütün API üçün tək nöqtədir (single point of failure). Nüsxələr stateless-dir: sayğaclar ortaq anbardadır, ona görə load balancer sorğunu istənilən nüsxəyə göndərə bilər və limit yenə düzgün sayılır.',
          ],
          check: {
            type: 'all-of',
            predicates: [
              { type: 'node', node: { component: 'rate-limiter', config: { instances: 1 } }, max: 0 },
              { type: 'path', from: 'client', to: 'rate-limiter', through: 'load-balancer' },
            ],
          },
        },
        {
          id: 'shared-counters',
          weight: 2,
          description: 'Bütün limiter nüsxələri sayğacları ortaq yaddaş anbarında saxlayır, SQL bazasında yox.',
          hints: [
            'Hər limiter nüsxəsi sayğacı öz yaddaşında saxlasa, 3 nüsxə ilə client nə qədər sorğu göndərə bilər?',
            'Rate limiter-dən cache-ə (və ya key-value store-a) gedən xətti saxlayın; limiterdən SQL bazasına xətt olmasın.',
            'Ortaq Redis bütün nüsxələrə eyni sayğacı göstərir. Yükü bir Redis daşımasa, sayğaclar açara görə bir neçə Redis node-una shard-lanır (Redis Cluster); bir istifadəçinin sayğacı həmişə eyni node-dadır, ona görə limit yenə düzgün sayılır.',
          ],
          check: COUNTERS_IN_MEMORY,
        },
        scaleOutRule,
        allConnectedRule('Rate Limiter → Redis'),
      ],
      referenceSolution: {
        nodes: [
          node('client-1', 'client', 'Client', 0, 240),
          node('load-balancer-1', 'load-balancer', 'Load Balancer', 240, 240, { instances: 3 }),
          node('rate-limiter-1', 'rate-limiter', 'Rate Limiter', 480, 240, { limitQps: 12_000, failMode: 'open', instances: 3 }),
          node('app-service-1', 'app-service', 'API Servers', 720, 120, { instances: 30 }),
          node('cache-1', 'cache', 'Redis', 720, 360, { instances: 2 }),
          node('app-service-2', 'app-service', 'Rules Worker', 480, 520, { instances: 2 }),
          node('sql-database-1', 'sql-database', 'Rules DB', 720, 580),
        ],
        edges: [
          edge('client-1', 'load-balancer-1', 'both'),
          edge('load-balancer-1', 'rate-limiter-1', 'both'),
          edge('rate-limiter-1', 'app-service-1', 'both'),
          edge('rate-limiter-1', 'cache-1', 'both'),
          edge('app-service-2', 'sql-database-1', 'read'),
          edge('app-service-2', 'cache-1', 'write'),
        ],
      },
    },
  ],
}
