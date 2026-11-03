// The notification system: not a primer question. Other services hand it notifications to send; it records
// each one, looks up the user's settings and device tokens, and puts the deliveries on a queue per channel,
// from which workers call the third-party providers: APNs and FCM for mobile push, an e-mail provider for
// mail. The providers are far away and can fail, so nothing waits for them, and a provider outage leaves its
// deliveries waiting in their queue. The assumptions are authored: 2.5 billion notifications a month, five
// times as many at the peak of a campaign, each sent as a push to the user's two devices on average and as an
// e-mail, 500 bytes a record, kept a year.
//
// The push workers are a fan-out service sending each notification on as one push per device. Reads (an
// in-app notification list) are out of scope: the load is writes only. Looking up the settings is drawn on
// the write path, so it counts as a write to the cache.
import type { ChallengeInput } from '../../src/core/challenges/challenge'
import type { NodeSelector, Predicate } from '../../src/core/challenges/rules'
import { allConnectedRule, apiPath, edge, ENTRY, node, QUEUES, shardedDatabase } from '../primer-challenges/shared'
import { loadBalancerRule, MOBILE_PUSH, scaleOutRule } from './shared'

/** The provider of e-mail. */
const EMAIL: NodeSelector = { component: 'push-service', config: { channel: 'email' } }
/** Where every notification is recorded: a NoSQL store, or a SQL table. */
const NOTIFICATION_LOG: NodeSelector[] = ['nosql-store', 'sql-database']
/** A fan-out service sending one push to each of the average user's two devices. */
const TO_DEVICES: NodeSelector = { component: 'fan-out', config: { fanOut: 2 } }

/** Every delivery waits in a queue before a worker calls the provider. */
const QUEUED_DELIVERY: Predicate = { type: 'path', from: 'client', to: 'push-service', through: QUEUES, traffic: 'write' }

export const notificationSystem: ChallengeInput = {
  id: 'notification-system',
  title: 'Bildiriş sistemi (push, e-poçt) dizayn edin',
  kind: 'architecture',
  source: 'authored',
  lessonIds: [
    'additional-system-design-interview-questions',
    'asynchronism',
    'message-queues',
    'task-queues',
    'back-pressure',
    'nosql',
    'cache',
    'back-of-the-envelope-calculations',
    'horizontal-scaling',
  ],
  // The authored average: 2.5 billion notifications a month, and nothing read back.
  loadProfile: { readQps: 0, writeQps: 1_000, requestBytes: 500 },
  stages: [
    {
      id: 'requirements',
      type: 'requirements',
      weight: 1,
      prompt:
        'Şirkətin bütün servislərinin istifadə etdiyi bildiriş sistemi dizayn edin: sifariş servisi "sifarişiniz yoldadır", marketinq isə kampaniya bildirişi göndərmək istəyir, sistem isə onları istifadəçinin cihazlarına və e-poçtuna çatdırır. Bu sual primer-dən deyil. Aşağıdakılardan bu tapşırığa aid olan istifadə hallarını (use case) və məhdudiyyətləri seçin, kənarda qalanları seçməyin.',
      items: [
        {
          section: 'use-case',
          text: 'Daxili servis API vasitəsilə istifadəçiyə bildiriş göndərir',
          correct: true,
          explanation: 'Sistemin əsas ssenarisi: bildiriş qəbul olunur, qeydə alınır və kanallara paylanır.',
        },
        {
          section: 'use-case',
          text: 'Bildiriş istifadəçinin bütün cihazlarına mobil push kimi çatdırılır (iOS, Android)',
          correct: true,
          explanation: 'Push APNs (iOS) və FCM (Android) provayderləri vasitəsilə gedir; istifadəçinin orta hesabla 2 cihazı var, ona görə bir bildiriş 2 push-a çevrilir.',
        },
        {
          section: 'use-case',
          text: 'Bildiriş e-poçt kimi də göndərilir',
          correct: true,
          explanation: 'E-poçt ayrıca provayderdən (məsələn, SendGrid) keçir və öz növbəsi, öz worker-ləri olur.',
        },
        {
          section: 'use-case',
          text: 'İstifadəçi bildiriş növlərindən imtina edə bilər (opt-out)',
          correct: true,
          explanation: 'Hər göndərmədən əvvəl istifadəçinin ayarları yoxlanılır: imtina etdiyi kanala heç nə getmir.',
        },
        {
          section: 'use-case',
          text: 'Provayder müvəqqəti sıradan çıxsa, bildirişlər itmir və sonra çatdırılır',
          correct: true,
          explanation: 'Bildirişlər növbədə gözləyir və təkrar cəhd olunur (retry); bunun üçün hər bildiriş qeydə alınır.',
        },
        {
          section: 'use-case',
          text: 'Bildiriş istifadəçiyə bir neçə millisaniyə ərzində çatmalıdır',
          explanation: 'Bildiriş sistemi "yumşaq real vaxt"dır: bir neçə saniyəlik gecikmə qəbulediləndir, xüsusilə kampaniyalarda. Önəmli olan, onun itməməsidir.',
        },
        {
          section: 'use-case',
          text: 'Sistem bildirişin mətnini istifadəçi üçün maşın öyrənməsi ilə özü yazır',
          explanation: 'Mətni göndərən servis verir (və ya hazır şablon seçir); məzmunun yaradılması bu tapşırıqda kənarda qalır.',
        },
        {
          section: 'use-case',
          text: 'İstifadəçi tətbiqdə köhnə bildirişlərinin siyahısını oxuyur',
          explanation: 'Tətbiqdaxili bildiriş siyahısı bu tapşırıqda kənarda qalır: sistem yalnız göndərir.',
        },
        {
          section: 'constraint',
          text: 'Ayda 2,5 milyard bildiriş göndərilir',
          correct: true,
          explanation: 'Fərziyyə: estimation mərhələsi bundan başlayır.',
        },
        {
          section: 'constraint',
          text: 'Marketinq kampaniyaları zamanı yük ortalamanın 5 qatına çatır',
          correct: true,
          explanation: 'Kampaniya milyonlarla istifadəçiyə bir anda göndərilir: sistem bu dalğanı növbələrlə udmalı və worker-ləri ona görə ölçməlidir.',
        },
        {
          section: 'constraint',
          text: 'Hər bildirişin qeydi təxminən 500 baytdır və 1 il saxlanılır',
          correct: true,
          explanation: 'Qeyd (kimə, hansı kanal, status, təkrar cəhdlər) yaddaş hesablamasının əsasıdır: ayda 1,25 TB, ildə 15 TB.',
        },
        {
          section: 'constraint',
          text: 'Göndərən servis bildiriş çatdırılana qədər cavab gözləyir',
          explanation: 'Göndərən servis yalnız bildirişin qəbul olunduğunu gözləyir (məsələn, HTTP 202 Accepted); çatdırılma asinxron gedir.',
        },
        {
          section: 'constraint',
          text: 'Hər bildiriş dəqiq bir dəfə (exactly once) çatdırılmalıdır',
          explanation: 'Paylanmış sistemdə provayderə qədər "dəqiq bir dəfə" zəmanəti vermək olmur: təkrar cəhdlər "ən azı bir dəfə" (at least once) verir, təkrarları isə bildirişin id-si ilə mümkün qədər aradan qaldırırıq.',
        },
      ],
    },
    {
      id: 'estimation',
      type: 'estimation',
      weight: 1,
      prompt:
        'Fərziyyələr: ayda 2,5 milyard bildiriş göndərilir; kampaniyalar zamanı yük ortalamanın 5 qatına çatır. Hər bildirişin qeydi təxminən 500 baytdır və 1 il saxlanılır. Ayda 2,5 milyon saniyə və 1 KB = min bayt kimi yuvarlaq çevirmələri işlədin. Cavablar referansın 2 qatı daxilində olsa qəbul olunur.',
      explanation:
        'Bu, primer-in "back-of-the-envelope" üsuludur: ayda təxminən 2,5 milyon saniyə var, ona görə ayda 2,5 milyard bildiriş saniyədə 1 000 bildiriş, kampaniya pikində isə 5 000 deməkdir. Hər bildiriş 2 cihaza push və bir e-poçt kimi gedir, ona görə pikdə provayderlərə saniyədə 10 000 push və 5 000 e-poçt düşür. Yaddaş qeydlərin sayı ilə ölçüsünün hasilidir: ayda 1,25 TB, ildə 15 TB.',
      inputs: { writesPerMonth: 2_500_000_000, readsPerMonth: 0, bytesPerWrite: 500, peakFactor: 5 },
      questions: [
        { id: 'write-qps', quantity: 'writeQps', prompt: 'Orta hesabla saniyədə neçə bildiriş göndərilir?' },
        { id: 'peak-write-qps', quantity: 'peakWriteQps', prompt: 'Kampaniya pikində saniyədə neçə bildiriş göndərilir?' },
        { id: 'storage-per-month', quantity: 'storagePerMonth', prompt: 'Bir ayda bildirişlərin qeydləri nə qədər yer tutur?' },
        { id: 'storage-per-year', quantity: 'storagePerYear', prompt: 'Bir ildə bildirişlərin qeydləri nə qədər yer tutur?' },
      ],
    },
    {
      id: 'high-level-design',
      type: 'high-level-design',
      weight: 3,
      prompt:
        'Daxili servislər bildiriş göndərir; sistem hər bildirişi istifadəçinin hər cihazına mobil push (APNs, FCM) kimi və e-poçt kimi çatdırır. İstifadəçinin orta hesabla 2 cihazı var: push-ları fan-out service ilə göndərin və onun "fan-out" sahəsinə bir bildirişin neçə push-a çevrildiyini yazın. Provayderlər üçün push service komponentini götürün və kanalını seçin. Saniyədə orta hesabla 1 000 bildiriş gəlir. Bütün vacib komponentləri kətana qoyun, sorğuların axınını xətlərlə göstərin və "Yoxla" düyməsini basın.',
      rules: [
        {
          id: 'entry-point',
          weight: 2,
          description: 'Servislərin sorğuları bildiriş servisinə web server (reverse proxy) və ya load balancer vasitəsilə çatır.',
          hints: [
            'Göndərən servisin sorğusu bildiriş servisinin koduna çatmazdan əvvəl ilk olaraq nəyə dəyir?',
            'Client (göndərən servislər) ilə application service arasına web server, reverse proxy və ya load balancer qoyun: hər sorğu ondan keçsin.',
            'Bildiriş servisinin qarşısındakı qat sorğunu bir neçə server arasında bölür və göndərənin kimliyini yoxlamağa (məsələn, API açarı ilə) imkan verir: yalnız icazəli servislər istifadəçilərə bildiriş göndərə bilməlidir.',
          ],
          check: { type: 'path', from: 'client', to: 'app-service', through: ENTRY },
        },
        {
          id: 'notification-log',
          weight: 2,
          description: 'Hər bildiriş bildiriş servisi vasitəsilə anbarda qeydə alınır.',
          hints: [
            'Provayder sıradan çıxsa və ya worker çöksə, hansı bildirişlərin göndərilmədiyini haradan bilərsiniz?',
            'Bildiriş servisindən NoSQL store-a (və ya SQL database-ə) yazma xətti çəkin: bildiriş log-u.',
            'Log hər bildirişin id-sini, alıcısını, kanalını və statusunu (gözləyir, göndərildi, uğursuz) saxlayır. O, təkrar cəhdləri, təkrarlanan bildirişlərin aradan qaldırılmasını (dedup) və statistikanı mümkün edir. Yazmalar çox, oxumalar azdır və id-yə görədir: key-value və ya wide-column store yaxşı uyğun gəlir.',
          ],
          check: apiPath(NOTIFICATION_LOG, 'write'),
        },
        {
          id: 'settings-cache',
          weight: 2,
          description: 'Bildiriş servisi istifadəçinin ayarlarını və cihaz token-lərini cache-dən oxuyur.',
          hints: [
            'Bildirişi hansı cihazlara göndərmək lazımdır? İstifadəçi bu növ bildirişdən imtina edibmi?',
            'Bildiriş servisindən cache-ə xətt çəkin: orada istifadəçilərin ayarları və cihaz token-ləri saxlanılır.',
            'Hər bildiriş üçün iki şey lazımdır: cihaz token-ləri (APNs və FCM cihazı onlarla tanıyır) və istifadəçinin ayarları (opt-out, gecə saatlarında susmaq). Onlar nadir dəyişir, amma hər bildirişdə oxunur: yaddaş cache-i (Redis) bazanı bu oxumalardan qoruyur.',
          ],
          check: { type: 'edge', from: 'app-service', to: 'cache' },
        },
        {
          id: 'both-channels',
          weight: 2,
          description: 'Bildirişlər həm mobil push provayderinə, həm də e-poçt provayderinə çatır.',
          hints: [
            'Bildiriş istifadəçiyə hansı kanallardan çatır və hər kanalı kim çatdırır?',
            'İki push service komponenti əlavə edin: birinin kanalını "Mobil push", digərininkini "E-poçt" seçin və hər birinə göndərmə yolundan xətt çəkin.',
            'Sistem bildirişi özü çatdırmır: mobil push-u APNs və FCM, e-poçtu isə e-poçt provayderi (məsələn, SendGrid, Amazon SES) çatdırır. Hər kanalın öz provayderi, öz limitləri və öz uğursuzluqları var.',
          ],
          check: {
            type: 'all-of',
            predicates: [
              { type: 'path', from: 'client', to: MOBILE_PUSH, traffic: 'write' },
              { type: 'path', from: 'client', to: EMAIL, traffic: 'write' },
            ],
          },
        },
        {
          id: 'queued-delivery',
          weight: 3,
          description: 'Hər çatdırılma provayderə növbə vasitəsilə gedir və kanallar üçün ən azı iki növbə var.',
          hints: [
            'Provayder 150 ms cavab verirsə və ya bir saat sıradan çıxırsa, bildiriş göndərən servis bunu gözləməlidirmi?',
            'Bildiriş servisi ilə hər provayder arasına message queue və onu oxuyan worker-lər qoyun: push üçün bir növbə, e-poçt üçün ayrıca növbə.',
            'Növbə bildirişi qəbul etməyi onun çatdırılmasından ayırır: servis bildirişi qeydə alıb növbəyə qoyur və dərhal cavab verir, worker-lər isə provayderlərə öz sürətində müraciət edir və uğursuzları təkrarlayır. Kanal başına ayrıca növbə bir provayderin problemini digərlərindən təcrid edir: APNs sıradan çıxsa, e-poçtlar yenə gedir.',
          ],
          check: { type: 'all-of', predicates: [QUEUED_DELIVERY, { type: 'node', node: QUEUES, min: 2 }] },
        },
        {
          id: 'push-per-device',
          weight: 2,
          description: 'Mobil push-lar fan-out service ilə hər bildiriş üçün istifadəçinin 2 cihazına göndərilir.',
          hints: [
            'İstifadəçinin telefonu da, planşeti də var. Bir bildiriş neçə push-a çevrilir?',
            'Push növbəsini oxuyan worker kimi fan-out service qoyun, onun "fan-out" sahəsini 2 edin və ondan mobil push provayderinə xətt çəkin.',
            'APNs və FCM hər push-u bir cihaz token-inə göndərir, ona görə bildiriş istifadəçinin hər cihazı üçün ayrıca push-a çevrilir: bu, bildiriş sisteminin fan-out-udur. Kampaniyada isə fan-out daha böyükdür: bir kampaniya milyonlarla istifadəçiyə gedir və worker-lər onu partiyalarla açır.',
          ],
          check: { type: 'path', from: 'client', to: MOBILE_PUSH, through: TO_DEVICES, traffic: 'write' },
        },
        allConnectedRule('Push Queue → Push Workers'),
      ],
      referenceSolution: {
        nodes: [
          node('client-1', 'client', 'Services', 0, 240),
          node('web-server-1', 'web-server', 'Web Server', 240, 240),
          node('app-service-1', 'app-service', 'Notification Service', 480, 240),
          node('nosql-store-1', 'nosql-store', 'Notification Log', 720, 0, { kind: 'wide-column' }),
          node('cache-1', 'cache', 'Settings & Tokens', 720, 120),
          node('message-queue-1', 'message-queue', 'Push Queue', 720, 280),
          node('fan-out-1', 'fan-out', 'Push Workers', 960, 280, { fanOut: 2 }),
          node('push-service-1', 'push-service', 'APNs / FCM', 1200, 280),
          node('message-queue-2', 'message-queue', 'Email Queue', 720, 440),
          node('app-service-2', 'app-service', 'Email Workers', 960, 440),
          node('push-service-2', 'push-service', 'Email Provider', 1200, 440, { channel: 'email' }),
        ],
        edges: [
          edge('client-1', 'web-server-1', 'write'),
          edge('web-server-1', 'app-service-1', 'write'),
          edge('app-service-1', 'nosql-store-1', 'write'),
          edge('app-service-1', 'cache-1', 'write'),
          edge('app-service-1', 'message-queue-1', 'write'),
          edge('app-service-1', 'message-queue-2', 'write'),
          edge('message-queue-1', 'fan-out-1', 'write'),
          edge('fan-out-1', 'push-service-1', 'write'),
          edge('message-queue-2', 'app-service-2', 'write'),
          edge('app-service-2', 'push-service-2', 'write'),
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
          prompt: 'Bildiriş hansı çatdırılma zəmanəti ilə göndərilməlidir?',
          options: [
            {
              text: 'Ən azı bir dəfə (at least once): uğursuz göndərmə təkrarlanır, təkrarlar isə bildirişin id-si ilə aradan qaldırılır',
              correct: true,
              explanation: 'Worker provayderdən cavab almadan çöksə, bildiriş yenidən göndərilir: itmək təkrarlanmaqdan pisdir. Worker göndərmədən əvvəl log-da həmin id-nin artıq göndərilib-göndərilmədiyini yoxlayır (dedup).',
            },
            {
              text: 'Ən çox bir dəfə (at most once): heç vaxt təkrar cəhd etməmək',
              explanation: 'Təkrar push olmur, amma hər müvəqqəti xəta bildirişin itməsi deməkdir: "sifarişiniz yoldadır" heç vaxt çatmaya bilər.',
            },
            {
              text: 'Dəqiq bir dəfə (exactly once), provayderə qədər',
              explanation: 'Provayder cavab verməmiş əlaqə qırılsa, push-un çatıb-çatmadığını bilmək mümkün deyil: üçüncü tərəfə qədər "dəqiq bir dəfə" zəmanəti verilə bilməz.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'APNs bir saatlıq sıradan çıxsa, push-lar nə olmalıdır?',
          options: [
            {
              text: 'Push növbəsində qalırlar; worker-lər eksponensial gözləmə (exponential backoff) ilə təkrar cəhd edir, bir neçə uğursuz cəhddən sonra bildiriş dead-letter queue-ya düşür',
              correct: true,
              explanation: 'Növbə provayderin problemini udur: bildiriş servisi və e-poçt kanalı işləməyə davam edir. Backoff sıradan çıxmış provayderi təkrar sorğularla boğmur; dead-letter queue isə heç vaxt çatmayan bildirişləri araşdırmaq üçün saxlayır.',
            },
            {
              text: 'Bildiriş servisi yeni bildirişləri qəbul etməyi dayandırır',
              explanation: 'Bir kanalın problemi bütün sistemi dayandırır: e-poçtlar da, digər provayderlər də gözləməli olur.',
            },
            {
              text: 'Push-lar atılır: onsuz da gecikmiş bildiriş mənasızdır',
              explanation: 'Bəzi bildirişlər (məsələn, kampaniya) köhnələ bilər, amma bunu bildirişin özünə verilən "expires at" müddəti həll edir, bütün push-ları atmaq yox.',
            },
          ],
        },
        {
          type: 'multi-select',
          prompt: 'Bildiriş göndərilməzdən əvvəl nələr yoxlanılmalıdır?',
          options: [
            {
              text: 'İstifadəçinin bu növ bildirişdən və ya bu kanaldan imtina edib-etmədiyi (opt-out)',
              correct: true,
              explanation: 'İmtina edilmiş kanala göndərmək istifadəçini itirməyin ən tez yoludur, e-poçtda isə qanuni tələbdir.',
            },
            {
              text: 'İstifadəçiyə qısa müddətdə həddən artıq bildiriş getməməsi (frequency capping)',
              correct: true,
              explanation: 'Bir neçə servis eyni anda bildiriş göndərsə, istifadəçi spam alır və bildirişləri söndürür: istifadəçi başına limit (məsələn, rate limiter sayğacı ilə) bunun qarşısını alır.',
            },
            {
              text: 'Göndərən servisin icazəsi (API açarı)',
              correct: true,
              explanation: 'Yalnız tanınan servislər istifadəçilərə bildiriş göndərə bilməlidir; əks halda sistem spam kanalına çevrilər.',
            },
            {
              text: 'İstifadəçinin hazırda tətbiqi açıb-açmadığı, açıqdırsa push-un tamamilə qadağan edilməsi',
              explanation: 'Açıq tətbiqdə push-u göstərmək və ya göstərməmək client-in qərarıdır; server bildirişi qadağan etməməlidir, çünki istifadəçinin başqa cihazı da ola bilər.',
            },
          ],
        },
        {
          type: 'multi-select',
          prompt: '10 milyon istifadəçiyə gedən kampaniya bildirişi necə göndərilməlidir (fan-out)?',
          options: [
            {
              text: 'Worker-lər istifadəçi seqmentini partiyalarla açır və push-ları provayderin limitlərinə uyğun sürətlə göndərir',
              correct: true,
              explanation: 'Kampaniya 10 milyon ayrıca push-a çevrilir (fan-out on write): mobil push hər cihaza ayrıca getməlidir. Partiyalar və sürət limiti dalğanı saatlara yayır, provayderin limitini keçmir.',
            },
            {
              text: 'Tətbiqdaxili bildiriş siyahısı üçün kampaniyanı bir dəfə saxlamaq, istifadəçilər isə onu oxuyanda görmək',
              correct: true,
              explanation: 'Siyahını istifadəçi özü açır, ona görə orada fan-out on read işləyir: 10 milyon sətir yazmaq əvəzinə bir sətir yazılır. Push-un isə belə alternativi yoxdur.',
            },
            {
              text: 'Kampaniya üçün bildiriş servisinə 10 milyon ayrıca HTTP sorğusu göndərmək',
              explanation: 'Göndərən servis 10 milyon sorğunu idarə etməli olur və API dalğa altında qalır; kampaniyanı bir sorğu ilə vermək və onu sistemin daxilində açmaq daha etibarlıdır.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Birdəfəlik şifrə (OTP) bildirişi kampaniyanın arxasında qalmamalıdır. Bunu necə təmin etmək olar?',
          options: [
            {
              text: 'Prioritetə görə ayrı növbələr: təcili bildirişlər (OTP, təhlükəsizlik) ayrıca növbədən, öz worker-ləri ilə gedir',
              correct: true,
              explanation: 'Kampaniya milyonlarla işlə növbəni doldursa da, təcili növbə boş qalır və OTP saniyələr içində çatır.',
            },
            {
              text: 'Hamısını bir növbəyə qoymaq, amma worker sayını artırmaq',
              explanation: 'Növbə FIFO-dur: OTP kampaniyanın milyonlarla işindən sonra gəlir. Worker-lər artsa da, dalğa onları yenə tutur.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Cihaz token-ləri necə aktual saxlanılmalıdır?',
          options: [
            {
              text: 'Tətbiq hər açılanda token-i serverə göndərir; provayder token-in etibarsız olduğunu bildirəndə o silinir',
              correct: true,
              explanation: 'Token-lər tətbiq yenidən quraşdırılanda və ya cihaz dəyişəndə dəyişir. APNs və FCM etibarsız token haqqında cavab qaytarır: onu silmək boş göndərmələrin qarşısını alır.',
            },
            {
              text: 'Token qeydiyyatda bir dəfə alınır və heç vaxt dəyişmir',
              explanation: 'Token dəyişəndə push-lar köhnə token-ə gedir və itir; istifadəçi bildiriş almadığını isə bilmir.',
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
        'Yüksək səviyyəli dizaynınızdan davam edin və onu kampaniya pikinə görə miqyaslayın: saniyədə 5 000 bildiriş, yəni 10 000 push və 5 000 e-poçt. Bildirişin qəbul olunmasının orta gecikməsi 50 ms-i keçməməli, heç bir node, o cümlədən worker-lər, həddən artıq yüklənməməli və heç bir sorğu xəta ilə bitməməlidir. Xaos tapşırığı: mobil push provayderi (APNs / FCM) sıradan çıxıb; bildirişlər yenə xətasız qəbul edilməli, push-lar isə növbədə gözləməlidir. Bunu trafik simulyasiyası ilə yoxlayın, darboğazları tapın və "Yoxla" düyməsini basın.',
      // The authored peak: five times the average, a campaign.
      loadProfile: { readQps: 0, writeQps: 5_000, requestBytes: 500 },
      chaosTasks: [
        {
          id: 'push-provider-down',
          prompt: 'Mobil push provayderi sıradan çıxıb: bildirişlər xətasız qəbul edilməlidir, push-lar növbədə gözləyir.',
          scenario: { type: 'node-down', nodes: [MOBILE_PUSH] },
        },
      ],
      rules: [
        {
          id: 'peak-load',
          weight: 3,
          description: 'Kampaniya pikində (saniyədə 5 000 bildiriş) qəbulun orta gecikməsi 50 ms-dən çox deyil, həddən artıq yüklənən node, o cümlədən worker, və xəta yoxdur.',
          hints: [
            'Saniyədə 5 000 bildiriş gələndə dizaynınızın hansı node-u ilk tıxanır? Provayderin cavabını kim gözləyir?',
            'Trafik simulyasiyasını işə salın və "Darboğazlar" siyahısına baxın. Ən çox yüklənən node-ların, o cümlədən növbədən sonrakı worker-lərin "instances" sahəsini artırın; provayderləri yalnız növbədən sonra çağırın.',
            'Provayderə sinxron müraciət hər bildirişə təxminən 150 ms əlavə edir, ona görə o, qəbulun yolunda olmamalıdır. Bu modeldə application service-in bir nüsxəsi saniyədə 500 sorğu emal edir: 5 000 bildiriş üçün bildiriş servisinə və e-poçt worker-lərinə 10-dan çox nüsxə lazımdır. Fan-out service-in bir nüsxəsi saniyədə 5 000 push göndərir: 10 000 push üçün 2-dən çox, məsələn 3 nüsxə. Bildiriş log-unun bir NoSQL nüsxəsi 5 000 yazma daşıyır, ona görə onu shard-layın.',
          ],
          check: { type: 'simulation', maxLatencyMs: { write: 50 }, maxOverloadedNodes: 0, maxErrorRate: 0 },
        },
        {
          id: 'push-provider-down',
          weight: 2,
          description: 'Mobil push provayderi sıradan çıxanda kampaniya pikində bildirişlər xətasız qəbul edilir.',
          hints: [
            'APNs sıradan çıxsa, bildiriş göndərən servis xəta alırmı? Push-lar hara gedir?',
            'Trafik simulyasiyasında "Xaos ssenarisi" siyahısından bu tapşırığı seçin. Provayderə gedən hər yolun növbədən keçdiyinə əmin olun.',
            'Növbədən sonrakı iş təxirə salınmış işdir: provayder sıradan çıxanda push-lar növbədə və worker-lərdə gözləyir (backlog), bildiriş servisi isə qəbul etməyə davam edir. Provayder qayıdanda worker-lər yığılanları təkrar cəhdlə göndərir; e-poçt kanalı isə bu müddətdə heç nə hiss etmir.',
          ],
          check: { type: 'simulation', chaos: 'push-provider-down', maxErrorRate: 0 },
        },
        loadBalancerRule,
        scaleOutRule,
        {
          id: 'log-sharded',
          weight: 2,
          description: 'Bildiriş log-u shard-lara bölünüb: shard açarı verilib və o, bir neçə nüsxədə işləyir.',
          hints: [
            'Kampaniya pikində log-a saniyədə 5 000 yazma düşür. Replikalar yazmaları bölürmü?',
            'Bildiriş log-unun "shardKey" sahəsinə bildirişin id-sini (məsələn, notification_id) yazın və "instances"-i 2 və ya daha çox edin.',
            'Hər yazma hər replikaya düşür, ona görə yazma yükünü yalnız shard-lar bölür. Bildirişin id-si qeydləri shard-lar arasında bərabər paylayır; worker dedup üçün qeydi məhz bu id ilə tapır.',
          ],
          check: shardedDatabase,
        },
        {
          id: 'workers-scaled',
          weight: 2,
          description: 'Push worker-ləri (fan-out service) bir neçə nüsxədə işləyir.',
          hints: [
            'Kampaniya pikində push növbəsindən saniyədə neçə push çıxmalıdır? Tək worker nüsxəsi buna çatırmı?',
            'Push worker-lərinin (fan-out service) "instances" sahəsini 2 və ya daha çox edin.',
            'Worker-lər stateless-dir: işi növbədən götürürlər, ona görə onları istənilən qədər artırmaq olar. Növbə qəfil dalğanı bir anlıq udur, amma worker-lər onu orta hesabla yetişdirə bilməsə, növbə sonsuz böyüyür və bildirişlər saatlarla gecikir.',
          ],
          check: { type: 'all-of', predicates: [{ type: 'node', node: 'fan-out' }, { type: 'node', node: { component: 'fan-out', config: { instances: 1 } }, max: 0 }] },
        },
        allConnectedRule('Push Queue → Push Workers'),
      ],
      referenceSolution: {
        nodes: [
          node('client-1', 'client', 'Services', 0, 280),
          node('load-balancer-1', 'load-balancer', 'Load Balancer', 240, 280, { instances: 2 }),
          node('web-server-1', 'web-server', 'Web Server', 480, 280, { instances: 8 }),
          node('app-service-1', 'app-service', 'Notification Service', 720, 280, { instances: 13 }),
          node('nosql-store-1', 'nosql-store', 'Notification Log', 960, 0, { kind: 'wide-column', shardKey: 'notification_id', instances: 2 }),
          node('cache-1', 'cache', 'Settings & Tokens', 960, 140),
          node('message-queue-1', 'message-queue', 'Push Queue', 960, 300),
          node('fan-out-1', 'fan-out', 'Push Workers', 1200, 300, { fanOut: 2, instances: 3 }),
          node('push-service-1', 'push-service', 'APNs / FCM', 1440, 300),
          node('message-queue-2', 'message-queue', 'Email Queue', 960, 460),
          node('app-service-2', 'app-service', 'Email Workers', 1200, 460, { instances: 13 }),
          node('push-service-2', 'push-service', 'Email Provider', 1440, 460, { channel: 'email' }),
        ],
        edges: [
          edge('client-1', 'load-balancer-1', 'write'),
          edge('load-balancer-1', 'web-server-1', 'write'),
          edge('web-server-1', 'app-service-1', 'write'),
          edge('app-service-1', 'nosql-store-1', 'write'),
          edge('app-service-1', 'cache-1', 'write'),
          edge('app-service-1', 'message-queue-1', 'write'),
          edge('app-service-1', 'message-queue-2', 'write'),
          edge('message-queue-1', 'fan-out-1', 'write'),
          edge('fan-out-1', 'push-service-1', 'write'),
          edge('message-queue-2', 'app-service-2', 'write'),
          edge('app-service-2', 'push-service-2', 'write'),
        ],
      },
    },
  ],
}
