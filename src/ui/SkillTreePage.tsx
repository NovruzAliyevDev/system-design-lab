import { Background, Controls, Handle, MarkerType, Position, ReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useMemo, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { bestAttemptScore } from '../core/challenges/attempt'
import { findLesson } from '../core/content/catalog'
import { selectCards } from '../core/flashcards/deck'
import type { Progress } from '../core/progress/progress'
import { computeMastery, MASTERED_AT, unmetPrerequisites, type MasterySignal, type TopicMastery } from '../core/skill-tree/mastery'
import { findTopic, skillTreeLayers, topicItems, type SkillTopic } from '../core/skill-tree/skill-tree'
import { percent } from './challenge/shared'
import { catalog } from './catalog'
import { t, type StringKey } from './i18n'
import { useProgress } from './progress/store'
import { challengePath, flashcardsPath, LESSON_QUIZ_ANCHOR, lessonPath, skillTreePath } from './routes'
import { TABLET_QUERY, useMediaQuery } from './useMediaQuery'

const topics = catalog.skillTree
const layers = skillTreeLayers(topics)

/** A topic with the learner's Mastery of it and the prerequisites they have not mastered yet. */
interface TopicState {
  topic: SkillTopic
  mastery: TopicMastery
  unmet: SkillTopic[]
}

/** How a Mastery is coloured: on the map's nodes, their bars and the legend. */
const MASTERY_LEVELS: { label: StringKey; from: number; bar: string; border: string }[] = [
  { label: 'skillTreeLegendMastered', from: MASTERED_AT, bar: 'bg-emerald-500', border: 'border-emerald-500' },
  { label: 'skillTreeLegendHalf', from: 0.5, bar: 'bg-sky-500', border: 'border-sky-500' },
  { label: 'skillTreeLegendStarted', from: Number.MIN_VALUE, bar: 'bg-amber-500', border: 'border-amber-500' },
  { label: 'skillTreeLegendNone', from: 0, bar: 'bg-zinc-600', border: 'border-zinc-700' },
]

const levelOf = (mastery: number) => MASTERY_LEVELS.find((level) => mastery >= level.from)!

const SIGNAL_LABELS: Record<MasterySignal, StringKey> = {
  reading: 'topicSignalReading',
  quizzes: 'topicSignalQuizzes',
  flashcards: 'topicSignalFlashcards',
  challenges: 'topicSignalChallenges',
}

function topicStates(progress: Progress): Map<string, TopicState> {
  const mastery = computeMastery(progress, catalog)
  return new Map(
    topics.map((topic) => [
      topic.id,
      { topic, mastery: mastery[topic.id], unmet: unmetPrerequisites(topic, mastery).map((id) => findTopic(topics, id)!) },
    ]),
  )
}

/**
 * The Skill Tree: every topic of the primer with the learner's Mastery. From the tablet width up it is
 * a map that pans and zooms; below it, a list in recommended order. Selecting a topic opens its details.
 */
export function SkillTreePage() {
  const progress = useProgress((state) => state.progress)
  const states = useMemo(() => progress && topicStates(progress), [progress])
  const wide = useMediaQuery(TABLET_QUERY)
  const [params] = useSearchParams()
  const selected = states?.get(params.get('topic') ?? '')

  return (
    <section>
      <h1 className="text-2xl font-semibold text-zinc-50">{t('skillTreeTitle')}</h1>
      <p className="mt-1 max-w-3xl text-sm text-zinc-400">{t('skillTreeDescription')}</p>
      {!states || !progress ? (
        <p className="mt-6 text-sm text-zinc-400">{t('skillTreeLoading')}</p>
      ) : wide ? (
        <>
          <p className="mt-2 text-xs text-zinc-500">{t('skillTreeMapHint')}</p>
          <Legend />
          <div className="mt-3 flex flex-col gap-4 lg:flex-row">
            <SkillTreeMap states={states} selectedId={selected?.topic.id} theme={progress.settings.theme} />
            {selected && (
              <aside className="lg:w-96 lg:shrink-0">
                <TopicDetails state={selected} progress={progress} />
              </aside>
            )}
          </div>
        </>
      ) : selected ? (
        <div className="mt-4">
          <Link to={skillTreePath()} className="text-sm text-sky-400 hover:text-sky-300">
            {t('topicBack')}
          </Link>
          <TopicDetails state={selected} progress={progress} />
        </div>
      ) : (
        <>
          <p className="mt-2 text-xs text-zinc-500">{t('skillTreeListHint')}</p>
          <Legend />
          <SkillTreeList states={states} />
        </>
      )}
    </section>
  )
}

function Legend() {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
      {[...MASTERY_LEVELS].reverse().map((level) => (
        <li key={level.label} className="flex items-center gap-1.5">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${level.bar}`} aria-hidden />
          {t(level.label)}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-4 rounded border border-dashed border-zinc-500" aria-hidden />
        {t('topicRecommendedLater')}
      </li>
    </ul>
  )
}

export function MasteryBar({ mastery }: { mastery: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
      <div className={`h-full ${levelOf(mastery).bar}`} style={{ width: `${percent(mastery)}%` }} />
    </div>
  )
}

const NODE_WIDTH = 200
const COLUMN_PITCH = NODE_WIDTH + 40
const ROW_PITCH = 120

type TopicFlowNode = Node<{ state: TopicState; selected: boolean }, 'topic'>

const NODE_TYPES = { topic: TopicNode }

/** A topic on the map: its title and Mastery, dashed while it is recommended later. */
function TopicNode({ data: { state, selected } }: NodeProps<TopicFlowNode>) {
  const { topic, mastery, unmet } = state
  const border = unmet.length > 0 ? 'border-dashed border-zinc-500' : `border-solid ${levelOf(mastery.mastery).border}`
  return (
    <div
      className={`rounded-lg border-2 bg-zinc-900 px-3 py-2 text-left shadow ${border} ${selected ? 'ring-2 ring-sky-400' : ''}`}
      style={{ width: NODE_WIDTH }}
    >
      <Handle type="target" position={Position.Top} isConnectable={false} className="!opacity-0" />
      <div className="text-sm font-medium text-zinc-100">{topic.title}</div>
      <div className="mt-1.5">
        <MasteryBar mastery={mastery.mastery} />
      </div>
      <div className="mt-1 flex justify-between gap-2 text-xs text-zinc-400">
        <span>{percent(mastery.mastery)}%</span>
        {unmet.length > 0 && <span className="text-zinc-500">{t('topicRecommendedLater')}</span>}
      </div>
      <Handle type="source" position={Position.Bottom} isConnectable={false} className="!opacity-0" />
    </div>
  )
}

/** The topics from the first layer at the top down, each layer centred; an edge from each prerequisite. */
function SkillTreeMap({ states, selectedId, theme }: { states: Map<string, TopicState>; selectedId?: string; theme: Progress['settings']['theme'] }) {
  const [, setParams] = useSearchParams()
  const nodes = useMemo(
    () =>
      layers.flatMap((layer, row) =>
        layer.map(
          (id, i): TopicFlowNode => ({
            id,
            type: 'topic',
            position: { x: (i - (layer.length - 1) / 2) * COLUMN_PITCH - NODE_WIDTH / 2, y: row * ROW_PITCH },
            data: { state: states.get(id)!, selected: id === selectedId },
            draggable: false,
            connectable: false,
          }),
        ),
      ),
    [states, selectedId],
  )
  const edges = useMemo(
    () =>
      topics.flatMap((topic) =>
        topic.prerequisiteIds.map((prerequisiteId): Edge => {
          const met = states.get(prerequisiteId)!.mastery.mastered
          return {
            id: `${prerequisiteId}->${topic.id}`,
            source: prerequisiteId,
            target: topic.id,
            markerEnd: { type: MarkerType.ArrowClosed },
            style: met ? undefined : { strokeDasharray: '5 5' },
          }
        }),
      ),
    [states],
  )
  return (
    <div className="h-[70vh] min-h-96 flex-1 overflow-hidden rounded-lg border border-zinc-800" role="region" aria-label={t('skillTreeMap')}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        colorMode={theme}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesFocusable={false}
        onNodeClick={(_, node) => setParams({ topic: node.id })}
        onPaneClick={() => setParams({})}
        fitView
        fitViewOptions={{ padding: 0.1 }}
        minZoom={0.2}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}

/** The topics layer by layer, so that prerequisites come first. */
function SkillTreeList({ states }: { states: Map<string, TopicState> }) {
  return (
    <ol className="mt-4 divide-y divide-zinc-800 rounded-lg border border-zinc-800">
      {layers.flat().map((id) => {
        const { topic, mastery, unmet } = states.get(id)!
        return (
          <li key={id}>
            <Link to={skillTreePath(id)} className="block px-4 py-3 hover:bg-zinc-900 focus-visible:bg-zinc-900 focus-visible:outline-none">
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-medium text-zinc-100">{topic.title}</span>
                <span className="text-xs text-zinc-400">{percent(mastery.mastery)}%</span>
              </span>
              <span className="mt-1.5 block">
                <MasteryBar mastery={mastery.mastery} />
              </span>
              {unmet.length > 0 && <span className="mt-1 block text-xs text-zinc-500">{t('topicRecommendedLater')}</span>}
            </Link>
          </li>
        )
      })}
    </ol>
  )
}

/** A topic's Mastery and where it comes from, its prerequisites, and links to everything it has to learn and practise. */
function TopicDetails({ state, progress }: { state: TopicState; progress: Progress }) {
  const { topic, mastery, unmet } = state
  const items = topicItems(catalog, topic)
  const signals = Object.entries(mastery.signals) as [MasterySignal, number][]
  const cardLessons = topic.lessonIds
    .map((lessonId) => ({ lessonId, count: selectCards(catalog.decks, { kind: 'lesson', lessonId }).length }))
    .filter(({ count }) => count > 0)
  const lessonTitle = (lessonId: string) => findLesson(catalog, lessonId)?.title ?? lessonId

  return (
    <div className="mt-3 rounded-lg border border-zinc-800 p-4 lg:mt-0">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-50">{topic.title}</h2>
        <Link to={skillTreePath()} className="hidden text-sm text-zinc-400 hover:text-zinc-100 md:inline">
          {t('topicClose')}
        </Link>
      </div>
      <p className="mt-1 text-sm text-zinc-300">
        {t('topicMastery', { percent: percent(mastery.mastery) })}
        {mastery.mastered && <span className="ml-2 text-emerald-500">{t('topicMastered')}</span>}
      </p>
      <div className="mt-2">
        <MasteryBar mastery={mastery.mastery} />
      </div>
      {unmet.length > 0 && (
        <div className="mt-3 rounded border border-dashed border-zinc-600 px-3 py-2 text-sm text-zinc-300">
          <p className="font-medium">{t('topicRecommendedLater')}</p>
          <p>{t('topicRecommendedLaterDetail', { topics: unmet.map((each) => each.title).join(', ') })}</p>
        </div>
      )}

      <h3 className="mt-4 text-sm font-semibold text-zinc-200">{t('topicSignals')}</h3>
      <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-sm">
        {signals.map(([signal, value]) => (
          <div key={signal} className="contents">
            <dt className="text-zinc-400">
              {t(SIGNAL_LABELS[signal])} <span className="text-xs text-zinc-500">({t('topicSignalWeight', { percent: percent(mastery.weights[signal] ?? 0) })})</span>
            </dt>
            <dd className="text-right text-zinc-200">{percent(value)}%</dd>
          </div>
        ))}
      </dl>

      <h3 className="mt-4 text-sm font-semibold text-zinc-200">{t('topicPrerequisites')}</h3>
      {topic.prerequisiteIds.length === 0 ? (
        <p className="mt-1 text-sm text-zinc-400">{t('topicNoPrerequisites')}</p>
      ) : (
        <ul className="mt-1 flex flex-wrap gap-2 text-sm">
          {topic.prerequisiteIds.map((id) => (
            <li key={id}>
              <Link to={skillTreePath(id)} className="rounded border border-zinc-700 px-2 py-0.5 text-sky-400 hover:text-sky-300">
                {findTopic(topics, id)?.title}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <ItemList title={t('topicLessons')}>
        {items.lessonIds.map((lessonId) => (
          <li key={lessonId}>
            <Link to={lessonPath(lessonId)} className="text-sky-400 hover:text-sky-300">
              {lessonTitle(lessonId)}
            </Link>
            {Object.hasOwn(progress.reading.readLessons, lessonId) && <span className="ml-2 text-xs text-zinc-500">✓ {t('lessonRead')}</span>}
          </li>
        ))}
      </ItemList>
      {items.quizzes.length > 0 && (
        <ItemList title={t('topicQuizzes')}>
          {items.quizzes.map((quiz) => {
            const result = progress.quizzes.results[quiz.id]
            return (
              <li key={quiz.id}>
                <Link to={lessonPath(quiz.lessonId, LESSON_QUIZ_ANCHOR)} className="text-sky-400 hover:text-sky-300">
                  {lessonTitle(quiz.lessonId)}
                </Link>
                <span className="ml-2 text-xs text-zinc-500">
                  {result ? t('topicQuizScore', { percent: percent(result.bestScore) }) : t('topicQuizNotTaken')}
                </span>
              </li>
            )
          })}
        </ItemList>
      )}
      {cardLessons.length > 0 && (
        <ItemList title={t('topicCards')}>
          {cardLessons.map(({ lessonId, count }) => (
            <li key={lessonId}>
              <Link to={flashcardsPath({ kind: 'lesson', lessonId })} className="text-sky-400 hover:text-sky-300">
                {lessonTitle(lessonId)}
              </Link>
              <span className="ml-2 text-xs text-zinc-500">{t('topicCardCount', { count })}</span>
            </li>
          ))}
        </ItemList>
      )}
      {items.challenges.length > 0 && (
        <ItemList title={t('topicChallenges')}>
          {items.challenges.map(({ challenge, required }) => {
            const best = bestAttemptScore(progress.challenges.attempts[challenge.id] ?? [])
            return (
              <li key={challenge.id}>
                <Link to={challengePath(challenge.id)} className="text-sky-400 hover:text-sky-300">
                  {challenge.title}
                </Link>
                <span className="ml-2 text-xs text-zinc-500">
                  {best === undefined ? t('challengeNotStarted') : t('challengeBestScore', { percent: percent(best) })}
                  {!required && ` · ${t('topicChallengeOnceFinished')}`}
                </span>
              </li>
            )
          })}
        </ItemList>
      )}
    </div>
  )
}

function ItemList({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <h3 className="mt-4 text-sm font-semibold text-zinc-200">{title}</h3>
      <ul className="mt-1 space-y-1 text-sm">{children}</ul>
    </>
  )
}
