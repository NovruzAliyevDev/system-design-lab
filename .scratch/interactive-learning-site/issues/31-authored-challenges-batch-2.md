# 31: Authored Challenges, batch 2: chat system, news feed, notification system

**What to build:** Three more authored Challenges in the same format as ticket 30: chat system (WhatsApp-like), news feed, and notification system. Where it fits, they include push/websocket-style connections and fan-out trade-offs. If WebSocket gateway or push service components are missing from the palette, add them.

**Blocked by:** 20

**Status:** resolved

- [x] Three Challenge definitions with source = authored.
- [x] Fan-out-on-write vs fan-out-on-read covered in the news feed deep dive and Scaling targets.
- [x] Content validation tests pass for all three.
- [x] Any new component type or predicate has Seam A tests.

## Comments

**Done on `main`.**

- **Three new palette components** (`components.ts`), with Glossary Terms "WebSocket", "Fan-out" and "Push notification service" for the palette tooltips.
  - **WebSocket gateway** (`websocket-gateway`, tag WS).
    - It relays 20,000 messages a second per instance in 0.5 ms, since it pushes frames over connections that are already open.
    - It has no special simulation semantics.
  - **Push service** (`push-service`, tag PUSH).
    - A third-party provider with `channel` set to `mobile-push` (APNs, FCM), `sms` or `email`.
    - It has no `instances`: there is nothing of it to scale.
    - It takes 100,000 a second, and its $100 a month stands for a plan, since providers bill per message.
    - It takes 150 ms, from the primer's "Send packet CA->Netherlands->CA", now added to `PRIMER_LATENCY_NS`. So calling it synchronously breaks any latency target, and behind a queue its outage turns into a backlog.
  - **Fan-out service** (`fan-out`, tag FAN).
    - `fanOut` (default 1) is the number of copies each request it serves is sent on as, along each Edge out.
    - Its capacity (5,000 copies a second per instance) counts every copy it sends: it serves capacity ÷ (fanOut × Edges out) requests.
    - A request waits for its copies once, not one after another, and fails when they fail.
    - The spec's Simulation Engine section now describes this.
- **New simulation target:** `maxMonthlyCostUsd`, a budget on the whole Design's monthly cost (`rules.ts`), with content validation.
- **Three Challenges** (`content/authored-challenges/`, after the ID generator), each with five Stages, Azerbaijani explanations and no Solution page.
  - `authored-challenges/shared.ts` now also holds the `MOBILE_PUSH` selector.
  - **Chat system** (`chat-system.ts`):
    - 1B messages a day, each delivered to 2 devices, 100 bytes, kept 5 years: 12,000 sends and 24,000 deliveries a second, 36 TB a year, 180 TB in total.
    - A message sent is a write. A message delivered is a read, which the gateway takes from the chat service's inbox.
    - High-level design: everything to the message store goes through the WebSocket gateway; messages live in a key-value or wide-column store; offline push goes to APNs/FCM through a queue (or an asynchronous Edge).
    - Scaling at a 2× peak: gateways behind a load balancer, a sharded message store and an inbox cache on the delivery path.
    - Chaos task: the Redis cluster (inbox and presence) goes down, so the message store must take every delivery.
    - Deep dive: polling vs long polling vs WebSocket, per-conversation message ids, routing to another gateway, presence heartbeats, group fan-out (small groups on write, huge channels on read), and when to acknowledge.
  - **News feed** (`news-feed.ts`):
    - 1B posts and 50B feed reads a month, 200 friends each, 1 KB a post, 5 years: 400 posts and 20,000 reads a second, 60 TB.
    - High-level design: either fan-out on write (posts → fan-out 200 → feed cache) or fan-out on read (feed reads → fan-out 200 → posts) is accepted, plus a graph DB for friendships.
    - Scaling at a 2× peak:
      - a $40,000 budget: fan-out on write costs about $26,400, while fan-out on read needs 8 million copies a second, more than 1,000 fan-out instances can send;
      - a Rule requiring fan-out on write;
      - Chaos task: the fan-out service goes down, so posting must not wait for it (a queue before it).
    - Deep dive: write vs read for a 50:1 read-heavy feed, celebrities and the hybrid, ids only in the feed cache, skipping inactive users, cursor pagination, and fan-out outage.
  - **Notification system** (`notification-system.ts`):
    - 2.5B notifications a month, a 5× campaign peak, 500 bytes a record: 1,000 a second (5,000 at the peak), 15 TB a year. Writes only.
    - Each notification goes as a push to 2 devices (fan-out 2) and as an e-mail.
    - High-level design: a notification log, a settings and tokens cache, queues before every provider, at least two queues, and both channels.
    - Scaling: a 50 ms acceptance target, which a synchronous provider call breaks, a sharded log and scaled-out push workers.
    - Chaos task: the mobile push provider goes down.
    - Deep dive: at-least-once with dedup, backoff and dead-letter queue, opt-out, frequency caps and sender auth, campaign fan-out (push on write, in-app inbox on read), priority queues for OTPs, and token freshness.
  - Lookups on the write path (friends in the graph, presence, settings) are drawn as write Edges, as the primer Twitter Challenge does; each file's header says so.
- **Tests.**
  - `simulate.test.ts`:
    - fan-out: default 1, copies per Edge, capacity counting copies over every Edge, overloaded, and latency and failure once per request;
    - WebSocket gateway capacity;
    - push service: 150 ms when synchronous, and backlog behind a queue when down.
  - `rules.test.ts`: the budget target. `challenge.test.ts`: an invalid budget fails the build.
  - `primer-catalog.test.ts`: the six authored Challenges, each Estimation's numbers, and key mistakes:
    - chat: a path around the gateway, a synchronous push, no inbox (a push worker reading presence), and a store without replicas under the cache outage;
    - news feed: either fan-out time accepted at high level but only with fan-out 200, fan-out on read over budget and overloaded, and a synchronous fan-out failing its Chaos task;
    - notifications: one push per device, one queue for both channels, and a synchronous provider failing both latency and Chaos.
- **Review.** /code-review (Standards + Spec) findings are fixed:
  - the fan-out capacity now counts copies on every Edge out;
  - the chat inbox Rule now needs deliveries to reach a cache;
  - the chat Chaos task now says it takes down the whole Redis cluster;
  - the notification queue Rule's description now matches its check;
  - the news feed's lookup service is renamed "Friend Lookup", so "fan-out service" means one thing;
  - "at least N" Hints that landed at ρ = 1 now say "more than N";
  - `MOBILE_PUSH` is shared and documented, and the push component's label is English like the others.
  - Kept as is:
    - the `sms` channel, a general palette option like the unused load balancer algorithms;
    - "dropped" counting copies sent along a cut Edge, since they are requests the target never gets;
    - a separate push predicate in each file, since the chat one also accepts an asynchronous Edge.
