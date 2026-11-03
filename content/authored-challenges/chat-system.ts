// The chat system (WhatsApp): not a primer question. Clients keep a WebSocket open to a gateway, so that
// messages flow both ways without polling; a chat service stores each message in a wide-column store sharded
// by conversation and keeps the undelivered ones in a memory inbox; recipients who are offline get a push
// notification through a queue, so that the provider far away never holds a message up. The assumptions are
// authored: 50 million daily users sending a billion messages a day, each reaching two devices on average,
// 100 bytes a message, kept 5 years.
//
// In the simulation a message sent is a write and a message delivered is a read: the recipient's open
// connection waits for it, and the gateway takes it from the chat service's inbox. Every message sent queues
// a notification job; the push worker drops those of recipients who are online, which this steady-load model
// does not tell apart. Presence is updated asynchronously, by every message here and by heartbeats, which
// the load does not count; the push worker's look-up of presence is drawn on the write path, so it counts as
// a write to the cache.
import type { ChallengeInput } from '../../src/core/challenges/challenge'
import type { NodeSelector, Predicate } from '../../src/core/challenges/rules'
import { allConnectedRule, apiPath, edge, node, QUEUES, shardedDatabase } from '../primer-challenges/shared'
import { MOBILE_PUSH, scaleOutRule } from './shared'

/** Where the messages live: a key-value or wide-column NoSQL store (HBase, Cassandra). */
const MESSAGE_STORE: NodeSelector[] = [{ component: 'nosql-store', config: { kind: ['key-value', 'wide-column'] } }]

/** Messages are sent and delivered over a WebSocket: every path to the message store passes a gateway. */
const OVER_WEBSOCKET: Predicate = {
  type: 'all-of',
  predicates: (['write', 'read'] as const).flatMap((traffic) =>
    MESSAGE_STORE.map((store): Predicate => ({ type: 'path', from: 'client', to: store, through: 'websocket-gateway', traffic })),
  ),
}

/** Push notifications go out through a queue, or along an asynchronous Edge: no message waits for the provider. */
const ASYNC_PUSH: Predicate = {
  type: 'any-of',
  predicates: [
    { type: 'path', from: 'client', to: 'push-service', through: QUEUES, traffic: 'write' },
    { type: 'edge-mode', from: 'app-service', to: 'push-service', mode: 'async' },
  ],
}

export const chatSystem: ChallengeInput = {
  id: 'chat-system',
  title: 'Mesajlaşma tətbiqi (WhatsApp) dizayn edin',
  kind: 'architecture',
  source: 'authored',
  lessonIds: [
    'additional-system-design-interview-questions',
    'communication',
    'transmission-control-protocol-tcp',
    'nosql',
    'cache',
    'message-queues',
    'service-discovery',
    'back-of-the-envelope-calculations',
    'horizontal-scaling',
  ],
  // The authored average: a billion messages a day sent, each delivered to two devices.
  loadProfile: { readQps: 24_000, writeQps: 12_000, requestBytes: 100 },
  stages: [
    {
      id: 'requirements',
      type: 'requirements',
      weight: 1,
      prompt:
        'WhatsApp kimi mesajlaşma tətbiqi dizayn edin: istifadəçilər bir-birinə və kiçik qruplara mətn mesajları göndərir, mesajlar dərhal çatdırılır. Bu sual primer-dən deyil; primer-in OOD bölməsindəki "online chat" sualı siniflərə baxır, bu isə sistemin özünə. Aşağıdakılardan bu tapşırığa aid olan istifadə hallarını (use case) və məhdudiyyətləri seçin, kənarda qalanları seçməyin.',
      items: [
        {
          section: 'use-case',
          text: 'İstifadəçi başqa istifadəçiyə mətn mesajı göndərir (1:1 chat)',
          correct: true,
          explanation: 'Servisin əsas ssenarisi: mesaj saxlanılır və alıcıya çatdırılır.',
        },
        {
          section: 'use-case',
          text: 'İstifadəçi 100 nəfərədək kiçik qrupa mesaj yazır',
          correct: true,
          explanation: 'Qrup mesajı hər üzvə ayrıca çatdırılır: bu, chat-in öz fan-out-udur və qrupun ölçüsü məhdud saxlanılır.',
        },
        {
          section: 'use-case',
          text: 'Onlayn alıcı mesajı dərhal (real vaxtda) alır',
          correct: true,
          explanation: 'Buna görə client serverlə daimi bağlantı (WebSocket) saxlayır: server yeni mesajı soruşulmadan göndərir.',
        },
        {
          section: 'use-case',
          text: 'Oflayn alıcıya push bildirişi gedir, mesajlar isə o qayıdanda çatdırılır',
          correct: true,
          explanation: 'Mesajlar saxlanılır və cihaz qoşulanda yetişdirilir; push bildirişi üçüncü tərəf provayderdən (APNs, FCM) keçir.',
        },
        {
          section: 'use-case',
          text: 'Bir hesab bir neçə cihazda (telefon, kompüter) eyni söhbətləri görür',
          correct: true,
          explanation: 'Hər mesaj alıcının bütün cihazlarına çatmalıdır: orta hesabla iki cihaz, ona görə çatdırılmalar göndərilən mesajlardan iki dəfə çoxdur.',
        },
        {
          section: 'use-case',
          text: 'İstifadəçi dostlarının onlayn olub-olmadığını görür (presence)',
          correct: true,
          explanation: 'Presence ayrıca, yüngül servisdir: gateway-lər heartbeat-ləri ona asinxron ötürür və mesajın yolu onu gözləmir.',
        },
        {
          section: 'use-case',
          text: 'Səsli və görüntülü zənglər',
          explanation: 'Zənglər (WebRTC, media serverləri) bu tapşırıqda kənarda qalır.',
        },
        {
          section: 'use-case',
          text: 'Milyonlarla üzvü olan açıq kanallar',
          explanation: 'Belə kanallar başqa model tələb edir (mesaj hər üzvə köçürülmür, üzvlər onu bir yerdən oxuyur); bu tapşırıqda qruplar kiçikdir.',
        },
        {
          section: 'constraint',
          text: 'Gündə 50 milyon aktiv istifadəçi gündə 1 milyard mesaj göndərir',
          correct: true,
          explanation: 'Fərziyyə: ayda təxminən 30 milyard mesaj; estimation mərhələsi bundan başlayır.',
        },
        {
          section: 'constraint',
          text: 'Hər mesaj orta hesabla 2 cihaza çatdırılır',
          correct: true,
          explanation: 'Çatdırılmalar (oxumalar) yazmalardan iki dəfə çoxdur: gateway-lər hər iki istiqaməti daşımalıdır.',
        },
        {
          section: 'constraint',
          text: 'Mesaj təxminən 100 baytdır və 5 il saxlanılır',
          correct: true,
          explanation: 'Bu, yaddaş hesablamasının əsasıdır: ildə 36 TB, 5 ildə 180 TB.',
        },
        {
          section: 'constraint',
          text: 'Mesajlar alıcıya bir söhbət daxilində göndərildiyi ardıcıllıqla çatır',
          correct: true,
          explanation: 'Buna görə hər söhbətin mesajları söhbət daxilində artan id alır və həmin ardıcıllıqla saxlanılır.',
        },
        {
          section: 'constraint',
          text: 'Mesajın çatdırılması bir neçə dəqiqə gecikə bilər',
          explanation: 'Chat-də gecikmə bir saniyədən az olmalıdır: istifadəçi cavabı söhbət gedərkən gözləyir.',
        },
        {
          section: 'constraint',
          text: 'Client yeni mesajları hər saniyə HTTP sorğusu ilə yoxlayır',
          explanation: 'Belə polling-də sorğuların çoxu boş qayıdır və 50 milyon istifadəçi serverləri boş yerə yükləyir; WebSocket bu israfı aradan qaldırır.',
        },
      ],
    },
    {
      id: 'estimation',
      type: 'estimation',
      weight: 1,
      prompt:
        'Fərziyyələr: gündə 1 milyard, yəni ayda 30 milyard mesaj göndərilir; hər mesaj orta hesabla 2 cihaza çatdırılır (ayda 60 milyard çatdırılma). Pik anlarda yük ortalamanın 2 qatıdır. Bir mesaj təxminən 100 baytdır və 5 il saxlanılır. Ayda 2,5 milyon saniyə və 1 KB = min bayt kimi yuvarlaq çevirmələri işlədin. Cavablar referansın 2 qatı daxilində olsa qəbul olunur.',
      explanation:
        'Bu, primer-in "back-of-the-envelope" üsuludur: ayda təxminən 2,5 milyon saniyə var, ona görə ayda 30 milyard mesaj saniyədə 12 000 göndərmə, 60 milyard çatdırılma isə saniyədə 24 000 çatdırılma deməkdir; pikdə hər ikisi iki qatdır. Yaddaş mesajların sayı ilə ölçüsünün hasilidir: ayda 3 TB, ildə 36 TB, 5 ildə 180 TB. Bu həcm və saniyədə on minlərlə yazma tək serverə sığmır, ona görə mesajlar söhbətə görə shard-lanır.',
      inputs: { writesPerMonth: 30_000_000_000, readsPerMonth: 60_000_000_000, bytesPerWrite: 100, peakFactor: 2, years: 5 },
      questions: [
        { id: 'write-qps', quantity: 'writeQps', prompt: 'Orta hesabla saniyədə neçə mesaj göndərilir?' },
        { id: 'read-qps', quantity: 'readQps', prompt: 'Orta hesabla saniyədə neçə mesaj cihazlara çatdırılır?' },
        { id: 'peak-write-qps', quantity: 'peakWriteQps', prompt: 'Pik anlarda saniyədə neçə mesaj göndərilir?' },
        { id: 'storage-per-year', quantity: 'storagePerYear', prompt: 'Bir ildə nə qədər yeni mesaj məlumatı yığılır?' },
        { id: 'storage-5-years', quantity: 'storageTotal', prompt: '5 ildə nə qədər mesaj məlumatı yığılır?' },
      ],
    },
    {
      id: 'high-level-design',
      type: 'high-level-design',
      weight: 3,
      prompt:
        'İstifadəçilər bir-birinə mesaj göndərir; onlayn alıcı mesajı dərhal alır, oflayn alıcıya isə push bildirişi gedir. Client-lər WebSocket gateway ilə daimi bağlantı saxlayır. Bu modeldə göndərilən mesaj yazma, alıcının cihazına çatdırılan mesaj isə oxuma kimi sayılır: alıcının açıq bağlantısı mesajı gözləyir və gateway onu chat servisindən alır. Saniyədə orta hesabla 12 000 mesaj göndərilir və 24 000 mesaj çatdırılır. Bütün vacib komponentləri kətana qoyun, sorğuların axınını xətlərlə göstərin və "Yoxla" düyməsini basın.',
      rules: [
        {
          id: 'websocket',
          weight: 3,
          description: 'Mesajlar həm göndərilir, həm də çatdırılır WebSocket gateway vasitəsilə: mesajların anbarına gedən hər yol ondan keçir.',
          hints: [
            'Server alıcıya yeni mesajı necə çatdırır, əgər client heç nə soruşmursa?',
            'WebSocket gateway əlavə edin, Client-dən ona hər iki trafiki daşıyan xətt, ondan isə chat servisinə xətt çəkin. Mesajların anbarına gateway-dən yan keçən yol olmasın.',
            'HTTP-də yalnız client soruşur: server yeni mesajı ancaq polling (hər neçə saniyədən bir sorğu) və ya long polling ilə verə bilər, sorğuların çoxu isə boş qayıdır. WebSocket bir dəfə qurulan və açıq qalan iki istiqamətli bağlantıdır: client mesajı ondan göndərir, server isə yeni mesajı dərhal ondan ötürür. Gateway bağlantıları saxlayır, mesajların məntiqini isə chat servisinə ötürür.',
          ],
          check: OVER_WEBSOCKET,
        },
        {
          id: 'message-store',
          weight: 2,
          description: 'Mesajlar chat servisi vasitəsilə key-value və ya wide-column NoSQL store-a yazılır.',
          hints: [
            'Saniyədə 12 000 mesaj, 5 ildə 180 TB. Bu yükə hansı növ anbar yaxşı uyğun gəlir?',
            'Wide-column (və ya key-value) tipli NoSQL store əlavə edin və chat servisindən ona yazma xətti çəkin.',
            'Chat yükü yazmaya meyillidir və mesajlar demək olar həmişə söhbətə görə, son mesajlardan başlayaraq oxunur: join və mürəkkəb sorğu lazım deyil. Wide-column store (HBase, Cassandra) söhbətin mesajlarını id ardıcıllığı ilə yan-yana saxlayır və üfüqi paylanır; Facebook Messenger HBase-dən, Discord isə Cassandra-dan istifadə edir. Relational database bu həcmdə shard-lamaq üçün xeyli iş tələb edir.',
          ],
          check: apiPath(MESSAGE_STORE, 'write'),
        },
        {
          id: 'delivery',
          weight: 2,
          description: 'Çatdırılmalar chat servisi vasitəsilə mesajları inbox cache-indən və ya anbardan oxuyur.',
          hints: [
            'Alıcının cihazı qoşulanda ona çatmayan mesajlar haradan götürülür?',
            'Chat servisindən mesajların anbarına (və ya inbox cache-inə) oxuma xətti çəkin. Xəttin trafikini "Oxuma" və ya "Oxuma və yazma" seçin.',
            'Hər cihaz son aldığı mesajın id-sini saxlayır (cursor). Qoşulanda və ya yeni mesaj gələndə gateway chat servisindən bu id-dən sonrakıları istəyir; servis onları inbox-dan, orada olmayanları isə anbardan oxuyur. Beləcə bir neçə cihaz bir-birindən asılı olmadan sinxron qalır.',
          ],
          check: apiPath([...MESSAGE_STORE, 'cache'], 'read'),
        },
        {
          id: 'offline-push',
          weight: 2,
          description: 'Oflayn alıcılara mobil push provayderi (APNs, FCM) vasitəsilə bildiriş gedir.',
          hints: [
            'Tətbiq bağlı olanda, WebSocket bağlantısı yoxdursa, istifadəçi yeni mesajdan necə xəbər tutur?',
            'Push service komponenti əlavə edin, onun kanalını "Mobil push" seçin və ona mesaj göndərmə yolundan xətt çəkin.',
            'Telefon arxa planda tətbiqlərin bağlantılarını bağlayır, ona görə bildirişi yalnız əməliyyat sisteminin öz kanalı çatdıra bilər: iOS-da Apple Push Notification service (APNs), Android-də Firebase Cloud Messaging (FCM). Servis alıcının cihaz token-i ilə provayderə sorğu göndərir, provayder isə bildirişi cihaza çatdırır.',
          ],
          check: { type: 'path', from: 'client', to: MOBILE_PUSH, traffic: 'write' },
        },
        {
          id: 'async-push',
          weight: 2,
          description: 'Push bildirişləri növbə (və ya asinxron xətt) vasitəsilə göndərilir: mesajın göndərilməsi provayderi gözləmir.',
          hints: [
            'Push provayderi başqa şirkətin datacenter-indədir. Göndərən istifadəçi onun cavabını gözləməlidirmi?',
            'Chat servisi ilə push provayderi arasına message queue və onu oxuyan push worker qoyun (və ya push xəttini asinxron edin).',
            'Provayder datacenter-dən kənarda, çox vaxt başqa qitədədir: bir sorğu təxminən 150 ms çəkir (primer-in "CA → Netherlands → CA" rəqəmi). Sinxron çağırış hər mesajı bu qədər ləngidər, provayder sıradan çıxanda isə mesajlaşma dayanardı. Növbə mesajı dərhal təsdiqləməyə imkan verir; push worker bildirişləri öz sürətində göndərir və uğursuzları təkrarlayır.',
          ],
          check: ASYNC_PUSH,
        },
        allConnectedRule('Chat Service → Notification Queue'),
      ],
      referenceSolution: {
        nodes: [
          node('client-1', 'client', 'Client', 0, 240),
          node('websocket-gateway-1', 'websocket-gateway', 'WebSocket Gateway', 240, 240),
          node('app-service-1', 'app-service', 'Chat Service', 480, 240),
          node('nosql-store-1', 'nosql-store', 'Message Store', 720, 120, { kind: 'wide-column' }),
          node('message-queue-1', 'message-queue', 'Notification Queue', 720, 360),
          node('app-service-2', 'app-service', 'Push Worker', 960, 360),
          node('push-service-1', 'push-service', 'APNs / FCM', 1200, 360),
          node('cache-1', 'cache', 'Presence', 480, 520),
        ],
        edges: [
          edge('client-1', 'websocket-gateway-1', 'both'),
          edge('websocket-gateway-1', 'app-service-1', 'both'),
          edge('websocket-gateway-1', 'cache-1', 'write', 'async'),
          edge('app-service-1', 'nosql-store-1', 'both'),
          edge('app-service-1', 'message-queue-1', 'write'),
          edge('message-queue-1', 'app-service-2', 'write'),
          edge('app-service-2', 'cache-1', 'write'),
          edge('app-service-2', 'push-service-1', 'write'),
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
          prompt: 'Server yeni mesajı alıcıya necə çatdırmalıdır?',
          options: [
            {
              text: 'WebSocket: client daimi, iki istiqamətli bağlantı saxlayır və server mesajı dərhal ondan göndərir',
              correct: true,
              explanation: 'Bağlantı bir dəfə qurulur: hər mesaj üçün yeni HTTP sorğusu, başlıqlar və boş cavablar yoxdur, gecikmə isə minimaldır. Qiyməti stateful serverlərdir: hər gateway öz bağlantılarını saxlayır.',
            },
            {
              text: 'Short polling: client hər bir neçə saniyədən bir yeni mesaj olub-olmadığını soruşur',
              explanation: 'Sadədir, amma sorğuların böyük hissəsi boş qayıdır və mesaj polling intervalı qədər gecikir; 50 milyon istifadəçidə bu, serverləri boş yerə yükləyir.',
            },
            {
              text: 'Long polling: server cavabı yeni mesaj gələnə və ya vaxt bitənə qədər saxlayır',
              explanation: 'Polling-dən yaxşıdır, amma hər mesajdan sonra bağlantı yenidən qurulur, göndərmə üçün isə ayrıca sorğu lazımdır; client-in hansı serverə bağlı olduğunu bilmək də çətinləşir.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Bir söhbətin mesajları hansı id ilə ardıcıllaşdırılmalıdır?',
          options: [
            {
              text: 'Hər söhbət daxilində artan id (local sequence), söhbətin shard-ında verilən',
              correct: true,
              explanation: 'Ardıcıllıq yalnız söhbət daxilində lazımdır: söhbətin bütün mesajları eyni shard-dadır və orada artan id ucuzdur. Cihazlar da "bu id-dən sonrakıları ver" deyərək sinxron qalır.',
            },
            {
              text: 'Göndərən cihazın saatı (timestamp)',
              explanation: 'Cihazların saatları fərqlidir və dəyişdirilə bilər: iki nəfərin mesajları yanlış ardıcıllıqla görünər, eyni millisaniyədə gələnlər isə toqquşar.',
            },
            {
              text: 'Bütün sistem üçün bir mərkəzi sayğac (auto-increment)',
              explanation: 'Saniyədə on minlərlə mesajda tək sayğac darboğaz və tək nöqtə olar; qlobal ardıcıllıq isə chat üçün lazım deyil.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Alıcı başqa gateway-ə bağlıdırsa, mesaj ona necə çatır?',
          options: [
            {
              text: 'Kimin hansı gateway-ə bağlı olduğu ortaq yaddaşda (Redis) saxlanılır; chat servisi mesajı həmin gateway-ə yönləndirir (məsələn, pub/sub ilə)',
              correct: true,
              explanation: 'Gateway-lər stateful-dur, ona görə bağlantı xəritəsi (user → gateway) mərkəzdə saxlanılır və bağlantı qurulanda yenilənir. Hansı gateway-lərin canlı olduğunu service discovery (ZooKeeper) bilir.',
            },
            {
              text: 'Mesaj bütün gateway-lərə göndərilir, alıcısı olan onu ötürür',
              explanation: 'Hər mesaj yüzlərlə serverə çatar: trafik gateway-lərin sayı ilə vurulur və sistem miqyaslanmır.',
            },
            {
              text: 'Hər iki istifadəçini həmişə eyni gateway-ə bağlamaq',
              explanation: 'Hər kəs çox adamla yazışır: belə bölgü mümkün deyil, bir gateway-in çökməsi isə bütün dostlar dairəsini kəsər.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'İstifadəçinin onlayn olduğunu (presence) necə bilmək olar?',
          options: [
            {
              text: 'Client hər bir neçə saniyədə heartbeat göndərir; məsələn, 30 saniyə heartbeat gəlməsə, istifadəçi oflayn sayılır',
              correct: true,
              explanation: 'Mobil şəbəkədə bağlantı tez-tez qısa müddətə qırılır: heartbeat qısa qırılmalarda statusun hey dəyişməsinin ("flapping") qarşısını alır. Status dəyişiklikləri dostlara asinxron, pub/sub ilə çatdırılır.',
            },
            {
              text: 'WebSocket bağlantısı qırılan kimi istifadəçini oflayn etmək',
              explanation: 'Tunelə girən telefon bir neçə saniyəlik qırılmada oflayn, sonra yenə onlayn görünər; hər dəyişiklik bütün dostlara yayılar.',
            },
            {
              text: 'Dostlar hər saniyə istifadəçinin statusunu soruşur',
              explanation: 'Bu, presence-i polling-ə çevirir: yük dostların sayı ilə vurulur.',
            },
          ],
        },
        {
          type: 'multi-select',
          prompt: 'Qrup mesajı üzvlərə necə çatdırılmalıdır (fan-out)?',
          options: [
            {
              text: 'Kiçik qrupda (məsələn, 100 nəfərədək) mesajı hər üzvün inbox-una köçürmək (fan-out on write)',
              correct: true,
              explanation: 'Hər üzv yalnız öz inbox-unu oxuyur və çatdırılma sadə qalır; nüsxələrin sayı qrupun ölçüsü ilə məhdud olduğu üçün qiyməti də məhduddur. WeChat kiçik qruplar üçün belə edir.',
            },
            {
              text: 'Çox böyük kanallarda mesajı bir dəfə saxlamaq və üzvlərin onu oradan oxuması (fan-out on read)',
              correct: true,
              explanation: 'Milyon üzvlü kanalda hər mesajı milyon dəfə köçürmək olmaz: üzvlər kanalın mesajlarını öz cursor-ları ilə bir yerdən oxuyur.',
            },
            {
              text: 'Qrupun ölçüsündən asılı olmayaraq həmişə hər üzvə ayrıca nüsxə yazmaq',
              explanation: 'Böyük kanallarda bu, hər mesajı milyonlarla yazıya çevirir: fan-out-un qiyməti qrupun ölçüsü ilə birlikdə artır.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Chat servisi mesajı nə vaxt göndərənə "göndərildi" kimi təsdiqləməlidir?',
          options: [
            {
              text: 'Mesaj anbara davamlı yazılandan sonra; çatdırılma və push isə bundan sonra gedir',
              correct: true,
              explanation: 'Təsdiq "mesaj itməyəcək" deməkdir: alıcı oflayn olsa, gateway çöksə belə mesaj anbardadır və cihaz qoşulanda çatdırılacaq.',
            },
            {
              text: 'Alıcı mesajı oxuyandan sonra',
              explanation: 'Alıcı günlərlə oflayn ola bilər: göndərən bu müddətdə nə olduğunu bilməz. "Oxundu" ayrıca statusdur.',
            },
            {
              text: 'Gateway mesajı qəbul edən kimi, anbara yazmadan əvvəl',
              explanation: 'Gateway həmin anda çöksə, təsdiqlənmiş mesaj itir.',
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
        'Yüksək səviyyəli dizaynınızdan davam edin və onu pik yükə görə miqyaslayın: saniyədə 24 000 mesaj göndərilir və 48 000 mesaj çatdırılır. Göndərmənin və çatdırılmanın orta gecikməsi 100 ms-i keçməməli, heç bir node həddən artıq yüklənməməli və heç bir sorğu xəta ilə bitməməlidir. Xaos tapşırığı: cache klasteri (Redis: inbox da, presence da) sıradan çıxıb; mesajlar yenə xətasız göndərilməli və çatdırılmalı, mesajların anbarı isə bu yükü daşımalıdır. Bunu trafik simulyasiyası ilə yoxlayın, darboğazları tapın və "Yoxla" düyməsini basın.',
      // The authored peak: twice the average.
      loadProfile: { readQps: 48_000, writeQps: 24_000, requestBytes: 100 },
      chaosTasks: [
        {
          id: 'cache-down',
          prompt: 'Cache klasteri (Redis) sıradan çıxıb: bütün çatdırılmalar mesajların anbarından oxunur, amma xətasız davam etməlidir; presence yeniləmələri gözləyir.',
          scenario: { type: 'node-down', nodes: ['cache'] },
        },
      ],
      rules: [
        {
          id: 'peak-load',
          weight: 3,
          description: 'Pik yükdə (saniyədə 24 000 göndərmə, 48 000 çatdırılma) orta gecikmə 100 ms-dən çox deyil, həddən artıq yüklənən node və xəta yoxdur.',
          hints: [
            'Saniyədə 72 000 mesaj həm göndərilir, həm də çatdırılır. Tək gateway və tək chat servisi bunu daşıyırmı?',
            'Trafik simulyasiyasını işə salın və "Darboğazlar" siyahısına baxın. Ən çox yüklənən node-ların "instances" sahəsini artırın; mesajların anbarını shard-layın, çatdırılmaları isə inbox cache-indən oxuyun.',
            'Bu modeldə WebSocket gateway-in bir nüsxəsi saniyədə 20 000 mesaj ötürür (açıq bağlantıda hər mesaj üçün handshake yoxdur), application service-in bir nüsxəsi isə 500 sorğu emal edir: 72 000 mesaj üçün ən azı 4 gateway və 144-dən çox chat servisi nüsxəsi lazımdır. NoSQL store-un bir nüsxəsi saniyədə 5 000 sorğu daşıyır və hər yazma hər replikaya düşür, ona görə yazmaları shard-lar bölür. Push worker-ləri də hər mesajın bildiriş işini daşımalıdır.',
          ],
          check: { type: 'simulation', maxLatencyMs: { read: 100, write: 100 }, maxOverloadedNodes: 0, maxErrorRate: 0 },
        },
        {
          id: 'cache-down',
          weight: 2,
          description: 'Cache klasteri (Redis) sıradan çıxanda pik yükdə mesajlar xətasız göndərilir və çatdırılır, heç bir node həddən artıq yüklənmir.',
          hints: [
            'Redis çöksə, bütün çatdırılmalar hara gedəcək? Mesajların anbarı buna hazırdırmı?',
            'Trafik simulyasiyasında "Xaos ssenarisi" siyahısından bu tapşırığı seçin və qırmızı node-lara baxın. Mesajların anbarına replikalar əlavə edin və ya shard-larının sayını artırın.',
            'Cache çatdırılmaların çoxunu anbardan götürür, amma onun işləyəcəyinə arxalanmaq olmaz: cache çökəndə və ya yenidən başlayanda bütün oxumalar anbara düşür. Anbar pik çatdırılmaları cache-siz də daşımalıdır: məsələn, 10 shard və 2 replika ilə hər nüsxəyə 16 000 oxuma və 24 000 yazmanın payı düşür, tutum isə 50 000-dir.',
          ],
          check: { type: 'simulation', chaos: 'cache-down', maxOverloadedNodes: 0, maxErrorRate: 0 },
        },
        {
          id: 'gateways-balanced',
          weight: 2,
          description: 'WebSocket gateway bir neçə nüsxədə işləyir və bağlantılar onlara load balancer vasitəsilə paylanır.',
          hints: [
            'Milyonlarla açıq bağlantı bir serverə sığarmı? Bu server çöksə, nə olur?',
            'WebSocket gateway-in "instances" sahəsini 2 və ya daha çox edin və Client ilə gateway arasına load balancer qoyun.',
            'Load balancer (məsələn, WebSocket-i dəstəkləyən L4/L7 balancer) yeni bağlantını ən az yüklənmiş gateway-ə verir; bağlantı sonra həmin gateway-də qalır. Gateway çöksə, onun client-ləri yenidən qoşulur və balancer onları qalan gateway-lərə paylayır: mesajlar anbarda olduğu üçün heç nə itmir.',
          ],
          check: {
            type: 'all-of',
            predicates: [
              { type: 'node', node: { component: 'websocket-gateway', config: { instances: 1 } }, max: 0 },
              { type: 'path', from: 'client', to: 'websocket-gateway', through: 'load-balancer' },
            ],
          },
        },
        scaleOutRule,
        {
          id: 'messages-sharded',
          weight: 2,
          description: 'Mesajların anbarı shard-lara bölünüb: shard açarı verilib və o, bir neçə nüsxədə işləyir.',
          hints: [
            'Saniyədə 24 000 yazma və 180 TB tək serverə sığarmı? Replikalar yazmaları bölürmü?',
            'Mesajların anbarının "shardKey" sahəsinə söhbətin id-sini (məsələn, channel_id) yazın və "instances"-i 2 və ya daha çox edin.',
            'Replikalar yalnız oxumaları bölür: hər yazma hər replikaya düşür. Yazmaları shard-lar bölür. Söhbətin id-si yaxşı shard açarıdır: bir söhbətin mesajları eyni shard-da, ardıcıl qalır və söhbəti oxumaq bir shard-a müraciət tələb edir.',
          ],
          check: shardedDatabase,
        },
        {
          id: 'inbox-cache',
          weight: 2,
          description: 'Çatdırılmalar son mesajları chat servisi vasitəsilə yaddaş cache-indən (inbox) oxuyur.',
          hints: [
            'Çatdırılan mesajların çoxu bir neçə saniyə əvvəl yazılıb. Onları hər dəfə diskdəki anbardan oxumaq lazımdırmı?',
            'Chat servisindən cache-ə oxuma xətti çəkin (inbox), anbara gedən xətti də saxlayın.',
            'Chat-də oxumaların çoxu ən təzə mesajlara düşür: inbox (məsələn, Redis-də hər istifadəçi üçün çatdırılmamış mesajlar) onları yaddaşdan verir, anbara yalnız köhnə tarixçə sorğuları düşür. Chat servisi mesajı yazanda onu inbox-a da əlavə edir.',
          ],
          check: { type: 'path', from: 'client', to: 'cache', through: 'websocket-gateway', traffic: 'read' },
        },
        allConnectedRule('Chat Service → Inbox Cache'),
      ],
      referenceSolution: {
        nodes: [
          node('client-1', 'client', 'Client', 0, 320),
          node('load-balancer-1', 'load-balancer', 'Load Balancer', 240, 320, { instances: 5 }),
          node('websocket-gateway-1', 'websocket-gateway', 'WebSocket Gateway', 480, 320, { instances: 5 }),
          node('app-service-1', 'app-service', 'Chat Service', 720, 320, { instances: 180 }),
          node('cache-2', 'cache', 'Inbox Cache', 960, 160, { instances: 2 }),
          node('nosql-store-1', 'nosql-store', 'Message Store', 1200, 160, { kind: 'wide-column', replicas: 2, shardKey: 'channel_id', instances: 10 }),
          node('message-queue-1', 'message-queue', 'Notification Queue', 960, 440, { instances: 3 }),
          node('app-service-2', 'app-service', 'Push Worker', 1200, 440, { instances: 60 }),
          node('push-service-1', 'push-service', 'APNs / FCM', 1440, 440),
          node('cache-1', 'cache', 'Presence', 720, 600, { instances: 2 }),
        ],
        edges: [
          edge('client-1', 'load-balancer-1', 'both'),
          edge('load-balancer-1', 'websocket-gateway-1', 'both'),
          edge('websocket-gateway-1', 'app-service-1', 'both'),
          edge('websocket-gateway-1', 'cache-1', 'write', 'async'),
          edge('app-service-1', 'cache-2', 'both'),
          edge('app-service-1', 'nosql-store-1', 'both'),
          edge('app-service-1', 'message-queue-1', 'write'),
          edge('message-queue-1', 'app-service-2', 'write'),
          edge('app-service-2', 'cache-1', 'write'),
          edge('app-service-2', 'push-service-1', 'write'),
        ],
      },
    },
  ],
}
