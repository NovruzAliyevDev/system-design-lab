// The LRU cache, from the primer's object-oriented design solution (`lru_cache.py`): a Cache answers
// `get` and `set` for web query results, keeping a lookup of query → Node for O(1) access and a LinkedList
// of the Nodes from the most to the least recently used, so that it can evict from the tail when full.
//
// Rules find classes by the role their members give them rather than by name, so that a learner's
// `LRUCache`, `Store` or `QueryCache` all count: the cache is the class with `get` and `set`, the list the
// one with a head and a tail or that moves entries to the front (or one named like a list), the node the
// one with `next` or holding the results (or one named like a node). Member patterns accept
// the usual synonyms; the two list operations must be two methods. The reference UML mirrors the Python
// solution's three classes and how they hold each other, drawing links to other objects as relations
// rather than also as fields. Its Node keeps the `query` the Cache reads off the tail when it evicts, which
// the primer's constructor leaves out, and its link to the next Node is a Node → Node association.
import type { ChallengeInput } from '../../src/core/challenges/challenge'
import type { ClassSelector, Predicate } from '../../src/core/challenges/rules'
import { anyClass, anyRelation, umlClass, umlDesign, umlRelation } from './shared'

/** Where a cache finds an entry by its key in O(1). */
const LOOKUP_FIELD = '.*(lookup|map|dict|table|index|hash|entries|nodes|items|store|cache).*'
/** The most entries the cache holds before it evicts. */
const CAPACITY_FIELD = '.*(max|capacity|limit).*'
/** Moving an entry to the front; no name an eviction would have, so that one method cannot be both. */
const MOVE_METHOD = 'move.*|.*to_?front.*|touch|promote|bump|refresh'
const EVICT_METHOD = '.*(remove|pop|evict|drop|delete).*'

/** The class `get` and `set` are called on. */
const CACHE: ClassSelector = { methods: ['get', 'set|put'] }
/** The list that keeps the Nodes in order of use: by its name, its ends, or by moving entries to the front. */
const LIST: ClassSelector[] = [{ name: '(doubly_?)?linked_?list|list|queue|deque' }, { fields: ['head', 'tail'] }, { methods: [MOVE_METHOD] }]
/** An entry of the list: by its name, the link to the next one, or the result it holds. */
const NODE: ClassSelector[] = [{ name: '(list_?)?node|entry|item' }, { fields: ['next'] }, { fields: ['results?|value|data'] }]

/** Any number of objects: an LRU cache starts empty, so none is allowed. */
const MANY = '*'

export const lruCache: ChallengeInput = {
  id: 'lru-cache',
  title: 'LRU cache dizayn edin',
  kind: 'ood',
  source: 'primer',
  codeSolutionId: 'lru_cache',
  lessonIds: ['object-oriented-design-interview-questions-with-solutions'],
  stages: [
    {
      id: 'class-design',
      type: 'class-design',
      weight: 1,
      prompt:
        'Veb sorğularının nəticələrini saxlayan LRU (least recently used) cache-in siniflərini qurun. Cache sorğuya görə nəticəni verir (get) və yeni nəticəni yazır (set); dolu olanda ən uzun müddət istifadə olunmamış nəticəni çıxarır. Hər iki əməliyyat O(1) olmalıdır. Primer-in fərziyyələri: girişlər düzgündür və hamısı yaddaşa sığır. Sinifləri sahələri (field) və metodları ilə əlavə edin, aralarındakı əlaqələri (relation) növü və multiplicity ilə çəkin.',
      rules: [
        {
          id: 'cache-api',
          weight: 2,
          description: 'Bir sinif cache-in özüdür: get və set metodları var.',
          hints: [
            'Cache-dən istifadə edən kod hansı iki əməliyyatı çağırır?',
            'Bir sinfə nəticəni sorğuya görə qaytaran və yeni nəticəni yazan iki metod əlavə edin.',
            'Primer-də Cache sinfinin get(query) və set(results, query) metodları var: get nəticəni qaytarır, set onu yazır və lazım olsa, ən köhnəsini çıxarır.',
          ],
          check: { type: 'class', class: CACHE },
        },
        {
          id: 'cache-lookup',
          weight: 2,
          description: 'Cache açara görə entry-ni O(1)-də tapmaq üçün hash map (lookup) saxlayır.',
          hints: [
            'Siyahıda gəzmədən sorğuya uyğun nəticəni necə dərhal tapmaq olar?',
            'Cache sinfinə açarı (sorğunu) entry-yə bağlayan bir sahə əlavə edin: dict, map və ya hash table.',
            'Primer-də Cache-in lookup sahəsi var: sorğu → Node. get və set ona baxaraq entry-ni O(1)-də tapır, siyahıda axtarmır.',
          ],
          check: { type: 'member', class: CACHE, field: LOOKUP_FIELD },
        },
        {
          id: 'cache-capacity',
          weight: 1,
          description: 'Cache tutumunu (neçə entry saxlaya bildiyini) bilir.',
          hints: [
            'Cache nə vaxt ən köhnə nəticəni çıxarmalı olduğunu haradan bilir?',
            'Cache sinfinə ən çox neçə entry saxlayacağını göstərən sahə əlavə edin.',
            'Primer-də Cache MAX_SIZE ilə yaradılır və size sahəsində neçə entry-nin olduğunu sayır; size MAX_SIZE-a çatanda set yeni entry-dən əvvəl tail-i çıxarır.',
          ],
          check: { type: 'member', class: CACHE, field: CAPACITY_FIELD },
        },
        {
          id: 'usage-order',
          weight: 2,
          description: 'Entry-ləri son istifadə sırası ilə saxlayan siyahı sinfi var: ən yenisi əvvəldə (head), ən köhnəsi sonda (tail).',
          hints: [
            'Ən uzun müddət istifadə olunmamış entry-ni hər dəfə hamısını yoxlamadan necə tapmaq olar?',
            'Entry-ləri istifadə sırası ilə saxlayan, əvvəli və sonu olan bir siyahı sinfi əlavə edin.',
            'Primer-də LinkedList head və tail sahələri ilə entry-ləri ən yenidən ən köhnəyə qədər saxlayır: yeni və ya oxunan entry əvvələ keçir, çıxarılacaq entry həmişə tail-dədir.',
          ],
          check: anyClass(LIST),
        },
        {
          id: 'list-operations',
          weight: 2,
          description: 'Siyahı entry-ni əvvələ keçirə və ən köhnəsini sondan çıxara bilir.',
          hints: [
            'Entry oxunanda və cache dolanda siyahı ilə nə baş verməlidir?',
            'Siyahı sinfinə iki metod əlavə edin: entry-ni əvvələ keçirən və tail-dəki entry-ni silən.',
            'Primer-də LinkedList-in move_to_front(node), append_to_front(node) və remove_from_tail() metodları var: get və set entry-ni əvvələ keçirir, dolu cache tail-i silir. İkiqat bağlı siyahıda hər üçü O(1)-dir.',
          ],
          check: { type: 'any-of', predicates: LIST.map((selector): Predicate => ({ type: 'class', class: { ...selector, methods: [MOVE_METHOD, EVICT_METHOD] } })) },
        },
        {
          id: 'node',
          weight: 1,
          description: 'Siyahının hər entry-si ayrıca Node sinfidir və növbəti entry-yə bağlanır.',
          hints: [
            'Siyahının hər elementi nəyi saxlayır və növbətisini haradan tanıyır?',
            'Nəticəni və növbəti elementə keçidi saxlayan bir Node sinfi əlavə edin.',
            'Primer-də Node sorğunun nəticəsini (results) və next keçidini saxlayır; Cache ən köhnəni çıxaranda tail-in sorğusunu (query) oxuyur, ona görə Node sorğunu da saxlamalıdır. Növbəti Node-a keçidi Node-dan Node-a association kimi çəkmək olar.',
          ],
          check: anyClass(NODE),
        },
        {
          id: 'cache-owns-list',
          weight: 2,
          description: 'Cache öz siyahısına sahibdir (composition): siyahı cache ilə yaranır və onunla yox olur.',
          hints: [
            'Siyahı cache-dən ayrı yaşayırmı, yoxsa onun bir hissəsidir?',
            'Cache-dən siyahı sinfinə composition əlaqəsi çəkin (cache tərəfdə dolu romb).',
            'Primer-də Cache siyahını öz __init__-ində yaradır (self.linked_list = LinkedList()), ona görə siyahı Cache-in hissəsidir: bu, composition-dur, hər cache-in bir siyahısı var.',
          ],
          check: anyRelation([CACHE], LIST, { kind: 'composition' }),
        },
        {
          id: 'list-holds-nodes',
          weight: 2,
          description: 'Siyahı çox Node saxlayır: siyahıdan Node-a aggregation və ya composition, Node tərəfdə çoxluq (*).',
          hints: [
            'Bir siyahıda neçə Node ola bilər?',
            'Siyahıdan Node sinfinə aggregation (və ya composition) çəkin və Node ucuna * multiplicity verin.',
            'Primer-də LinkedList head-dən tail-ə qədər istənilən sayda Node saxlayır: siyahı tərəfdə 1, Node tərəfdə * (çox, boş cache-də heç biri). Node-ları Cache yaradır, siyahı onları sıralayır, ona görə aggregation uyğundur.',
          ],
          check: anyRelation(LIST, NODE, { kind: ['aggregation', 'composition'], toMultiplicity: MANY }),
        },
        {
          id: 'lookup-nodes',
          weight: 1,
          description: 'Cache lookup vasitəsilə çox Node-a birbaşa çatır: Cache-dən Node-a əlaqə, Node tərəfdə *.',
          hints: [
            'lookup sorğunu nəyə bağlayır?',
            'Cache-dən Node sinfinə əlaqə çəkin (association; Node-ları Cache yaratdığı üçün composition da olar) və Node ucuna * multiplicity verin.',
            'Primer-də lookup sorğunu Node-a bağlayır (key: query, value: node), ona görə Cache çox Node-u tanıyır: Cache tərəfdə 1, Node tərəfdə *. Node-ları set yaradır və çıxarır, ona görə bunu composition kimi də oxumaq olar.',
          ],
          check: anyRelation([CACHE], NODE, { kind: ['association', 'aggregation', 'composition'], toMultiplicity: MANY }),
        },
      ],
      referenceSolution: umlDesign(
        [
          umlClass('class-1', 'Cache', 0, 200, ['MAX_SIZE: int', 'size: int', 'lookup: dict'], ['get(query)', 'set(results, query)']),
          umlClass('class-2', 'LinkedList', 420, 0, [], ['move_to_front(node)', 'append_to_front(node)', 'remove_from_tail()']),
          umlClass('class-3', 'Node', 840, 200, ['query', 'results'], []),
        ],
        [
          umlRelation('class-1', 'class-2', 'composition', '1', '1'),
          umlRelation('class-2', 'class-3', 'aggregation', '1', '*'),
          umlRelation('class-1', 'class-3', 'association', '1', '*'),
          // next (and prev, for a doubly linked list): each Node links to at most one other.
          umlRelation('class-3', 'class-3', 'association', '0..1', '0..1'),
        ],
      ),
    },
  ],
}
