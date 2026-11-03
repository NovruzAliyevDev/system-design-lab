// Video streaming (YouTube): not a primer question. An upload is stored as it came, recorded in the metadata
// store and put on a queue; transcoders take it from there and encode it into several renditions (360p to
// 1080p), each written to the object store. Viewers stream the renditions from a CDN, which answers most of
// them from its edge and fetches the rest from the object store, while the video's page (title, views) comes
// from the video service. The assumptions are authored: 25 million uploads and 25 billion views a month, about
// 50 MB a video and as much streamed by a view, twice the average at the evening peak.
//
// In the simulation a view is a read: it fetches the video's metadata from the video service and streams the
// video from the CDN, one call after the other. An upload is a write. A transcoder sends each upload on as one
// write per rendition, and its capacity counts the renditions it encodes. Each request carries 50 MB, what a
// view streams and an upload brings; the metadata calls beside them carry far less, which this one figure for
// every Node overstates.
import type { ChallengeInput } from '../../src/core/challenges/challenge'
import type { NodeSelector, Predicate } from '../../src/core/challenges/rules'
import { allConnectedRule, apiPath, edge, ENTRY, node, QUEUES, readAndWritePaths } from '../primer-challenges/shared'
import { loadBalancerRule, scaledOutNodes, scaleOutRule } from './shared'

/** Where a video's title, uploader, renditions and status live: a SQL table or a NoSQL store. */
const METADATA_STORE: NodeSelector[] = ['sql-database', 'nosql-store']
/** A transcoder encoding each upload into the four renditions the Stage asks for: 360p, 480p, 720p and 1080p. */
const FOUR_RENDITIONS: NodeSelector = { component: 'transcoder', config: { renditions: 4 } }

/** A pull CDN: every view reaches the video files through it, and it fetches its misses from the object store. */
const PULL_CDN: Predicate = { type: 'path', from: 'client', to: 'object-store', through: 'cdn', traffic: 'read' }
/** A push CDN: the transcoders push the renditions to it, and no view reads the object store itself. */
const PUSH_CDN: Predicate = {
  type: 'all-of',
  predicates: [
    { type: 'edge', from: 'client', to: 'cdn', traffic: 'read' },
    { type: 'edge', from: 'transcoder', to: 'cdn', traffic: 'write' },
    { type: 'not', predicate: { type: 'path', from: 'client', to: 'object-store', traffic: 'read' } },
  ],
}

export const videoStreaming: ChallengeInput = {
  id: 'video-streaming',
  title: 'Video yayımı (YouTube kimi) dizayn edin',
  kind: 'architecture',
  source: 'authored',
  lessonIds: [
    'additional-system-design-interview-questions',
    'content-delivery-network',
    'pull-cdns',
    'push-cdns',
    'task-queues',
    'asynchronism',
    'cache',
    'back-of-the-envelope-calculations',
    'horizontal-scaling',
  ],
  // The authored average: 25 billion views and 25 million uploads a month.
  loadProfile: { readQps: 10_000, writeQps: 10, requestBytes: 50_000_000 },
  stages: [
    {
      id: 'requirements',
      type: 'requirements',
      weight: 1,
      prompt:
        'YouTube kimi video platforması dizayn edin: istifadəçilər video yükləyir, başqaları isə onları istənilən cihazda izləyir. Bu sual primer-dən deyil. Aşağıdakılardan bu tapşırığa aid olan istifadə hallarını (use case) və məhdudiyyətləri seçin, kənarda qalanları seçməyin.',
      items: [
        {
          section: 'use-case',
          text: 'İstifadəçi video yükləyir',
          correct: true,
          explanation: 'Yükləmə yolunun əsası: orijinal fayl saxlanılır, video qeydə alınır və emala göndərilir.',
        },
        {
          section: 'use-case',
          text: 'Video bir neçə keyfiyyətə (360p, 480p, 720p, 1080p) çevrilir',
          correct: true,
          explanation: 'Bu, transcoding-dir: telefon zəif şəbəkədə 360p, televizor isə 1080p alır. Hər keyfiyyət (rendition) ayrıca fayl kimi saxlanılır.',
        },
        {
          section: 'use-case',
          text: 'İzləyici videonu izləyir, keyfiyyət isə şəbəkəsinə uyğun dəyişir',
          correct: true,
          explanation: 'Bu, adaptive bitrate streaming-dir: video qısa seqmentlərə bölünür və player hər seqmenti şəbəkənin sürətinə uyğun keyfiyyətdə götürür.',
        },
        {
          section: 'use-case',
          text: 'İzləyici videonun səhifəsini görür: başlıq, təsvir, baxış sayı',
          correct: true,
          explanation: 'Metadata video faylından ayrıca saxlanılır və video servisindən oxunur; video axını isə CDN-dən gəlir.',
        },
        {
          section: 'use-case',
          text: 'Canlı yayım (live streaming)',
          explanation: 'Canlı yayımın tələbləri fərqlidir (saniyələr içində kodlaşdırma, seqmentlərin dərhal paylanması): bu tapşırıqda kənarda qalır.',
        },
        {
          section: 'use-case',
          text: 'İstifadəçiyə şəxsi tövsiyələr (recommendations) göstərilir',
          explanation: 'Tövsiyə sistemi ayrıca böyük sualdır (primer-in əlavə suallarında da var): bu tapşırıqda kənarda qalır.',
        },
        {
          section: 'use-case',
          text: 'Yükləmə bitən kimi video bütün keyfiyyətlərdə bir saniyə ərzində izlənə bilir',
          explanation: 'Transcoding dəqiqələr çəkir: video bir müddət "emal olunur" statusunda qalır. Önəmli olan, yükləmənin dərhal qəbul olunması və emalın sonra, asinxron getməsidir.',
        },
        {
          section: 'constraint',
          text: 'Ayda 25 milyon video yüklənir və 25 milyard dəfə video izlənilir',
          correct: true,
          explanation: 'Fərziyyə: estimation mərhələsi bundan başlayır. Bir yükləməyə 1 000 baxış düşür: sistem oxumaya görə ağırdır.',
        },
        {
          section: 'constraint',
          text: 'Orta video təxminən 50 MB-dır və bir baxış da orta hesabla 50 MB ötürür',
          correct: true,
          explanation: 'Yaddaş və ötürmə zolağı (bandwidth) hesablamasının əsası: baxışlar saniyədə yüzlərlə GB ötürür.',
        },
        {
          section: 'constraint',
          text: 'Axşam pikində yük ortalamanın 2 qatıdır',
          correct: true,
          explanation: 'Miqyaslama mərhələsi pikə görə yoxlanılır: saniyədə 20 000 baxış və 20 yükləmə.',
        },
        {
          section: 'constraint',
          text: 'Bütün videolar şirkətin öz datacenter-indəki serverlərdən ötürülür',
          explanation: 'Saniyədə yüzlərlə GB-ı bir datacenter-dən ötürmək həm bahalı, həm də uzaqdakı izləyici üçün yavaşdır: videolar istifadəçiyə yaxın CDN serverlərindən gedir.',
        },
        {
          section: 'constraint',
          text: 'Baxış sayı hər an bütün izləyicilər üçün dəqiq eyni olmalıdır (strong consistency)',
          explanation: 'Baxış sayının bir neçə saniyə gecikməsi qəbulediləndir: eventual consistency kifayətdir və sayğacı ucuz edir.',
        },
      ],
    },
    {
      id: 'estimation',
      type: 'estimation',
      weight: 1,
      prompt:
        'Fərziyyələr: ayda 25 milyon video yüklənir və 25 milyard dəfə izlənilir. Orta video 50 MB-dır və bir baxış da 50 MB ötürür; pikdə yük ortalamanın 2 qatıdır. Ayda 2,5 milyon saniyə və 1 KB = min bayt kimi yuvarlaq çevirmələri işlədin. Cavablar referansın 2 qatı daxilində olsa qəbul olunur.',
      explanation:
        'Bu, primer-in "back-of-the-envelope" üsuludur: ayda təxminən 2,5 milyon saniyə var, ona görə ayda 25 milyon yükləmə saniyədə 10 yükləmə, 25 milyard baxış isə saniyədə 10 000 baxış, pikdə 20 000 deməkdir. Yaddaş yükləmələrin sayı ilə ölçüsünün hasilidir: ayda 1,25 PB orijinal video; renditions də təxminən bir o qədər əlavə edir. Ötürmə zolağı baxışların sayı ilə ötürdükləri baytların hasilidir: saniyədə 500 GB, yəni təxminən 4 Tbps. Bunu yalnız dünyaya yayılmış CDN daşıya bilər.',
      inputs: { writesPerMonth: 25_000_000, readsPerMonth: 25_000_000_000, bytesPerWrite: 50_000_000, peakFactor: 2 },
      questions: [
        { id: 'write-qps', quantity: 'writeQps', prompt: 'Orta hesabla saniyədə neçə video yüklənir?' },
        { id: 'read-qps', quantity: 'readQps', prompt: 'Orta hesabla saniyədə neçə dəfə video izlənilir?' },
        { id: 'peak-read-qps', quantity: 'peakReadQps', prompt: 'Axşam pikində saniyədə neçə dəfə video izlənilir?' },
        { id: 'storage-per-month', quantity: 'storagePerMonth', prompt: 'Bir ayda yüklənən orijinal videolar nə qədər yer tutur?' },
        { id: 'read-bandwidth', quantity: 'readBandwidth', prompt: 'Baxışlar orta hesabla saniyədə nə qədər məlumat ötürür?' },
      ],
    },
    {
      id: 'high-level-design',
      type: 'high-level-design',
      weight: 3,
      prompt:
        'Yükləmə yolunu və izləmə yolunu qurun. Yüklənən video saxlanılır və transcoding worker ilə 4 keyfiyyətə (360p, 480p, 720p, 1080p) çevrilir: onun "renditions" sahəsinə 4 yazın. İzləyicilər videoları CDN-dən götürür, videonun səhifəsini (başlıq, baxış sayı) isə video servisindən. Saniyədə orta hesabla 10 000 baxış və 10 yükləmə gəlir. Bütün vacib komponentləri kətana qoyun, sorğuların axınını xətlərlə göstərin və "Yoxla" düyməsini basın.',
      rules: [
        {
          id: 'entry-point',
          weight: 2,
          description: 'İstifadəçi sorğuları video servisinə web server (reverse proxy) və ya load balancer vasitəsilə çatır.',
          hints: [
            'Yükləmə və ya videonun səhifəsi üçün sorğu video servisinin koduna çatmazdan əvvəl ilk olaraq nəyə dəyir?',
            'Client ilə application service arasına web server, reverse proxy və ya load balancer qoyun: hər sorğu ondan keçsin.',
            'Servisin qarşısındakı qat sorğuları bir neçə server arasında bölür, HTTPS-i bitirir və istifadəçinin kimliyini yoxlayır: video yalnız daxil olmuş istifadəçi tərəfindən yüklənə bilər.',
          ],
          check: { type: 'path', from: 'client', to: 'app-service', through: ENTRY },
        },
        {
          id: 'video-storage',
          weight: 2,
          description: 'Yüklənən videolar video servisi vasitəsilə object store-da saxlanılır.',
          hints: [
            '50 MB-lıq video faylları ayda petabaytlarla yığılır. Onları harada saxlamaq ucuz və etibarlıdır?',
            'Video servisindən object store-a yazma xətti çəkin: orijinal video orada saxlanılır.',
            'Object store (məsələn, Amazon S3) böyük faylları açarla saxlayır, demək olar ki, sonsuz miqyaslanır və hər faylın bir neçə nüsxəsini özü saxlayır. Video faylı verilənlər bazasına yazılmır: bazada yalnız onun açarı və metadata qalır.',
          ],
          check: apiPath(['object-store'], 'write'),
        },
        {
          id: 'video-metadata',
          weight: 2,
          description: 'Videonun metadata-sı (başlıq, müəllif, status, renditions) video servisi vasitəsilə bazada yazılır və oxunur.',
          hints: [
            'İzləyici videonun başlığını və baxış sayını haradan alır? Video hələ emal olunursa, bunu kim bilir?',
            'Video servisindən SQL database-ə (və ya NoSQL store-a) həm oxuma, həm yazma daşıyan xətt çəkin.',
            'Metadata kiçikdir və strukturludur: videonun id-si, müəllifi, başlığı, statusu ("emal olunur", "hazırdır") və hər rendition-un object store-dakı açarı. Yükləmə onu yazır, hər baxış isə oxuyur, ona görə o, sonra cache-lənəcək.',
          ],
          check: readAndWritePaths(METADATA_STORE),
        },
        {
          id: 'queued-transcoding',
          weight: 3,
          description: 'Hər yükləmənin transcoding-i növbə vasitəsilə gedir: yükləmə emalı gözləmir.',
          hints: [
            'Bir videonun kodlaşdırılması dəqiqələr çəkir. İstifadəçinin yükləmə sorğusu bu müddətdə açıq qalmalıdırmı?',
            'Video servisi ilə transcoding worker arasına message queue qoyun: servis işi növbəyə qoyur, transcoder-lər onu oradan götürür.',
            'Növbə yükləməni emaldan ayırır: servis videonu saxlayıb işi növbəyə qoyur və dərhal cavab verir, transcoder-lər isə işləri öz sürətində götürür. Pikdə yığılan işlər növbədə gözləyir, worker çöksə də iş itmir və başqa worker onu təkrar götürür.',
          ],
          check: { type: 'path', from: 'client', to: 'transcoder', through: QUEUES, traffic: 'write' },
        },
        {
          id: 'renditions',
          weight: 2,
          description: 'Transcoder hər videonu 4 keyfiyyətə çevirir və onları object store-a yazır.',
          hints: [
            'Zəif mobil şəbəkədəki telefon ilə 4K televizor eyni faylı izləməlidirmi?',
            'Transcoding worker-in "renditions" sahəsini 4 edin və ondan object store-a yazma xətti çəkin.',
            'Hər rendition ayrıca fayldır: 360p, 480p, 720p və 1080p. Player şəbəkəyə görə onlar arasında keçir. Bu modeldə transcoder hər yükləməni 4 yazma kimi göndərir və onun gücü kodlaşdırdığı rendition-larla ölçülür: 4 keyfiyyət 4 qat iş deməkdir.',
          ],
          check: { type: 'edge', from: FOUR_RENDITIONS, to: 'object-store', traffic: 'write' },
        },
        {
          id: 'cdn-delivery',
          weight: 3,
          description: 'Baxışlar videolara yalnız CDN vasitəsilə çatır: pull CDN object store-dan götürür, və ya transcoder-lər videoları push CDN-ə göndərir.',
          hints: [
            'Saniyədə 500 GB-ı kim ötürəcək? Bakıdakı izləyici videonu ABŞ-dakı datacenter-dən götürməlidirmi?',
            'Client-dən CDN-ə oxuma xətti, CDN-dən isə object store-a oxuma xətti çəkin (pull CDN). Və ya transcoder-dən CDN-ə yazma xətti çəkin (push CDN). Object store-a CDN-dən yan keçən oxuma yolu qalmasın.',
            'CDN videonu izləyiciyə yaxın serverdən verir: gecikmə azalır, datacenter-in ötürmə zolağı isə qorunur. Pull CDN seqmenti ilk istəyəndə origin-dən (object store-dan) götürür və saxlayır, sonrakı izləyicilər onu kənardan alır. Push CDN-ə isə video əvvəlcədən göndərilir.',
          ],
          check: { type: 'any-of', predicates: [PULL_CDN, PUSH_CDN] },
        },
        allConnectedRule('Transcode Queue → Transcoders'),
      ],
      referenceSolution: {
        nodes: [
          node('client-1', 'client', 'Viewers & Uploaders', 0, 240),
          node('cdn-1', 'cdn', 'CDN', 240, 40),
          node('web-server-1', 'web-server', 'Web Server', 240, 320),
          node('app-service-1', 'app-service', 'Video Service', 480, 320),
          node('sql-database-1', 'sql-database', 'Video Metadata', 720, 200),
          node('message-queue-1', 'message-queue', 'Transcode Queue', 720, 440),
          node('transcoder-1', 'transcoder', 'Transcoders', 960, 440, { renditions: 4 }),
          node('object-store-1', 'object-store', 'Video Storage', 1200, 40),
        ],
        edges: [
          edge('client-1', 'cdn-1', 'read'),
          edge('client-1', 'web-server-1', 'both'),
          edge('web-server-1', 'app-service-1', 'both'),
          edge('app-service-1', 'sql-database-1', 'both'),
          edge('app-service-1', 'object-store-1', 'write'),
          edge('app-service-1', 'message-queue-1', 'write'),
          edge('message-queue-1', 'transcoder-1', 'write'),
          edge('transcoder-1', 'object-store-1', 'write'),
          edge('cdn-1', 'object-store-1', 'read'),
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
          prompt: '50 MB-lıq (və ya 5 GB-lıq) video object store-a necə yüklənməlidir?',
          options: [
            {
              text: 'Video servisi müvəqqəti imzalı URL (pre-signed URL) verir, client faylı hissə-hissə birbaşa object store-a yükləyir',
              correct: true,
              explanation: 'Gigabaytlar API serverlərindən keçmir: onların thread-ləri və şəbəkəsi boş qalır. Hissələrlə yükləmə (multipart) qırılan bağlantıdan sonra yalnız qalan hissəni yenidən göndərir. Bitəndə client servisə xəbər verir və transcoding başlayır.',
            },
            {
              text: 'Client faylı video servisinə göndərir, servis isə onu object store-a ötürür',
              explanation: 'İşləyir, amma hər bayt iki dəfə ötürülür və yavaş şəbəkədəki istifadəçi server thread-ini dəqiqələrlə tutur. Bu modeldə video servisi yazmanı ötürən kimi çəkilib, real sistemdə isə yalnız URL verir.',
            },
            {
              text: 'Videonu base64 ilə JSON sorğusunun içində bir dəfəyə göndərmək',
              explanation: 'Base64 faylı üçdə bir böyüdür, bütün fayl yaddaşa yüklənir və bağlantı qırılanda hər şey yenidən başlayır.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Player şəbəkə zəifləyəndə donmadan necə davam etməlidir?',
          options: [
            {
              text: 'Hər rendition 2–10 saniyəlik seqmentlərə bölünür və manifest (HLS, DASH) onları sadalayır; player hər seqmenti şəbəkəsinə görə uyğun keyfiyyətdə götürür',
              correct: true,
              explanation: 'Bu, adaptive bitrate streaming-dir: şəbəkə zəifləyəndə player növbəti seqmenti 360p-də götürür, güclənəndə 1080p-yə qayıdır. Seqmentlər adi HTTP faylları olduğu üçün CDN onları digər statik fayllar kimi cache-ləyir.',
            },
            {
              text: 'Başlanğıcda keyfiyyət seçilir və bütün fayl o keyfiyyətdə bir dəfəyə göndərilir',
              explanation: 'Şəbəkə ortada zəifləsə video donur (buffering), çünki keyfiyyəti dəyişmək mümkün deyil; izləyicinin baxmadığı hissə də boşuna ötürülür.',
            },
            {
              text: 'Server hər izləyicinin şəbəkəsini ölçür və videonu onun üçün canlı kodlaşdırır',
              explanation: 'Hər baxış üçün ayrıca kodlaşdırma saniyədə 20 000 transcoding deməkdir: bu, çox bahalıdır, CDN isə fərdi axını cache-ləyə bilmir.',
            },
          ],
        },
        {
          type: 'multi-select',
          prompt: 'Ayda 25 milyon yeni video gəlir və onların çoxuna az baxılır. CDN necə doldurulmalıdır?',
          options: [
            {
              text: 'Videoların çoxu üçün pull CDN: seqment ilk istəyəndə origin-dən götürülür və TTL ilə saxlanılır',
              correct: true,
              explanation: 'Primer-in dediyi kimi, pull CDN böyük trafikli saytlara uyğundur: CDN-də yalnız izlənilənlər qalır. Az baxılan videolar kənar serverlərin yaddaşını tutmur; ilk izləyici bir az gözləyir.',
            },
            {
              text: 'Populyar olacağı gözlənilən videoları (məsələn, yeni serialı) trafik az olanda əvvəlcədən kənar serverlərə göndərmək (push)',
              correct: true,
              explanation: 'Netflix belə edir: populyar kontent gecə saatlarında kənar serverlərə yerləşdirilir, ona görə ilk izləyici də gözləmir, pikdə origin-ə sorğu getmir.',
            },
            {
              text: 'Hər yeni videonu bütün kənar serverlərə göndərmək',
              explanation: 'Ayda 1,25 PB (renditions ilə daha çox) hər kənar serverə kopyalanmalı olur, onun böyük hissəsi isə heç vaxt izlənilmir: CDN yaddaşı boşuna dolur.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: '2 saatlıq filmin transcoding-ini necə sürətləndirmək olar?',
          options: [
            {
              text: 'Videonu qısa hissələrə bölüb onları çox worker-də paralel kodlaşdırmaq, sonra birləşdirmək',
              correct: true,
              explanation: 'Hissələr bir-birindən asılı olmadan kodlaşdırılır (məsələn, hər biri key frame-dən başlayır): 100 worker filmi bir worker-dən təxminən 100 qat tez emal edir. Bu iş axını adətən DAG kimi qurulur: bölmək, kodlaşdırmaq, birləşdirmək, thumbnail yaratmaq.',
            },
            {
              text: 'Hər videonu bir worker-də əvvəldən sona kodlaşdırmaq',
              explanation: 'Sadədir, amma uzun video saatlarla bir worker-də qalır, qısa videolar isə onun arxasında gözləyir.',
            },
            {
              text: 'Rendition-u yalnız kimsə o keyfiyyətdə izləmək istəyəndə kodlaşdırmaq',
              explanation: 'Yer qənaət olunur, amma ilk izləyici dəqiqələrlə gözləyir. Bunu yalnız çox nadir keyfiyyətlər üçün düşünmək olar.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Transcoder videonun ortasında çöksə, nə olmalıdır?',
          options: [
            {
              text: 'İş növbədə qalır, çünki worker onu yalnız bitirəndə təsdiqləyir (ack); vaxtı keçəndə iş başqa worker-ə verilir, nəticə faylları isə eyni açarlarla yenidən yazılır',
              correct: true,
              explanation: 'Növbə işi təsdiqlənənə qədər saxlayır (visibility timeout): itmir. Eyni açarla yenidən yazmaq təkrarı zərərsiz edir (idempotent), video isə metadata-da "emal olunur" statusunda qalır.',
            },
            {
              text: 'Video itir və istifadəçidən yenidən yükləməsi xahiş olunur',
              explanation: 'Orijinal artıq object store-dadır: emalı təkrarlamaq mümkündür. İstifadəçini yenidən yükləməyə məcbur etmək lazım deyil.',
            },
            {
              text: 'Video servisi transcoding-i sinxron təkrarlayır, istifadəçi isə gözləyir',
              explanation: 'İstifadəçinin sorğusu dəqiqələrlə açıq qalır və serverin çökməsi ilə yenə itir; növbə məhz bunun üçündür.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Viral videoya saniyədə on minlərlə baxış düşür. Baxış sayı necə hesablanmalıdır?',
          options: [
            {
              text: 'Baxışlar yaddaşdakı sayğacda (və ya axında) toplanır və bazaya bir neçə saniyədən bir partiya ilə yazılır',
              correct: true,
              explanation: 'Bir sətrə saniyədə on minlərlə yazma əvəzinə bir yazma gedir. Sayğac bir neçə saniyə geri qalır: baxış sayı üçün eventual consistency kifayətdir.',
            },
            {
              text: 'Hər baxışda SQL-də "views = views + 1" əmrini icra etmək',
              explanation: 'Bütün yazmalar eyni sətrə düşür və onun kilidi üçün növbəyə durur (hot row): baza məhz viral videoda tıxanır.',
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
        'Yüksək səviyyəli dizaynınızdan davam edin və onu axşam pikinə görə miqyaslayın: saniyədə 20 000 baxış və 20 yükləmə, yəni 80 rendition. Baxışın orta gecikməsi 30 ms-i, yükləmənin qəbulu 200 ms-i keçməməli, heç bir node, o cümlədən transcoder-lər, həddən artıq yüklənməməli və heç bir sorğu xəta ilə bitməməlidir. Xaos tapşırığı: bütün transcoder-lər sıradan çıxıb; yükləmələr yenə xətasız qəbul edilməli, emal işləri isə növbədə gözləməlidir. Bunu trafik simulyasiyası ilə yoxlayın, darboğazları tapın və "Yoxla" düyməsini basın.',
      // The authored peak: twice the average, in the evening.
      loadProfile: { readQps: 20_000, writeQps: 20, requestBytes: 50_000_000 },
      chaosTasks: [
        {
          id: 'transcoders-down',
          prompt: 'Bütün transcoder-lər sıradan çıxıb: yükləmələr xətasız qəbul edilməlidir, emal işləri növbədə gözləyir.',
          scenario: { type: 'node-down', nodes: ['transcoder'] },
        },
      ],
      rules: [
        {
          id: 'peak-load',
          weight: 3,
          description:
            'Axşam pikində (saniyədə 20 000 baxış və 20 yükləmə) baxışın orta gecikməsi 30 ms-dən, yükləməninki 200 ms-dən çox deyil, həddən artıq yüklənən node, o cümlədən transcoder, və xəta yoxdur.',
          hints: [
            'Saniyədə 20 000 baxış gələndə dizaynınızın hansı node-u ilk tıxanır? Baxışın gözlədiyi ən yavaş node hansıdır?',
            'Trafik simulyasiyasını işə salın və "Darboğazlar" siyahısına baxın. Ən çox yüklənən node-ların "instances" sahəsini artırın, videoların metadata-sını cache-dən oxuyun və transcoding-i yalnız növbədən sonra edin.',
            'Bu modeldə CDN baxışların 90%-ni kənardan cavablayır, qalanı isə object store-un disklərindən gəlir (təxminən 40 ms): CDN olmadan hər baxış diski gözləyir. Hər baxış videonun səhifəsini də video servisindən alır: application service-in bir nüsxəsi saniyədə 500 sorğu emal edir, 20 000 üçün 40-dan çox nüsxə lazımdır, web server-ə isə 20-dən çox. Bir transcoder nüsxəsi saniyədə 5 rendition kodlaşdırır: 80 rendition üçün 16-dan çox nüsxə. Object store-un bir nüsxəsi 2 000 sorğu daşıyır, ona isə CDN-in cavablamadığı 2 000 baxış və 100 yazma düşür: 1-dən çox nüsxə. Metadata bazasına cache-dən keçən 4 000 oxuma çatır, SQL-in bir nüsxəsi isə 1 000 sorğu emal edir: oxumaları read replica-lar bölüşür.',
          ],
          check: { type: 'simulation', maxLatencyMs: { read: 30, write: 200 }, maxOverloadedNodes: 0, maxErrorRate: 0 },
        },
        {
          id: 'transcoders-down',
          weight: 2,
          description: 'Transcoder-lər sıradan çıxanda pikdə yükləmələr və baxışlar xətasız davam edir.',
          hints: [
            'Transcoder-lər çöksə, yükləmə edən istifadəçi xəta alırmı?',
            'Trafik simulyasiyasında "Xaos ssenarisi" siyahısından bu tapşırığı seçin. Transcoder-ə gedən hər yolun növbədən keçdiyinə əmin olun.',
            'Növbədən sonrakı iş təxirə salınmış işdir: transcoder-lər sıradan çıxanda emal işləri növbədə gözləyir (backlog), yükləmələr isə qəbul olunmağa davam edir. Videolar bir müddət "emal olunur" statusunda qalır və transcoder-lər qayıdanda yığılanları emal edir; artıq hazır videolara baxışlar isə heç nə hiss etmir.',
          ],
          check: { type: 'simulation', chaos: 'transcoders-down', maxErrorRate: 0 },
        },
        loadBalancerRule,
        scaleOutRule,
        {
          id: 'metadata-cache',
          weight: 2,
          description: 'Video servisi videoların metadata-sını cache-dən oxuyur.',
          hints: [
            'Hər baxış videonun başlığını və baxış sayını oxuyur. Populyar videonun metadata-sı hər dəfə bazadan oxunmalıdırmı?',
            'Video servisindən cache-ə oxuma xətti çəkin: cache bazanın yanında (cache-aside) və ya onun qarşısında dura bilər.',
            'Baxışlar bir neçə populyar videoya toplanır, ona görə onların metadata-sı cache-də yaxşı qalır: bu modeldə cache oxumaların 80%-ni cavablayır və bazaya yalnız qalanlar çatır. Metadata nadir dəyişir (yükləmə, status), ona görə köhnəlmə də azdır.',
          ],
          check: { type: 'path', from: 'client', to: 'cache', through: 'app-service', traffic: 'read' },
        },
        {
          id: 'transcoders-scaled',
          weight: 2,
          description: 'Transcoder-lər bir neçə nüsxədə işləyir.',
          hints: [
            'Pikdə saniyədə neçə rendition kodlaşdırılmalıdır? Tək transcoder nüsxəsi buna çatırmı?',
            'Transcoding worker-in "instances" sahəsini 2 və ya daha çox edin.',
            'Transcoder-lər stateless-dir: işi növbədən götürürlər, ona görə onları istənilən qədər artırmaq olar. Növbə pikdəki dalğanı bir anlıq udur, amma worker-lər orta hesabla yetişməsə, növbə sonsuz böyüyür və videolar saatlarla "emal olunur" statusunda qalır.',
          ],
          check: scaledOutNodes('transcoder'),
        },
        allConnectedRule('Transcode Queue → Transcoders'),
      ],
      referenceSolution: {
        nodes: [
          node('client-1', 'client', 'Viewers & Uploaders', 0, 280),
          node('cdn-1', 'cdn', 'CDN', 240, 40),
          node('load-balancer-1', 'load-balancer', 'Load Balancer', 240, 320, { instances: 2 }),
          node('web-server-1', 'web-server', 'Web Server', 480, 320, { instances: 25 }),
          node('app-service-1', 'app-service', 'Video Service', 720, 320, { instances: 50 }),
          node('cache-1', 'cache', 'Metadata Cache', 960, 180),
          node('sql-database-1', 'sql-database', 'Video Metadata', 1200, 180, { replicas: 5 }),
          node('message-queue-1', 'message-queue', 'Transcode Queue', 960, 460),
          node('transcoder-1', 'transcoder', 'Transcoders', 1200, 460, { renditions: 4, instances: 20 }),
          node('object-store-1', 'object-store', 'Video Storage', 1440, 40, { instances: 3 }),
        ],
        edges: [
          edge('client-1', 'cdn-1', 'read'),
          edge('client-1', 'load-balancer-1', 'both'),
          edge('load-balancer-1', 'web-server-1', 'both'),
          edge('web-server-1', 'app-service-1', 'both'),
          edge('app-service-1', 'cache-1', 'read'),
          edge('app-service-1', 'sql-database-1', 'both'),
          edge('app-service-1', 'object-store-1', 'write'),
          edge('app-service-1', 'message-queue-1', 'write'),
          edge('message-queue-1', 'transcoder-1', 'write'),
          edge('transcoder-1', 'object-store-1', 'write'),
          edge('cdn-1', 'object-store-1', 'read'),
        ],
      },
    },
  ],
}
