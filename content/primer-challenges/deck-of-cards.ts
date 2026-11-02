// The deck of cards, from the primer's object-oriented design solution (`deck_of_cards.py`): a generic
// Deck deals Cards of a Suit into Hands, and blackjack extends it, a BlackJackCard counting face cards as
// 10 and a BlackJackHand scoring with aces as 1 or 11.
//
// Rules find the generic classes by their role rather than by name: a card is the class with a suit (or
// one named like a card), the deck the class that deals, a hand the class that adds cards and scores them.
// Blackjack is found as the subclasses of the generic Card and Hand. The reference UML mirrors the Python
// solution's classes, its Suit Enum as an enumeration whose fields are its values, and draws the cards of
// a Deck and a Hand as relations only.
import type { ChallengeInput } from '../../src/core/challenges/challenge'
import type { ClassSelector, Predicate, RelationPredicate } from '../../src/core/challenges/rules'
import { ABSTRACT, anyRelation, MANY_OR_SOME, umlClass, umlDesign, umlRelation } from './shared'

/** What a card is worth: its value or rank. */
const VALUE_FIELD = 'value|rank|face|number'
/** A card: by its name or its suit. */
const CARD: ClassSelector[] = [{ name: '(playing_?)?card' }, { fields: ['suit'] }]
/** The deck: by its name or by dealing cards. */
const DECK: ClassSelector[] = [{ name: 'deck' }, { methods: ['deal.*'] }]
/** Scoring the cards of a hand. */
const SCORE_METHOD = '.*score.*|total.*'
/** What a hand does: add a card and score the cards it holds. */
const HAND_METHODS = ['add.*', SCORE_METHOD]
/** A hand: by its name or by adding cards and scoring them. */
const HAND: ClassSelector[] = [{ name: 'hand' }, { methods: HAND_METHODS }]
/** A blackjack card: by its name, or by knowing an ace or a face card, which blackjack counts differently. */
const BLACKJACK_CARD: ClassSelector[] = [{ name: '.*black_?jack.*' }, { methods: ['is_?ace|is_?face.*|.*face_?card.*'] }]
/** Making a generic class into a game's own: subclassing it, or implementing it when it is an interface. */
const EXTENDS: Pick<RelationPredicate, 'kind'> = { kind: ['inheritance', 'implementation'] }

export const deckOfCards: ChallengeInput = {
  id: 'deck-of-cards',
  title: 'Kart dəstəsi (deck of cards) dizayn edin',
  kind: 'ood',
  source: 'primer',
  codeSolutionId: 'deck_of_cards',
  lessonIds: ['object-oriented-design-interview-questions-with-solutions'],
  stages: [
    {
      id: 'class-design',
      type: 'class-design',
      weight: 1,
      prompt:
        'Poker, blackjack kimi oyunlar üçün ümumi kart dəstəsinin (deck of cards) siniflərini qurun, sonra onu blackjack üçün genişləndirin. Primer-in fərziyyələri: dəstədə 52 kart var (2-10, Jack, Queen, King, Ace) və 4 suit; girişlər düzgündür. Sinifləri sahələri (field) və metodları ilə əlavə edin, aralarındakı əlaqələri (relation) növü və multiplicity ilə çəkin.',
      rules: [
        {
          id: 'card',
          weight: 2,
          description: 'Kart ayrıca Card sinfidir: dəyərini (value) və suit-ini bilir.',
          hints: [
            'Bir kartı digərindən nə ayırır?',
            'Dəyər və suit sahələri olan bir Card sinfi əlavə edin.',
            'Primer-də Card value və suit sahələrini, bir də is_available-ı (kart hələ paylanmayıb) saxlayır: 52 kartın hər biri dəyəri və suit-i ilə təkdir.',
          ],
          check: { type: 'class', class: { fields: ['suit', VALUE_FIELD] } },
        },
        {
          id: 'suit-enum',
          weight: 1,
          description: 'Suit enum-dur: HEART, DIAMOND, CLUBS, SPADE.',
          hints: [
            'Kartın suit-i hansı dəyərləri ala bilər?',
            'Növü enum olan bir Suit sinfi əlavə edin və dörd suit-i onun sahələri kimi yazın.',
            'Primer-də Suit Enum-dur: HEART, DIAMOND, CLUBS, SPADE. Card suit: Suit sahəsini saxlayır; sabit dörd dəyər səhv suit yazmağa imkan vermir.',
          ],
          check: { type: 'class', class: { kind: 'enum', fields: ['hearts?', 'diamonds?', 'clubs?', 'spades?'] } },
        },
        {
          id: 'deck',
          weight: 2,
          description: 'Deck kartları qarışdırır (shuffle) və bir-bir paylayır (deal_card).',
          hints: [
            'Oyunun əvvəlində və gedişində dəstə ilə nə edirik?',
            'Bir Deck sinfi əlavə edin: kartları qarışdıran və növbəti kartı paylayan metodlarla.',
            'Primer-də Deck-in shuffle() və deal_card() metodları var: deal_card deal_index-dəki kartı verir, onu artıq əlçatan olmayan kimi işarələyir və indeksi irəli çəkir; remaining_cards() neçə kartın qaldığını deyir.',
          ],
          check: { type: 'class', class: { methods: ['deal.*', 'shuffle'] } },
        },
        {
          id: 'deck-holds-cards',
          weight: 2,
          description: 'Deck çox Card saxlayır: Deck-dən Card-a aggregation və ya composition, Card tərəfdə çoxluq (*).',
          hints: [
            'Bir dəstədə neçə kart var?',
            'Deck-dən Card sinfinə aggregation çəkin və Card ucuna * multiplicity verin.',
            'Primer-də Deck cards siyahısı ilə yaradılır: kartlar ondan kənarda yaranır və ona verilir, ona görə aggregation uyğundur. Deck tərəfdə 1, Card tərəfdə * (52 kart).',
          ],
          check: anyRelation(DECK, CARD, { kind: ['aggregation', 'composition'], toMultiplicity: MANY_OR_SOME }),
        },
        {
          id: 'hand',
          weight: 1,
          description: 'Oyunçunun əli ayrıca Hand sinfidir: kart əlavə edir və xalı hesablayır.',
          hints: [
            'Paylanan kartlar hara gedir və onlarla nə hesablanır?',
            'Bir Hand sinfi əlavə edin: kart əlavə edən və əlin xalını qaytaran metodlarla.',
            'Primer-də Hand-in add_card(card) və score() metodları var: score kartların dəyərlərini toplayır. Hər oyun xalı öz qaydası ilə hesablaya bilsin deyə score alt sinifdə dəyişdirilir.',
          ],
          check: { type: 'class', class: { methods: HAND_METHODS } },
        },
        {
          id: 'hand-holds-cards',
          weight: 2,
          description: 'Hand çox Card saxlayır, amma onlara sahib deyil: Hand-dən Card-a aggregation və ya association, Card tərəfdə çoxluq (*).',
          hints: [
            'Əldəki kart kimə məxsusdur: ələ, yoxsa dəstəyə?',
            'Hand-dən Card sinfinə aggregation çəkin (Hand tərəfdə boş romb) və Card ucuna * multiplicity verin.',
            'Primer-də Hand-in cards siyahısı Deck-in paylandığı kartlardır: kart əldən əvvəl də, sonra da var, ona görə bu, composition yox, aggregation-dur. Hand tərəfdə 0..1 (kart ən çox bir əldədir), Card tərəfdə *.',
          ],
          check: anyRelation(HAND, CARD, { kind: ['aggregation', 'association'], toMultiplicity: MANY_OR_SOME }),
        },
        {
          id: 'abstract-card',
          weight: 1,
          description: 'Ümumi Card abstraktdır: dəyərini hər oyun özü müəyyən edir.',
          hints: [
            'Poker və blackjack-də eyni kart eyni dəyərdədirmi?',
            'Card sinfinin növünü abstract edin.',
            'Primer-də Card abstraktdır: value onda abstrakt property-dir. Hər oyun öz kartını Card-dan törədir və dəyəri öz qaydası ilə verir, məsələn, blackjack-də şəkilli kartlar 10-dur.',
          ],
          check: { type: 'any-of', predicates: CARD.map((selector): Predicate => ({ type: 'class', class: { ...selector, kind: ABSTRACT } })) },
        },
        {
          id: 'blackjack-card',
          weight: 2,
          description: 'Blackjack kartı ümumi Card-dan törəyir.',
          hints: [
            'Blackjack-də kartın dəyəri necə hesablanır və bunu ümumi Card-ı dəyişmədən harada yazmaq olar?',
            'BlackJackCard sinfi əlavə edin və ondan Card-a inheritance çəkin (Card tərəfdə boş üçbucaq).',
            'Primer-də BlackJackCard Card-ın alt sinfidir: is_ace() və is_face_card() metodları var, value isə ace üçün 1, Jack, Queen, King üçün 10 qaytarır.',
          ],
          check: anyRelation(BLACKJACK_CARD, CARD, EXTENDS),
        },
        {
          id: 'blackjack-hand',
          weight: 2,
          description: 'Blackjack əli ümumi Hand-dən törəyir və xalı öz qaydası ilə hesablayır.',
          hints: [
            'Blackjack-də ace həm 1, həm 11 ola bilir. Əlin xalını bu qayda ilə harada hesablamaq olar?',
            'BlackJackHand sinfi əlavə edin, ona score metodu verin və ondan Hand-ə inheritance çəkin.',
            'Primer-də BlackJackHand Hand-in alt sinfidir: possible_scores() ace-lərə görə mümkün xalları verir, score() isə 21-dən (BLACKJACK) çox olmayan ən böyük xalı, belə xal yoxdursa ən kiçiyini seçir.',
          ],
          check: anyRelation([{ methods: [SCORE_METHOD] }], HAND, EXTENDS),
        },
      ],
      referenceSolution: umlDesign(
        [
          umlClass('class-1', 'Deck', 0, 0, ['deal_index: int'], ['remaining_cards()', 'deal_card()', 'shuffle()']),
          umlClass('class-2', 'Card', 420, 120, ['value: int', 'suit: Suit', 'is_available: bool'], [], 'abstract'),
          umlClass('class-3', 'BlackJackCard', 840, 0, [], ['value(): int', 'is_ace()', 'is_face_card()']),
          umlClass('class-4', 'Suit', 840, 240, ['HEART', 'DIAMOND', 'CLUBS', 'SPADE'], [], 'enum'),
          umlClass('class-5', 'Hand', 0, 260, [], ['add_card(card)', 'score()']),
          umlClass('class-6', 'BlackJackHand', 0, 460, ['BLACKJACK = 21'], ['score()', 'possible_scores()']),
        ],
        [
          umlRelation('class-1', 'class-2', 'aggregation', '1', '*'),
          umlRelation('class-5', 'class-2', 'aggregation', '0..1', '*'),
          umlRelation('class-3', 'class-2', 'inheritance'),
          umlRelation('class-6', 'class-5', 'inheritance'),
        ],
      ),
    },
  ],
}
