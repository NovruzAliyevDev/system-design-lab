import { describe, expect, it } from 'vitest'
import { loadPrimerCatalog } from '../scripts/build-content'
import { findChallenge, isRuledStageType, type Challenge, type ClassDesignStage, type DesignStage, type Stage, type StageType } from '../src/core/challenges/challenge'
import { chaosScenarioOf, evaluateDesign, problemHints } from '../src/core/challenges/rules'
import { conceptSimulationsOfLesson, lessonParts, RELATED_LESSONS } from '../src/core/concept-simulations/embed'
import { CALCULATOR_LESSONS } from '../src/core/content/calculator-lessons'
import { findCodeSolution, findLesson } from '../src/core/content/catalog'
import { findUnresolvedLinks, resolveLink } from '../src/core/content/links'
import { linkUrls } from '../src/core/content/markdown'
import { defaultConfig, paletteGlossaryProblems, PRIMER_LATENCY_NS } from '../src/core/design/components'
import { addNode, connect, emptyDesign, removeElements, setNodeConfig, updateEdge, type Design, type DesignClass, type DesignNode, type DesignRelation } from '../src/core/design/design'
import { BYTE_UNITS, estimate, gradeEstimate, workedSteps } from '../src/core/estimation/estimate'
import { compareLatencies } from '../src/core/estimation/latency'
import { htmlLinkUrls } from '../src/core/flashcards/deck'
import { simulate } from '../src/core/simulation/simulate'
import { findLessonQuiz } from '../src/core/quizzes/quiz'
import { findTopic, skillTreeLayers, topicItems } from '../src/core/skill-tree/skill-tree'

/** The Stage interface of a Stage type, e.g. `DesignStage` for `'scaling'`. */
type StageOf<T extends StageType, S = Stage> = S extends Stage ? (T extends S['type'] ? S : never) : never

describe('catalog of the pinned primer commit', () => {
  const catalog = loadPrimerCatalog()

  it('contains the primer topics as Lessons in their groups', () => {
    const byId = new Map(catalog.lessons.map((lesson) => [lesson.id, lesson]))

    expect(byId.get('load-balancer')?.groupId).toBe('load-balancer')
    expect(byId.get('cap-theorem')?.groupId).toBe('availability-vs-consistency')
    expect(byId.get('relational-database-management-system-rdbms')?.groupId).toBe('database')
    expect(byId.get('latency-numbers-every-programmer-should-know')?.groupId).toBe('appendix')
    expect(catalog.lessons.some((lesson) => lesson.title === 'Source(s) and further reading')).toBe(false)
  })

  it('resolves every internal link in the primer and its solutions to a page of the app', () => {
    expect(findUnresolvedLinks(catalog)).toEqual([])
  })

  it('has a Solution page for each of the eight system design questions, in primer order', () => {
    expect(catalog.solutions.map((solution) => [solution.id, solution.title])).toEqual([
      ['pastebin', 'Design Pastebin.com (or Bit.ly)'],
      ['twitter', 'Design the Twitter timeline and search'],
      ['web_crawler', 'Design a web crawler'],
      ['mint', 'Design Mint.com'],
      ['social_graph', 'Design the data structures for a social network'],
      ['query_cache', 'Design a key-value cache to save the results of the most recent web server queries'],
      ['sales_rank', "Design Amazon's sales rank by category feature"],
      ['scaling_aws', 'Design a system that scales to millions of users on AWS'],
    ])
    expect(resolveLink(catalog, 'solutions/system_design/pastebin/README.md')).toEqual({ kind: 'solution', solutionId: 'pastebin' })
  })

  it('serves every diagram of the Solution pages with the site', () => {
    for (const solution of catalog.solutions) {
      const images = linkUrls(solution.body).filter((href) => /\.(png|jpe?g|gif|svg|webp)$/i.test(href))
      expect(images.length, solution.id).toBeGreaterThan(0)
      for (const src of images) expect(resolveLink(catalog, src, solution.path).kind, `${solution.id}: ${src}`).toBe('asset')
    }
  })

  it("converts the primer's three Decks into Flashcards, front to back", () => {
    const [deck] = catalog.decks

    expect(catalog.decks.map(({ id, title, cards }) => [id, title, cards.length])).toEqual([
      ['system-design', 'System Design', 42],
      ['system-design-exercises', 'System Design Exercises', 8],
      ['oo-design', 'OO Design', 6],
    ])
    expect(deck.cards[0]).toMatchObject({ id: 'system-design/1482325088071', front: '<h2>Performance vs scalability</h2>' })
    expect(deck.cards[0].back).toContain('if it results in increased')
    const html = deck.cards.map((card) => card.front + card.back).join('')
    expect(html).not.toMatch(/ style=|<script|<svg/)
  })

  it('links the Exercises to their Lessons, and the links in their write-ups into the README', () => {
    const exercises = catalog.decks[1].cards
    const primerLinks = exercises.flatMap((card) => htmlLinkUrls(card.back)).filter((href) => href.startsWith(`${catalog.source.repoUrl}#`))

    expect(exercises[1]).toMatchObject({ lessonIds: ['design-pastebincom-or-bitly'] })
    expect(primerLinks.length).toBeGreaterThan(100)
    expect(primerLinks.filter((href) => resolveLink(catalog, href).kind !== 'lesson')).toEqual([])
  })

  it('serves every Flashcard image with the site, except the one the README also shows from GitHub', () => {
    const external = catalog.decks.flatMap((deck) =>
      deck.cards.flatMap((card) =>
        [...card.back.matchAll(/<img src="([^"]*)"/g)]
          .map((match) => match[1])
          .filter((src) => resolveLink(catalog, src).kind !== 'asset')
          .map((src) => `${card.id}: ${src}`),
      ),
    )
    const latencyChart = catalog.lessons.find((lesson) => lesson.id === 'latency-numbers-every-programmer-should-know')

    expect(external).toHaveLength(1)
    expect(latencyChart?.body).toContain(external[0].split(': ')[1])
  })

  it("has Glossary Terms for the primer's core vocabulary", () => {
    const forms = new Set(catalog.glossary.flatMap((term) => [term.term, ...term.aliases].map((form) => form.toLowerCase())))
    // The topics that head primer sections, and common terms used across them.
    const vocabulary = [
      'performance', 'scalability', 'latency', 'throughput', 'availability', 'cap theorem', 'consistency', 'weak consistency', 'eventual consistency',
      'strong consistency', 'fail-over', 'replication', 'dns', 'cdn', 'push cdn', 'pull cdn', 'load balancer',
      'layer 4 load balancing', 'layer 7 load balancing', 'horizontal scaling', 'reverse proxy', 'application layer',
      'microservices', 'service discovery', 'rdbms', 'nosql', 'master-slave replication', 'master-master replication',
      'federation', 'sharding', 'denormalization', 'sql tuning', 'key-value store', 'document store', 'wide column store',
      'graph database', 'cache', 'cache-aside', 'write-through', 'write-behind', 'refresh-ahead', 'asynchronism',
      'message queue', 'task queue', 'back pressure', 'http', 'tcp', 'udp', 'rpc', 'rest', 'quorum',
    ]

    expect(vocabulary.filter((term) => !forms.has(term))).toEqual([])
  })

  it('has a Glossary Term explaining each palette component, for its tooltip', () => {
    expect(paletteGlossaryProblems(catalog.glossary)).toEqual([])
  })

  it('extracts the powers of two table from the appendix', () => {
    const rows = catalog.appendix.powersOfTwo?.rows ?? []

    expect(rows.map((row) => row.power)).toEqual([7, 8, 10, 16, 20, 30, 32, 40])
    expect(rows.find((row) => row.power === 10)).toEqual({ power: 10, exactValue: 1024, approxValue: '1 thousand', bytes: '1 KB' })
    expect(rows.find((row) => row.power === 16)).toEqual({ power: 16, exactValue: 65_536, bytes: '64 KB' })
    expect(rows.find((row) => row.power === 40)?.exactValue).toBe(1_099_511_627_776)
  })

  it('extracts the latency numbers table from the appendix', () => {
    const rows = catalog.appendix.latencyNumbers?.rows ?? []

    expect(rows).toHaveLength(15)
    expect(rows[0]).toEqual({ operation: 'L1 cache reference', nanoseconds: 0.5 })
    expect(rows.find((row) => row.operation === 'Main memory reference')).toEqual({
      operation: 'Main memory reference',
      nanoseconds: 100,
      note: '20x L2 cache, 200x L1 cache',
    })
    expect(rows.find((row) => row.operation === 'Read 1 MB sequentially from SSD*')).toEqual({
      operation: 'Read 1 MB sequentially from SSD*',
      nanoseconds: 1_000_000,
      note: '~1GB/sec SSD, 4X memory',
    })
    expect(rows.at(-1)).toEqual({ operation: 'Send packet CA->Netherlands->CA', nanoseconds: 150_000_000 })
  })

  it("builds component latencies from the primer's own latency numbers", () => {
    const rows = catalog.appendix.latencyNumbers?.rows ?? []

    for (const [operation, nanoseconds] of Object.entries(PRIMER_LATENCY_NS)) {
      expect(rows.find((row) => row.operation === operation)?.nanoseconds, operation).toBe(nanoseconds)
    }
  })

  it("offers the primer's study guide as three timelines of steps through the Lessons", () => {
    const guide = catalog.studyGuide

    expect(guide?.timelines.map((timeline) => timeline.id)).toEqual(['short', 'medium', 'long'])
    expect(guide?.timelines[0].summary).toBe(
      'Aim for breadth with system design topics. Practice by solving some interview questions.',
    )
    expect(guide?.steps).toHaveLength(7)
    expect(guide?.steps[0]).toEqual({
      parts: [
        { text: 'Read through the ' },
        { text: 'System design topics', lessonId: 'index-of-system-design-topics' },
        { text: ' to get a broad understanding of how systems work' },
      ],
      amounts: { short: 'yes', medium: 'yes', long: 'yes' },
    })
    expect(guide?.steps[4].amounts).toEqual({ short: 'some', medium: 'many', long: 'most' })
  })

  it('has a Quiz at the end of every Lesson of the Cache group, the first content set', () => {
    const cacheLessons = catalog.lessons.filter((lesson) => lesson.groupId === 'cache').map((lesson) => lesson.id)

    expect(cacheLessons).toHaveLength(10)
    expect(cacheLessons.filter((lessonId) => !findLessonQuiz(catalog.quizzes, lessonId))).toEqual([])
  })

  /** The Stage of a type in a Challenge, failing the test when there is none. */
  function stageOfType<T extends StageType>(challenge: Challenge, type: T): StageOf<T> {
    const stage = challenge.stages.find((candidate) => candidate.type === type)
    if (!stage) throw new Error(`${challenge.id} has no ${type} Stage`)
    return stage as StageOf<T>
  }

  it('has Challenges whose Reference Solutions score 100% on their own Rules, every Rule with three Hint tiers', () => {
    expect(catalog.challenges.map((challenge) => challenge.id)).toContain('pastebin')
    for (const challenge of catalog.challenges) {
      const ruledStages = challenge.stages.filter((stage): stage is DesignStage | ClassDesignStage => isRuledStageType(stage.type))
      for (const stage of ruledStages) {
        const evaluation = evaluateDesign(stage, stage.referenceSolution, {})

        expect(evaluation.score, `${challenge.id}/${stage.id}`).toBe(evaluation.totalWeight)
        expect(evaluation.failingCount).toBe(0)
        for (const rule of stage.rules) {
          expect(rule.hints.filter((hint) => hint.trim() !== ''), `${challenge.id}/${stage.id}/${rule.id}`).toHaveLength(3)
        }
      }
    }
  })

  it('has architecture Challenges with a default Load Profile, whose Reference Solutions meet their own simulation targets, under their Chaos tasks too', () => {
    for (const challenge of catalog.challenges.filter((each) => each.kind === 'architecture')) {
      const { readQps, writeQps } = challenge.loadProfile!
      expect(readQps + writeQps, challenge.id).toBeGreaterThan(0)
      const designStages = challenge.stages.filter((stage): stage is DesignStage => stage.type === 'high-level-design' || stage.type === 'scaling')
      for (const stage of designStages) {
        const targets = stage.rules.filter((rule) => rule.check.type === 'simulation')
        const results = evaluateDesign({ ...stage, rules: targets }, stage.referenceSolution, {}).rules

        expect(results.filter((result) => !result.passed).map((result) => result.ruleId), `${challenge.id}/${stage.id}`).toEqual([])
      }
    }
  })

  it('has Estimation Stages whose every question has a reference value and a worked solution', () => {
    for (const challenge of catalog.challenges) {
      for (const stage of challenge.stages) {
        if (stage.type !== 'estimation') continue
        expect(stage.explanation.trim(), `${challenge.id}/${stage.id}`).not.toBe('')
        for (const question of stage.questions) {
          expect(question.referenceValue, `${challenge.id}/${stage.id}/${question.id}`).toBeGreaterThan(0)
          expect(workedSteps(estimate(stage.inputs), question.quantity).at(-1)?.value).toBe(question.referenceValue)
        }
      }
    }
  })

  it("names byte units as the primer's powers of two table does, which stops at 1 TB", () => {
    const tableUnits = catalog.appendix.powersOfTwo!.rows.flatMap((row) => (row.bytes?.startsWith('1 ') ? [[row.bytes.slice(2), row.power]] : []))

    expect(tableUnits).toEqual(BYTE_UNITS.filter(({ unit }) => unit !== 'B' && unit !== 'PB').map(({ unit, power }) => [unit, power]))
  })

  it('fits 15 HDD seeks in a cross-continent round trip, by the latency numbers table', () => {
    const rows = catalog.appendix.latencyNumbers!.rows
    const row = (operation: string) => rows.find((candidate) => candidate.operation === operation)!

    expect(compareLatencies(row('Send packet CA->Netherlands->CA'), row('HDD seek')).ratio).toBe(15)
  })

  it('links the calculators from Lessons that exist', () => {
    const lessonIds = new Set(catalog.lessons.map((lesson) => lesson.id))

    expect(Object.values(CALCULATOR_LESSONS).flat().filter((lessonId) => !lessonIds.has(lessonId))).toEqual([])
  })

  it('shows the load balancer simulation in its Lesson, and consistent hashing right after the sharding section', () => {
    const rdbms = findLesson(catalog, 'relational-database-management-system-rdbms')!
    const parts = lessonParts(rdbms, catalog.conceptSimulations)

    expect(conceptSimulationsOfLesson(catalog.conceptSimulations, 'load-balancer')).toEqual(['load-balancer'])
    expect(parts.map((part) => part.simulations)).toEqual([['replication'], ['consistent-hashing'], []])
    expect(parts[1].text.body).toContain('consistent hashing')
    expect(parts[2].text.body).toMatch(/^#### Denormalization/)
  })

  it('shows the replication simulation in its Lesson and after the RDBMS replication section, and CAP after AP', () => {
    const [rdbmsReplication, afterReplication] = lessonParts(findLesson(catalog, 'relational-database-management-system-rdbms')!, catalog.conceptSimulations)
    const [capTheorem, furtherReading] = lessonParts(findLesson(catalog, 'cap-theorem')!, catalog.conceptSimulations)

    expect(conceptSimulationsOfLesson(catalog.conceptSimulations, 'replication')).toEqual(['replication'])
    expect(rdbmsReplication.text.body).toContain('##### Disadvantage(s): replication')
    expect(afterReplication.text.body).toMatch(/^##### Source\(s\) and further reading: replication/)
    expect(capTheorem.simulations).toEqual(['cap'])
    expect(capTheorem.text.body).toContain('#### AP - availability and partition tolerance')
    expect(furtherReading.text.body).toMatch(/^### Source\(s\) and further reading/)
  })

  it('links the simulations to related Lessons that exist', () => {
    const lessonIds = new Set(catalog.lessons.map((lesson) => lesson.id))

    expect(Object.values(RELATED_LESSONS).flat().filter((lessonId) => !lessonIds.has(lessonId))).toEqual([])
  })

  it('shows the cache simulation in the Cache Lesson and after the update strategies', () => {
    expect(conceptSimulationsOfLesson(catalog.conceptSimulations, 'cache')).toEqual(['cache'])
    expect(conceptSimulationsOfLesson(catalog.conceptSimulations, 'when-to-update-the-cache')).toEqual(['cache'])
  })

  describe('the LRU cache Challenge', () => {
    const lruCache = findChallenge(catalog.challenges, 'lru-cache')!
    const classDesign = lruCache.stages[0] as ClassDesignStage

    it('is an ood Challenge with a class-design Stage beside the primer Python solution', () => {
      expect(lruCache).toMatchObject({ kind: 'ood', codeSolutionId: 'lru_cache' })
      expect(lruCache.stages.map((stage) => stage.type)).toEqual(['class-design'])
      expect(findCodeSolution(catalog, 'lru_cache')?.code).toContain('class LinkedList(object):')
      expect(catalog.codeSolutions.map((solution) => solution.id)).toEqual(['call_center', 'deck_of_cards', 'hash_table', 'lru_cache', 'online_chat', 'parking_lot'])
    })

    it('has a reference UML of the Python solution\'s classes, scoring 100%', () => {
      const evaluation = evaluateDesign(classDesign, classDesign.referenceSolution, {})

      expect(classDesign.referenceSolution.classes.map((each) => each.name)).toEqual(['Cache', 'LinkedList', 'Node'])
      expect(evaluation.score).toBe(evaluation.totalWeight)
    })

    it('needs two list operations, not one method matching both', () => {
      const list = classDesign.referenceSolution.classes[1]
      const withMethods = (methods: string[]) => ({
        ...classDesign.referenceSolution,
        classes: classDesign.referenceSolution.classes.map((each) => (each === list ? { ...each, methods } : each)),
      })
      const failing = (methods: string[]) => evaluateDesign(classDesign, withMethods(methods), {}).rules.filter((result) => !result.passed).map((result) => result.ruleId)

      expect(failing(['pop_front()'])).toEqual(['list-operations'])
      expect(failing(['move_to_front(node)'])).toEqual(['list-operations'])
      expect(failing(['touch(node)', 'evict()'])).toEqual([])
    })

    it('accepts the lookup of Nodes drawn as composition, but not at least one Node in an empty cache', () => {
      const withLookup = (change: Record<string, unknown>) => ({
        ...classDesign.referenceSolution,
        relations: classDesign.referenceSolution.relations.map((relation) => (relation.id === 'class-1->class-3' ? { ...relation, ...change } : relation)),
      })
      const passes = (change: Record<string, unknown>) => evaluateDesign(classDesign, withLookup(change), {}).rules.find((result) => result.ruleId === 'lookup-nodes')?.passed

      expect(passes({ kind: 'composition' })).toBe(true)
      expect(passes({ targetMultiplicity: '1..*' })).toBe(false)
    })

    it('accepts the classes under other names, found by the role their members give them', () => {
      const renamed = { ...classDesign.referenceSolution, classes: classDesign.referenceSolution.classes.map((each, i) => ({ ...each, name: ['QueryStore', 'Recency', 'Slot'][i] })) }

      expect(evaluateDesign(classDesign, renamed, {}).failingCount).toBe(0)
    })

    it('fails the relations drawn the wrong way round or of the wrong kind', () => {
      const reversed = {
        ...classDesign.referenceSolution,
        relations: classDesign.referenceSolution.relations.map((relation) =>
          relation.kind === 'composition' ? { ...relation, kind: 'association' as const } : { ...relation, source: relation.target, target: relation.source },
        ),
      }
      const failing = evaluateDesign(classDesign, reversed, {}).rules.filter((result) => !result.passed).map((result) => result.ruleId)

      expect(failing).toEqual(['cache-owns-list', 'list-holds-nodes', 'lookup-nodes'])
    })
  })

  describe('the other OOD Challenges', () => {
    /** The class-design Stage of an OOD Challenge. */
    const classDesignOf = (id: string) => findChallenge(catalog.challenges, id)!.stages[0] as ClassDesignStage
    /** The Rules a Design fails on a Challenge's class-design Stage. */
    const failing = (id: string, design: Design) =>
      evaluateDesign(classDesignOf(id), design, {})
        .rules.filter((result) => !result.passed)
        .map((result) => result.ruleId)
    /** A Challenge's reference UML with a class, found by name, changed. */
    const withClass = (id: string, name: string, change: Partial<DesignClass>): Design => {
      const reference = classDesignOf(id).referenceSolution
      return { ...reference, classes: reference.classes.map((each) => (each.name === name ? { ...each, ...change } : each)) }
    }
    /** A Challenge's reference UML with the relation between two classes, found by name, changed, or removed when `change` is null. */
    const withRelation = (id: string, source: string, target: string, change: Partial<DesignRelation> | null): Design => {
      const reference = classDesignOf(id).referenceSolution
      const idOf = (name: string) => reference.classes.find((each) => each.name === name)!.id
      const chosen = reference.relations.find((relation) => relation.source === idOf(source) && relation.target === idOf(target))
      expect(chosen, `${source} -> ${target}`).toBeDefined()
      return {
        ...reference,
        relations: change === null ? reference.relations.filter((relation) => relation !== chosen) : reference.relations.map((relation) => (relation === chosen ? { ...relation, ...change } : relation)),
      }
    }
    /** A Challenge's reference UML with its classes renamed, in order. */
    const renamed = (id: string, names: string[]): Design => {
      const reference = classDesignOf(id).referenceSolution
      return { ...reference, classes: reference.classes.map((each, i) => ({ ...each, name: names[i] ?? each.name })) }
    }

    it('are the primer OOD questions in its order, each beside its Python solution', () => {
      const ood = catalog.challenges.filter((challenge) => challenge.kind === 'ood')

      expect(ood.map((challenge) => [challenge.id, challenge.kind === 'ood' && challenge.codeSolutionId])).toEqual([
        ['hash-map', 'hash_table'],
        ['lru-cache', 'lru_cache'],
        ['call-center', 'call_center'],
        ['deck-of-cards', 'deck_of_cards'],
        ['parking-lot', 'parking_lot'],
        ['online-chat', 'online_chat'],
      ])
      for (const challenge of ood) {
        expect(challenge.stages.map((stage) => stage.type), challenge.id).toEqual(['class-design'])
        expect(challenge.lessonIds).toEqual(['object-oriented-design-interview-questions-with-solutions'])
      }
    })

    it.each([
      ['hash-map', ['HashTable', 'Item']],
      ['call-center', ['CallCenter', 'Employee', 'Operator', 'Supervisor', 'Director', 'Call', 'Rank', 'CallState']],
      ['deck-of-cards', ['Deck', 'Card', 'BlackJackCard', 'Suit', 'Hand', 'BlackJackHand']],
      ['parking-lot', ['ParkingLot', 'Level', 'ParkingSpot', 'Vehicle', 'Motorcycle', 'Car', 'Bus', 'VehicleSize']],
      ['online-chat', ['UserService', 'User', 'AddRequest', 'RequestStatus', 'Chat', 'PrivateChat', 'GroupChat', 'Message']],
    ])("%s has a reference UML of the Python solution's classes, each in its code", (id, names) => {
      const stage = classDesignOf(id)
      const code = findCodeSolution(catalog, (findChallenge(catalog.challenges, id) as Challenge & { codeSolutionId: string }).codeSolutionId)!.code

      expect(stage.referenceSolution.classes.map((each) => each.name)).toEqual(names)
      for (const name of names) expect(code, name).toContain(`class ${name}(`)
      // No Rule passes on an empty canvas.
      expect(failing(id, emptyDesign())).toEqual(stage.rules.map((rule) => rule.id))
    })

    describe('hash map', () => {
      it('accepts the classes under other names, found by their role', () => {
        expect(failing('hash-map', renamed('hash-map', ['Dictionary', 'Entry']))).toEqual([])
      })

      it('needs a hash function of its own, and Items that may be none', () => {
        expect(failing('hash-map', withClass('hash-map', 'HashTable', { methods: ['set(key, value)', 'get(key)', 'remove(key)'] }))).toEqual(['hash-function'])
        expect(failing('hash-map', withRelation('hash-map', 'HashTable', 'Item', { targetMultiplicity: '1..*' }))).toEqual(['table-holds-items'])
      })

      it('accepts the Items chained through a Bucket class of their own', () => {
        const direct = withRelation('hash-map', 'HashTable', 'Item', null)
        const bucket = { id: 'class-3', name: 'Bucket', kind: 'class' as const, fields: [], methods: [], position: { x: 0, y: 0 } }
        const holds = (source: string, target: string) => ({ id: `${source}->${target}`, source, target, kind: 'composition' as const, targetMultiplicity: '*' as const })
        const throughBuckets = { ...direct, classes: [...direct.classes, bucket], relations: [holds('class-1', 'class-3'), holds('class-3', 'class-2')] }

        expect(failing('hash-map', direct)).toEqual(['table-holds-items'])
        expect(failing('hash-map', throughBuckets)).toEqual([])
      })
    })

    describe('call center', () => {
      it('finds the call center, the employee base and the call by their role', () => {
        expect(failing('call-center', renamed('call-center', ['Switchboard', 'Staff', 'Operator', 'Supervisor', 'Director', 'PhoneCall', 'Level']))).toEqual([])
      })

      it('needs all three ranks to be Employees, each handling one call at a time', () => {
        expect(failing('call-center', withRelation('call-center', 'Director', 'Employee', null))).toEqual(['ranks'])
        expect(failing('call-center', withRelation('call-center', 'Employee', 'Call', { targetMultiplicity: '*' }))).toEqual(['employee-call'])
      })
    })

    describe('deck of cards', () => {
      it('needs a generic Card that is abstract, and Hands that hold Cards without owning them', () => {
        expect(failing('deck-of-cards', withClass('deck-of-cards', 'Card', { kind: 'class' }))).toEqual(['abstract-card'])
        expect(failing('deck-of-cards', withRelation('deck-of-cards', 'Hand', 'Card', { kind: 'composition' }))).toEqual(['hand-holds-cards'])
      })

      it('needs blackjack as subclasses of the generic Card and Hand', () => {
        expect(failing('deck-of-cards', withRelation('deck-of-cards', 'BlackJackHand', 'Hand', null))).toEqual(['blackjack-hand'])
        expect(failing('deck-of-cards', withRelation('deck-of-cards', 'BlackJackCard', 'Card', { kind: 'association' }))).toEqual(['blackjack-card'])
        // A subclass of Card that knows nothing of blackjack does not count.
        expect(failing('deck-of-cards', withClass('deck-of-cards', 'BlackJackCard', { name: 'PokerCard', methods: ['value(): int'] }))).toEqual(['blackjack-card'])
      })
    })

    describe('parking lot', () => {
      it('needs every vehicle type to be a Vehicle', () => {
        expect(failing('parking-lot', withRelation('parking-lot', 'Bus', 'Vehicle', null))).toEqual(['vehicle-types'])
      })

      it('parks at most one vehicle on a spot, and a vehicle, a bus, over several spots', () => {
        expect(failing('parking-lot', withRelation('parking-lot', 'Vehicle', 'ParkingSpot', { sourceMultiplicity: '*' }))).toEqual(['spot-holds-one'])
        expect(failing('parking-lot', withRelation('parking-lot', 'Vehicle', 'ParkingSpot', { targetMultiplicity: '0..1' }))).toEqual(['vehicle-takes-spots'])
      })
    })

    describe('online chat', () => {
      it('finds the user service by its role', () => {
        expect(failing('online-chat', renamed('online-chat', ['Accounts']))).toEqual([])
      })

      it('needs private and group chats as kinds of one abstract Chat', () => {
        expect(failing('online-chat', withRelation('online-chat', 'GroupChat', 'Chat', null))).toEqual(['chat-types'])
        expect(failing('online-chat', withClass('online-chat', 'Chat', { kind: 'class' }))).toEqual(['chat-types'])
      })

      it('accepts Chat as an interface that both kinds of chat implement', () => {
        const asInterface = withClass('online-chat', 'Chat', { kind: 'interface' })
        const implemented = { ...asInterface, relations: asInterface.relations.map((relation) => (relation.kind === 'inheritance' ? { ...relation, kind: 'implementation' as const } : relation)) }

        expect(failing('online-chat', implemented)).toEqual([])
      })
    })
  })

  describe('the Pastebin Challenge', () => {
    const pastebin = findChallenge(catalog.challenges, 'pastebin')!

    it('runs through all five Stages in interview order', () => {
      expect(pastebin.stages.map((stage) => stage.type)).toEqual(['requirements', 'estimation', 'high-level-design', 'deep-dive', 'scaling'])
    })

    it("estimates the primer's usage: 4 writes and 40 reads a second, ~450 GB in 3 years", () => {
      const answers = Object.fromEntries(stageOfType(pastebin, 'estimation').questions.map((question) => [question.id, question.referenceValue]))

      expect(answers['write-qps']).toBe(4)
      expect(answers['read-qps']).toBe(40)
      expect(gradeEstimate(answers['storage-3-years'], 450e9).passed).toBe(true)
      expect(answers['storage-3-years']).toBeCloseTo(457.56e9, 0)
    })

    it('accepts a primary with read replicas configured in place of a replica node', () => {
      const stage = stageOfType(pastebin, 'scaling')
      const withoutReplicaNode = removeElements(stage.referenceSolution, { nodeIds: ['sql-database-2'] })
      const readsFromPrimary = updateEdge(connect(withoutReplicaNode, 'app-service-2', 'sql-database-1'), 'app-service-2->sql-database-1', { traffic: 'read' })
      const isReplicaRule = (result: { ruleId: string }) => result.ruleId === 'read-replicas'

      expect(evaluateDesign(stage, readsFromPrimary, {}).rules.find(isReplicaRule)?.passed).toBe(false)
      expect(evaluateDesign(stage, setNodeConfig(readsFromPrimary, 'sql-database-1', 'replicas', 2), {}).failingCount).toBe(0)
    })

    describe('Scaling Stage simulation target', () => {
      const scaling = stageOfType(pastebin, 'scaling')
      const peakLoad = (design: Design) => evaluateDesign(scaling, design, {}).rules.find((result) => result.ruleId === 'peak-load')!

      it("starts the Challenge at the primer's average load and checks the Scaling Stage at a peak 25 times as high", () => {
        expect(pastebin.loadProfile).toEqual({ readQps: 40, writeQps: 4, requestBytes: 1_000 })
        expect(stageOfType(pastebin, 'high-level-design').loadProfile).toEqual(pastebin.loadProfile)
        expect(scaling.loadProfile).toEqual({ readQps: 1_000, writeQps: 100, requestBytes: 1_000 })
      })

      it('is missed by the high-level design, whose single Web Server cannot take the peak', () => {
        expect(peakLoad(stageOfType(pastebin, 'high-level-design').referenceSolution).passed).toBe(false)
      })

      it('is missed when one Node of the scaled design is too small, and offers its Hints like any other Rule', () => {
        const oneObjectStore = setNodeConfig(scaling.referenceSolution, 'object-store-1', 'instances', 1)
        const evaluation = evaluateDesign(scaling, oneObjectStore, { 'peak-load': 1 })

        expect(peakLoad(oneObjectStore).passed).toBe(false)
        // The overloaded Object Store drops reads under the Chaos task too.
        expect(problemHints(scaling, evaluation)).toEqual([
          { ruleId: 'peak-load', opened: scaling.rules[0].hints.slice(0, 1), canOpenMore: true },
          { ruleId: 'primary-db-down', opened: [], canOpenMore: true },
        ])
      })
    })

    describe('Scaling Stage Chaos task', () => {
      const scaling = stageOfType(pastebin, 'scaling')
      const survives = (design: Design) => evaluateDesign(scaling, design, {}).rules.find((result) => result.ruleId === 'primary-db-down')!.passed

      it('takes the primary of the shortlink table down, and the Reference Solution keeps reading from its replicas', () => {
        expect(scaling.chaosTasks?.map((task) => task.id)).toEqual(['primary-db-down'])
        const scenario = chaosScenarioOf(scaling.chaosTasks![0].scenario, scaling.referenceSolution)
        expect(scenario).toEqual({ type: 'node-down', nodeIds: ['sql-database-1'] })

        const result = simulate(scaling.referenceSolution, scaling.loadProfile, scenario)
        expect(result.errorRateByKind).toEqual({ read: 0, write: 1 })
        expect(survives(scaling.referenceSolution)).toBe(true)
      })

      it('is failed by a design reading the shortlinks from the primary, and passed with replicas configured on it', () => {
        const withoutReplicaNode = removeElements(scaling.referenceSolution, { nodeIds: ['sql-database-2'] })
        const readsFromPrimary = updateEdge(connect(withoutReplicaNode, 'app-service-2', 'sql-database-1'), 'app-service-2->sql-database-1', { traffic: 'read' })

        expect(survives(setNodeConfig(readsFromPrimary, 'sql-database-1', 'instances', 3))).toBe(false)
        expect(survives(setNodeConfig(readsFromPrimary, 'sql-database-1', 'replicas', 2))).toBe(true)
      })
    })
  })

  describe('the Challenges of the eight primer questions', () => {
    const PRIMER_LESSONS: Record<string, string> = {
      pastebin: 'design-pastebincom-or-bitly',
      twitter: 'design-the-twitter-timeline-and-search-or-facebook-feed-and-search',
      'web-crawler': 'design-a-web-crawler',
      mint: 'design-mintcom',
      'social-graph': 'design-the-data-structures-for-a-social-network',
      'query-cache': 'design-a-key-value-store-for-a-search-engine',
      'sales-rank': 'design-amazons-sales-ranking-by-category-feature',
      'scaling-aws': 'design-a-system-that-scales-to-millions-of-users-on-aws',
    }
    const primerChallenges = Object.keys(PRIMER_LESSONS).map((id) => findChallenge(catalog.challenges, id)!)
    /** Estimation question id → reference value. */
    const answersOf = (challenge: Challenge) => Object.fromEntries(stageOfType(challenge, 'estimation').questions.map((question) => [question.id, question.referenceValue]))
    const ruleResult = (stage: DesignStage, design: Design, ruleId: string) => evaluateDesign(stage, design, {}).rules.find((result) => result.ruleId === ruleId)!

    it('each run through all five Stages, link their Solution page and practise their primer question Lesson', () => {
      const primerArchitecture = catalog.challenges.filter((challenge) => challenge.kind === 'architecture' && challenge.source === 'primer')
      expect(primerArchitecture.map((challenge) => challenge.id)).toEqual(Object.keys(PRIMER_LESSONS))
      for (const challenge of primerChallenges) {
        expect(challenge.stages.map((stage) => stage.type), challenge.id).toEqual(['requirements', 'estimation', 'high-level-design', 'deep-dive', 'scaling'])
        expect(catalog.solutions.some((solution) => solution.id === challenge.solutionId), challenge.id).toBe(true)
        expect(challenge.lessonIds[0]).toBe(PRIMER_LESSONS[challenge.id])
      }
    })

    it('have Scaling targets that the high-level Reference Solutions miss, so that scaling is needed', () => {
      for (const challenge of primerChallenges) {
        const scaling = stageOfType(challenge, 'scaling')
        const targets = scaling.rules.filter((rule) => rule.check.type === 'simulation' && rule.check.chaos === undefined)
        const highLevel = stageOfType(challenge, 'high-level-design').referenceSolution

        expect(targets.some((target) => !ruleResult(scaling, highLevel, target.id).passed), challenge.id).toBe(true)
      }
    })

    it("estimate Twitter's usage as the primer does: 6,000 tweets and 100,000 reads a second, 150 TB a month, 5.4 PB in 3 years", () => {
      const twitter = findChallenge(catalog.challenges, 'twitter')!

      expect(answersOf(twitter)).toEqual({
        'write-qps': 6_000,
        'read-qps': 100_000,
        'storage-per-month': 150e12,
        'storage-3-years': 5.4e15,
      })
      expect(twitter.loadProfile).toEqual({ readQps: 100_000, writeQps: 6_000, requestBytes: 10_000 })
      expect(stageOfType(twitter, 'scaling').loadProfile).toEqual(twitter.loadProfile)
    })

    it("estimate the web crawler's usage as the primer does: 1,600 pages and 40,000 searches a second, 2 PB a month, 72 PB in 3 years", () => {
      const crawler = findChallenge(catalog.challenges, 'web-crawler')!

      expect(answersOf(crawler)).toEqual({
        'write-qps': 1_600,
        'read-qps': 40_000,
        'storage-per-month': 2e15,
        'storage-3-years': 72e15,
      })
      // Only Clients send traffic, so the simulation carries the searches and not the crawling.
      expect(crawler.loadProfile).toEqual({ readQps: 40_000, writeQps: 0, requestBytes: 1_000 })
    })

    it("estimate Mint's usage as the primer does: 2,000 transactions and 200 reads a second, 250 GB a month, 9 TB in 3 years", () => {
      const mint = findChallenge(catalog.challenges, 'mint')!

      expect(answersOf(mint)).toEqual({ 'write-qps': 2_000, 'read-qps': 200, 'storage-per-month': 250e9, 'storage-3-years': 9e12 })
      expect(mint.loadProfile).toEqual({ readQps: 200, writeQps: 2_000, requestBytes: 50 })
    })

    it("estimate the social graph's 400 searches a second without writes, and check its Scaling Stage at the authored 10 times peak", () => {
      const socialGraph = findChallenge(catalog.challenges, 'social-graph')!

      expect(answersOf(socialGraph)).toEqual({ 'read-qps': 400, 'peak-read-qps': 4_000 })
      expect(socialGraph.loadProfile).toEqual({ readQps: 400, writeQps: 0, requestBytes: 1_000 })
      expect(stageOfType(socialGraph, 'scaling').loadProfile).toEqual({ readQps: 4_000, writeQps: 0, requestBytes: 1_000 })
    })

    it("estimate the query cache's usage as the primer does: 4,000 queries a second, and 2.7 TB a month if every query were stored", () => {
      const queryCache = findChallenge(catalog.challenges, 'query-cache')!

      expect(answersOf(queryCache)).toEqual({ 'read-qps': 4_000, 'storage-per-month': 2.7e12 })
      expect(queryCache.loadProfile).toEqual({ readQps: 4_000, writeQps: 0, requestBytes: 270 })
    })

    it("estimate the sales rank's usage as the primer does: 400 sales and 40,000 reads a second, 40 GB a month, 1.44 TB in 3 years", () => {
      const salesRank = findChallenge(catalog.challenges, 'sales-rank')!

      expect(answersOf(salesRank)).toEqual({ 'write-qps': 400, 'read-qps': 40_000, 'storage-per-month': 40e9, 'storage-3-years': 1.44e12 })
      expect(salesRank.loadProfile).toEqual({ readQps: 40_000, writeQps: 400, requestBytes: 40 })
    })

    it("estimate the AWS system's usage as the primer does: 400 writes and 40,000 reads a second, 1 TB a month, 36 TB in 3 years", () => {
      const scalingAws = findChallenge(catalog.challenges, 'scaling-aws')!

      expect(answersOf(scalingAws)).toEqual({ 'write-qps': 400, 'read-qps': 40_000, 'storage-per-month': 1e12, 'storage-3-years': 36e12 })
      expect(scalingAws.loadProfile).toEqual({ readQps: 40_000, writeQps: 400, requestBytes: 1_000 })
    })

    describe('the AWS Scaling Stage', () => {
      const scalingAws = findChallenge(catalog.challenges, 'scaling-aws')!
      const highLevel = stageOfType(scalingAws, 'high-level-design')
      const scaling = stageOfType(scalingAws, 'scaling')
      /** The user-count targets of the Scaling Stage a Design meets. */
      const targetsMet = (design: Design) =>
        evaluateDesign(scaling, design, {}).rules.filter((result) => result.ruleId.startsWith('users-') && result.passed).map((result) => result.ruleId)

      it('checks successive simulation targets at 100 thousand, 1 million and 10 million users, starting from the first', () => {
        const loads = scaling.rules.flatMap((rule) => (rule.check.type === 'simulation' ? [[rule.id, rule.check.load]] : []))

        expect(loads).toEqual([
          ['users-100k', { readQps: 400, writeQps: 4, requestBytes: 1_000 }],
          ['users-1m', { readQps: 4_000, writeQps: 40, requestBytes: 1_000 }],
          ['users-10m', { readQps: 40_000, writeQps: 400, requestBytes: 1_000 }],
        ])
        expect(scaling.loadProfile).toEqual(loads[0][1])
        expect(highLevel.loadProfile).toEqual({ readQps: 40, writeQps: 0.4, requestBytes: 1_000 })
      })

      it('is met up to 100 thousand users by the single box, whose Web Server and MySQL a million users overload', () => {
        expect(targetsMet(highLevel.referenceSolution)).toEqual(['users-100k'])
      })

      it('is met up to a million users by a design with too few Web Servers for ten million', () => {
        expect(targetsMet(setNodeConfig(scaling.referenceSolution, 'web-server-1', 'instances', 6))).toEqual(['users-100k', 'users-1m'])
        expect(targetsMet(scaling.referenceSolution)).toEqual(['users-100k', 'users-1m', 'users-10m'])
      })
    })

    it('require the query cache to run on a cluster of several machines', () => {
      const scaling = stageOfType(findChallenge(catalog.challenges, 'query-cache')!, 'scaling')

      expect(ruleResult(scaling, setNodeConfig(scaling.referenceSolution, 'cache-1', 'instances', 1), 'cache-cluster').passed).toBe(false)
    })

    it('accept a MapReduce job ranking the sales, but not one that never reads the sales logs', () => {
      const stage = stageOfType(findChallenge(catalog.challenges, 'sales-rank')!, 'high-level-design')
      const design = stage.referenceSolution
      const mapReduce = { ...design, nodes: design.nodes.map((each) => (each.id === 'app-service-3' ? { ...each, componentType: 'analytics' as const, config: defaultConfig('analytics') } : each)) }

      expect(evaluateDesign(stage, mapReduce, {}).failingCount).toBe(0)
      expect(ruleResult(stage, removeElements(design, { edgeIds: ['app-service-3->object-store-1'] }), 'rank-job').passed).toBe(false)
    })

    it('accept federation in place of sharding for the Twitter and Mint SQL writes, but not an unsharded master beside some NoSQL store', () => {
      for (const id of ['twitter', 'mint']) {
        const scaling = stageOfType(findChallenge(catalog.challenges, id)!, 'scaling')
        const unsharded = setNodeConfig(scaling.referenceSolution, 'sql-database-1', 'shardKey', '')
        const master = unsharded.nodes.find((each) => each.id === 'sql-database-1')!
        const federated = { ...unsharded, nodes: [...unsharded.nodes, { ...master, id: 'sql-database-3' }] }
        const besideNoSql = { ...unsharded, nodes: [...unsharded.nodes, { ...master, id: 'nosql-store-9', componentType: 'nosql-store' as const, config: defaultConfig('nosql-store') }] }

        expect(ruleResult(scaling, unsharded, 'write-scaling').passed, id).toBe(false)
        expect(ruleResult(scaling, federated, 'write-scaling').passed, id).toBe(true)
        expect(ruleResult(scaling, besideNoSql, 'write-scaling').passed, id).toBe(false)
      }
    })

    it('count a web crawler search index as sharded only with a shard key over more than one instance', () => {
      const scaling = stageOfType(findChallenge(catalog.challenges, 'web-crawler')!, 'scaling')

      expect(ruleResult(scaling, setNodeConfig(scaling.referenceSolution, 'search-index-1', 'instances', 1), 'sharded-index').passed).toBe(false)
      expect(ruleResult(scaling, setNodeConfig(scaling.referenceSolution, 'search-index-1', 'shardKey', ''), 'sharded-index').passed).toBe(false)
    })

    it('refuse a graph database for the social graph, which the primer rules out', () => {
      const stage = stageOfType(findChallenge(catalog.challenges, 'social-graph')!, 'high-level-design')

      expect(ruleResult(stage, setNodeConfig(stage.referenceSolution, 'nosql-store-1', 'kind', 'graph'), 'person-data').passed).toBe(false)
    })

    it('require the web crawler to index through a queue, never straight from the crawler', () => {
      const stage = stageOfType(findChallenge(catalog.challenges, 'web-crawler')!, 'high-level-design')
      const direct = updateEdge(connect(stage.referenceSolution, 'app-service-3', 'search-index-1'), 'app-service-3->search-index-1', { traffic: 'write' })

      expect(ruleResult(stage, direct, 'reverse-index-queue').passed).toBe(false)
    })
  })

  describe('the authored Challenges', () => {
    const AUTHORED = ['url-shortener', 'rate-limiter', 'id-generator', 'chat-system', 'news-feed', 'notification-system']
    const authored = AUTHORED.map((id) => findChallenge(catalog.challenges, id)!)
    const answersOf = (challenge: Challenge) => Object.fromEntries(stageOfType(challenge, 'estimation').questions.map((question) => [question.id, question.referenceValue]))
    const ruleResult = (stage: DesignStage, design: Design, ruleId: string) => evaluateDesign(stage, design, {}).rules.find((result) => result.ruleId === ruleId)!
    /** Letters Azerbaijani has and English does not. */
    const AZERBAIJANI = /[əğıöşç]/i

    it('follow the primer questions, marked as authored, each through all five Stages and without a Solution page', () => {
      expect(catalog.challenges.filter((challenge) => challenge.source === 'authored').map((challenge) => challenge.id)).toEqual(AUTHORED)
      expect(catalog.challenges.slice(-AUTHORED.length)).toEqual(authored)
      for (const challenge of authored) {
        expect(challenge.kind, challenge.id).toBe('architecture')
        expect(challenge.stages.map((stage) => stage.type), challenge.id).toEqual(['requirements', 'estimation', 'high-level-design', 'deep-dive', 'scaling'])
        expect(challenge.solutionId, challenge.id).toBeUndefined()
        expect(challenge.stages.filter((stage) => stage.solutionAnchor !== undefined), challenge.id).toEqual([])
      }
    })

    it('explain themselves in Azerbaijani: every requirement item, estimation, deep-dive option and Hint', () => {
      for (const challenge of authored) {
        const texts = challenge.stages.flatMap((stage) => {
          switch (stage.type) {
            case 'requirements':
              return stage.items.map((item) => item.explanation)
            case 'estimation':
              return [stage.explanation]
            case 'deep-dive':
              return stage.questions.flatMap((question) => question.options.map((option) => option.explanation))
            case 'high-level-design':
            case 'scaling':
              return stage.rules.flatMap((rule) => [rule.description, ...rule.hints])
            default:
              return []
          }
        })
        for (const text of texts) expect(text, `${challenge.id}: ${text}`).toMatch(AZERBAIJANI)
      }
    })

    it('have Scaling targets that the high-level Reference Solutions miss, so that scaling is needed', () => {
      for (const challenge of authored) {
        const scaling = stageOfType(challenge, 'scaling')
        const targets = scaling.rules.filter((rule) => rule.check.type === 'simulation' && rule.check.chaos === undefined)
        const highLevel = stageOfType(challenge, 'high-level-design').referenceSolution

        expect(targets.some((target) => !ruleResult(scaling, highLevel, target.id).passed), challenge.id).toBe(true)
      }
    })

    it('estimate the URL shortener: 1,200 links and 12,000 redirects a second, 3.6 TB a year, 36 TB in 10 years', () => {
      expect(answersOf(findChallenge(catalog.challenges, 'url-shortener')!)).toEqual({
        'write-qps': 1_200,
        'read-qps': 12_000,
        'peak-read-qps': 24_000,
        'storage-per-year': 3.6e12,
        'storage-10-years': 36e12,
      })
    })

    it('estimate the rate limiter: 1,600 reads and 400 writes a second, five times as many at the peak', () => {
      expect(answersOf(findChallenge(catalog.challenges, 'rate-limiter')!)).toEqual({ 'read-qps': 1_600, 'write-qps': 400, 'peak-read-qps': 8_000, 'peak-write-qps': 2_000 })
    })

    it('estimate the ID generator: 10,000 IDs a second, 30,000 at the peak, 2.4 TB of IDs a year', () => {
      expect(answersOf(findChallenge(catalog.challenges, 'id-generator')!)).toEqual({ 'write-qps': 10_000, 'peak-write-qps': 30_000, 'storage-per-year': 2.4e12 })
    })

    describe('URL shortener', () => {
      const challenge = findChallenge(catalog.challenges, 'url-shortener')!
      const scaling = stageOfType(challenge, 'scaling')

      it('survives a cold cache only with a URL store that takes every redirect itself', () => {
        const withoutReplicas = setNodeConfig(scaling.referenceSolution, 'nosql-store-1', 'replicas', 0)

        expect(ruleResult(scaling, withoutReplicas, 'peak-load').passed).toBe(true)
        expect(ruleResult(scaling, withoutReplicas, 'cache-cold').passed).toBe(false)
        expect(ruleResult(scaling, scaling.referenceSolution, 'cache-cold').passed).toBe(true)
      })

      it('takes its keys from a Key Generation Service', () => {
        const stage = stageOfType(challenge, 'high-level-design')
        const withoutKgs = removeElements(stage.referenceSolution, { nodeIds: ['app-service-3', 'nosql-store-2'] })

        expect(ruleResult(stage, withoutKgs, 'key-generation').passed).toBe(false)
      })
    })

    describe('rate limiter', () => {
      const challenge = findChallenge(catalog.challenges, 'rate-limiter')!
      const highLevel = stageOfType(challenge, 'high-level-design')
      const scaling = stageOfType(challenge, 'scaling')
      const withLimiter = (key: string, value: string | number) => setNodeConfig(scaling.referenceSolution, 'rate-limiter-1', key, value)

      it('throttles nothing at the peak, and cuts an abusive burst down to its limit', () => {
        const peak = simulate(scaling.referenceSolution, scaling.loadProfile)
        const burst = simulate(scaling.referenceSolution, { readQps: 32_000, writeQps: 8_000, requestBytes: 1_000 })

        expect(peak.throttledQps).toBe(0)
        expect(burst.throttledQps).toBe(28_000)
        expect(burst.nodes['app-service-1']).toMatchObject({ loadQps: 12_000, overloaded: false })
        expect(burst.nodes['cache-1']).toMatchObject({ loadQps: 40_000, overloaded: false })
      })

      it('needs a limit over the peak, and under what the API servers take', () => {
        expect(ruleResult(scaling, withLimiter('limitQps', 8_000), 'peak-load').passed).toBe(false)
        expect(ruleResult(scaling, withLimiter('limitQps', 20_000), 'peak-load').passed).toBe(true)
        expect(ruleResult(scaling, withLimiter('limitQps', 20_000), 'abusive-burst').passed).toBe(false)
      })

      it('needs limiter instances enough to see every request of the burst', () => {
        expect(ruleResult(scaling, withLimiter('instances', 2), 'abusive-burst').passed).toBe(false)
      })

      it('keeps the API up without its counters only failing open', () => {
        expect(ruleResult(scaling, withLimiter('failMode', 'closed'), 'counters-down').passed).toBe(false)
      })

      it('refuses counters in a SQL database, and a way to the API around the limiter', () => {
        const design = highLevel.referenceSolution

        expect(ruleResult(highLevel, connect(design, 'rate-limiter-1', 'sql-database-1'), 'counters-in-memory').passed).toBe(false)
        expect(ruleResult(highLevel, connect(design, 'client-1', 'app-service-1'), 'limiter-in-path').passed).toBe(false)
      })
    })

    describe('ID generator', () => {
      const challenge = findChallenge(catalog.challenges, 'id-generator')!
      const highLevel = stageOfType(challenge, 'high-level-design')
      const scaling = stageOfType(challenge, 'scaling')

      it('refuses a ticket server: a database counting the IDs', () => {
        const { design, nodeId } = addNode(highLevel.referenceSolution, 'sql-database', { x: 720, y: 120 }, 'Ticket Server')

        expect(ruleResult(highLevel, connect(design, 'app-service-1', nodeId), 'no-shared-counter').passed).toBe(false)
      })

      it('refuses generators calling the coordination service for every ID, which then fail when it is down', () => {
        const perId = connect(removeElements(scaling.referenceSolution, { edgeIds: ['coordination-service-1->app-service-1'] }), 'app-service-1', 'coordination-service-1')

        expect(ruleResult(scaling, perId, 'no-shared-counter').passed).toBe(false)
        expect(ruleResult(scaling, perId, 'worker-ids').passed).toBe(true)
        expect(ruleResult(scaling, perId, 'coordination-down').passed).toBe(false)
      })

      it('needs an odd ensemble of at least three coordination nodes', () => {
        const ensemble = (instances: number) => ruleResult(scaling, setNodeConfig(scaling.referenceSolution, 'coordination-service-1', 'instances', instances), 'coordination-quorum').passed

        expect([1, 3, 4, 5].map(ensemble)).toEqual([false, true, false, true])
      })
    })

    it('estimate the chat system: 12,000 messages sent and 24,000 delivered a second, 36 TB a year, 180 TB in 5 years', () => {
      expect(answersOf(findChallenge(catalog.challenges, 'chat-system')!)).toEqual({
        'write-qps': 12_000,
        'read-qps': 24_000,
        'peak-write-qps': 24_000,
        'storage-per-year': 36e12,
        'storage-5-years': 180e12,
      })
    })

    it('estimate the news feed: 400 posts and 20,000 feed reads a second, 1 TB a month, 60 TB in 5 years', () => {
      expect(answersOf(findChallenge(catalog.challenges, 'news-feed')!)).toEqual({
        'write-qps': 400,
        'read-qps': 20_000,
        'peak-read-qps': 40_000,
        'storage-per-month': 1e12,
        'storage-5-years': 60e12,
      })
    })

    it('estimate the notification system: 1,000 notifications a second, 5,000 at a campaign peak, 15 TB of records a year', () => {
      expect(answersOf(findChallenge(catalog.challenges, 'notification-system')!)).toEqual({
        'write-qps': 1_000,
        'peak-write-qps': 5_000,
        'storage-per-month': 1.25e12,
        'storage-per-year': 15e12,
      })
    })

    describe('chat system', () => {
      const challenge = findChallenge(catalog.challenges, 'chat-system')!
      const highLevel = stageOfType(challenge, 'high-level-design')
      const scaling = stageOfType(challenge, 'scaling')

      it('refuses a way to the messages around the WebSocket gateway', () => {
        expect(ruleResult(highLevel, connect(highLevel.referenceSolution, 'client-1', 'app-service-1'), 'websocket').passed).toBe(false)
      })

      it('slows every message past the target when it calls the push provider synchronously', () => {
        const withoutQueue = removeElements(scaling.referenceSolution, { nodeIds: ['message-queue-1'] })
        const synchronous = updateEdge(connect(withoutQueue, 'app-service-1', 'app-service-2'), 'app-service-1->app-service-2', { traffic: 'write' })
        const peak = simulate(synchronous, scaling.loadProfile)

        expect(Object.values(peak.nodes).filter((metrics) => metrics.overloaded)).toEqual([])
        expect(peak.meanLatencyMs.write).toBeGreaterThan(150)
        expect(ruleResult(scaling, synchronous, 'peak-load').passed).toBe(false)
        expect(ruleResult(highLevel, synchronous, 'async-push').passed).toBe(false)
      })

      it('needs deliveries read from an inbox cache, not a push worker reading presence', () => {
        const withoutInbox = removeElements(scaling.referenceSolution, { nodeIds: ['cache-2'] })
        const presenceRead = updateEdge(withoutInbox, 'app-service-2->cache-1', { traffic: 'both' })

        expect(ruleResult(scaling, presenceRead, 'inbox-cache').passed).toBe(false)
      })

      it('survives the inbox cache going down only with a message store that takes every delivery itself', () => {
        const withoutReplicas = setNodeConfig(scaling.referenceSolution, 'nosql-store-1', 'replicas', 0)

        expect(ruleResult(scaling, withoutReplicas, 'peak-load').passed).toBe(true)
        expect(ruleResult(scaling, withoutReplicas, 'cache-down').passed).toBe(false)
      })
    })

    describe('news feed', () => {
      const challenge = findChallenge(catalog.challenges, 'news-feed')!
      const highLevel = stageOfType(challenge, 'high-level-design')
      const scaling = stageOfType(challenge, 'scaling')
      /** The design reading each feed from the 200 friends' posts in the post cache instead of fanning each post out. */
      const onRead = (design: Design, postCache: string) => {
        const gathering = removeElements(design, { edgeIds: ['app-service-3->fan-out-1', 'fan-out-1->cache-1', 'app-service-2->cache-1'] })
        const fromFeed = updateEdge(connect(gathering, 'app-service-2', 'fan-out-1'), 'app-service-2->fan-out-1', { traffic: 'read' })
        return updateEdge(connect(fromFeed, 'fan-out-1', postCache), `fan-out-1->${postCache}`, { traffic: 'read' })
      }

      it('accepts a feed built at either time in the high-level design, but only with the fan-out set to the 200 friends', () => {
        const { design } = addNode(highLevel.referenceSolution, 'cache', { x: 1200, y: 560 }, 'Post Cache')
        const gathering = onRead(design, 'cache-2')

        expect(ruleResult(highLevel, gathering, 'feed-fan-out').passed).toBe(true)
        expect(ruleResult(highLevel, setNodeConfig(highLevel.referenceSolution, 'fan-out-1', 'fanOut', 1), 'feed-fan-out').passed).toBe(false)
      })

      it('fans 800 posts a second out into 160,000 feed writes within the budget, where gathering for 40,000 reads would ask for 8 million copies', () => {
        const peak = simulate(scaling.referenceSolution, scaling.loadProfile)
        let gathering = onRead(scaling.referenceSolution, 'cache-2')
        gathering = setNodeConfig(setNodeConfig(gathering, 'fan-out-1', 'instances', 1_000), 'cache-2', 'instances', 200)
        const gatheringPeak = simulate(gathering, scaling.loadProfile)

        expect(peak.nodes['cache-1'].writeQps).toBe(160_000)
        // Even 1,000 instances send 5 million copies a second: enough for 25,000 of the 40,000 reads.
        expect(gatheringPeak.nodes['fan-out-1']).toMatchObject({ loadQps: 40_000, capacityQps: 25_000, overloaded: true })
        expect(gatheringPeak.monthlyCostUsd).toBeGreaterThan(40_000)
        expect(ruleResult(scaling, gathering, 'budget').passed).toBe(false)
        expect(ruleResult(scaling, gathering, 'peak-load').passed).toBe(false)
      })

      it('keeps posts and feeds working while the fan-out is down only with a queue before it', () => {
        const withoutQueue = removeElements(scaling.referenceSolution, { nodeIds: ['message-queue-1'] })
        const synchronous = connect(withoutQueue, 'app-service-1', 'app-service-3')

        expect(ruleResult(scaling, synchronous, 'peak-load').passed).toBe(true)
        expect(ruleResult(scaling, synchronous, 'fan-out-down').passed).toBe(false)
      })
    })

    describe('notification system', () => {
      const challenge = findChallenge(catalog.challenges, 'notification-system')!
      const highLevel = stageOfType(challenge, 'high-level-design')
      const scaling = stageOfType(challenge, 'scaling')

      it('sends every notification as a push to each of two devices and as an e-mail', () => {
        const peak = simulate(scaling.referenceSolution, scaling.loadProfile)

        expect(peak.nodes['push-service-1'].writeQps).toBe(10_000)
        expect(peak.nodes['push-service-2'].writeQps).toBe(5_000)
        expect(ruleResult(highLevel, setNodeConfig(highLevel.referenceSolution, 'fan-out-1', 'fanOut', 1), 'push-per-device').passed).toBe(false)
      })

      it('needs a queue of its own for each channel', () => {
        const oneQueue = connect(removeElements(highLevel.referenceSolution, { nodeIds: ['message-queue-2'] }), 'message-queue-1', 'app-service-2')

        expect(ruleResult(highLevel, oneQueue, 'queued-delivery').passed).toBe(false)
      })

      it('accepts notifications while the push provider is down only with a queue before it, and keeps the provider’s 150 ms off the request', () => {
        const synchronous = connect(removeElements(scaling.referenceSolution, { nodeIds: ['message-queue-1'] }), 'app-service-1', 'fan-out-1')

        expect(ruleResult(scaling, synchronous, 'push-provider-down').passed).toBe(false)
        expect(ruleResult(scaling, synchronous, 'peak-load').passed).toBe(false)
        expect(ruleResult(scaling, scaling.referenceSolution, 'push-provider-down').passed).toBe(true)
      })
    })
  })

  describe('the Pastebin high-level design Stage', () => {
    const stage = stageOfType(findChallenge(catalog.challenges, 'pastebin')!, 'high-level-design')

    /** A Design with one node replaced by another (in its place, with its edges). */
    function replaceNode(design: Design, id: string, replacement: DesignNode): Design {
      const rename = (nodeId: string) => (nodeId === id ? replacement.id : nodeId)
      return {
        ...design,
        nodes: design.nodes.map((node) => (node.id === id ? { ...replacement, position: node.position } : node)),
        edges: design.edges.map((edge) => {
          const [source, target] = [rename(edge.source), rename(edge.target)]
          return { ...edge, id: `${source}->${target}`, source, target }
        }),
      }
    }

    it('accepts the stores the primer names as alternatives: a key-value store and a document store', () => {
      const nosql = (id: string): DesignNode => ({ ...stage.referenceSolution.nodes[0], id, componentType: 'nosql-store', config: defaultConfig('nosql-store') })
      let design = replaceNode(stage.referenceSolution, 'sql-database-1', nosql('nosql-store-1'))
      design = replaceNode(design, 'object-store-1', nosql('nosql-store-2'))
      design = setNodeConfig(design, 'nosql-store-2', 'kind', 'document')

      expect(evaluateDesign(stage, design, {}).failingCount).toBe(0)
    })

    it('accepts analytics fed by Web Server logs, as the primer describes, when they are shipped asynchronously', () => {
      const withoutPulls = removeElements(stage.referenceSolution, { edgeIds: ['analytics-1->object-store-1', 'analytics-1->sql-database-1'] })
      const logs = connect(withoutPulls, 'web-server-1', 'analytics-1')

      expect(evaluateDesign(stage, updateEdge(logs, 'web-server-1->analytics-1', { mode: 'async' }), {}).failingCount).toBe(0)
      // Called synchronously, analytics sits on the request path.
      expect(evaluateDesign(stage, logs, {}).rules.find((result) => result.ruleId === 'offline-analytics')?.passed).toBe(false)
    })
  })

  describe('Skill Tree', () => {
    /** Groups of the primer that are its introduction or about the repo, not system design topics. */
    const META_GROUPS = ['the-system-design-primer', 'motivation', 'anki-flashcards', 'contributing', 'index-of-system-design-topics', 'study-guide', 'under-development', 'credits', 'contact-info', 'license']

    it('puts every Lesson of a system design topic in a topic of the Skill Tree', () => {
      const inTopics = new Set(catalog.skillTree.flatMap((topic) => topic.lessonIds))
      const outside = catalog.lessons.filter((lesson) => !META_GROUPS.includes(lesson.groupId) && !inTopics.has(lesson.id))

      expect(outside.map((lesson) => lesson.id)).toEqual([])
    })

    it('requires the Challenges only in the design question topics, so every topic before them can be mastered without one', () => {
      const requiring = catalog.skillTree.filter((topic) => topicItems(catalog, topic).challenges.some(({ required }) => required))

      expect(requiring.map((topic) => topic.id)).toEqual(['design-questions', 'object-oriented-design'])
    })

    it('starts from the scalability basics and ends with the design questions and real world architectures', () => {
      const layers = skillTreeLayers(catalog.skillTree)

      expect(layers[0]).toEqual(['scalability-basics'])
      expect(layers.at(-1)).toEqual(['real-world-architectures'])
      expect(findTopic(catalog.skillTree, 'design-questions')?.prerequisiteIds).toContain('interview-approach')
    })

    it('gives every quiz, card and Challenge a topic, so each counts toward some Mastery', () => {
      const items = catalog.skillTree.map((topic) => topicItems(catalog, topic))
      const quizzes = new Set(items.flatMap((each) => each.quizzes.map((quiz) => quiz.id)))
      const cards = new Set(items.flatMap((each) => each.cards.map((card) => card.id)))
      const challenges = new Set(items.flatMap((each) => each.challenges.map(({ challenge }) => challenge.id)))

      expect(catalog.quizzes.filter((quiz) => !quizzes.has(quiz.id)).map((quiz) => quiz.id)).toEqual([])
      expect(catalog.decks.flatMap((deck) => deck.cards).filter((card) => !cards.has(card.id)).map((card) => card.id)).toEqual([])
      expect(catalog.challenges.filter((challenge) => !challenges.has(challenge.id)).map((challenge) => challenge.id)).toEqual([])
    })
  })

  it('matches the recorded Lesson list', () => {
    expect(catalog.lessons.map((lesson) => `${lesson.id} | ${lesson.title}`)).toMatchSnapshot()
  })
})
