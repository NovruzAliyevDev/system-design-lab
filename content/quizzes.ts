// Authored Quizzes, each shown at the end of its Lesson. The Content Pipeline validates them when it
// builds the catalog: a schema error or an unknown Lesson id fails the build. Prompts, options and
// explanations are Azerbaijani; technical terms stay English. Every option has an explanation, so a
// wrong answer still teaches something.
//
// A Quiz's id stores its results, so it stays the same when the Lesson it is shown in is renamed.
// Options are wrong unless marked `correct`. Ordering items are written in the right order (the app
// scrambles them). A "which component fits" flow marks the blank with "?".
import type { QuizInput } from '../src/core/quizzes/quiz'

export const quizzes: QuizInput[] = [
  // Cache
  {
    id: 'cache',
    lessonId: 'cache',
    questions: [
      {
        type: 'multiple-choice',
        prompt: 'Keşi verilənlər bazasının qarşısına qoymaq nəyə kömək edir?',
        options: [
          {
            text: 'Qeyri-bərabər yükü və trafik sıçrayışlarını udmağa',
            correct: true,
            explanation:
              'Populyar elementlər oxuma və yazmaların partition-lar arasında bərabər paylanmasını pozur və darboğaz yaradır. Bazanın qarşısındakı keş bu yükü və sıçrayışları udur.',
          },
          {
            text: 'Bazadakı məlumatın həmişə aktual qalmasına',
            explanation:
              'Əksinə: keş məlumatın əlavə nüsxəsidir və köhnə (stale) məlumat riski yaradır. Keşlə baza arasındakı consistency-ni ayrıca qorumaq lazımdır.',
          },
          {
            text: 'Yazma əməliyyatlarını tamamilə aradan qaldırmağa',
            explanation: 'Keş əsasən oxumaları sürətləndirir. Yazmalar yenə də bazaya çatmalıdır: birbaşa və ya keşin özü vasitəsilə.',
          },
        ],
      },
      {
        type: 'component-fit',
        prompt: 'Eyni sorğunun nəticəsi hər dəfə yenidən hesablanmasın deyə boş yerə hansı komponent uyğundur?',
        flow: ['Client', 'Web server', '?', 'Database'],
        options: [
          {
            text: 'Cache',
            correct: true,
            explanation: 'Keş əvvəlki sorğunun nəticəsini saxlayır. Dispatcher əvvəlcə orada axtarır və nəticəni tapsa, sorğunu yenidən icra etmir.',
          },
          {
            text: 'Load balancer',
            explanation: 'Load balancer sorğuları serverlər arasında paylayır, amma nəticələri saxlamır: hər sorğu yenə də icra olunur.',
          },
          {
            text: 'Message queue',
            explanation: 'Queue işi sonra emal etmək üçün saxlayır, hazır nəticəni qaytarmır. Oxuma sorğusu yenə də bazaya getməlidir.',
          },
        ],
      },
    ],
  },
  {
    id: 'client-caching',
    lessonId: 'client-caching',
    questions: [
      {
        type: 'multi-select',
        prompt: 'Primer-ə görə keş harada yerləşə bilər? Bütün doğru cavabları seçin.',
        options: [
          {
            text: 'Client tərəfində (OS və ya brauzer)',
            correct: true,
            explanation: 'Brauzer və əməliyyat sistemi cavabları yerli saxlayır, ona görə də təkrar sorğu şəbəkəyə heç çıxmaya bilər.',
          },
          {
            text: 'Server tərəfində (reverse proxy, web server)',
            correct: true,
            explanation: 'Reverse proxy və ya web server cavabı özü qaytara bilər, onda application server-ə müraciət lazım olmur.',
          },
          {
            text: 'Ayrıca keş qatında',
            correct: true,
            explanation: 'Memcached və ya Redis kimi ayrıca keş qatı tətbiqlə baza arasında dayanır.',
          },
          {
            text: 'Yalnız verilənlər bazasının daxilində',
            explanation: 'Bazanın da daxili keşi var, amma keş təkcə orada olmur: primer client, server və ayrıca keş qatını da sadalayır.',
          },
        ],
      },
    ],
  },
  {
    id: 'cdn-caching',
    lessonId: 'cdn-caching',
    questions: [
      {
        type: 'multiple-choice',
        prompt: 'CDN-i niyə keş növü saymaq olar?',
        options: [
          {
            text: 'Məzmunun nüsxəsini istifadəçiyə yaxın serverlərdə saxlayıb oradan verdiyi üçün',
            correct: true,
            explanation: 'CDN məzmunun nüsxələrini saxlayır, sorğuya origin server əvəzinə yaxın node-dan cavab verir. Keşin etdiyi də budur.',
          },
          {
            text: 'Verilənlər bazasının sorğu nəticələrini saxladığı üçün',
            explanation: 'CDN adətən statik məzmunu (şəkil, CSS, JavaScript, bəzən HTML) paylayır, bazanın sorğu nəticələrini yox.',
          },
          {
            text: 'Yazmaları bazaya asinxron ötürdüyü üçün',
            explanation: 'Bu, write-behind strategiyasıdır. CDN-in işi məzmunu istifadəçiyə yaxın yerdən verməkdir, yazmaları ötürmək yox.',
          },
        ],
      },
    ],
  },
  {
    id: 'web-server-caching',
    lessonId: 'web-server-caching',
    questions: [
      {
        type: 'component-fit',
        prompt: 'Statik və dinamik məzmunu application server-ə getmədən qaytarmaq üçün boş yerə hansı komponent uyğundur?',
        flow: ['Client', '?', 'Application server'],
        options: [
          {
            text: 'Reverse proxy (Varnish kimi keşlə)',
            correct: true,
            explanation: 'Reverse proxy və Varnish kimi keşlər məzmunu birbaşa qaytara bilir, cavab üçün application server-ə müraciət lazım olmur.',
          },
          {
            text: 'DNS',
            explanation: 'DNS domen adını IP ünvanına çevirir. O, HTTP cavablarını saxlamır və qaytarmır.',
          },
          {
            text: 'Message queue',
            explanation: 'Queue tapşırıqları asinxron emal üçün saxlayır. Client-ə hazır cavab qaytarmır.',
          },
        ],
      },
    ],
  },
  {
    id: 'database-caching',
    lessonId: 'database-caching',
    questions: [
      {
        type: 'multiple-choice',
        prompt: 'Verilənlər bazasının daxili keşi haqqında hansı fikir doğrudur?',
        options: [
          {
            text: 'Default konfiqurasiya ümumi hal üçündür; onu öz yükünüzə görə tənzimləmək performansı artırır',
            correct: true,
            explanation: 'Baza adətən ümumi istifadə üçün optimallaşdırılmış keşlə gəlir. Ayarları öz sorğu nümunələrinizə uyğunlaşdırmaq əlavə sürət verir.',
          },
          {
            text: 'Daxili keş olduğu üçün ayrıca keş qatı heç vaxt lazım deyil',
            explanation: 'Daxili keş ümumi hal üçündür. Böyük yükdə Memcached və ya Redis kimi ayrıca keş qatı yenə də faydalıdır.',
          },
          {
            text: 'Bazanın daxili keşi yalnız yazmaları sürətləndirir',
            explanation: 'Bazanın keşi əsasən tez-tez oxunan məlumatı yaddaşda saxlayır, yəni ilk növbədə oxumaları sürətləndirir.',
          },
        ],
      },
    ],
  },
  {
    id: 'application-caching',
    lessonId: 'application-caching',
    questions: [
      {
        type: 'multiple-choice',
        prompt: 'Memcached və Redis niyə tipik verilənlər bazasından daha sürətlidir?',
        options: [
          {
            text: 'Məlumatı RAM-da saxladıqları üçün',
            correct: true,
            explanation: 'RAM diskdən çox sürətlidir: primer-in latency rəqəmlərində yaddaşdan oxumaq diskdən oxumaqdan qat-qat tezdir.',
          },
          {
            text: 'Məlumatı sıxılmış halda diskdə saxladıqları üçün',
            explanation: 'Onların sürəti diskdən yox, RAM-dan gəlir. Disk istənilən halda yaddaşdan yavaşdır.',
          },
          {
            text: 'SQL sorğularını daha yaxşı optimallaşdırdıqları üçün',
            explanation: 'Memcached və Redis key-value store-dur, SQL sorğusu icra etmirlər. Sürət məlumatın yaddaşda olmasındandır.',
          },
        ],
      },
      {
        type: 'multi-select',
        prompt: 'Primer Redis-in hansı əlavə imkanlarını qeyd edir? Bütün doğru cavabları seçin.',
        options: [
          {
            text: 'Persistence seçimi',
            correct: true,
            explanation: 'Redis məlumatı diskə də yaza bilir, ona görə də yenidən başladıqdan sonra keş boş qalmaya bilər.',
          },
          {
            text: 'Sorted set və list kimi daxili data structure-lar',
            correct: true,
            explanation: 'Redis sadə key-value-dan əlavə sorted set, list kimi strukturlar verir (məsələn, reytinq cədvəlləri üçün).',
          },
          {
            text: 'RAM-dan asılı olmaması',
            explanation: 'Redis də in-memory keşdir. Persistence yalnız əlavə seçimdir, məlumat yenə də RAM-da saxlanılır və oradan oxunur.',
          },
          {
            text: 'SQL join dəstəyi',
            explanation: 'Redis key-value store-dur və cədvəlləri join etmir. Bu, relational bazaların işidir.',
          },
        ],
      },
      {
        type: 'multiple-choice',
        prompt: 'RAM məhduddur. LRU (least recently used) keşdən hansı girişləri çıxarır?',
        options: [
          {
            text: 'Ən uzun müddətdir müraciət olunmayan, "soyuq" girişləri',
            correct: true,
            explanation: 'LRU son vaxtlar istifadə olunmayan girişləri çıxarır və "isti" məlumatı RAM-da saxlayır.',
          },
          {
            text: 'Nə qədər oxunmasından asılı olmayaraq, ən əvvəl yazılmış girişləri',
            explanation: 'Bu, FIFO-dur. LRU yazılma vaxtına yox, son müraciət vaxtına baxır.',
          },
          {
            text: 'Ən böyük girişləri',
            explanation: 'Ölçüyə görə çıxarmaq başqa siyasətdir. LRU yalnız son müraciət vaxtına baxır.',
          },
        ],
      },
      {
        type: 'multiple-choice',
        prompt: 'Primer niyə file-based caching-dən qaçmağı tövsiyə edir?',
        options: [
          {
            text: 'Serverləri klonlamağı və auto-scaling-i çətinləşdirdiyi üçün',
            correct: true,
            explanation:
              'Keş hər serverin öz diskində olanda serverlər eyni olmur və yeni server boş keşlə başlayır. Bu, klonlamağı və avtomatik miqyaslamanı çətinləşdirir.',
          },
          {
            text: 'Disk RAM-dan bahalı olduğu üçün',
            explanation: 'Disk əslində RAM-dan ucuzdur. Problem qiymətdə yox, serverin öz daxilində vəziyyət (state) saxlamasındadır.',
          },
          {
            text: 'Fayllarda yalnız HTML saxlamaq mümkün olduğu üçün',
            explanation: 'Faylda istənilən məlumatı saxlamaq olar. Problem formatda yox, keşin bir serverə bağlı qalmasındadır.',
          },
        ],
      },
    ],
  },
  {
    id: 'caching-at-the-database-query-level',
    lessonId: 'caching-at-the-database-query-level',
    questions: [
      {
        type: 'multiple-choice',
        prompt: 'Sorğu səviyyəsində keşləmədə nəticə keşdə hansı açarla (key) saxlanılır?',
        options: [
          {
            text: 'Sorğunun hash-i ilə',
            correct: true,
            explanation: 'Hər sorğu hash-lənir və nəticə bu hash açarı ilə keşə yazılır. Eyni sorğu təkrarlananda nəticə keşdən gəlir.',
          },
          {
            text: 'Cədvəlin adı ilə',
            explanation: 'Bir cədvələ çoxlu fərqli sorğu ola bilər. Açar cədvəli yox, sorğunun özünü təmsil etməlidir.',
          },
          {
            text: 'İstifadəçinin id-si ilə',
            explanation: 'Açarı məlumatın öz id-sinə görə qurmaq obyekt səviyyəsində keşləməyə yaxındır. Sorğu səviyyəsində açar sorğunun hash-idir.',
          },
        ],
      },
      {
        type: 'multi-select',
        prompt: 'Bu yanaşmanın hansı expiration problemləri var? Bütün doğru cavabları seçin.',
        options: [
          {
            text: 'Mürəkkəb sorğuların keşlənmiş nəticəsini silmək çətindir',
            correct: true,
            explanation: 'Mürəkkəb sorğunun hansı məlumata bağlı olduğunu bilmək çətindir, ona görə də onun nəticəsini vaxtında silmək çətindir.',
          },
          {
            text: 'Bir xana dəyişəndə onu ehtiva edə biləcək bütün keşlənmiş sorğuları silmək lazımdır',
            correct: true,
            explanation: 'Bir cədvəl xanası çoxlu sorğunun nəticəsində ola bilər. Hamısını tapıb silmək lazımdır, yoxsa köhnə nəticə qalar.',
          },
          {
            text: 'Hash hesablamaq sorğunu bazadan da yavaş edir',
            explanation: 'Hash hesablamaq bazaya getməkdən qat-qat ucuzdur. Problem sürətdə yox, köhnəlmiş nəticələri vaxtında silməkdədir.',
          },
          {
            text: 'Sorğu nəticələri keşə yazıla bilmir',
            explanation: 'Nəticələr keşə rahat yazılır, yanaşmanın mahiyyəti də budur. Çətinlik onları vaxtında silməkdədir (invalidation).',
          },
        ],
      },
    ],
  },
  {
    id: 'caching-at-the-object-level',
    lessonId: 'caching-at-the-object-level',
    questions: [
      {
        type: 'multiple-choice',
        prompt: 'Obyektin əsasındakı məlumat dəyişəndə nə etmək lazımdır?',
        options: [
          {
            text: 'Həmin obyekti keşdən silmək',
            correct: true,
            explanation: 'Obyekt səviyyəsində invalidation sadədir: məlumat dəyişəndə həmin obyekt keşdən silinir və növbəti oxuda yenidən yığılır.',
          },
          {
            text: 'Bütün keşi təmizləmək',
            explanation: 'Bütün keşi silmək lazımsızdır və bazaya qəfil böyük yük yaradır. Yalnız dəyişən obyekti silmək kifayətdir.',
          },
          {
            text: 'Heç nə: TTL bitəndə obyekt özü yenilənəcək',
            explanation: 'TTL köhnə məlumatın nə qədər qalacağını məhdudlaşdırır, amma TTL bitənə qədər istifadəçilər köhnə obyekti görəcək.',
          },
        ],
      },
      {
        type: 'multi-select',
        prompt: 'Primer obyekt səviyyəsində nəyi keşləməyi təklif edir? Bütün doğru cavabları seçin.',
        options: [
          {
            text: 'User session-lar',
            correct: true,
            explanation: 'Session hər sorğuda lazım olur və tez-tez oxunur, ona görə də keş üçün yaxşı namizəddir.',
          },
          {
            text: 'Tam render olunmuş veb səhifələr',
            correct: true,
            explanation: 'Hazır səhifəni keşdən vermək səhifəni hər dəfə yenidən qurmaqdan çox ucuzdur.',
          },
          {
            text: 'Activity stream-lər və user graph məlumatı',
            correct: true,
            explanation: 'Bunları yığmaq çoxlu sorğu tələb edir, amma oxunma sayı dəyişmə sayından çoxdur. Hazır obyekt kimi keşləmək sərfəlidir.',
          },
          {
            text: 'Hər SQL sorğusunun xam nəticəsi',
            explanation: 'Bu, sorğu səviyyəsində keşləmədir və invalidation problemləri var. Obyekt səviyyəsində tam yığılmış obyekt saxlanılır.',
          },
        ],
      },
    ],
  },
  {
    id: 'when-to-update-the-cache',
    lessonId: 'when-to-update-the-cache',
    questions: [
      {
        type: 'ordering',
        prompt: 'Cache-aside-da cache miss olanda tətbiqin addımlarını sıraya düzün.',
        items: [
          { text: 'Girişi keşdə axtar', explanation: 'Tətbiq əvvəlcə keşə baxır. Giriş yoxdursa, bu, cache miss-dir.' },
          { text: 'Girişi bazadan yüklə', explanation: 'Keşdə olmayan məlumat bazadan oxunur.' },
          { text: 'Girişi keşə əlavə et', explanation: 'Növbəti oxu sürətli olsun deyə nəticə keşə yazılır.' },
          { text: 'Girişi qaytar', explanation: 'Sonda tətbiq nəticəni çağırana qaytarır.' },
        ],
      },
      {
        type: 'multiple-choice',
        prompt: 'Hansı strategiyada keşin özü məlumatı bazaya sinxron yazır?',
        options: [
          {
            text: 'Write-through',
            correct: true,
            explanation: 'Tətbiq keşə yazır, keş də girişi bazaya sinxron yazır, sonra cavab qaytarılır. Yazma yavaşdır, amma keşdəki məlumat köhnə olmur.',
          },
          {
            text: 'Cache-aside',
            explanation: 'Cache-aside-da keş bazaya toxunmur: bazadan oxumanı və bazaya yazmanı tətbiq özü edir.',
          },
          {
            text: 'Write-behind',
            explanation: 'Write-behind da əvvəl keşə yazır, amma bazaya asinxron, sonradan ötürür.',
          },
          {
            text: 'Refresh-ahead',
            explanation: 'Refresh-ahead müddəti bitmək üzrə olan girişləri əvvəlcədən yeniləyir. O, yazma strategiyası deyil.',
          },
        ],
      },
      {
        type: 'multiple-choice',
        prompt: 'Keş məlumatı bazaya yazmazdan əvvəl çökərsə, hansı strategiyada məlumat itə bilər?',
        options: [
          {
            text: 'Write-behind (write-back)',
            correct: true,
            explanation: 'Write-behind yazmanı əvvəl keşə edir, bazaya isə sonra asinxron ötürür. Keş bundan əvvəl çökərsə, məlumat itir.',
          },
          {
            text: 'Write-through',
            explanation: 'Write-through bazaya sinxron yazır: cavab qaytarılanda məlumat artıq bazadadır.',
          },
          {
            text: 'Cache-aside',
            explanation: 'Cache-aside-da yazmalar birbaşa bazaya gedir. Keş yalnız oxunmuş məlumatın nüsxəsini saxlayır.',
          },
        ],
      },
      {
        type: 'multi-select',
        prompt: 'Cache-aside-ın çatışmazlıqları hansılardır? Bütün doğru cavabları seçin.',
        options: [
          {
            text: 'Hər cache miss üç səfər tələb edir',
            correct: true,
            explanation: 'Keşə, bazaya, sonra yenə keşə: miss olanda üç əməliyyat lazımdır və bu, hiss olunan gecikmə yarada bilər.',
          },
          {
            text: 'Bazada yenilənən məlumat keşdə köhnələ bilər',
            correct: true,
            explanation: 'Keş yazmalardan xəbər tutmur. Bunu TTL ilə və ya write-through ilə birlikdə istifadə edərək azaltmaq olar.',
          },
          {
            text: 'Node çökəndə yerinə gələn boş node gecikməni artırır',
            correct: true,
            explanation: 'Yeni node boş başlayır, ona görə də ilk sorğular miss olur və bazaya gedir.',
          },
          {
            text: 'Heç kimin sorğulamadığı məlumat da keşi doldurur',
            explanation: 'Əksinə: cache-aside (lazy loading) yalnız sorğulanan məlumatı keşləyir. Bu, write-through-un çatışmazlığıdır.',
          },
          {
            text: 'Keş çökəndə hələ bazaya yazılmamış məlumat itir',
            explanation: 'Bu, write-behind-ın riskidir. Cache-aside-da yazmalar birbaşa bazaya gedir.',
          },
        ],
      },
      {
        type: 'multiple-choice',
        prompt: 'Refresh-ahead nə vaxt performansı əksinə pisləşdirir?',
        options: [
          {
            text: 'Hansı girişlərin lazım olacağı düzgün proqnozlaşdırılmayanda',
            correct: true,
            explanation: 'Refresh-ahead lazım olacağını təxmin etdiyi girişləri əvvəlcədən yeniləyir. Proqnoz səhv olanda boş yerə iş görülür və performans azalır.',
          },
          {
            text: 'Yazmalar oxumalardan çox olanda',
            explanation: 'Refresh-ahead oxunan girişlərin vaxtında yenilənməsinə aiddir. Primer onun çatışmazlığı kimi yalnız səhv proqnozu göstərir.',
          },
          {
            text: 'Keşdəki girişlərin TTL-i olanda',
            explanation: 'Refresh-ahead məhz TTL bitməzdən əvvəl yeniləmə üçündür. TTL olmadan onun mənası olmazdı.',
          },
        ],
      },
    ],
  },
  {
    id: 'disadvantages-cache',
    lessonId: 'disadvantages-cache',
    questions: [
      {
        type: 'multi-select',
        prompt: 'Primer keşin hansı çatışmazlıqlarını göstərir? Bütün doğru cavabları seçin.',
        options: [
          {
            text: 'Keşlə məlumat mənbəyi (məsələn, baza) arasında consistency qorumaq lazımdır',
            correct: true,
            explanation: 'Keş məlumatın ikinci nüsxəsidir. Mənbə dəyişəndə keşi cache invalidation ilə yeniləmək lazımdır.',
          },
          {
            text: 'Cache invalidation çətindir və keşi nə vaxt yeniləmək əlavə mürəkkəblik gətirir',
            correct: true,
            explanation: 'Hansı girişin nə vaxt köhnəldiyini bilmək çətindir, buna görə də yeniləmə strategiyası seçmək lazım gəlir.',
          },
          {
            text: 'Tətbiqdə dəyişiklik lazımdır, məsələn, Redis və ya Memcached əlavə etmək',
            correct: true,
            explanation: 'Keş qatı yeni komponentdir: onu qurmaq, tətbiqdən çağırmaq və idarə etmək lazımdır.',
          },
          {
            text: 'Oxuma gecikməsini artırır',
            explanation: 'Cache hit olanda oxuma sürətlənir. Gecikmə yalnız miss-də, əlavə səfər qədər artır.',
          },
          {
            text: 'Bazaya yükü artırır',
            explanation: 'Keş bazaya yükü azaldır: hit olan sorğular bazaya heç çatmır.',
          },
        ],
      },
    ],
  },
]
