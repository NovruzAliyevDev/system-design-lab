// The news feed (Facebook): not a primer question, though the primer's Twitter timeline is its cousin. The
// focus is the fan-out trade-off: a feed made of 200 friends' posts is built either when a post is written
// (fan-out on write: each post copied into 200 feeds held in memory) or when a feed is read (fan-out on
// read: each read gathering 200 friends' posts). The assumptions are authored: a billion posts and fifty
// billion feed reads a month, 200 friends each, about 1 KB a post, kept 5 years.
//
// A fan-out service sends each request on as `fanOut` copies, and its capacity counts the copies, so the
// Scaling Stage's simulation and budget show what each choice costs: at the peak, fanning out the 800 posts
// a second sends 160,000 copies, gathering for the 40,000 reads a second asks for 8 million. Celebrities,
// whose millions of followers no steady average stands for, are weighed in the deep dive. Looking up a post's
// friends in the graph is drawn on the write path, so it counts as a write to the graph database.
import type { ChallengeInput } from '../../src/core/challenges/challenge'
import type { NodeSelector, Predicate } from '../../src/core/challenges/rules'
import { allConnectedRule, apiPath, edge, ENTRY, node, readReplicas, shardedDatabase } from '../primer-challenges/shared'
import { loadBalancerRule, scaleOutRule } from './shared'

/** Where the posts live: a NoSQL store of any kind but a graph, or a SQL table. */
const POST_STORE: NodeSelector[] = [{ component: 'nosql-store', config: { kind: ['key-value', 'document', 'wide-column'] } }, 'sql-database']
/** Where the friendships live. */
const GRAPH_DB: NodeSelector = { component: 'nosql-store', config: { kind: 'graph' } }
/** A fan-out service copying each request for every one of the average user's 200 friends. */
const TO_FRIENDS: NodeSelector = { component: 'fan-out', config: { fanOut: 200 } }

/** Fan-out on write: every post is copied into the 200 friends' feeds, held in memory (or a NoSQL store). */
const FAN_OUT_ON_WRITE: Predicate = {
  type: 'all-of',
  predicates: [
    { type: 'path', from: 'client', to: TO_FRIENDS, traffic: 'write' },
    { type: 'any-of', predicates: (['cache', 'nosql-store'] as const).map((feeds) => ({ type: 'edge', from: TO_FRIENDS, to: feeds, traffic: 'write' })) },
  ],
}

/** Fan-out on read: every feed read gathers the 200 friends' latest posts. */
const FAN_OUT_ON_READ: Predicate = {
  type: 'all-of',
  predicates: [
    { type: 'path', from: 'client', to: TO_FRIENDS, traffic: 'read' },
    { type: 'any-of', predicates: [...POST_STORE, 'cache' as const].map((posts) => ({ type: 'edge', from: TO_FRIENDS, to: posts, traffic: 'read' })) },
  ],
}

/** The post store serves its reads from replicas, or spreads them over shards. */
const POSTS_SPREAD: Predicate = { type: 'any-of', predicates: [...readReplicas('nosql-store'), ...readReplicas('sql-database'), shardedDatabase] }

export const newsFeed: ChallengeInput = {
  id: 'news-feed',
  title: 'Xəbər lentini (Facebook News Feed) dizayn edin',
  kind: 'architecture',
  source: 'authored',
  lessonIds: [
    'design-the-twitter-timeline-and-search-or-facebook-feed-and-search',
    'asynchronism',
    'message-queues',
    'cache',
    'nosql',
    'back-of-the-envelope-calculations',
    'horizontal-scaling',
  ],
  // The authored average: a billion posts and fifty billion feed reads a month.
  loadProfile: { readQps: 20_000, writeQps: 400, requestBytes: 1_000 },
  stages: [
    {
      id: 'requirements',
      type: 'requirements',
      weight: 1,
      prompt:
        'Facebook-un xəbər lenti kimi servis dizayn edin: istifadəçi post paylaşır, dostları isə onu öz lentlərində görür. Bu sual primer-dən deyil, amma primer-in Twitter timeline sualına yaxındır: burada diqqət lentin necə qurulmasına, yəni fan-out trade-off-una yönəlib. Aşağıdakılardan bu tapşırığa aid olan istifadə hallarını (use case) və məhdudiyyətləri seçin, kənarda qalanları seçməyin.',
      items: [
        {
          section: 'use-case',
          text: 'İstifadəçi mətn (və şəkil) postu paylaşır',
          correct: true,
          explanation: 'Servisin əsas yazma ssenarisi: post saxlanılır və dostların lentlərinə çatdırılır.',
        },
        {
          section: 'use-case',
          text: 'İstifadəçi dostlarının son postlarından ibarət lentini görür',
          correct: true,
          explanation: 'Servisin əsas oxuma ssenarisi və onun ən çox yüklənən hissəsi: lent postlardan 50 dəfə çox açılır.',
        },
        {
          section: 'use-case',
          text: 'Lent tez açılır',
          correct: true,
          explanation: 'Lent tətbiqin ilk ekranıdır: o, hər açılışda sıfırdan qurulmamalı, hazır halda yaddaşdan verilməlidir.',
        },
        {
          section: 'use-case',
          text: 'Servis yüksək əlçatanlığa (high availability) malikdir',
          correct: true,
          explanation: 'Lent işləməsə, tətbiqin özü işləmir; Scaling mərhələsində bunun üçün bir neçə server nüsxəsi və replikalar əlavə olunur.',
        },
        {
          section: 'use-case',
          text: 'Yeni post dostların lentinə bir neçə saniyə gecikmə ilə düşə bilər',
          correct: true,
          explanation: 'Eventual consistency bu servis üçün qəbulediləndir: buna görə lentlərin yenilənməsi asinxron, növbə vasitəsilə aparıla bilər.',
        },
        {
          section: 'use-case',
          text: 'Lent maşın öyrənməsi ilə hər istifadəçi üçün sıralanır',
          explanation: 'Sıralama (ranking) bu tapşırıqda kənarda qalır: lent sadəcə yenidən köhnəyə (reverse chronological) göstərilir.',
        },
        {
          section: 'use-case',
          text: 'Bəyənmə və şərh sayları real vaxtda yenilənir',
          explanation: 'Bəyənmə və şərhlər ayrıca servisin işidir və bu tapşırıqda kənarda qalır.',
        },
        {
          section: 'use-case',
          text: 'İstifadəçilər bir-birinə şəxsi mesaj yazır',
          explanation: 'Mesajlaşma ayrıca sistemdir (chat); lentə aid deyil.',
        },
        {
          section: 'constraint',
          text: 'Ayda 1 milyard post paylaşılır',
          correct: true,
          explanation: 'Fərziyyə: estimation mərhələsi bundan başlayır.',
        },
        {
          section: 'constraint',
          text: 'Lent ayda 50 milyard dəfə açılır',
          correct: true,
          explanation: 'Oxuma:yazma nisbəti 50:1-dir: lentin oxunması ucuz olmalıdır, hətta yazma bunun üçün bahalaşsa belə.',
        },
        {
          section: 'constraint',
          text: 'Hər istifadəçinin orta hesabla 200 dostu var',
          correct: true,
          explanation: 'Bu ədəd fan-out-un ölçüsüdür: bir post 200 lentə düşür, bir lent isə 200 dostun postlarından qurulur.',
        },
        {
          section: 'constraint',
          text: 'Post təxminən 1 KB-dır və 5 il saxlanılır; şəkillər ayrıca object store-dadır',
          correct: true,
          explanation: 'Bu, yaddaş hesablamasının əsasıdır: ayda 1 TB, 5 ildə 60 TB mətn və metadata.',
        },
        {
          section: 'constraint',
          text: 'Post paylaşılan anda bütün dostlar onu eyni millisaniyədə görməlidir',
          explanation: 'Belə strong consistency lazım deyil və çox baha başa gələrdi: bir neçə saniyəlik gecikmə istifadəçiyə hiss olunmur.',
        },
        {
          section: 'constraint',
          text: 'Postlar lentin açılmasından daha çoxdur',
          explanation: 'Əksinədir: hər post bir dəfə yazılır, amma lentlər postlardan 50 dəfə çox açılır.',
        },
      ],
    },
    {
      id: 'estimation',
      type: 'estimation',
      weight: 1,
      prompt:
        'Fərziyyələr: ayda 1 milyard post paylaşılır və lent ayda 50 milyard dəfə açılır. Pik anlarda yük ortalamanın 2 qatıdır. Bir post təxminən 1 KB-dır və 5 il saxlanılır. Ayda 2,5 milyon saniyə və 1 KB = min bayt kimi yuvarlaq çevirmələri işlədin. Cavablar referansın 2 qatı daxilində olsa qəbul olunur.',
      explanation:
        'Bu, primer-in "back-of-the-envelope" üsuludur: ayda təxminən 2,5 milyon saniyə var, ona görə ayda 1 milyard post saniyədə 400 post, 50 milyard oxuma isə saniyədə 20 000 oxuma deməkdir. Yaddaş postların sayı ilə ölçüsünün hasilidir: ayda 1 TB, 5 ildə 60 TB. Fan-out-un qiyməti də buradan görünür: hər post 200 dostun lentinə yazılsa, saniyədə 400 × 200 = 80 000 lent yazısı olur; hər lent açılışında 200 dostun postları yığılsa, saniyədə 20 000 × 200 = 4 milyon oxuma olur. Oxumalar yazmalardan 50 dəfə çox olduğu üçün işi yazma anına keçirmək 50 dəfə ucuzdur.',
      inputs: { writesPerMonth: 1_000_000_000, readsPerMonth: 50_000_000_000, bytesPerWrite: 1_000, peakFactor: 2, years: 5 },
      questions: [
        { id: 'write-qps', quantity: 'writeQps', prompt: 'Orta hesabla saniyədə neçə post paylaşılır?' },
        { id: 'read-qps', quantity: 'readQps', prompt: 'Orta hesabla saniyədə lent neçə dəfə açılır?' },
        { id: 'peak-read-qps', quantity: 'peakReadQps', prompt: 'Pik anlarda saniyədə lent neçə dəfə açılır?' },
        { id: 'storage-per-month', quantity: 'storagePerMonth', prompt: 'Bir ayda nə qədər yeni post məlumatı yığılır?' },
        { id: 'storage-5-years', quantity: 'storageTotal', prompt: '5 ildə nə qədər post məlumatı yığılır?' },
      ],
    },
    {
      id: 'high-level-design',
      type: 'high-level-design',
      weight: 3,
      prompt:
        'İstifadəçi post paylaşır, lentində isə 200 dostunun son postlarını görür. Dostluq əlaqələri graph database-də saxlanılır. Lenti iki yolla qurmaq olar, birini seçin: post yazılanda onu fan-out service ilə 200 dostun lentinə köçürmək (fan-out on write), ya da lent açılanda fan-out service ilə 200 dostun postlarını yığmaq (fan-out on read). Fan-out service-in "fan-out" sahəsinə bir sorğunun neçə nüsxəyə çevrildiyini yazın. Saniyədə orta hesabla 400 post paylaşılır və lent 20 000 dəfə açılır. Bütün vacib komponentləri kətana qoyun, sorğuların axınını xətlərlə göstərin və "Yoxla" düyməsini basın.',
      rules: [
        {
          id: 'entry-point',
          weight: 2,
          description: 'Client sorğuları tətbiq servislərinə web server (reverse proxy) və ya load balancer vasitəsilə çatır.',
          hints: [
            'Client sorğusu tətbiq kodunun işlədiyi serverə çatmazdan əvvəl ilk olaraq nəyə dəyir?',
            'Client ilə application service arasına web server, reverse proxy və ya load balancer qoyun: hər sorğu ondan keçsin.',
            'Tətbiq serverləri birbaşa internetə açılmır: qarşılarında duran web server və ya reverse proxy SSL-i bitirir, sorğunu Post və ya Feed servisinə ötürür və serverləri xaricdən gizlədir. Client-dən application service-ə bu qatdan yan keçən yol olmamalıdır.',
          ],
          check: { type: 'path', from: 'client', to: 'app-service', through: ENTRY },
        },
        {
          id: 'separate-services',
          weight: 2,
          description: 'Post paylaşmaq və lenti oxumaq ayrı tətbiq servislərindədir.',
          hints: [
            'Lent postlardan 50 dəfə çox açılır. Hər ikisini eyni server qrupu emal etsə, onları ayrıca miqyaslamaq olarmı?',
            'Kətanda ən azı iki application service olsun: biri postu qəbul edən Post Service, digəri lenti verən Feed Service.',
            'Post Service postu saxlayır və lentlərin yenilənməsini başladır; Feed Service isə hazır lenti oxuyub postların məzmunu ilə doldurur. Ayrı servislər ayrıca miqyaslanır: oxuma yükü artanda yalnız Feed Service nüsxələri artırılır.',
          ],
          check: { type: 'node', node: 'app-service', min: 2 },
        },
        {
          id: 'post-store',
          weight: 2,
          description: 'Postlar tətbiq servisi vasitəsilə NoSQL store-a (və ya SQL bazasına) yazılır.',
          hints: [
            'Yeni post yazılanda o, harada qalıcı saxlanılır?',
            'Post Service-dən key-value, wide-column və ya document tipli NoSQL store-a (və ya SQL database-ə) yazma xətti çəkin.',
            'Postlar id-yə görə oxunur və yazılandan sonra demək olar dəyişmir: key-value və ya wide-column store (məsələn, Cassandra) 60 TB-ı rahat paylayır. Client anbara yalnız Post Service vasitəsilə çatmalıdır: postun yoxlanılması və lentlərin yenilənməsi məhz servisdə başlayır.',
          ],
          check: apiPath(POST_STORE, 'write'),
        },
        {
          id: 'social-graph',
          weight: 2,
          description: 'Dostluq əlaqələri graph database-də saxlanılır və tətbiq servisləri onu oxuyur.',
          hints: [
            'Post kimin lentinə düşməlidir? Bu siyahı haradan gəlir?',
            'Graph tipli NoSQL store (graph database) əlavə edin və ona postun dostlarını tapan servisdən xətt çəkin.',
            'Dostluq qrafı "kim kimin dostudur" sualına cavab verir: fan-out on write-da postun 200 alıcısını, fan-out on read-də isə lentin 200 mənbəyini o verir. Graph database (məsələn, Neo4j) və ya qrafı saxlayan xüsusi servis (Facebook-un TAO-su) belə əlaqələri sürətlə gəzir.',
          ],
          check: { type: 'path', from: 'client', to: GRAPH_DB, through: 'app-service' },
        },
        {
          id: 'feed-fan-out',
          weight: 3,
          description:
            'Lent 200 dostun postlarından fan-out ilə qurulur: ya hər post fan-out service ilə 200 lentə yazılır (fan-out on write), ya da hər lent oxunuşu fan-out service ilə 200 dostun postlarını yığır (fan-out on read).',
          hints: [
            'Lentdə 200 dostun postları var. Bu 200 mənbəni bir yerə nə vaxt yığırsınız: post yazılanda, yoxsa lent açılanda?',
            'Fan-out service əlavə edin və onun "fan-out" sahəsini 200 edin. Fan-out on write üçün ona post yazmalarını gətirin və ondan lent cache-inə yazma xətti çəkin; fan-out on read üçün ona lent oxumalarını gətirin və ondan postların anbarına oxuma xətti çəkin.',
            'Fan-out on write (push model): post yazılanda onun id-si 200 dostun cache-dəki lentinə əlavə olunur, lent isə hazır oxunur. Yazma bahalaşır (400 post/san → 80 000 lent yazısı), oxuma ucuzlaşır. Fan-out on read (pull model): heç nə əvvəlcədən yazılmır, lent açılanda 200 dostun son postları yığılır. Yazma ucuzdur, amma hər oxuma 200 oxumaya çevrilir (20 000 → 4 milyon). Hər iki yol düzgündür; hansının ucuz olduğunu Scaling mərhələsi göstərəcək.',
          ],
          check: { type: 'any-of', predicates: [FAN_OUT_ON_WRITE, FAN_OUT_ON_READ] },
        },
        {
          id: 'feed-read',
          weight: 2,
          description: 'Lent oxumaları tətbiq servisi vasitəsilə lent cache-inə və ya postların anbarına çatır.',
          hints: [
            'İstifadəçi lentini açanda Feed Service postları haradan oxuyur?',
            'Feed Service-dən lent cache-inə və ya postların anbarına oxuma xətti çəkin. Xəttin trafikini "Oxuma" və ya "Oxuma və yazma" seçin.',
            'Client → Web Server → Feed Service → Feed Cache / Post DB oxuma yolu olmalıdır. Feed Service lentdəki post id-lərini oxuyur və onları postların məzmunu, müəllifin adı və şəkli ilə doldurur (hydration).',
          ],
          check: apiPath([...POST_STORE, 'cache'], 'read'),
        },
        allConnectedRule('Fan-out Workers → Feed Cache'),
      ],
      referenceSolution: {
        nodes: [
          node('client-1', 'client', 'Client', 0, 280),
          node('web-server-1', 'web-server', 'Web Server', 240, 280),
          node('app-service-1', 'app-service', 'Post Service', 480, 120),
          node('app-service-2', 'app-service', 'Feed Service', 480, 440),
          node('nosql-store-1', 'nosql-store', 'Post DB', 960, 440),
          node('message-queue-1', 'message-queue', 'Fan-out Queue', 720, 0),
          node('app-service-3', 'app-service', 'Friend Lookup', 960, 0),
          node('nosql-store-2', 'nosql-store', 'Graph DB', 1200, 0, { kind: 'graph' }),
          node('fan-out-1', 'fan-out', 'Fan-out Workers', 1200, 160, { fanOut: 200 }),
          node('cache-1', 'cache', 'Feed Cache', 1200, 320),
        ],
        edges: [
          edge('client-1', 'web-server-1', 'both'),
          edge('web-server-1', 'app-service-1', 'write'),
          edge('web-server-1', 'app-service-2', 'read'),
          edge('app-service-1', 'nosql-store-1', 'write'),
          edge('app-service-1', 'message-queue-1', 'write'),
          edge('message-queue-1', 'app-service-3', 'write'),
          edge('app-service-3', 'nosql-store-2', 'write'),
          edge('app-service-3', 'fan-out-1', 'write'),
          edge('fan-out-1', 'cache-1', 'write'),
          edge('app-service-2', 'cache-1', 'read'),
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
          prompt: 'Lent postlardan 50 dəfə çox açılırsa və hər istifadəçinin 200 dostu varsa, adi istifadəçilər üçün lenti necə qurmaq daha sərfəlidir?',
          options: [
            {
              text: 'Fan-out on write: post yazılanda onu 200 dostun lentinə köçürmək',
              correct: true,
              explanation: 'Pikdə 800 post/san × 200 = 160 000 lent yazısı olur və lent yaddaşdan bir oxumada verilir. İş oxuma anından yazma anına keçir; oxumalar 50 dəfə çox olduğu üçün bu, ümumi işi 50 dəfə azaldır.',
            },
            {
              text: 'Fan-out on read: lent açılanda 200 dostun postlarını yığmaq',
              explanation: 'Pikdə 40 000 oxuma/san × 200 = 8 milyon oxuma deməkdir və hər lent 200 sorğunun ən yavaşını gözləyir. Yazma ucuzdur, amma bu servisdə yazma onsuz da azdır.',
            },
            {
              text: 'Fərq yoxdur: hər iki halda eyni sayda əməliyyat olur',
              explanation: 'Fan-out on write-da iş postların sayına, fan-out on read-də isə oxumaların sayına vurulur; bu servisdə onlar 50 dəfə fərqlənir.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: '10 milyon izləyicisi olan məşhur hesab (celebrity) post paylaşanda fan-out on write ilə nə olur və bunu necə həll etmək olar?',
          options: [
            {
              text: 'Bir post 10 milyon lent yazısına çevrilir; hibrid yanaşma: məşhurların postlarını fan-out etməyib, lent oxunanda ayrıca yığıb qarışdırmaq',
              correct: true,
              explanation: 'Bu, "hot key" və ya celebrity problemidir: bir post dəqiqələrlə fan-out növbəsini tutur. Adi istifadəçilər üçün fan-out on write, məşhurlar üçün fan-out on read: oxucu bir neçə məşhurun son postlarını oxuma anında alır və onları hazır lentlə birləşdirir.',
            },
            {
              text: 'Problem yoxdur: fan-out worker-lərinin sayını artırmaq kifayətdir',
              explanation: 'Worker-lər artsa da, 10 milyon yazı yenə yazılmalıdır, cache və növbə də bu dalğanı daşımalıdır; üstəlik izləyicilərin çoxu lentini heç açmayacaq.',
            },
            {
              text: 'Məşhurların postlarını göstərməmək',
              explanation: 'Bu, məhsulun əsas dəyərini itirmək deməkdir: istifadəçilər məhz məşhurları izləmək üçün gəlir.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Lent cache-ində hər istifadəçi üçün nə saxlamaq lazımdır?',
          options: [
            {
              text: 'Yalnız son post id-lərinin siyahısı (məsələn, ən çox 500); məzmun oxunanda post və istifadəçi cache-lərindən doldurulur',
              correct: true,
              explanation: 'Bir post id-si 8 baytdır, post isə 1 KB: id saxlamaq yaddaşı 100 dəfə azaldır və post redaktə ediləndə 200 nüsxəni yeniləmək lazım olmur. Köhnə postlar nadir oxunur, ona görə siyahı qısa saxlanılır.',
            },
            {
              text: 'Hər postun tam məzmunu, müəllifin adı və şəkli ilə birlikdə',
              explanation: 'Hər post 200 dəfə köçürülür, ona görə yaddaş 200 qat artır; post və ya profil dəyişəndə bütün nüsxələr köhnəlir.',
            },
            {
              text: 'İstifadəçinin bütün tarixçəsi boyu bütün lent',
              explanation: 'İstifadəçilər lentin yalnız başını oxuyur; illərin lentini yaddaşda saxlamaq çox bahadır.',
            },
          ],
        },
        {
          type: 'multi-select',
          prompt: 'Fan-out on write-ı ucuzlaşdırmaq üçün nə etmək olar?',
          options: [
            {
              text: 'Uzun müddət (məsələn, 30 gün) daxil olmayan istifadəçilərin lentinə yazmamaq; onlar qayıdanda lenti oxuma anında qurmaq',
              correct: true,
              explanation: 'Dostların bir hissəsi passivdir: onların lentinə yazılan postları heç kim oxumur. Qayıdan istifadəçi üçün lent bir dəfə fan-out on read ilə qurulur.',
            },
            {
              text: 'Fan-out-u növbəyə vermək və post yazmasını ondan əvvəl təsdiqləmək',
              correct: true,
              explanation: 'Post saxlanılan kimi istifadəçiyə cavab verilir; 200 lentin yenilənməsi arxa planda gedir. Növbə qəfil dalğaları udur və worker çökəndə iş itmir.',
            },
            {
              text: 'Fan-out-u post sorğusunun içində, sinxron etmək',
              explanation: 'İstifadəçi 200 yazının (məşhurda milyonların) bitməsini gözləyər; fan-out worker-ləri sıradan çıxanda post paylaşmaq da dayanar.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Lentin növbəti səhifəsi necə verilməlidir?',
          options: [
            {
              text: 'Cursor ilə: client son gördüyü post id-sini göndərir, servis ondan köhnə postları qaytarır',
              correct: true,
              explanation: 'Lentin başına daim yeni postlar əlavə olunur: cursor yeni postlar gəlsə də səhifələrin sürüşməsinin və postların təkrarlanmasının qarşısını alır.',
            },
            {
              text: 'Offset ilə: "?page=3" kimi səhifə nömrəsi',
              explanation: 'Oxuyarkən başa yeni post düşsə, bütün səhifələr sürüşür və istifadəçi eyni postu iki dəfə görür; dərin offset-lər də bahadır.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Fan-out worker-ləri bir müddət sıradan çıxsa, nə baş verməlidir?',
          options: [
            {
              text: 'Postlar qəbul olunmağa davam edir və növbədə gözləyir; lentlər köhnəlmiş halda oxunur, worker-lər qayıdanda yetişir',
              correct: true,
              explanation: 'Növbə yazma yolunu fan-out-dan ayırır: post paylaşmaq da, lent oxumaq da xətasız davam edir, sadəcə yeni postlar lentə gecikmə ilə düşür. Scaling mərhələsinin xaos tapşırığı məhz bunu yoxlayır.',
            },
            {
              text: 'Post paylaşmaq dayanır, ta ki worker-lər qayıdana qədər',
              explanation: 'Bu, fan-out-un post sorğusunda sinxron olduğunu göstərir: köməkçi bir servisin problemi əsas funksiyanı dayandırır.',
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
        'Yüksək səviyyəli dizaynınızdan davam edin və onu pik yükə görə miqyaslayın: saniyədə 40 000 lent oxunuşu və 800 post. Lent oxumasının orta gecikməsi 100 ms-i, postunku 200 ms-i keçməməli, heç bir node həddən artıq yüklənməməli, heç bir sorğu xəta ilə bitməməli və infrastrukturun aylıq xərci 40 000 dolları keçməməlidir. Xaos tapşırığı: fan-out service sıradan çıxıb; post paylaşmaq da, lent oxumaq da xətasız davam etməlidir. Bunu trafik simulyasiyası ilə yoxlayın, darboğazları tapın və "Yoxla" düyməsini basın.',
      // The authored peak: twice the average.
      loadProfile: { readQps: 40_000, writeQps: 800, requestBytes: 1_000 },
      chaosTasks: [
        {
          id: 'fan-out-down',
          prompt: 'Fan-out service sıradan çıxıb: postlar da, lent oxumaları da xətasız davam etməlidir; lentlər bir müddət köhnələ bilər.',
          scenario: { type: 'node-down', nodes: ['fan-out'] },
        },
      ],
      rules: [
        {
          id: 'peak-load',
          weight: 3,
          description: 'Pik yükdə (saniyədə 40 000 oxuma, 800 post) lent oxumasının orta gecikməsi 100 ms-dən, postunku 200 ms-dən çox deyil, həddən artıq yüklənən node və xəta yoxdur.',
          hints: [
            'Saniyədə 40 000 lent açılanda dizaynınızın hansı node-u ilk tıxanır? Fan-out service saniyədə neçə nüsxə göndərir?',
            'Trafik simulyasiyasını işə salın və "Darboğazlar" siyahısına baxın. Ən çox yüklənən node-ların "instances" sahəsini artırın. Fan-out service-in yükü onun nüsxələridir: bir sorğu "fan-out" qədər nüsxəyə çevrilir.',
            'Bu modeldə application service-in bir nüsxəsi saniyədə 500 sorğu emal edir: 40 000 lent oxunuşu üçün Feed Service-ə 80-dən çox, ehtiyatla 100-dən çox nüsxə lazımdır; web server-lər və load balancer ümumi yükü daşımalıdır. Fan-out service-in bir nüsxəsi saniyədə 5 000 nüsxə göndərir: fan-out on write-da 800 × 200 = 160 000 nüsxə üçün 32-dən çox nüsxə, lent cache-i isə bu yazıları və 40 000 oxumanı birlikdə daşımalıdır (bir nüsxəsi 50 000). Fan-out on read-də isə 40 000 × 200 = 8 milyon nüsxə lazım olardı.',
          ],
          check: { type: 'simulation', maxLatencyMs: { read: 100, write: 200 }, maxOverloadedNodes: 0, maxErrorRate: 0 },
        },
        {
          id: 'budget',
          weight: 3,
          description: 'Pik yükü daşıyan dizaynın aylıq xərci 40 000 dollardan çox deyil.',
          hints: [
            'Simulyasiyanın "Aylıq xərc" sətrinə baxın. Pulun çoxu hara gedir: lentin yazılmasına, yoxsa oxunmasına?',
            'Lenti oxuma anında 200 dostdan yığırsınızsa (fan-out on read), fan-out-u yazma yoluna keçirin: postları növbə ilə fan-out service-ə verin, o da onları 200 dostun lent cache-inə yazsın; Feed Service isə hazır lenti oxusun.',
            'Fan-out on read-də hər lent oxunuşu 200 oxumaya çevrilir: pikdə 8 milyon nüsxə üçün 1 600 fan-out nüsxəsi (aylıq 112 000 dollar) və 160 cache nüsxəsi lazımdır. Fan-out on write-da isə 800 post × 200 = 160 000 nüsxə üçün 32-dən çox fan-out nüsxəsi (məsələn, 40: 2 800 dollar) və bir neçə cache nüsxəsi kifayətdir. Oxumalar yazmalardan 50 dəfə çox olduqda işi yazma anına keçirmək həm sürətli, həm də ucuzdur.',
          ],
          check: { type: 'simulation', maxMonthlyCostUsd: 40_000 },
        },
        {
          id: 'fan-out-down',
          weight: 2,
          description: 'Fan-out service sıradan çıxanda pik yükdə post paylaşmaq və lent oxumaq xətasız davam edir.',
          hints: [
            'Fan-out service işləməyəndə post sorğusu nəyi gözləyir? Lent oxuması ondan asılıdırmı?',
            'Trafik simulyasiyasında "Xaos ssenarisi" siyahısından bu tapşırığı seçin. Post Service ilə fan-out arasına message queue qoyun (və ya xətti asinxron edin) ki, post sorğusu fan-out-u gözləməsin.',
            'Növbə yazma yolunu fan-out-dan ayırır: Post Service postu saxlayıb növbəyə iş qoyur və dərhal cavab verir. Fan-out service sıradan çıxanda işlər növbədə gözləyir (backlog), lentlər isə cache-dən köhnəlmiş halda verilməyə davam edir; worker-lər qayıdanda yetişir. Fan-out on read-də isə fan-out lentin öz yolundadır: o çökəndə lent də açılmır.',
          ],
          check: { type: 'simulation', chaos: 'fan-out-down', maxErrorRate: 0 },
        },
        {
          id: 'fan-out-on-write',
          weight: 2,
          description: 'Miqyaslanmış dizaynda hər post fan-out service ilə 200 dostun lentinə yazılır (fan-out on write).',
          hints: [
            'Pik yükdə və büdcə daxilində lent hansı anda qurulmalıdır?',
            'Post yazmalarını "fan-out" sahəsi 200 olan fan-out service-ə gətirin və ondan lent cache-inə yazma xətti çəkin.',
            'Bu servisdə oxumalar yazmalardan 50 dəfə çoxdur, ona görə lentlər yazma anında qurulur və oxunanda hazır olur. Bunun istisnası milyonlarla izləyicisi olan məşhurlardır: onların postları fan-out edilmir, oxuma anında ayrıca yığılır (hibrid yanaşma).',
          ],
          check: FAN_OUT_ON_WRITE,
        },
        loadBalancerRule,
        scaleOutRule,
        {
          id: 'posts-spread',
          weight: 2,
          description: 'Postların anbarı oxumaları replikalara paylayır və ya shard-lara bölünüb.',
          hints: [
            'Feed Service hər lent üçün postların məzmununu oxuyur. 60 TB və saniyədə minlərlə oxuma bir baza serverinə sığarmı?',
            'Post DB-nin "replicas" sahəsini 1 və ya daha çox edin (ya da "replica" rolunda ayrıca node əlavə edin), və ya "shardKey" (məsələn, post_id) yazıb "instances"-i 2 və daha çox edin.',
            'Postların çoxu cache-dən verilir, cache-də olmayanlar isə bazanın replikalarından oxunur. Shard-lar həm məlumatı, həm də yükü bölür; post_id-yə görə shard-lamaq postları bərabər paylayır.',
          ],
          check: POSTS_SPREAD,
        },
        allConnectedRule('Fan-out Workers → Feed Cache'),
      ],
      referenceSolution: {
        nodes: [
          node('client-1', 'client', 'Client', 0, 360),
          node('load-balancer-1', 'load-balancer', 'Load Balancer', 240, 360, { instances: 3 }),
          node('web-server-1', 'web-server', 'Web Server', 480, 360, { instances: 60 }),
          node('app-service-1', 'app-service', 'Post Service', 720, 160, { instances: 4 }),
          node('app-service-2', 'app-service', 'Feed Service', 720, 560, { instances: 120 }),
          node('nosql-store-1', 'nosql-store', 'Post DB', 1200, 560, { replicas: 2 }),
          node('cache-2', 'cache', 'Post Cache', 960, 680, { instances: 2 }),
          node('message-queue-1', 'message-queue', 'Fan-out Queue', 960, 40),
          node('app-service-3', 'app-service', 'Friend Lookup', 1200, 40, { instances: 3 }),
          node('nosql-store-2', 'nosql-store', 'Graph DB', 1440, 40, { kind: 'graph' }),
          node('fan-out-1', 'fan-out', 'Fan-out Workers', 1440, 200, { fanOut: 200, instances: 40 }),
          node('cache-1', 'cache', 'Feed Cache', 1440, 400, { instances: 5 }),
        ],
        edges: [
          edge('client-1', 'load-balancer-1', 'both'),
          edge('load-balancer-1', 'web-server-1', 'both'),
          edge('web-server-1', 'app-service-1', 'write'),
          edge('web-server-1', 'app-service-2', 'read'),
          edge('app-service-1', 'nosql-store-1', 'write'),
          edge('app-service-1', 'message-queue-1', 'write'),
          edge('message-queue-1', 'app-service-3', 'write'),
          edge('app-service-3', 'nosql-store-2', 'write'),
          edge('app-service-3', 'fan-out-1', 'write'),
          edge('fan-out-1', 'cache-1', 'write'),
          edge('app-service-2', 'cache-1', 'read'),
          edge('app-service-2', 'cache-2', 'read'),
          edge('app-service-2', 'nosql-store-1', 'read'),
        ],
      },
    },
  ],
}
