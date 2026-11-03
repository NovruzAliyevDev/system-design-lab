// Search autocomplete (typeahead): not a primer question. As a user types, an autocomplete service answers
// each prefix with the top suggestions kept at that prefix's node of a trie held in memory, and a cache keeps
// the hot prefixes. Every search made is logged to a queue; aggregators count how often each query is searched,
// and a MapReduce job rebuilds the trie from those counts, so that ranking follows what people search. The
// assumptions are authored: 2.5 billion searches a month, each typed with 4 suggestion requests on average,
// 100 bytes a logged search, three times the average when news breaks.
//
// In the simulation a suggestion request is a read and a logged search is a write. The rebuild job is drawn
// reading the counts and writing the trie, but the load does not reach it: it runs offline, once a day or a
// week, and swaps the new trie in.
import type { ChallengeInput } from '../../src/core/challenges/challenge'
import type { NodeSelector, Predicate } from '../../src/core/challenges/rules'
import { allConnectedRule, apiPath, edge, ENTRY, node, QUEUES } from '../primer-challenges/shared'
import { loadBalancerRule, queuedWrites, scaleOutRule } from './shared'

/** Where the counts of each query can be kept: a NoSQL store, a SQL table, a warehouse or files. */
const FREQUENCY_STORE: NodeSelector[] = ['nosql-store', 'sql-database', 'data-warehouse', 'object-store']

/** No search updates the trie on its way: the trie is written by a builder, and any write reaching it waits in a queue first. */
const TRIE_BUILT_OFFLINE: Predicate = {
  type: 'all-of',
  predicates: [
    { type: 'edge', from: ['app-service', 'analytics'], to: 'trie', traffic: 'write' },
    {
      type: 'any-of',
      predicates: [
        { type: 'not', predicate: { type: 'path', from: 'client', to: 'trie', traffic: 'write' } },
        { type: 'path', from: 'client', to: 'trie', through: QUEUES, traffic: 'write' },
      ],
    },
  ],
}

export const searchAutocomplete: ChallengeInput = {
  id: 'search-autocomplete',
  title: 'Axtarışda avtomatik tamamlama (autocomplete) dizayn edin',
  kind: 'architecture',
  source: 'authored',
  lessonIds: [
    'additional-system-design-interview-questions',
    'cache',
    'application-caching',
    'client-caching',
    'asynchronism',
    'message-queues',
    'back-of-the-envelope-calculations',
    'horizontal-scaling',
  ],
  // The authored average: 10 billion suggestion requests and 2.5 billion searches a month.
  loadProfile: { readQps: 4_000, writeQps: 1_000, requestBytes: 100 },
  stages: [
    {
      id: 'requirements',
      type: 'requirements',
      weight: 1,
      prompt:
        'Axtarış qutusu üçün avtomatik tamamlama dizayn edin: istifadəçi yazdıqca qutunun altında ən populyar 5 təklif görünür. Bu sual primer-dən deyil. Aşağıdakılardan bu tapşırığa aid olan istifadə hallarını (use case) və məhdudiyyətləri seçin, kənarda qalanları seçməyin.',
      items: [
        {
          section: 'use-case',
          text: 'İstifadəçi yazdıqca yazdığı prefiks ilə başlayan 5 təklif görür',
          correct: true,
          explanation: 'Sistemin əsas sorğusu: prefiks gəlir, ən populyar 5 davamı qayıdır.',
        },
        {
          section: 'use-case',
          text: 'Təkliflər nə qədər tez-tez axtarıldıqlarına görə sıralanır',
          correct: true,
          explanation: 'Ranking axtarışların tezliyinə əsaslanır: buna görə hər axtarış qeydə alınır və sayılır.',
        },
        {
          section: 'use-case',
          text: 'Yeni populyar axtarışlar bir müddət sonra təkliflərə düşür',
          correct: true,
          explanation: 'Trie axtarış qeydlərindən dövri olaraq (məsələn, gündə bir dəfə) yenidən qurulur: yeni trend bir gün ərzində görünür.',
        },
        {
          section: 'use-case',
          text: 'Təkliflər yazı səhvlərini düzəldir (spell check)',
          explanation: 'Yazı səhvlərinin düzəldilməsi ayrıca problemdir: bu tapşırıqda yalnız prefiks ilə başlayan sorğular təklif olunur.',
        },
        {
          section: 'use-case',
          text: 'Axtarışın özü: nəticələrin siyahısı və onların sıralanması',
          explanation: 'Axtarış nəticələri ayrıca sistemdir (primer-də veb crawler və axtarış indeksi kimi): burada yalnız axtarış qutusunun təklifləri var.',
        },
        {
          section: 'constraint',
          text: 'Ayda 2,5 milyard axtarış edilir və hər axtarış yazılarkən orta hesabla 4 təklif sorğusu göndərilir',
          correct: true,
          explanation: 'Fərziyyə: ayda 10 milyard təklif sorğusu. Client hər hərfdə deyil, yazmağa ara verəndə (debounce) sorğu göndərir.',
        },
        {
          section: 'constraint',
          text: 'Təkliflər istifadəçi yazdıqca dərhal görünməlidir: cavab 100 ms-dən tez gəlməlidir',
          correct: true,
          explanation: 'Təklif yazmaqdan gec gəlsə, istifadəçi artıq növbəti hərfi yazıb: gecikmə büdcəsi çox kiçikdir, ona görə cavab yaddaşdan verilir.',
        },
        {
          section: 'constraint',
          text: 'Xəbər anlarında yük ortalamanın 3 qatına çatır; bir axtarışın qeydi təxminən 100 baytdır',
          correct: true,
          explanation: 'Miqyaslama pikə görə yoxlanılır: saniyədə 12 000 təklif sorğusu və 3 000 axtarış.',
        },
        {
          section: 'constraint',
          text: 'Hər axtarış dərhal, elə həmin saniyə təkliflərin sırasını dəyişməlidir',
          explanation: 'Sıra dövri yenidən qurulma ilə dəyişir: hər axtarışda trie-ni yeniləmək oxumaların yolunu yazmalarla tıxayardı, təkliflər isə bir neçə saat gecikəndə də faydalıdır.',
        },
      ],
    },
    {
      id: 'estimation',
      type: 'estimation',
      weight: 1,
      prompt:
        'Fərziyyələr: ayda 2,5 milyard axtarış edilir və 10 milyard təklif sorğusu göndərilir. Hər axtarışın qeydi 100 baytdır; xəbər anlarında yük ortalamanın 3 qatına çatır. Ayda 2,5 milyon saniyə və 1 KB = min bayt kimi yuvarlaq çevirmələri işlədin. Cavablar referansın 2 qatı daxilində olsa qəbul olunur.',
      explanation:
        'Bu, primer-in "back-of-the-envelope" üsuludur: ayda təxminən 2,5 milyon saniyə var, ona görə ayda 10 milyard təklif sorğusu saniyədə 4 000, pikdə isə 12 000 deməkdir; 2,5 milyard axtarış saniyədə 1 000-dir. Axtarış qeydləri ayda 250 GB, ildə 3 TB tutur. Trie isə qeydlərdən çox kiçikdir: yalnız tez-tez axtarılan sorğular (məsələn, ən çox axtarılan bir neçə on milyon) onda qalır, ona görə o, bir maşının yaddaşına sığır.',
      inputs: { writesPerMonth: 2_500_000_000, readsPerMonth: 10_000_000_000, bytesPerWrite: 100, peakFactor: 3 },
      questions: [
        { id: 'read-qps', quantity: 'readQps', prompt: 'Orta hesabla saniyədə neçə təklif sorğusu gəlir?' },
        { id: 'write-qps', quantity: 'writeQps', prompt: 'Orta hesabla saniyədə neçə axtarış edilir?' },
        { id: 'peak-read-qps', quantity: 'peakReadQps', prompt: 'Xəbər anlarında saniyədə neçə təklif sorğusu gəlir?' },
        { id: 'storage-per-month', quantity: 'storagePerMonth', prompt: 'Bir ayda axtarış qeydləri nə qədər yer tutur?' },
        { id: 'storage-per-year', quantity: 'storagePerYear', prompt: 'Bir ildə axtarış qeydləri nə qədər yer tutur?' },
      ],
    },
    {
      id: 'high-level-design',
      type: 'high-level-design',
      weight: 3,
      prompt:
        'Təklif sorğuları autocomplete servisinə gedir, o da cavabı yaddaşdakı trie-dən verir. Hər axtarış qeydə alınır və növbə vasitəsilə sayılır; trie-ni bu saylardan ayrıca bir iş (məsələn, MapReduce) yenidən qurur. Bu modeldə təklif sorğusu oxumadır, axtarışın qeydi isə yazmadır. Saniyədə orta hesabla 4 000 təklif sorğusu və 1 000 axtarış gəlir. Bütün vacib komponentləri kətana qoyun, sorğuların axınını xətlərlə göstərin və "Yoxla" düyməsini basın.',
      rules: [
        {
          id: 'entry-point',
          weight: 2,
          description: 'İstifadəçi sorğuları servislərə web server (reverse proxy) və ya load balancer vasitəsilə çatır.',
          hints: [
            'Təklif sorğusu autocomplete servisinin koduna çatmazdan əvvəl ilk olaraq nəyə dəyir?',
            'Client ilə application service-lər arasına web server, reverse proxy və ya load balancer qoyun: hər sorğu ondan keçsin.',
            'Servislərin qarşısındakı qat sorğuları bir neçə server arasında bölür və onları növünə görə yönləndirir: təklif sorğuları autocomplete servisinə, axtarışların qeydi isə qeyd servisinə.',
          ],
          check: { type: 'path', from: 'client', to: 'app-service', through: ENTRY },
        },
        {
          id: 'trie-lookup',
          weight: 3,
          description: 'Təklif sorğuları autocomplete servisi vasitəsilə yaddaşdakı trie-dən oxunur.',
          hints: [
            'İstifadəçi "sis" yazdı. Bu prefiks ilə başlayan ən populyar 5 sorğunu 100 ms-dən tez necə tapmaq olar?',
            'Autocomplete servisindən (application service) Trie komponentinə oxuma xətti çəkin.',
            'Trie-də eyni prefiksli sorğular eyni yoldan keçir: "sis" yazılanda üç addımda onun düyününə çatılır. Hər düyündə ən populyar k təklif əvvəlcədən saxlanılır, ona görə cavab üçün alt ağacı gəzmək lazım deyil. Bütün trie yaddaşda olduğu üçün cavab millisaniyədən tez gəlir.',
          ],
          check: apiPath(['trie'], 'read'),
        },
        {
          id: 'no-database-scan',
          weight: 2,
          description: 'Heç bir təklif sorğusu SQL bazasına getmir: hər hərf üçün LIKE axtarışı yoxdur.',
          hints: [
            'Hər hərfdə "WHERE query LIKE \'sis%\' ORDER BY count DESC LIMIT 5" sorğusunu icra etmək nə qədər başa gəlir?',
            'Təklif sorğularının yolundan SQL database-ə gedən oxuma xəttini silin: təkliflər trie-dən gəlsin.',
            'Index prefiksi tapa bilər, amma "s" kimi qısa prefiksə milyonlarla sətir uyğun gəlir və baza onları sıralamalıdır. Saniyədə on minlərlə belə sorğu bazanı tıxayır; trie isə cavabı əvvəlcədən hazır saxlayır.',
          ],
          check: { type: 'not', predicate: { type: 'path', from: 'client', to: 'sql-database', traffic: 'read' } },
        },
        {
          id: 'query-log',
          weight: 2,
          description: 'Hər axtarış növbə vasitəsilə qeydə alınır və onun tezliyi anbarda sayılır.',
          hints: [
            'Hansı sorğuların populyar olduğunu sistem haradan bilir?',
            'Axtarışları qeyd edən servisdən message queue-ya, ondan sayan worker-ə (aggregator), ondan isə NoSQL store-a yazma xətləri çəkin.',
            'Hər axtarış qeyd olunur, aggregator-lar isə onları qısa pəncərələrdə toplayıb hər sorğunun sayını yeniləyir: saniyədə 1 000 ayrı yazma əvəzinə hər pəncərədə hər sorğu üçün bir yazma. Növbə qeydi axtarışın yolundan çıxarır: sayma yavaşlasa da, axtarış gözləmir.',
          ],
          check: queuedWrites(FREQUENCY_STORE),
        },
        {
          id: 'trie-built-offline',
          weight: 2,
          description: 'Trie-ni ayrıca bir iş (builder və ya MapReduce) yazır: heç bir axtarış onu öz yolunda yeniləmir.',
          hints: [
            'Hər axtarış trie-ni yeniləsə, saniyədə 12 000 oxumanın yolunda nə baş verir?',
            'Analytics (MapReduce) komponentindən sayların anbarına oxuma, ondan isə trie-yə yazma xətti çəkin; axtarışları qeyd edən yoldan trie-yə xətt çəkməyin.',
            'Trie dövri olaraq (məsələn, gündə bir dəfə) sayların cədvəlindən yenidən qurulur və köhnəsinin yerinə qoyulur. Oxumalar heç vaxt yazmalarla kilid üstündə yarışmır, yeni trie isə yayımdan əvvəl yoxlanıla bilir.',
          ],
          check: TRIE_BUILT_OFFLINE,
        },
        allConnectedRule('Trie Builder → Suggestion Trie'),
      ],
      referenceSolution: {
        nodes: [
          node('client-1', 'client', 'Users', 0, 240),
          node('web-server-1', 'web-server', 'Web Server', 240, 240),
          node('app-service-1', 'app-service', 'Autocomplete Service', 480, 120),
          node('trie-1', 'trie', 'Suggestion Trie', 720, 120),
          node('app-service-2', 'app-service', 'Query Logger', 480, 360),
          node('message-queue-1', 'message-queue', 'Query Log', 720, 360),
          node('app-service-3', 'app-service', 'Aggregator', 960, 360),
          node('nosql-store-1', 'nosql-store', 'Query Frequencies', 1200, 360),
          node('analytics-1', 'analytics', 'Trie Builder', 960, 120),
        ],
        edges: [
          edge('client-1', 'web-server-1', 'both'),
          edge('web-server-1', 'app-service-1', 'read'),
          edge('app-service-1', 'trie-1', 'read'),
          edge('web-server-1', 'app-service-2', 'write'),
          edge('app-service-2', 'message-queue-1', 'write'),
          edge('message-queue-1', 'app-service-3', 'write'),
          edge('app-service-3', 'nosql-store-1', 'write'),
          edge('analytics-1', 'nosql-store-1', 'read'),
          edge('analytics-1', 'trie-1', 'write'),
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
          prompt: 'Trie-nin hər düyünü nəyi saxlamalıdır ki, "s" kimi qısa prefiks də tez cavablansın?',
          options: [
            {
              text: 'Hərfi, uşaqlarını və bu prefiks üçün əvvəlcədən hesablanmış ən populyar k təklifi',
              correct: true,
              explanation: 'Sorğu prefiksin uzunluğu qədər addımda düyünə çatır və hazır siyahını qaytarır. Yaddaş artır (hər təklif bir çox düyündə təkrarlanır), amma oxuma sürəti bunun əvəzini verir; trie yenidən qurulanda siyahılar da yenidən hesablanır.',
            },
            {
              text: 'Yalnız hərfi və uşaqlarını: hər sorğuda prefiksin alt ağacı gəzilib ən populyarlar tapılır',
              explanation: 'Uzun prefiks üçün işləyir, amma "s"-in alt ağacında milyonlarla sorğu var: hər hərfdə onları gəzib sıralamaq 100 ms büdcəsinə sığmır.',
            },
            {
              text: 'Trie lazım deyil: bütün sorğuları hash map-də saxlamaq və hər prefiks üçün hamısını yoxlamaq',
              explanation: 'Hash map yalnız tam açarı tapır: prefiksə uyğun gələnləri tapmaq üçün hər sorğuda bütün açarları gəzmək lazımdır.',
            },
          ],
        },
        {
          type: 'multi-select',
          prompt: 'Client hər hərf üçün sorğu göndərməsin deyə nə etmək olar?',
          options: [
            {
              text: 'Debounce: istifadəçi yazmağa 100–200 ms ara verəndə sorğu göndərmək',
              correct: true,
              explanation: 'Sürətli yazan istifadəçi sözü bir-iki sorğu ilə yazır: sorğular bir neçə qat azalır, istifadəçi isə fərqi hiss etmir.',
            },
            {
              text: 'Cavabı brauzerdə cache-ləmək (məsələn, Cache-Control: max-age=3600)',
              correct: true,
              explanation: 'İstifadəçi silib yenidən yazanda eyni prefiks serverə getmir. Təkliflər saatlarla dəyişmir, ona görə köhnəlmə zərərsizdir; populyar prefikslərin cavabı CDN-də də saxlanıla bilər.',
            },
            {
              text: 'Bütün trie-ni brauzerə yükləmək',
              explanation: 'Trie gigabaytlardır və hər gün dəyişir: onu hər istifadəçiyə göndərmək mümkün deyil. Bunu yalnız kiçik, sabit siyahılar (məsələn, ölkələr) üçün etmək olar.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Trie bir maşının yaddaşına sığmayanda onu necə shard-lamaq olar?',
          options: [
            {
              text: 'Prefiks aralıqlarına görə, aralıqları keçmiş trafikə əsasən seçərək: "s" kimi böyük hərflər bir neçə shard-a bölünür, "x", "y", "z" isə bir shard-da birləşir',
              correct: true,
              explanation: 'Prefiks həmişə bir shard-a gedir, shard-lar isə bərabər yüklənir. Aralıqların xəritəsi kiçikdir və autocomplete servisində (və ya ZooKeeper-də) saxlanılır.',
            },
            {
              text: 'Hər hərf üçün bir shard: 26 shard',
              explanation: 'Sadədir, amma "s" ilə başlayan sorğular "x" ilə başlayanlardan dəfələrlə çoxdur: bəzi shard-lar boş qalır, bəziləri tıxanır.',
            },
            {
              text: 'Tam sorğunun hash-inə görə',
              explanation: 'Yük bərabər paylanır, amma bir prefiksin davamları bütün shard-lara səpələnir: hər təklif sorğusu hamısına getməli və nəticələri birləşdirməlidir.',
            },
          ],
        },
        {
          type: 'multi-select',
          prompt: 'Təkliflər necə sıralanmalıdır?',
          options: [
            {
              text: 'Axtarış tezliyinə görə, köhnə axtarışların çəkisi zamanla azalaraq (decay)',
              correct: true,
              explanation: 'Keçən ilin trendi bu gün də birinci olmasın deyə yeni axtarışlar daha çox çəki alır.',
            },
            {
              text: 'İstifadəçinin dilinə və ölkəsinə görə ayrıca',
              correct: true,
              explanation: 'Bakıda "hava" yazana Bakının havası, başqa ölkədə isə başqa təklif uyğundur: trie dil və ya region üzrə ayrıca qurula bilər.',
            },
            {
              text: 'Əlifba sırası ilə',
              explanation: 'Əlifba sırası populyarlıq haqqında heç nə demir: istifadəçinin axtardığı sorğu çox vaxt siyahıdan kənarda qalır.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Təhqiramiz və ya təhlükəli sorğu populyar oldu. Onun təkliflərə düşməsinin qarşısını necə almaq olar?',
          options: [
            {
              text: 'Trie qurulanda qadağan siyahısına görə süzmək və təcili hallar üçün servisdə cavabları süzən filtr saxlamaq',
              correct: true,
              explanation: 'Qurma zamanı süzmə trie-ni təmiz saxlayır, servisdəki filtr isə növbəti qurmanı gözləmədən sorğunu dərhal çıxarır.',
            },
            {
              text: 'Heç nə etməmək: təkliflər istifadəçilərin axtarışlarını əks etdirir',
              explanation: 'Təkliflər sistemin öz sözüdür: zərərli təklif həm istifadəçiyə ziyan vurur, həm də şirkətin nüfuzuna.',
            },
          ],
        },
        {
          type: 'multiple-choice',
          prompt: 'Yeni trie qurulub. Onu necə yayıma vermək olar?',
          options: [
            {
              text: 'Yeni trie ayrıca yüklənir və yoxlanılır, sonra servislər ona birdən keçir; köhnə cache-lənmiş təkliflər isə silinir',
              correct: true,
              explanation: 'Oxumalar heç vaxt yarımçıq trie görmür. Amma cache silinəndə bir anlıq bütün sorğular trie-yə düşür: trie bunu daşıya bilməlidir, və ya cache tədricən yenilənməlidir.',
            },
            {
              text: 'İşləyən trie-ni yerində düyün-düyün yeniləmək',
              explanation: 'Yeniləmə saatlarla davam edir və bu müddətdə oxumalar köhnə ilə yeninin qarışığını görür, kilidlər isə onları yavaşladır.',
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
        'Yüksək səviyyəli dizaynınızdan davam edin və onu xəbər anlarındakı pikə görə miqyaslayın: saniyədə 12 000 təklif sorğusu və 3 000 axtarış. Təklif sorğusunun orta gecikməsi 20 ms-i keçməməli, heç bir node, o cümlədən worker-lər, həddən artıq yüklənməməli və heç bir sorğu xəta ilə bitməməlidir. Xaos tapşırığı: yeni trie yayıma verilib və təkliflərin cache-i boşaldılıb; pikdə də təkliflər xətasız gəlməlidir. Bunu trafik simulyasiyası ilə yoxlayın, darboğazları tapın və "Yoxla" düyməsini basın.',
      // The authored peak: three times the average, when news breaks.
      loadProfile: { readQps: 12_000, writeQps: 3_000, requestBytes: 100 },
      chaosTasks: [
        {
          id: 'cache-flushed',
          prompt: 'Yeni trie yayıma verilib və təkliflərin cache-i boşaldılıb: pikdə təkliflər xətasız gəlməlidir.',
          scenario: { type: 'cache-cold', nodes: ['cache'] },
        },
      ],
      rules: [
        {
          id: 'peak-load',
          weight: 3,
          description: 'Xəbər anlarında (saniyədə 12 000 təklif sorğusu və 3 000 axtarış) təklif sorğusunun orta gecikməsi 20 ms-dən çox deyil, həddən artıq yüklənən node və xəta yoxdur.',
          hints: [
            'Saniyədə 12 000 təklif sorğusu gələndə dizaynınızın hansı node-u ilk tıxanır?',
            'Trafik simulyasiyasını işə salın və "Darboğazlar" siyahısına baxın. Ən çox yüklənən node-ların, o cümlədən növbədən sonrakı worker-lərin "instances" sahəsini artırın.',
            'Bu modeldə application service-in bir nüsxəsi saniyədə 500 sorğu emal edir: 12 000 təklif sorğusu üçün autocomplete servisinə 24-dən çox nüsxə, 3 000 axtarış üçün qeyd servisinə və aggregator-a 6-dan çox nüsxə lazımdır; web server-ə isə 15-dən çox. Trie-nin bir nüsxəsi saniyədə 5 000 sorğu cavablayır, cache isə 50 000.',
          ],
          check: { type: 'simulation', maxLatencyMs: { read: 20 }, maxOverloadedNodes: 0, maxErrorRate: 0 },
        },
        {
          id: 'cache-flushed',
          weight: 2,
          description: 'Təkliflərin cache-i boşaldılanda pikdə təkliflər xətasız gəlir.',
          hints: [
            'Cache boş olanda saniyədə 12 000 təklif sorğusunun hamısı haraya gedir?',
            'Trafik simulyasiyasında "Xaos ssenarisi" siyahısından bu tapşırığı seçin və trie-nin "instances" sahəsini bütün təklif sorğularını özü daşıyana qədər artırın.',
            'Cache trie-nin yükünü adi vaxtda azaldır: bu modeldə o, sorğuların 80%-ni cavablayır. Amma yeni trie yayıma veriləndə köhnə təkliflər cache-dən silinməlidir və bir müddət bütün sorğular trie-yə düşür. 12 000 sorğu üçün trie-nin 2-dən çox nüsxəsi lazımdır, və ya cache tədricən, açar-açar yenilənməlidir.',
          ],
          check: { type: 'simulation', chaos: 'cache-flushed', maxErrorRate: 0 },
        },
        loadBalancerRule,
        scaleOutRule,
        {
          id: 'suggestion-cache',
          weight: 2,
          description: 'Autocomplete servisi populyar prefikslərin təkliflərini cache-dən oxuyur.',
          hints: [
            'Sorğuların böyük hissəsi bir neçə min qısa prefiksə ("a", "fu", "hava") düşür. Onların cavabı hər dəfə trie-dən hesablanmalıdırmı?',
            'Autocomplete servisindən cache-ə oxuma xətti çəkin: cache trie-nin yanında (cache-aside) və ya onun qarşısında dura bilər.',
            'Prefikslərin populyarlığı çox qeyri-bərabərdir, ona görə kiçik cache sorğuların çoxunu cavablayır. Cache açarı prefiksin özüdür, dəyəri isə hazır 5 təklifdir; trie yenidən qurulanda cache də yenilənir.',
          ],
          check: { type: 'path', from: 'client', to: 'cache', through: 'app-service', traffic: 'read' },
        },
        allConnectedRule('Trie Builder → Suggestion Trie'),
      ],
      referenceSolution: {
        nodes: [
          node('client-1', 'client', 'Users', 0, 280),
          node('load-balancer-1', 'load-balancer', 'Load Balancer', 240, 280, { instances: 2 }),
          node('web-server-1', 'web-server', 'Web Server', 480, 280, { instances: 20 }),
          node('app-service-1', 'app-service', 'Autocomplete Service', 720, 120, { instances: 30 }),
          node('cache-1', 'cache', 'Suggestion Cache', 960, 0),
          node('trie-1', 'trie', 'Suggestion Trie', 1200, 120, { instances: 3 }),
          node('app-service-2', 'app-service', 'Query Logger', 720, 440, { instances: 8 }),
          node('message-queue-1', 'message-queue', 'Query Log', 960, 440),
          node('app-service-3', 'app-service', 'Aggregator', 1200, 440, { instances: 8 }),
          node('nosql-store-1', 'nosql-store', 'Query Frequencies', 1440, 440),
          node('analytics-1', 'analytics', 'Trie Builder', 1440, 240),
        ],
        edges: [
          edge('client-1', 'load-balancer-1', 'both'),
          edge('load-balancer-1', 'web-server-1', 'both'),
          edge('web-server-1', 'app-service-1', 'read'),
          edge('app-service-1', 'cache-1', 'read'),
          edge('app-service-1', 'trie-1', 'read'),
          edge('web-server-1', 'app-service-2', 'write'),
          edge('app-service-2', 'message-queue-1', 'write'),
          edge('message-queue-1', 'app-service-3', 'write'),
          edge('app-service-3', 'nosql-store-1', 'write'),
          edge('analytics-1', 'nosql-store-1', 'read'),
          edge('analytics-1', 'trie-1', 'write'),
        ],
      },
    },
  ],
}
