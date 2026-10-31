// The data structures for a social network, from the primer's solution: a shortest-path search (BFS)
// over friends sharded across Person Servers, which a Lookup Service finds for the User Graph Service.
// Reference Solutions mirror `social_graph_basic.png` and `social_graph.png`; a Person Server is a
// key-value store sharded by person id.
//
// The question has no writes: friend searches are the only traffic.
import type { ChallengeInput } from '../../src/core/challenges/challenge'
import type { NodeSelector, Predicate } from '../../src/core/challenges/rules'
import { allConnectedRule, apiPath, dnsRule, edge, entryPath, loadBalancerRule, node, scaleOutRule, shardedDatabase } from './shared'

/** Where people and their friend ids live: a non-graph NoSQL store (the primer's Person Servers), or SQL. */
const PERSON_STORE: NodeSelector[] = [{ component: 'nosql-store', config: { kind: ['key-value', 'document', 'wide-column'] } }, 'sql-database']

/** Searches reach person data through the application services, and no graph database is used. */
const PERSON_DATA: Predicate = {
  type: 'all-of',
  predicates: [apiPath(PERSON_STORE, 'read'), { type: 'node', node: { component: 'nosql-store', config: { kind: 'graph' } }, max: 0 }],
}
/** The Search API hands the search on to a separate service: the User Graph Service. */
const USER_GRAPH_SERVICE: Predicate = { type: 'edge', from: 'app-service', to: 'app-service', traffic: 'read' }

export const socialGraph: ChallengeInput = {
  id: 'social-graph',
  title: 'Sosial şəbəkə üçün məlumat strukturlarını dizayn edin',
  kind: 'architecture',
  source: 'primer',
  solutionId: 'social_graph',
  lessonIds: [
    'design-the-data-structures-for-a-social-network',
    'reverse-proxy-web-server',
    'application-layer',
    'relational-database-management-system-rdbms',
    'nosql',
    'cache',
  ],
  // The primer's average traffic: 1 billion friend searches a month. A request carries a path of a few people, an authored 1 KB.
  loadProfile: { readQps: 400, writeQps: 0, requestBytes: 1_000 },
  stages: [
    {
      id: 'requirements',
      type: 'requirements',
      weight: 1,
      prompt:
        'Sosial şəbəkə üçün məlumat strukturlarını dizayn edin: istifadəçi kimisə axtarır və ona qədər ən qısa dostluq yolunu görür. Aşağıdakılardan bu tapşırığa aid olan istifadə hallarını (use case) və məhdudiyyətləri seçin, kənarda qalanları seçməyin. Fikirlərinizi qeydlərə yaza bilərsiniz.',
      solutionAnchor: 'step-1-outline-use-cases-and-constraints',
      items: [
        {
          section: 'use-case',
          text: 'İstifadəçi kimisə axtarır və axtardığı insana qədər ən qısa yolu görür',
          correct: true,
          explanation: 'Tapşırığın yeganə əsas ssenarisi: dostluq qrafında iki insan arasında ən qısa yol.',
        },
        {
          section: 'use-case',
          text: 'Servis yüksək əlçatanlığa (high availability) malikdir',
          correct: true,
          explanation: 'Primer bunu servisin tələbi kimi qeyd edir.',
        },
        {
          section: 'use-case',
          text: 'Servis istifadəçiyə yeni dostlar tövsiyə edir',
          explanation: 'Dost tövsiyələri primer-in istifadə hallarında yoxdur: yalnız ən qısa yol axtarışı var.',
        },
        {
          section: 'use-case',
          text: 'İstifadəçi dostlarının paylaşımlarından ibarət lenti (news feed) görür',
          explanation: 'Lent başqa tapşırıqdır (Twitter timeline-ı kimi); burada yalnız dostluq qrafı üzrə axtarış var.',
        },
        {
          section: 'use-case',
          text: 'Yol dostluğun yaxınlığına görə çəkilərlə hesablanır',
          explanation: 'Primer qrafın kənarlarını çəkisiz fərz edir: hər dostluq bir addımdır.',
        },
        {
          section: 'constraint',
          text: 'Trafik bərabər paylanmayıb: bəzi axtarışlar çox populyardır, bəziləri isə bir dəfə edilir',
          correct: true,
          explanation: 'Buna görə Scaling mərhələsində insan məlumatı və BFS nəticələri Memory Cache-dən verilir.',
        },
        {
          section: 'constraint',
          text: 'Qrafın məlumatı bir maşına sığmır',
          correct: true,
          explanation: 'Buna görə istifadəçilər Person Server-lər arasında shard-lara bölünür və Lookup Service onları tapır.',
        },
        {
          section: 'constraint',
          text: 'Qrafın kənarları çəkisizdir',
          correct: true,
          explanation: 'Çəkisiz qrafda ən qısa yolu BFS tapır; Dijkstra kimi alqoritmlər lazım deyil.',
        },
        {
          section: 'constraint',
          text: '100 milyon istifadəçi, orta hesabla 50 dost, ayda 1 milyard dost axtarışı',
          correct: true,
          explanation: 'Primer-in fərziyyələri: 5 milyard dostluq əlaqəsi və saniyədə 400 axtarış.',
        },
        {
          section: 'constraint',
          text: 'Ənənəvi sistemlərdən istifadə edilir, GraphQL və ya Neo4j kimi qrafa xas həllərdən yox',
          correct: true,
          explanation: 'Primer məqsədli şəkildə graph database-i qadağan edir ki, qrafı adi serverlər üzərində özünüz paylayasınız.',
        },
        {
          section: 'constraint',
          text: 'Bütün qraf bir serverin yaddaşına sığır',
          explanation: 'Primer əksini fərz edir: qraf bir maşına sığmır, ona görə sharding lazımdır.',
        },
        {
          section: 'constraint',
          text: 'Qrafı saxlamaq üçün Neo4j kimi graph database götürmək olar',
          explanation: 'Primer bunu açıq şəkildə istisna edir; belə məhdudiyyət olmasaydı, graph database yaxşı seçim olardı.',
        },
      ],
    },
    {
      id: 'estimation',
      type: 'estimation',
      weight: 1,
      prompt:
        'Fərziyyələr: 100 milyon istifadəçi, hər birinin orta hesabla 50 dostu var, ayda 1 milyard dost axtarışı gəlir. Yazmalar bu tapşırığa daxil deyil. Pik anlarda yükün ortalamadan 10 dəfə çox olduğunu fərz edin. Primer-in yuvarlaq çevirmələrini işlədin: ayda 2,5 milyon saniyə. Cavablar referansın 2 qatı daxilində olsa qəbul olunur.',
      solutionAnchor: 'calculate-usage',
      explanation:
        'Qrafda 100 milyon istifadəçi × 50 dost = 5 milyard dostluq əlaqəsi var. Ayda təxminən 2,5 milyon saniyə var: saniyədə 400 sorğu ayda 1 milyard sorğu deməkdir. Primer yalnız "pikdə daha çox" deyir; 10 qat pik bu tapşırıq üçün götürülmüş fərziyyədir və Scaling mərhələsinin yükü də budur.',
      // No writes: friend searches only. The peak factor is authored; the primer gives none.
      inputs: { writesPerMonth: 0, readsPerMonth: 1_000_000_000, bytesPerWrite: 0, peakFactor: 10 },
      questions: [
        { id: 'read-qps', quantity: 'readQps', prompt: 'Orta hesabla saniyədə neçə dost axtarışı gəlir?' },
        { id: 'peak-read-qps', quantity: 'peakReadQps', prompt: 'Pik anlarda saniyədə neçə dost axtarışı gəlir?' },
      ],
    },
    {
      id: 'high-level-design',
      type: 'high-level-design',
      weight: 3,
      prompt:
        'İstifadəçi kimisə axtarır və ona qədər ən qısa dostluq yolunu görür. 100 milyon istifadəçi və 5 milyard dostluq əlaqəsi bir maşına sığmır, graph database işlətmək olmaz. Ayda 1 milyard axtarış gözlənilir. Bütün vacib komponentləri kətana qoyun, sorğuların axınını xətlərlə göstərin və "Yoxla" düyməsini basın.',
      solutionAnchor: 'step-2-create-a-high-level-design',
      rules: [
        {
          id: 'entry-point',
          weight: 2,
          description: 'Client sorğuları tətbiq serverlərinə web server (reverse proxy) və ya load balancer vasitəsilə çatır.',
          hints: [
            'Client sorğusu tətbiq kodunun işlədiyi serverə çatmazdan əvvəl ilk olaraq nəyə dəyir?',
            'Client ilə application service-lər arasına web server, reverse proxy və ya load balancer qoyun: hər sorğu ondan keçsin.',
            'Primer-də Client sorğuları reverse proxy rolunda işləyən Web Server-ə göndərir, o da sorğunu Search API serverinə ötürür. Client-dən application service-ə bu qatdan yan keçən yol olmamalıdır.',
          ],
          check: entryPath,
        },
        {
          id: 'user-graph-service',
          weight: 2,
          description: 'Search API axtarışı BFS aparan ayrıca User Graph Service-ə ötürür.',
          hints: [
            'Ən qısa yolu axtaran BFS-i kim aparır: sorğunu qəbul edən API, yoxsa ayrıca servis?',
            'User Graph Service (application service) əlavə edin və Search API-dən ona "Oxuma" trafikli xətt çəkin.',
            'Primer-də Search API sorğunu User Graph Service-ə ötürür. O, cari istifadəçini mənbə (source), onun friend_ids-ini isə qonşular kimi götürərək BFS aparır və yolu qaytarır.',
          ],
          check: USER_GRAPH_SERVICE,
        },
        {
          id: 'person-data',
          weight: 2,
          description: 'Axtarış insan məlumatına (friend_ids) tətbiq servisləri vasitəsilə çatır; graph database işlədilmir.',
          hints: [
            'BFS hər addımda insanın dost siyahısını haradan oxuyur?',
            'Key-value tipli NoSQL store (Person Server) əlavə edin və User Graph Service-dən ona "Oxuma" trafikli xətt çəkin. Graph tipli NoSQL seçməyin.',
            'Primer-də Person Server person_id → Person (id, name, friend_ids) xəritəsini saxlayır və User Graph Service hər qonşunun məlumatını ondan alır. Primer GraphQL və Neo4j kimi qrafa xas həlləri qadağan edir: tapşırıq qrafı adi anbarlar üzərində paylamaqdır.',
          ],
          check: PERSON_DATA,
        },
        {
          id: 'sharded-people',
          weight: 3,
          description: 'İstifadəçilər shard-lara bölünüb: insan məlumatının anbarında shard key təyin olunub və o, bir neçə nüsxədə işləyir.',
          hints: [
            '5 milyard dostluq əlaqəsi bir maşına sığmasa, istifadəçiləri necə paylamaq olar?',
            'Person Server-in tənzimləməsində "shardKey" sahəsini (məsələn, person_id) yazın və "instances" sahəsini 2 və ya daha çox edin.',
            'Primer-ə görə bütün istifadəçilər bir maşına sığmır, ona görə onlar Person Server-lər arasında shard-lara bölünür: hər server istifadəçilərin bir hissəsini saxlayır və hansı istifadəçinin harada olduğunu Lookup Service bilir.',
          ],
          check: shardedDatabase,
        },
        {
          id: 'lookup-service',
          weight: 2,
          description: 'Search API, User Graph Service və Lookup Service ayrı servislərdir: Lookup Service insanın hansı Person Server-də olduğunu bilir.',
          hints: [
            'User Graph Service qonşunun id-sini bilir. Onun məlumatının hansı shard-da olduğunu haradan öyrənir?',
            'Lookup Service (application service) əlavə edin və User Graph Service-dən ona xətt çəkin.',
            'Primer-in LookupService-i person_id → person_server xəritəsini saxlayır. User Graph Service hər qonşu üçün əvvəl Lookup Service-dən serveri öyrənir, sonra həmin Person Server-dən insanı alır; bu təkrar müraciətlər optimallaşdırma imkanıdır.',
          ],
          check: { type: 'node', node: 'app-service', min: 3 },
        },
        allConnectedRule('User Graph Service → Lookup Service'),
      ],
      referenceSolution: {
        nodes: [
          node('client-1', 'client', 'Client', 0, 100),
          node('web-server-1', 'web-server', 'Web Server', 240, 100),
          node('app-service-1', 'app-service', 'Search API', 480, 100),
          node('app-service-2', 'app-service', 'User Graph Service', 720, 100),
          node('app-service-3', 'app-service', 'Lookup Service', 960, 20),
          // The primer draws one Person Server and shards people across several.
          node('nosql-store-1', 'nosql-store', 'Person Server', 960, 180, { shardKey: 'person_id', instances: 4 }),
        ],
        edges: [
          edge('client-1', 'web-server-1', 'read'),
          edge('web-server-1', 'app-service-1', 'read'),
          edge('app-service-1', 'app-service-2', 'read'),
          edge('app-service-2', 'app-service-3', 'read'),
          edge('app-service-2', 'nosql-store-1', 'read'),
        ],
      },
    },
    {
      id: 'deep-dive',
      type: 'deep-dive',
      weight: 2,
      prompt: 'Əsas komponentlərin detallarına keçin. Hər sual üçün seçiminizi edin: bitirdikdən sonra hər variantın trade-off-u izah olunacaq.',
      solutionAnchor: 'step-3-design-core-components',
      questions: [
        {
          type: 'multiple-choice',
          prompt: 'Çəkisiz qrafda iki insan arasında ən qısa yolu hansı alqoritm tapır?',
          options: [
            {
              text: 'Breadth-first search (BFS)',
              correct: true,
              explanation: 'BFS qonşuları səviyyə-səviyyə gəzir, ona görə çəkisiz qrafda hədəfə ilk çatdığı yol ən qısadır. Primer məhz BFS işlədir.',
            },
            {
              text: 'Depth-first search (DFS)',
              explanation: 'DFS hədəfi tapa bilər, amma tapdığı yolun ən qısa olacağına zəmanət yoxdur.',
            },
            {
              text: 'Dijkstra alqoritmi',
              explanation: 'Dijkstra çəkili qraflar üçündür; çəkisiz qrafda BFS ilə eyni nəticəni daha baha başa gələrək verir.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Qraf bir maşına sığmırsa, BFS qonşunu necə tapır?',
          options: [
            {
              text: 'İstifadəçilər Person Server-lərə shard edilir; User Graph Service Lookup Service-dən serveri öyrənib insanı oradan alır',
              correct: true,
              explanation: 'Primer-in həlli: Lookup Service person_id → person_server xəritəsini saxlayır, Person Server isə insanları və onların friend_ids-ini.',
            },
            {
              text: 'Bütün qrafı daha böyük bir serverə köçürmək',
              explanation: 'Vertical scaling bir yerdə dayanır və tək server sıradan çıxma nöqtəsidir; fərziyyəyə görə qraf bir maşına sığmır.',
            },
            {
              text: 'Neo4j kimi graph database işlətmək',
              explanation: 'Primer bunu bu tapşırıqda qadağan edir: ənənəvi sistemlərlə işləmək lazımdır.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Paylanmış BFS-də ziyarət edilmiş insanları niyə visited_ids çoxluğunda saxlamaq lazımdır?',
          options: [
            {
              text: 'İnsanlar müxtəlif serverlərdədir, ona görə "ziyarət edilib" vəziyyətini node-un özündə saxlamaq olmur',
              correct: true,
              explanation: 'Primer qeyd edir ki, adi BFS-dən fərqli olaraq vəziyyət node-da yox, User Graph Service-in visited_ids çoxluğunda saxlanılır; bu, həm də dövrələrdə ilişməyin qarşısını alır.',
            },
            {
              text: 'Ən qısa yolu çəkilərə görə sıralamaq üçün',
              explanation: 'Qraf çəkisizdir; visited_ids eyni insanı iki dəfə növbəyə qoymamaq üçündür.',
            },
          ],
        },
        {
          type: 'multi-select',
          prompt: 'Axtarışı sürətləndirmək üçün primer-in hansı optimallaşdırmaları var?',
          options: [
            {
              text: 'Eyni Person Server-dəki dost sorğularını bir yerdə göndərmək və serverləri yerə görə shard etmək',
              correct: true,
              explanation: 'Maşınlar arası keçidlər azalır; dostlar adətən bir-birinə yaxın yaşayır.',
            },
            {
              text: 'İki BFS-i eyni vaxtda aparmaq: biri mənbədən, biri hədəfdən, sonra yolları birləşdirmək',
              correct: true,
              explanation: 'Bidirectional BFS hər tərəfdən yalnız yarı dərinliyə qədər gedir və gəzilən insanların sayını kəskin azaldır.',
            },
            {
              text: 'BFS-i çoxlu dostu olan insanlardan başlamaq və vaxt və ya addım limiti qoymaq',
              correct: true,
              explanation: 'Çox əlaqəli insanlar ayrılıq dərəcəsini azaldır; limit isə çox uzun axtarışdan əvvəl istifadəçidən davam etmək istəyib-istəmədiyini soruşmağa imkan verir.',
            },
            {
              text: 'Qonşuları təsadüfi sırada gəzmək',
              explanation: 'Sıra BFS-in ən qısa yolu tapmasını dəyişmir, amma heç nəyi sürətləndirmir də.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Təkrar axtarışları necə ucuzlaşdırmaq olar?',
          options: [
            {
              text: 'Tam və ya qismən BFS nəticələrini Memory Cache-də, offline batch ilə hesablananları isə NoSQL-də saxlamaq',
              correct: true,
              explanation: 'Primer hər ikisini təklif edir: ard-arda axtarış edən və çox əlaqəli istifadəçilər üçün xüsusilə faydalıdır.',
            },
            {
              text: 'Hər axtarışı sıfırdan aparmaq, çünki dostluqlar dəyişir',
              explanation: 'Dostluqlar nadir dəyişir; populyar axtarışları hər dəfə yenidən hesablamaq lazımsız yükdür.',
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
        'Yüksək səviyyəli dizaynınızdan davam edin və onu məhdudiyyətlərə görə miqyaslayın: trafik qeyri-bərabərdir, bəzi axtarışlar çox populyardır. Dizayn pik yükə dözməlidir: saniyədə 4000 axtarış altında oxumanın orta gecikməsi 200 ms-i keçməməli, heç bir node həddən artıq yüklənməməli və heç bir sorğu xəta ilə bitməməlidir. Bunu trafik simulyasiyası ilə yoxlayın. Darboğazları tapın, komponent əlavə edin və ya dəyişin, "Yoxla" düyməsini basın.',
      solutionAnchor: 'step-4-scale-the-design',
      // The authored peak of the Estimation Stage: 10 times the primer's average.
      loadProfile: { readQps: 4_000, writeQps: 0, requestBytes: 1_000 },
      rules: [
        {
          id: 'peak-load',
          weight: 3,
          description: 'Pik yükdə (saniyədə 4000 axtarış) orta gecikmə 200 ms-dən çox deyil, həddən artıq yüklənən node və xəta yoxdur.',
          hints: [
            'Saniyədə 4000 axtarış gələndə dizaynınızın hansı node-u ilk tıxanır?',
            'Trafik simulyasiyasını işə salın və "Darboğazlar" siyahısına baxın. Ən çox yüklənən node-ların "instances" sahəsini artırın və ya insan məlumatını cache ilə Person Server-dən götürün.',
            'Hər node bir nüsxədə məhdud sorğu emal edir: məsələn, web server təxminən 1000, application service 500 sorğu/san. Pik yükdə stateless servislər (Query API, User Graph Service, Lookup Service) horizontal miqyaslanır, insan məlumatı isə Memory Cache-dən verilir ki, Person Server-lərə yalnız cache miss-lər çatsın.',
          ],
          check: { type: 'simulation', maxLatencyMs: { read: 200 }, maxOverloadedNodes: 0, maxErrorRate: 0 },
        },
        loadBalancerRule,
        scaleOutRule,
        {
          id: 'memory-cache',
          weight: 2,
          description: 'İnsan məlumatı və axtarış nəticələri yaddaş cache-indən verilir.',
          hints: [
            'Çox əlaqəli bir insanın dost siyahısı min axtarışda oxunanda hər dəfə Person Server-ə getmək lazımdırmı?',
            'Memory Cache əlavə edin və User Graph Service-dən (və ya Query API-dən) ona "Oxuma" trafikli xətt çəkin.',
            'Primer-ə görə insan məlumatı Redis və ya Memcached kimi Memory Cache-dən verilə bilər: cavab vaxtı və aşağıdakı servislərə gedən trafik azalır. Bu, ard-arda axtarış edən və çox əlaqəli insanlar üçün xüsusilə faydalıdır; cache-də tam və ya qismən BFS nəticələri də saxlanıla bilər.',
          ],
          check: { type: 'edge', from: 'app-service', to: 'cache', traffic: 'read' },
        },
        {
          id: 'sharded-people',
          weight: 2,
          description: 'İstifadəçilər hələ də shard-lara bölünüb: insan məlumatının anbarında shard key təyin olunub və o, bir neçə nüsxədə işləyir.',
          hints: [
            'Miqyaslananda istifadəçilər hələ də Person Server-lər arasında bölünürmü?',
            'Person Server-in "shardKey" sahəsini (məsələn, person_id) saxlayın və "instances" sahəsini 2 və ya daha çox edin.',
            'Primer-ə görə qraf bir maşına sığmır: istifadəçilər Person Server-lər arasında shard-lara bölünür, Lookup Service onları tapır. Shard-ları yerə görə bölmək maşınlar arası keçidləri daha da azaldır.',
          ],
          check: shardedDatabase,
        },
        {
          id: 'graph-path',
          weight: 2,
          description: 'Yeni komponentlərlə də axtarış User Graph Service-dən keçərək insan məlumatına çatır; graph database işlədilmir.',
          hints: [
            'Komponent əlavə edəndən sonra axtarış hələ də User Graph Service vasitəsilə Person Server-ə çatırmı?',
            'Query API → User Graph Service və User Graph Service → Person Server "Oxuma" xətlərini saxlayın.',
            'Miqyaslanmış diaqram yüksək səviyyəli dizaynın axınını saxlayır: Query API → User Graph Service → Lookup Service və Person Server; əlavə olaraq Query API və User Graph Service Memory Cache-dən oxuyur.',
          ],
          check: { type: 'all-of', predicates: [USER_GRAPH_SERVICE, PERSON_DATA] },
        },
        dnsRule('social.com'),
        allConnectedRule('User Graph Service → Memory Cache'),
      ],
      // Mirrors social_graph.png; the primer leaves internal load balancers out, and so does this.
      referenceSolution: {
        nodes: [
          node('client-1', 'client', 'Client', 0, 200),
          node('dns-1', 'dns', 'DNS', 240, 40),
          node('load-balancer-1', 'load-balancer', 'Load Balancer', 240, 200, { instances: 3 }),
          node('web-server-1', 'web-server', 'Web Server', 480, 200, { instances: 6 }),
          node('app-service-1', 'app-service', 'Query API', 720, 200, { instances: 10 }),
          node('app-service-2', 'app-service', 'User Graph Service', 960, 200, { instances: 10 }),
          node('cache-1', 'cache', 'Memory Cache', 960, 400, { instances: 3 }),
          node('app-service-3', 'app-service', 'Lookup Service', 1200, 100, { instances: 10 }),
          node('nosql-store-1', 'nosql-store', 'Person Server', 1200, 300, { shardKey: 'person_id', instances: 4 }),
        ],
        edges: [
          edge('client-1', 'dns-1', 'read'),
          edge('client-1', 'load-balancer-1', 'read'),
          edge('load-balancer-1', 'web-server-1', 'read'),
          edge('web-server-1', 'app-service-1', 'read'),
          edge('app-service-1', 'app-service-2', 'read'),
          edge('app-service-1', 'cache-1', 'read'),
          edge('app-service-2', 'cache-1', 'read'),
          edge('app-service-2', 'app-service-3', 'read'),
          edge('app-service-2', 'nosql-store-1', 'read'),
        ],
      },
    },
  ],
}
