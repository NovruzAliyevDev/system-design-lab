// The hash map, from the primer's object-oriented design solution (`hash_map.py`): a HashTable keeps a
// table of buckets, hashes an integer key to a bucket and chains the Items that collide there, each Item
// holding its key and value.
//
// Rules find classes by their role rather than by name: the map is the class with `get` and `set`, an Item
// the class holding a key and a value. The map may hold its Items directly or through a Bucket class of
// its own. The reference UML mirrors the Python solution's two classes. Its table stays a field, the
// structure the map is built on, and the Items it chains are drawn as a relation.
import type { ChallengeInput } from '../../src/core/challenges/challenge'
import type { ClassSelector, RelationPredicate } from '../../src/core/challenges/rules'
import { umlClass, umlDesign, umlRelation } from './shared'

/** The class `get` and `set` are called on. */
const MAP: ClassSelector = { methods: ['get', 'set|put'] }
/** An entry of a bucket: the key, compared when keys collide, and its value. */
const ITEM: ClassSelector = { fields: ['key', 'value|val|data'] }
/** A bucket drawn as a class of its own, chaining the Items whose keys hash to it. */
const BUCKET: ClassSelector = { name: '(hash_?)?(bucket|chain|slot)|linked_?list' }
/** Holding any number of Items, created and removed with the map. */
const HOLDS: Omit<RelationPredicate, 'type' | 'from' | 'to'> = { kind: ['composition', 'aggregation'], toMultiplicity: '*' }

export const hashMap: ChallengeInput = {
  id: 'hash-map',
  title: 'Hash map dizayn edin',
  kind: 'ood',
  source: 'primer',
  codeSolutionId: 'hash_table',
  lessonIds: ['object-oriented-design-interview-questions-with-solutions'],
  stages: [
    {
      id: 'class-design',
      type: 'class-design',
      weight: 1,
      prompt:
        'Açara görə dəyəri yazan (set), oxuyan (get) və silən (remove) hash map-in siniflərini qurun. Primer-in fərziyyələri: açarlar tam ədəddir, collision-lar chaining ilə həll olunur, load factor-u izləmək lazım deyil, girişlər düzgündür və hamısı yaddaşa sığır. Sinifləri sahələri (field) və metodları ilə əlavə edin, aralarındakı əlaqələri (relation) növü və multiplicity ilə çəkin.',
      rules: [
        {
          id: 'map-api',
          weight: 2,
          description: 'Bir sinif hash map-in özüdür: get və set metodları var.',
          hints: [
            'Hash map-dən istifadə edən kod hansı iki əməliyyatı çağırır?',
            'Bir sinfə açara görə dəyəri qaytaran və açara dəyər yazan iki metod əlavə edin.',
            'Primer-də HashTable sinfinin set(key, value) və get(key) metodları var: set açar artıq varsa dəyərini yeniləyir, yoxdursa yeni Item əlavə edir; get açarın dəyərini qaytarır, tapmasa KeyError atır.',
          ],
          check: { type: 'class', class: MAP },
        },
        {
          id: 'map-remove',
          weight: 1,
          description: 'Hash map açarı silə bilir.',
          hints: [
            'Artıq lazım olmayan açarla nə etmək olar?',
            'Hash map sinfinə açarı və onun dəyərini silən metod əlavə edin.',
            'Primer-də HashTable-ın remove(key) metodu açarın bucket-ini tapır, orada Item-i silir, açar yoxdursa KeyError atır.',
          ],
          check: { type: 'member', class: MAP, method: 'remove|delete|del|pop|erase|discard' },
        },
        {
          id: 'buckets',
          weight: 2,
          description: 'Hash map dəyərləri bucket-lər cədvəlində (table) saxlayır.',
          hints: [
            'Açarın dəyərini bütün elementləri yoxlamadan haradan tapmaq olar?',
            'Hash map sinfinə bucket-lər massivi (table) sahəsi əlavə edin: hər bucket bir siyahıdır.',
            'Primer-də HashTable-ın table sahəsi size sayda boş siyahıdan ibarətdir: hər açar hash-inə görə bir bucket-ə düşür, collision olan açarlar eyni bucket-in siyahısına əlavə olunur (chaining).',
          ],
          check: { type: 'member', class: MAP, field: '.*(table|buckets?|slots|array|storage).*' },
        },
        {
          id: 'table-size',
          weight: 1,
          description: 'Hash map bucket-lərin sayını (size) bilir.',
          hints: [
            'Açarın hansı bucket-ə düşdüyünü hesablamaq üçün nəyi bilmək lazımdır?',
            'Hash map sinfinə bucket-lərin sayını saxlayan sahə əlavə edin.',
            'Primer-də HashTable size ilə yaradılır və table-da size sayda bucket olur; hash funksiyası açarı bu sayın modulu ilə bucket indeksinə çevirir.',
          ],
          check: { type: 'member', class: MAP, field: '.*(size|capacity|count|length).*' },
        },
        {
          id: 'hash-function',
          weight: 2,
          description: 'Hash map açarı bucket indeksinə çevirən hash funksiyasına malikdir.',
          hints: [
            'get, set və remove açarın bucket-ini eyni qaydada necə tapır?',
            'Hash map sinfinə açardan bucket indeksini hesablayan ayrıca metod əlavə edin.',
            'Primer-də HashTable-ın _hash_function(key) metodu key % size qaytarır. get, set və remove əvvəlcə onu çağırır, sonra yalnız o bucket-in siyahısına baxır: bucket-lər qısa olduqca əməliyyatlar O(1)-ə yaxındır.',
          ],
          check: { type: 'member', class: MAP, method: '_*(.*hash.*|(bucket_?)?index(_?(of|for))?)' },
        },
        {
          id: 'item',
          weight: 2,
          description: 'Hər element (Item) öz açarını və dəyərini saxlayır.',
          hints: [
            'İki açar eyni bucket-ə düşəndə, axtarılan dəyəri digərindən necə ayırmaq olar?',
            'Açarı və dəyəri saxlayan ayrıca bir Item sinfi əlavə edin.',
            'Primer-də Item key və value sahələrini saxlayır. Chaining-də bir bucket-də bir neçə Item ola bilər, ona görə get və remove onların açarını axtarılan açarla müqayisə edir: yalnız dəyəri saxlasaydıq, bunu edə bilməzdik.',
          ],
          check: { type: 'class', class: ITEM },
        },
        {
          id: 'table-holds-items',
          weight: 2,
          description: 'Hash map çox Item saxlayır: hash map-dən Item-ə (və ya bucket sinfindən keçərək) composition və ya aggregation, Item tərəfdə çoxluq (*).',
          hints: [
            'Bir hash map-də neçə Item ola bilər və onları kim yaradır?',
            'Hash map sinfindən Item sinfinə composition çəkin (hash map tərəfdə dolu romb) və Item ucuna * multiplicity verin.',
            'Primer-də Item-ləri set yaradır və remove silir: onlar yalnız hash map-in içində yaşayır, ona görə bu, composition-dur. Hash map tərəfdə 1, Item tərəfdə * (çox, boş hash map-də heç biri).',
          ],
          check: {
            type: 'any-of',
            predicates: [
              { type: 'relation', from: MAP, to: ITEM, ...HOLDS },
              { type: 'all-of', predicates: [{ type: 'relation', from: MAP, to: BUCKET, ...HOLDS }, { type: 'relation', from: BUCKET, to: ITEM, ...HOLDS }] },
            ],
          },
        },
      ],
      referenceSolution: umlDesign(
        [
          umlClass('class-1', 'HashTable', 0, 0, ['size: int', 'table: list'], ['_hash_function(key)', 'set(key, value)', 'get(key)', 'remove(key)']),
          umlClass('class-2', 'Item', 420, 0, ['key: int', 'value'], []),
        ],
        [umlRelation('class-1', 'class-2', 'composition', '1', '*')],
      ),
    },
  ],
}
