// Authored Glossary Terms. The Content Pipeline validates them when it builds the catalog: a schema
// error or an unknown Lesson id fails the build. Explanations are Azerbaijani; terms stay English.
//
// In Lesson text a term matches by its name or any alias, ignoring case, as a whole word and with a
// plural ending ("caches"). A name or alias written in capitals (REST, BASE) matches in capitals only.
import type { GlossaryTermInput } from '../src/core/glossary/glossary'

export const glossary: GlossaryTermInput[] = [
  // Performance, availability and consistency
  {
    term: 'Performance',
    explanation: 'Sistemin tək sorğunu nə qədər sürətli emal etdiyi. Performans problemi bir istifadəçi üçün də sistemi yavaş edir.',
    lessonIds: ['performance-vs-scalability'],
  },
  {
    term: 'Scalability',
    aliases: ['scalable'],
    explanation: 'Sistemin resurs əlavə etdikdə daha çox yükü eyni performansla qəbul edə bilməsi.',
    lessonIds: ['performance-vs-scalability'],
  },
  {
    term: 'Latency',
    explanation: 'Bir əməliyyatın başlanğıcından nəticəsinə qədər keçən vaxt (məsələn, sorğunun cavabını gözləmə müddəti).',
    lessonIds: ['latency-vs-throughput', 'latency-numbers-every-programmer-should-know'],
  },
  {
    term: 'Throughput',
    explanation: 'Sistemin vahid zamanda emal etdiyi iş həcmi, məsələn, saniyədə sorğu sayı.',
    lessonIds: ['latency-vs-throughput'],
  },
  {
    term: 'Availability',
    explanation: 'Sistemin istənilən an sorğulara cavab verə bilməsi; adətən faizlə, "doqquzlarla" ölçülür (99.9%, 99.99%).',
    lessonIds: ['availability-patterns', 'availability-in-numbers'],
  },
  {
    term: 'CAP theorem',
    aliases: ['CAP'],
    explanation:
      'Paylanmış sistemdə şəbəkə bölünməsi olduqda consistency və availability-dən yalnız birini təmin etmək olar. Ona görə seçim CP ilə AP arasındadır.',
    lessonIds: ['cap-theorem'],
  },
  {
    term: 'Partition tolerance',
    explanation: 'Node-lar arasında əlaqə kəsiləndə (network partition) belə sistemin işləməyə davam etməsi.',
    lessonIds: ['cap-theorem'],
  },
  {
    term: 'Consistency',
    explanation: 'Hər oxumanın ən son yazını görməsi (və ya xəta qaytarması). Zəmanətin gücünə görə weak, eventual və strong consistency var.',
    lessonIds: ['consistency-patterns', 'cap-theorem'],
  },
  {
    term: 'Weak consistency',
    explanation: 'Yazmadan sonra oxuma yeni dəyəri görə də bilər, görməyə də. Sistem buna zəmanət vermir (məsələn, VoIP, canlı video).',
    lessonIds: ['weak-consistency'],
  },
  {
    term: 'Eventual consistency',
    explanation: 'Yazmadan sonra oxumalar bir müddət köhnə dəyəri görə bilər, amma məlumat bir qədər sonra bütün replikalarda eyniləşir.',
    lessonIds: ['eventual-consistency'],
  },
  {
    term: 'Strong consistency',
    explanation: 'Yazmadan dərhal sonra bütün oxumalar yeni dəyəri görür. Məlumat sinxron replikasiya olunur.',
    lessonIds: ['strong-consistency'],
  },
  {
    term: 'Quorum',
    explanation:
      'Əməliyyatın uğurlu sayılması üçün təsdiq verməli olan replikaların minimum sayı (adətən çoxluq). Oxuma və yazma quorum-ları kəsişəndə oxuma ən son yazını görür.',
    lessonIds: ['replication', 'strong-consistency'],
  },
  {
    term: 'Fail-over',
    aliases: ['failover'],
    explanation: 'Əsas server sıradan çıxanda işin avtomatik olaraq ehtiyat serverə keçirilməsi.',
    lessonIds: ['fail-over'],
  },
  {
    term: 'Active-passive',
    explanation:
      'Fail-over üsulu: aktiv server işləyir, passiv server heartbeat ilə onu izləyir və heartbeat kəsiləndə onun yerini tutur.',
    lessonIds: ['fail-over'],
  },
  {
    term: 'Active-active',
    explanation: 'Fail-over üsulu: hər iki server eyni vaxtda trafik qəbul edir və yükü bölüşür.',
    lessonIds: ['fail-over'],
  },
  {
    term: 'Heartbeat',
    explanation: 'Serverlərin bir-birinə müntəzəm göndərdiyi "sağam" siqnalı. Siqnal kəsiləndə server sıradan çıxmış sayılır.',
    lessonIds: ['fail-over'],
  },
  {
    term: 'Single point of failure',
    explanation: 'Sıradan çıxanda bütün sistemi dayandıran tək komponent. Onu təkrarlamaqla (redundancy) aradan qaldırırlar.',
    lessonIds: ['load-balancer', 'disadvantages-load-balancer'],
  },
  {
    term: 'Replication',
    explanation: 'Eyni məlumatın bir neçə serverdə surətinin saxlanması; availability-ni və oxuma tutumunu artırır.',
    lessonIds: ['replication', 'relational-database-management-system-rdbms'],
  },
  {
    term: 'Replica',
    aliases: ['read replica'],
    explanation: 'Əsas verilənlər bazasının surəti. Adətən oxumalara xidmət edir, yazmalar isə əsas serverə (master) gedir.',
    lessonIds: ['replication', 'relational-database-management-system-rdbms'],
  },
  {
    term: 'Master-slave replication',
    explanation: 'Master oxuma və yazmalara xidmət edir, yazmaları slave-lərə köçürür. Slave-lər yalnız oxumalara cavab verir.',
    lessonIds: ['relational-database-management-system-rdbms', 'replication'],
  },
  {
    term: 'Master-master replication',
    explanation: 'Hər iki master oxuma və yazmaları qəbul edir və dəyişiklikləri bir-biri ilə sinxronlaşdırır.',
    lessonIds: ['relational-database-management-system-rdbms', 'replication'],
  },

  // Network edge
  {
    term: 'Domain Name System',
    aliases: ['DNS'],
    explanation: 'Domen adını (www.example.com) IP ünvanına çevirən paylanmış ad sistemi.',
    lessonIds: ['domain-name-system'],
  },
  {
    term: 'Time to live',
    aliases: ['TTL'],
    explanation: 'Keşlənmiş qeydin nə qədər müddət etibarlı sayıldığı. Bu müddət bitəndə qeyd yenidən mənbədən alınır.',
    lessonIds: ['domain-name-system', 'pull-cdns', 'when-to-update-the-cache'],
  },
  {
    term: 'Content delivery network',
    aliases: ['CDN'],
    explanation: 'Statik faylları (şəkil, CSS, JS, video) istifadəçiyə yaxın serverlərdən paylayan qlobal proxy server şəbəkəsi.',
    lessonIds: ['content-delivery-network', 'cdn-caching'],
  },
  {
    term: 'Push CDN',
    explanation: 'Məzmun dəyişəndə onu CDN-ə özünüz yükləyirsiniz. Az trafikli və nadir dəyişən saytlar üçün uyğundur.',
    lessonIds: ['push-cdns'],
  },
  {
    term: 'Pull CDN',
    explanation: 'CDN məzmunu ilk sorğuda sizin serverinizdən özü götürür və TTL bitənə qədər keşdə saxlayır.',
    lessonIds: ['pull-cdns'],
  },

  // Load balancing and proxies
  {
    term: 'Load balancer',
    aliases: ['load balancing'],
    explanation: 'Gələn sorğuları bir neçə server arasında bölən komponent; tək serverin yüklənməsinin və sıradan çıxmasının qarşısını alır.',
    lessonIds: ['load-balancer'],
  },
  {
    term: 'Rate limiter',
    aliases: ['rate limiting', 'throttling'],
    explanation:
      'Bir client-in müəyyən müddətdə göndərə biləcəyi sorğuların sayını məhdudlaşdıran komponent. Limiti keçən sorğular dərhal rədd edilir (HTTP 429 Too Many Requests), beləliklə servis sui-istifadədən və qəfil yükdən qorunur.',
    lessonIds: ['additional-system-design-interview-questions'],
  },
  {
    term: 'Layer 4 load balancing',
    aliases: ['Layer 4'],
    explanation: 'Transport səviyyəsində (IP ünvanı, port) qərar verən load balancing. Paketin məzmununa baxmır.',
    lessonIds: ['layer-4-load-balancing'],
  },
  {
    term: 'Layer 7 load balancing',
    aliases: ['Layer 7'],
    explanation: 'Application səviyyəsində (URL, header, cookie) qərar verən load balancing. Daha çevikdir, amma daha çox hesablama tələb edir.',
    lessonIds: ['layer-7-load-balancing'],
  },
  {
    term: 'Round robin',
    explanation: 'Sorğuları serverlərə növbə ilə, bir-bir paylayan sadə alqoritm.',
    lessonIds: ['load-balancer'],
  },
  {
    term: 'Session persistence',
    aliases: ['sticky session'],
    explanation: 'Eyni istifadəçinin sorğularının həmişə eyni serverə yönləndirilməsi.',
    lessonIds: ['load-balancer'],
  },
  {
    term: 'SSL termination',
    explanation: 'HTTPS trafikinin load balancer və ya reverse proxy-də deşifrə edilməsi; arxadakı serverlər bu işdən azad olur.',
    lessonIds: ['load-balancer', 'reverse-proxy-web-server'],
  },
  {
    term: 'Horizontal scaling',
    aliases: ['scaling horizontally', 'scale horizontally', 'scale out'],
    explanation: 'Daha çox server əlavə edərək miqyaslama. Adi serverlərlə ucuz başa gəlir, amma serverlər stateless olmalıdır.',
    lessonIds: ['horizontal-scaling'],
  },
  {
    term: 'Vertical scaling',
    aliases: ['scaling up', 'scale up', 'scaling vertically', 'scale vertically'],
    explanation: 'Mövcud serveri gücləndirərək (daha çox CPU, RAM) miqyaslama. Sadədir, amma bahalıdır və bir həddi var.',
    lessonIds: ['horizontal-scaling'],
  },
  {
    term: 'Reverse proxy',
    explanation:
      'Daxili serverlərin qarşısında duran web server: sorğuları qəbul edib onlara ötürür. Təhlükəsizlik, keşləmə, sıxılma və SSL termination üçün istifadə olunur.',
    lessonIds: ['reverse-proxy-web-server', 'load-balancer-vs-reverse-proxy'],
  },
  {
    term: 'Web server',
    explanation: 'HTTP sorğularını qəbul edib cavab qaytaran server (məsələn, NGINX, Apache).',
    lessonIds: ['reverse-proxy-web-server'],
  },
  {
    term: 'Client',
    explanation: 'Sistemə sorğu göndərən tərəf: brauzer, mobil tətbiq və ya başqa servis. Dizaynda trafik klientdən başlayır.',
    lessonIds: ['load-balancer', 'hypertext-transfer-protocol-http'],
  },

  // Application layer
  {
    term: 'Application layer',
    aliases: ['platform layer'],
    explanation: 'Biznes məntiqini web serverlərdən ayrı saxlayan qat; web və application serverlərini ayrı-ayrılıqda miqyaslamağa imkan verir.',
    lessonIds: ['application-layer'],
  },
  {
    term: 'Microservices',
    aliases: ['microservice'],
    explanation: 'Tətbiqin müstəqil yerləşdirilən kiçik servislərə bölünməsi. Hər servis bir işə cavabdehdir və şəbəkə üzərindən əlaqə saxlayır.',
    lessonIds: ['microservices'],
  },
  {
    term: 'Service discovery',
    explanation: 'Servislərin bir-birinin ünvanını mərkəzi reyestrdən (məsələn, Consul, Etcd, Zookeeper) tapması.',
    lessonIds: ['service-discovery'],
  },
  {
    term: 'Coordination service',
    aliases: ['ZooKeeper'],
    explanation:
      'Paylanmış sistemin node-larına ortaq, ardıcıl (consistent) vəziyyət verən kiçik klaster (məsələn, ZooKeeper, etcd): konfiqurasiya, leader election, lock və worker id kimi unikal nömrələrin paylanması. Hər sorğu üçün yox, nadir koordinasiya üçün istifadə olunur.',
    lessonIds: ['service-discovery', 'additional-system-design-interview-questions'],
  },

  // Databases
  {
    term: 'Relational database management system',
    aliases: ['RDBMS', 'relational database'],
    explanation: 'Məlumatı cədvəllərdə saxlayan, SQL ilə sorğulanan və ACID tranzaksiyaları dəstəkləyən verilənlər bazası.',
    lessonIds: ['relational-database-management-system-rdbms'],
  },
  {
    term: 'SQL',
    explanation: 'Relational verilənlər bazalarının sorğu dili; geniş mənada relational verilənlər bazasının özü.',
    lessonIds: ['relational-database-management-system-rdbms', 'sql-or-nosql'],
  },
  {
    term: 'ACID',
    explanation:
      'Tranzaksiyaların dörd xassəsi: Atomicity (hamısı və ya heç biri), Consistency (etibarlı vəziyyət), Isolation (paralel tranzaksiyalar bir-birinə qarışmır), Durability (təsdiqlənən dəyişiklik itmir).',
    lessonIds: ['relational-database-management-system-rdbms'],
  },
  {
    term: 'NoSQL',
    explanation: 'Relational olmayan verilənlər bazaları: key-value, document, wide column və graph. Adətən consistency əvəzinə availability seçirlər.',
    lessonIds: ['nosql', 'sql-or-nosql'],
  },
  {
    term: 'BASE',
    explanation: 'NoSQL sistemlərinin xassələri: Basically Available, Soft state, Eventual consistency. ACID-ə alternativdir.',
    lessonIds: ['nosql'],
  },
  {
    term: 'Federation',
    aliases: ['functional partitioning'],
    explanation: 'Verilənlər bazasını funksiyaya görə bölmək: məsələn, users, forums və products üçün ayrı-ayrı bazalar.',
    lessonIds: ['relational-database-management-system-rdbms'],
  },
  {
    term: 'Sharding',
    aliases: ['shard'],
    explanation:
      'Məlumatı sətirlərə görə bir neçə verilənlər bazasına bölmək. Hər shard məlumatın bir hissəsini saxlayır (məsələn, istifadəçilər soyadına görə).',
    lessonIds: ['relational-database-management-system-rdbms'],
  },
  {
    term: 'Consistent hashing',
    explanation: 'Server əlavə ediləndə və ya çıxarılanda açarların yalnız az hissəsini yerini dəyişməyə məcbur edən hashing üsulu.',
    lessonIds: ['relational-database-management-system-rdbms'],
  },
  {
    term: 'Denormalization',
    aliases: ['denormalize', 'denormalized'],
    explanation: 'Bahalı join-lardan qaçmaq üçün məlumatın bir neçə cədvəldə təkrar saxlanması. Oxuma sürətlənir, yazma isə çətinləşir.',
    lessonIds: ['relational-database-management-system-rdbms'],
  },
  {
    term: 'SQL tuning',
    explanation: 'Sxemi, indeksləri və sorğuları ölçüb təkmilləşdirərək relational verilənlər bazasının performansını artırmaq.',
    lessonIds: ['relational-database-management-system-rdbms'],
  },
  {
    term: 'Key-value store',
    explanation: 'Məlumatı açar–dəyər cütləri kimi saxlayan NoSQL bazası; O(1) oxuma və yazma verir (məsələn, Redis, Memcached).',
    lessonIds: ['nosql'],
  },
  {
    term: 'Document store',
    explanation: 'Məlumatı JSON kimi sənədlərdə saxlayan və sənədin içindəki sahələrə görə sorğulamağa imkan verən NoSQL bazası (məsələn, MongoDB).',
    lessonIds: ['nosql'],
  },
  {
    term: 'Wide column store',
    explanation: 'Məlumatı sütun ailələrində saxlayan, çox böyük həcm üçün nəzərdə tutulmuş NoSQL bazası (məsələn, Cassandra, HBase).',
    lessonIds: ['nosql'],
  },
  {
    term: 'Graph database',
    explanation: 'Məlumatı node və əlaqələr (edge) kimi saxlayan baza; sosial şəbəkə kimi çox-çoxa əlaqələr üçün əlverişlidir.',
    lessonIds: ['nosql'],
  },
  {
    term: 'Object store',
    aliases: ['object storage'],
    explanation: 'Faylları (şəkil, video, mətn) açarla obyekt kimi saxlayan və çox böyük həcmə ucuz miqyaslanan anbar (məsələn, Amazon S3).',
    lessonIds: ['design-pastebincom-or-bitly', 'design-a-system-that-scales-to-millions-of-users-on-aws'],
  },
  {
    term: 'Search index',
    explanation: 'Mətni sözlərə görə indeksləyib tam mətn axtarışını sürətli edən anbar (məsələn, Elasticsearch, Lucene).',
    lessonIds: ['design-the-twitter-timeline-and-search-or-facebook-feed-and-search', 'design-a-key-value-store-for-a-search-engine'],
  },

  // Caching
  {
    term: 'Cache',
    aliases: ['caching'],
    explanation: 'Tez-tez lazım olan məlumatın sürətli yaddaşda saxlanması. Sorğu yavaş mənbəyə (məsələn, verilənlər bazasına) getmir.',
    lessonIds: ['cache'],
  },
  {
    term: 'Cache-aside',
    aliases: ['lazy loading'],
    explanation:
      'Tətbiq əvvəlcə keşə baxır. Məlumat keşdə yoxdursa, onu bazadan oxuyur və keşə yazır. Keşdə yalnız soruşulan məlumat olur.',
    lessonIds: ['when-to-update-the-cache'],
  },
  {
    term: 'Write-through',
    explanation: 'Hər yazma keşə gedir, keş isə onu sinxron olaraq bazaya yazır. Keş həmişə aktualdır, amma yazma yavaşlayır.',
    lessonIds: ['when-to-update-the-cache'],
  },
  {
    term: 'Write-behind',
    aliases: ['write-back'],
    explanation: 'Yazma keşə gedir, bazaya isə sonra, asinxron yazılır. Yazma sürətlidir, amma keş itəndə məlumat itə bilər.',
    lessonIds: ['when-to-update-the-cache'],
  },
  {
    term: 'Refresh-ahead',
    explanation: 'Keş tez-tez istifadə olunan qeydləri vaxtı bitməzdən əvvəl özü yeniləyir, beləliklə oxumada gecikmə olmur.',
    lessonIds: ['when-to-update-the-cache'],
  },
  {
    term: 'Cache invalidation',
    explanation: 'Mənbədəki məlumat dəyişəndə keşdəki köhnə surətin silinməsi və ya yenilənməsi; keşləmənin ən çətin hissəsidir.',
    lessonIds: ['disadvantages-cache', 'application-caching'],
  },
  {
    term: 'Least recently used',
    aliases: ['LRU'],
    explanation: 'Keş dolanda ən çoxdan istifadə olunmamış qeydi silən eviction siyasəti.',
    lessonIds: ['application-caching'],
  },
  {
    term: 'Memcached',
    explanation: 'Məlumatı RAM-da açar–dəyər kimi saxlayan paylanmış keş sistemi.',
    lessonIds: ['application-caching'],
  },
  {
    term: 'Redis',
    explanation: 'RAM-da işləyən key-value store. Keşdən əlavə persistence, siyahı və sorted set kimi strukturlar, həmçinin message broker imkanları verir.',
    lessonIds: ['application-caching', 'message-queues'],
  },

  // Asynchronism
  {
    term: 'Asynchronism',
    aliases: ['asynchronous'],
    explanation: 'Uzun çəkən işi sorğunun axınından çıxarıb arxa planda görmək; istifadəçi nəticəni gözləməli olmur.',
    lessonIds: ['asynchronism'],
  },
  {
    term: 'Message queue',
    explanation: 'Mesajları qəbul edib saxlayan və onları emal edəcək servislərə ötürən növbə (məsələn, RabbitMQ, Amazon SQS).',
    lessonIds: ['message-queues'],
  },
  {
    term: 'Task queue',
    explanation: 'Tapşırıqları və onların məlumatlarını qəbul edib worker-lərdə icra edən növbə (məsələn, Celery).',
    lessonIds: ['task-queues'],
  },
  {
    term: 'Back pressure',
    explanation: 'Növbə dolanda yeni sorğuları rədd etmək (məsələn, HTTP 503). İstifadəçi sonra yenidən cəhd edir və sistem həddən artıq yüklənmir.',
    lessonIds: ['back-pressure'],
  },
  {
    term: 'Fan-out',
    aliases: ['fan out', 'fan-out on write', 'fan-out on read'],
    explanation:
      'Bir sorğunu çoxlu nüsxəyə çevirib bir çox yerə göndərmək: məsələn, yeni postu bütün izləyicilərin lentinə yazmaq (fan-out on write, push model) və ya lenti oxuyanda izlənilən hər hesabın postlarını yığmaq (fan-out on read, pull model). Biri yazmanı, digəri oxumanı bahalaşdırır.',
    lessonIds: ['design-the-twitter-timeline-and-search-or-facebook-feed-and-search', 'asynchronism'],
  },
  {
    term: 'Push notification service',
    aliases: ['APNs', 'FCM'],
    explanation:
      'Bildirişi istifadəçinin cihazına çatdıran üçüncü tərəf provayderi: iOS üçün Apple Push Notification service (APNs), Android üçün Firebase Cloud Messaging (FCM); SMS və e-poçt üçün də oxşar provayderlər var (məsələn, Twilio, SendGrid). Datacenter-dən kənarda olduğu üçün ona növbə vasitəsilə, asinxron müraciət edilir.',
    lessonIds: ['asynchronism', 'message-queues'],
  },

  // Communication
  {
    term: 'HTTP',
    aliases: ['Hypertext transfer protocol'],
    explanation: 'Klient və server arasında sorğu–cavab modelində məlumat ötürən application səviyyəsi protokolu.',
    lessonIds: ['hypertext-transfer-protocol-http'],
  },
  {
    term: 'TCP',
    aliases: ['Transmission control protocol'],
    explanation: 'Əlaqə quraraq paketlərin itkisiz və ardıcıl çatdırılmasına zəmanət verən transport protokolu.',
    lessonIds: ['transmission-control-protocol-tcp'],
  },
  {
    term: 'UDP',
    aliases: ['User datagram protocol'],
    explanation: 'Əlaqəsiz, çatdırılmaya zəmanət verməyən, amma daha sürətli transport protokolu; VoIP, oyun və video axını üçün uyğundur.',
    lessonIds: ['user-datagram-protocol-udp'],
  },
  {
    term: 'WebSocket',
    aliases: ['WebSockets'],
    explanation:
      'Bir TCP bağlantısı üzərində client ilə server arasında daimi, iki istiqamətli kanal. Bağlantı bir dəfə qurulur və açıq qalır, ona görə server yeni mesajı client soruşmadan dərhal göndərə bilər; HTTP polling-dəki boş sorğular olmur. Chat, canlı bildiriş və oyunlar üçün istifadə olunur.',
    lessonIds: ['communication', 'transmission-control-protocol-tcp'],
  },
  {
    term: 'RPC',
    aliases: ['Remote procedure call'],
    explanation: 'Uzaq serverdəki funksiyanı lokal funksiya kimi çağırmaq (məsələn, gRPC, Thrift).',
    lessonIds: ['remote-procedure-call-rpc', 'rpc-and-rest-calls-comparison'],
  },
  {
    term: 'REST',
    aliases: ['Representational state transfer'],
    explanation: 'API-ni resurslar və standart HTTP metodları (GET, POST, PUT, DELETE) üzərində quran memarlıq üslubu. Sorğular stateless olur.',
    lessonIds: ['representational-state-transfer-rest', 'rpc-and-rest-calls-comparison'],
  },

  // Data processing
  {
    term: 'MapReduce',
    explanation: 'Böyük həcmli məlumatı çox maşında paralel emal etmə modeli: map addımı hissələri ayrıca emal edir, reduce addımı nəticələri birləşdirir (məsələn, Hadoop).',
    lessonIds: ['real-world-architectures', 'under-development'],
  },
  {
    term: 'Data warehouse',
    explanation: 'Analitika və hesabatlar üçün bir çox mənbədən toplanan məlumatı saxlayan, böyük sorğulara görə optimallaşdırılmış baza (məsələn, Amazon Redshift).',
    lessonIds: ['design-amazons-sales-ranking-by-category-feature', 'design-mintcom'],
  },

  // Interview method
  {
    term: 'Back-of-the-envelope calculations',
    aliases: ['back-of-the-envelope'],
    explanation: 'Yük, yaddaş və trafik həcmini sürətli, təxmini hesablamaq; dizayn qərarlarının miqyasını yoxlamağa kömək edir.',
    lessonIds: ['back-of-the-envelope-calculations'],
  },
]
