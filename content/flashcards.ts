// Authored for each card of the primer's Anki Decks: the Lessons it is about (at least one) and a
// short Azerbaijani explanation shown under the English answer. The Content Pipeline validates them
// when it builds the catalog: an unknown card or Lesson id, or a card left out, fails the build.
//
// Card ids are `<deck id>/<Anki card id>`; each entry's comment is the card's front.
import type { FlashcardInput } from '../src/core/flashcards/deck'

export const flashcards: FlashcardInput[] = [
  // System Design
  {
    // Performance vs scalability
    cardId: 'system-design/1482325088071',
    lessonIds: ['performance-vs-scalability'],
    explanation:
      'Performans problemi varsa, sistem bir istifadəçi üçün də yavaşdır. Scalability problemi varsa, sistem bir istifadəçi üçün sürətlidir, amma yük artanda yavaşlayır.',
  },
  {
    // Latency vs throughput
    cardId: 'system-design/1482325122057',
    lessonIds: ['latency-vs-throughput'],
    explanation:
      'Latency bir əməliyyatın nə qədər çəkdiyidir, throughput isə vahid zamanda neçə əməliyyat görüldüyüdür. Adətən məqsəd qəbul edilə bilən latency ilə maksimum throughput-dur.',
  },
  {
    // Consistency patterns
    cardId: 'system-design/1482325196909',
    lessonIds: ['consistency-patterns', 'weak-consistency', 'eventual-consistency', 'strong-consistency'],
    explanation:
      'Weak consistency: yazıdan sonra oxu onu görməyə də bilər. Eventual consistency: bir müddətdən sonra hamı yazını görür. Strong consistency: yazıdan dərhal sonra hər oxu onu görür.',
  },
  {
    // Availability patterns
    cardId: 'system-design/1482325241108',
    lessonIds: ['availability-patterns', 'fail-over', 'replication'],
    explanation:
      'Yüksək əlçatanlığın iki əsas yolu: fail-over (active-passive və ya active-active serverlər) və replication (master-slave və ya master-master).',
  },
  {
    // Availability vs consistency
    cardId: 'system-design/1482325270797',
    lessonIds: ['cap-theorem'],
    explanation:
      'CAP teoreminə görə şəbəkə bölünməsi (partition) zamanı ya consistency (CP), ya da availability (AP) seçilməlidir; partition tolerance-dan imtina etmək olmur.',
  },
  {
    // Domain name system
    cardId: 'system-design/1482325300393',
    lessonIds: ['domain-name-system'],
    explanation:
      'DNS www.example.com kimi adı IP ünvanına çevirir. Cavablar TTL müddətində keşlənir, bəzi DNS xidmətləri trafiki müxtəlif serverlərə də yönləndirə bilir.',
  },
  {
    // Content delivery network
    cardId: 'system-design/1482325316323',
    lessonIds: ['content-delivery-network', 'push-cdns', 'pull-cdns'],
    explanation:
      'CDN statik faylları istifadəçiyə yaxın serverlərdən verir. Push CDN-ə məzmunu özünüz yükləyirsiniz; pull CDN isə ilk sorğuda onu mənbə serverdən götürür.',
  },
  {
    // Load balancer
    cardId: 'system-design/1482325345680',
    lessonIds: ['load-balancer', 'layer-4-load-balancing', 'layer-7-load-balancing', 'horizontal-scaling'],
    explanation:
      'Load balancer sorğuları bir neçə server arasında paylayır, sağlam olmayan serverlərə trafik göndərmir və horizontal scaling-i mümkün edir. Layer 4 nəqliyyat səviyyəsində, layer 7 isə sorğunun məzmununa görə qərar verir.',
  },
  {
    // Reverse proxy (web server)
    cardId: 'system-design/1482325362705',
    lessonIds: ['reverse-proxy-web-server', 'load-balancer-vs-reverse-proxy'],
    explanation:
      'Reverse proxy daxili xidmətlərin qarşısında duran vahid giriş nöqtəsidir: təhlükəsizlik, SSL termination, sıxışdırma və keşləmə verir. Hətta tək server olanda da faydalıdır.',
  },
  {
    // Application layer
    cardId: 'system-design/1482325376455',
    lessonIds: ['application-layer', 'microservices', 'service-discovery'],
    explanation:
      'Web layer-i application layer-dən ayırmaq hər birini ayrıca scale etməyə imkan verir. Microservices tətbiqi müstəqil, kiçik xidmətlərə bölür; service discovery onların bir-birini tapmasına kömək edir.',
  },
  {
    // Database
    cardId: 'system-design/1482325415622',
    lessonIds: ['database', 'relational-database-management-system-rdbms'],
    explanation:
      'RDBMS ACID tranzaksiyaları olan cədvəl əsaslı bazadır. Onu replication, federation, sharding, denormalization və SQL tuning ilə scale etmək olar.',
  },
  {
    // Federation
    cardId: 'system-design/1482325428863',
    lessonIds: ['relational-database-management-system-rdbms'],
    explanation:
      'Federation bazanı funksiyaya görə bölür (məsələn, users, products, forums ayrı bazalarda). Hər baza daha az yük daşıyır, amma bazalar arası join çətinləşir.',
  },
  {
    // Sharding
    cardId: 'system-design/1482325442179',
    lessonIds: ['relational-database-management-system-rdbms'],
    explanation:
      'Sharding eyni cədvəlin sətirlərini bir neçə bazaya bölür (məsələn, istifadəçi id-sinə görə). Yük və həcm bölünür, amma qeyri-bərabər paylanma və shard-lar arası sorğular problem yaradır.',
  },
  {
    // Denormalization
    cardId: 'system-design/1482325454660',
    lessonIds: ['relational-database-management-system-rdbms'],
    explanation:
      'Denormalization məlumatın surətlərini bir neçə cədvəldə saxlayaraq bahalı join-lərdən qaçır. Oxu sürətlənir, yazı isə yavaşlayır və surətləri uyğun saxlamaq lazım gəlir.',
  },
  {
    // SQL tuning
    cardId: 'system-design/1482325472557',
    lessonIds: ['relational-database-management-system-rdbms'],
    explanation:
      'SQL tuning-ə ölçməklə başlamaq lazımdır (benchmark, profile). Sonra sxemi sıxlaşdırmaq, uyğun index-lər yaratmaq, bahalı join-lərdən qaçmaq və cədvəlləri bölmək olar.',
  },
  {
    // NoSQL
    cardId: 'system-design/1482325485235',
    lessonIds: ['nosql'],
    explanation:
      'NoSQL bazaları adətən BASE prinsiplərinə əsaslanır və consistency-ni availability üçün qurban verir. Əsas növləri: key-value store, document store, wide column store və graph database.',
  },
  {
    // Key-value store
    cardId: 'system-design/1482325498585',
    lessonIds: ['nosql'],
    explanation: 'Key-value store hash table kimidir: açara görə O(1) oxu və yazı verir. Sadə modellər və sürətli keş üçün uyğundur.',
  },
  {
    // Document store
    cardId: 'system-design/1482325509936',
    lessonIds: ['nosql'],
    explanation:
      'Document store dəyəri sənəd (JSON, XML) olan key-value store-dur. Sənədin daxili sahələrinə görə sorğu vermək mümkündür, sxem çevikdir.',
  },
  {
    // Wide column store
    cardId: 'system-design/1482325523677',
    lessonIds: ['nosql'],
    explanation:
      'Wide column store-da əsas vahid column-dur, column-lar column family-lərə qruplaşır. Çox böyük həcmli məlumat üçün yüksək əlçatanlıq və scalability verir (Bigtable, HBase, Cassandra).',
  },
  {
    // Graph database
    cardId: 'system-design/1482325536496',
    lessonIds: ['nosql'],
    explanation:
      'Graph database-də hər node bir qeyd, hər edge iki node arasındakı əlaqədir. Sosial şəbəkə kimi çoxlu mürəkkəb əlaqəsi olan məlumat üçün uyğundur.',
  },
  {
    // SQL or NoSQL
    cardId: 'system-design/1482325548729',
    lessonIds: ['sql-or-nosql'],
    explanation:
      'SQL strukturlaşmış, əlaqəli məlumat, ciddi sxem və tranzaksiyalar üçün seçilir. NoSQL yarı strukturlaşmış məlumat, çevik sxem, çox yüksək throughput və asan horizontal scaling lazım olanda seçilir.',
  },
  {
    // Cache
    cardId: 'system-design/1482325571720',
    lessonIds: ['cache'],
    explanation:
      'Keş tez-tez oxunan məlumatı sürətli yaddaşda saxlayır: səhifələr tez açılır, server və bazanın yükü azalır. Məlumat bazada dəyişəndə keşin köhnəlməsi əsas çətinlikdir.',
  },
  {
    // Cache locations
    cardId: 'system-design/1482325630862',
    lessonIds: ['client-caching', 'cdn-caching', 'web-server-caching', 'database-caching', 'application-caching'],
    explanation:
      'Keş bir neçə yerdə ola bilər: klientdə (OS, brauzer), CDN-də, web serverdə (reverse proxy), bazanın özündə və tətbiq səviyyəsində (Memcached, Redis).',
  },
  {
    // Database caching, what to cache
    cardId: 'system-design/1482325651846',
    lessonIds: ['caching-at-the-database-query-level', 'caching-at-the-object-level'],
    explanation:
      'Sorğu nəticəsini keşləmək sadədir, amma bir xana dəyişəndə hansı nəticələri silmək lazım olduğunu bilmək çətindir. Obyekt səviyyəsində keşləmə (məsələn, hazır istifadəçi profili) bunu asanlaşdırır.',
  },
  {
    // Cache-aside
    cardId: 'system-design/1482325682414',
    lessonIds: ['when-to-update-the-cache'],
    explanation:
      'Cache-aside-da tətbiq əvvəlcə keşə baxır; tapmasa bazadan oxuyur və nəticəni keşə yazır. Yalnız lazım olan məlumat keşlənir, amma hər keş miss üç addım çəkir.',
  },
  {
    // Write-through
    cardId: 'system-design/1482325695806',
    lessonIds: ['when-to-update-the-cache'],
    explanation:
      'Write-through-da yazı keşə gedir, keş də onu dərhal bazaya yazır. Keşdəki məlumat köhnəlmir, amma hər yazı yavaşlayır.',
  },
  {
    // Write-behind (write-back)
    cardId: 'system-design/1482325708199',
    lessonIds: ['when-to-update-the-cache'],
    explanation:
      'Write-behind-da yazı keşə gedir, bazaya isə sonradan, asinxron yazılır. Yazı sürətlidir, amma keş bazaya yazmadan sıradan çıxsa məlumat itə bilər.',
  },
  {
    // Refresh-ahead
    cardId: 'system-design/1482325719168',
    lessonIds: ['when-to-update-the-cache'],
    explanation:
      'Refresh-ahead keşdəki məlumatı vaxtı bitməzdən əvvəl avtomatik yeniləyir. Hansı məlumatın lazım olacağı düzgün təxmin edilsə, latency azalır.',
  },
  {
    // Asynchronism
    cardId: 'system-design/1482325739496',
    lessonIds: ['asynchronism', 'message-queues', 'task-queues', 'back-pressure'],
    explanation:
      'Uzun işləri message queue və ya task queue ilə arxa plana keçirmək sorğuları sürətləndirir. Növbə dolanda back-pressure yeni işləri məhdudlaşdırır.',
  },
  {
    // Communication
    cardId: 'system-design/1482325756376',
    lessonIds: ['communication'],
    explanation: 'OSI modeli şəbəkə ünsiyyətini yeddi səviyyəyə bölür; HTTP application layer-də, TCP və UDP isə transport layer-də işləyir.',
  },
  {
    // Hypertext transfer protocol (HTTP)
    cardId: 'system-design/1482325781426',
    lessonIds: ['hypertext-transfer-protocol-http'],
    explanation:
      'HTTP klient və server arasında request/response protokoludur. Sorğuda metod (GET, POST, PUT, DELETE…) olur, cavabda status kodu və məzmun.',
  },
  {
    // Transmission control protocol (TCP)
    cardId: 'system-design/1482325795272',
    lessonIds: ['transmission-control-protocol-tcp'],
    explanation:
      'TCP connection əsaslıdır: paketlərin çatmasına, sırasına və bütövlüyünə zəmanət verir, itən paketi yenidən göndərir. Etibarlılıq lazım olanda seçilir, amma UDP-dən yavaşdır.',
  },
  {
    // User datagram protocol (UDP)
    cardId: 'system-design/1482325827018',
    lessonIds: ['user-datagram-protocol-udp'],
    explanation:
      'UDP connection qurmur və çatmağa zəmanət vermir, ona görə daha sürətlidir. Səs, video və oyunlar kimi ən aşağı latency lazım olan, bir az itkiyə dözən hallar üçün uyğundur.',
  },
  {
    // Remote procedure call (RPC)
    cardId: 'system-design/1482325872945',
    lessonIds: ['remote-procedure-call-rpc'],
    explanation:
      'RPC başqa serverdəki proseduru lokal funksiya kimi çağırmağa imkan verir. Daxili xidmətlər arasında performans üçün yaxşıdır, amma klient ilə server sıx bağlı olur.',
  },
  {
    // Representational state transfer (REST)
    cardId: 'system-design/1482325887664',
    lessonIds: ['representational-state-transfer-rest'],
    explanation:
      'REST resursları URI-lərlə ifadə edir və onlar üzərində HTTP metodları ilə işləyir. Stateless-dir, klientlə server arasındakı bağlılığı azaldır və açıq API-lər üçün geniş istifadə olunur.',
  },
  {
    // Security
    cardId: 'system-design/1482325917758',
    lessonIds: ['security'],
    explanation:
      'Əsaslar: məlumatı ötürərkən və saxlayarkən şifrələmək, istifadəçi girişini təmizləmək (XSS, SQL injection), parametrli sorğular və least privilege prinsipi.',
  },
  {
    // Powers of two table
    cardId: 'system-design/1482325934721',
    lessonIds: ['powers-of-two-table'],
    explanation: 'Təxmini hesablamalar üçün: 2^10 ≈ 1 thousand (1 KB), 2^20 ≈ 1 million (1 MB), 2^30 ≈ 1 billion (1 GB), 2^40 ≈ 1 trillion (1 TB).',
  },
  {
    // Latency numbers every programmer should know
    cardId: 'system-design/1482325974268',
    lessonIds: ['latency-numbers-every-programmer-should-know'],
    explanation:
      'Yaddaşdan oxu diskdən çox-çox sürətlidir, eyni data center daxilində round trip isə qitələr arası round trip-dən təxminən min dəfə qısadır. Bu rəqəmlər dizaynda hansı addımın bahalı olduğunu göstərir.',
  },
  {
    // MD5
    cardId: 'system-design/1482946339267',
    lessonIds: ['design-pastebincom-or-bitly'],
    explanation: 'MD5 128 bitlik hash verən, nəticələri bərabər paylanan hash funksiyasıdır. Pastebin həllində qısa URL yaratmaq üçün istifadə olunur.',
  },
  {
    // Base 62
    cardId: 'system-design/1482946355352',
    lessonIds: ['design-pastebincom-or-bitly'],
    explanation:
      'Base 62 [a-zA-Z0-9] simvolları ilə kodlaşdırır, ona görə URL-də xüsusi simvolları escape etmək lazım gəlmir. Eyni girişdən həmişə eyni nəticə alınır.',
  },
  {
    // What is HATEOAS?
    cardId: 'system-design/1483674215957',
    lessonIds: ['representational-state-transfer-rest'],
    explanation:
      'HATEOAS-da serverin cavabı növbəti mümkün əməliyyatların linklərini də verir. Klient URI-ləri əvvəlcədən bilmədən API-ni bu linklər üzrə gəzə bilir.',
  },
  {
    // RPC and REST calls comparison
    cardId: 'system-design/1488947467920',
    lessonIds: ['rpc-and-rest-calls-comparison'],
    explanation:
      'RPC əməliyyatı adla çağırır (POST /signup, POST /resign), REST isə resurs üzərində HTTP metodu işlədir (POST /persons, DELETE /persons/1234).',
  },

  // System Design Exercises
  {
    // Design Mint.com
    cardId: 'system-design-exercises/1482326031680',
    lessonIds: ['design-mintcom'],
    explanation:
      'Əsas məqamlar: bank hesablarından əməliyyatları asinxron çəkmək, xərcləri kateqoriyalara bölmək və büdcə həddi keçiləndə xəbərdarlıq göndərmək.',
  },
  {
    // Design Pastebin.com (or Bit.ly)
    cardId: 'system-design-exercises/1482326048921',
    lessonIds: ['design-pastebincom-or-bitly'],
    explanation:
      'Əsas məqamlar: unikal qısa link yaratmaq (MD5 + Base 62), məzmunu object store-da saxlamaq və oxu çox olduğu üçün keş və read replica-lardan istifadə etmək.',
  },
  {
    // Design Amazon's sales rank by category feature
    cardId: 'system-design-exercises/1482326065427',
    lessonIds: ['design-amazons-sales-ranking-by-category-feature'],
    explanation:
      'Əsas məqamlar: satış loglarını MapReduce ilə kateqoriya və məhsul üzrə toplamaq, nəticəni hazır cədvəldə saxlamaq və tez-tez oxunan sıralamanı keşləmək.',
  },
  {
    // Design a web crawler
    cardId: 'system-design-exercises/1482326082310',
    lessonIds: ['design-a-web-crawler'],
    explanation:
      'Əsas məqamlar: gəziləcək linkləri prioritetli növbədə saxlamaq, eyni səhifəni yenidən gəzməmək üçün təkrarları aşkar etmək və axtarış üçün reverse index qurmaq.',
  },
  {
    // Design the data structures for a social network
    cardId: 'system-design-exercises/1482326097231',
    lessonIds: ['design-the-data-structures-for-a-social-network'],
    explanation:
      'Əsas məqamlar: iki istifadəçi arasında ən qısa yolu BFS ilə tapmaq; istifadəçilər çox olanda onları serverlərə shard etmək və lookup service ilə harada olduqlarını tapmaq.',
  },
  {
    // Design the Twitter timeline and search
    cardId: 'system-design-exercises/1482326111151',
    lessonIds: ['design-the-twitter-timeline-and-search-or-facebook-feed-and-search'],
    explanation:
      'Əsas məqamlar: tweet-i izləyicilərin timeline-larına yazmaq (fan-out), timeline-ları keşdə saxlamaq və axtarışı bir neçə search cluster arasında paylamaq (scatter-gather).',
  },
  {
    // Design a key-value cache to save the results of the most recent web server queries
    cardId: 'system-design-exercises/1482326143458',
    lessonIds: ['design-a-key-value-store-for-a-search-engine'],
    explanation:
      'Əsas məqamlar: LRU keş (hash table + doubly linked list) ilə ən son sorğuların nəticələrini saxlamaq, keşi bir neçə maşın arasında bölmək və nə vaxt yeniləmək lazım olduğuna qərar vermək.',
  },
  {
    // Design a system that scales to millions of users on AWS
    cardId: 'system-design-exercises/1482326161319',
    lessonIds: ['design-a-system-that-scales-to-millions-of-users-on-aws'],
    explanation:
      'Əsas məqamlar: tək serverdən başlayıb darboğazları bir-bir aradan qaldırmaq: bazanı ayırmaq, statik faylları CDN-ə köçürmək, load balancer, read replica, keş və autoscaling əlavə etmək.',
  },

  // OO Design
  {
    // Design a deck of cards
    cardId: 'oo-design/1484864994371',
    lessonIds: ['object-oriented-design-interview-questions-with-solutions'],
    explanation: 'Əsas məqamlar: ümumi Card və Deck class-ları, oyuna xas qaydalar üçün onlardan törəyən class-lar (məsələn, BlackJackCard).',
  },
  {
    // Design a call center
    cardId: 'oo-design/1484865025096',
    lessonIds: ['object-oriented-design-interview-questions-with-solutions'],
    explanation:
      'Əsas məqamlar: Employee base class-ı və ondan törəyən Operator, Supervisor, Director; zəngi cavab verə bilməyən işçidən bir üst səviyyəyə ötürmək.',
  },
  {
    // Design a hash map
    cardId: 'oo-design/1484865054751',
    lessonIds: ['object-oriented-design-interview-questions-with-solutions'],
    explanation: 'Əsas məqamlar: açarın hash-inə görə bucket seçmək və toqquşmaları chaining ilə (hər bucket-də siyahı) həll etmək.',
  },
  {
    // Design an LRU cache
    cardId: 'oo-design/1484865075215',
    lessonIds: ['object-oriented-design-interview-questions-with-solutions'],
    explanation:
      'Əsas məqamlar: hash table O(1) axtarış, doubly linked list isə ən son istifadə sırasını verir; keş dolanda siyahının sonundakı element silinir.',
  },
  {
    // Design an online chat
    cardId: 'oo-design/1486849877916',
    lessonIds: ['object-oriented-design-interview-questions-with-solutions'],
    explanation: 'Əsas məqamlar: User, Chat (fərdi və qrup), Message və dostluq sorğuları üçün class-lar, onları idarə edən UserService.',
  },
  {
    // Design a parking lot
    cardId: 'oo-design/1486853316037',
    lessonIds: ['object-oriented-design-interview-questions-with-solutions'],
    explanation:
      'Əsas məqamlar: Vehicle base class-ı (Motorcycle, Car, Bus) və ölçüyə görə yerlər; ParkingLot → Level → ParkingSpot iyerarxiyası, avtobus bir neçə ardıcıl yer tutur.',
  },
]
