// The primer's Anki Decks were copied from the README and the solution write-ups in early 2017. These
// are links in them that the primer has fixed since, mapped to the link it now has in the same sentence.
const primer = 'https://github.com/donnemartin/system-design-primer'

export const flashcardLinkFixes: Record<string, string> = {
  [`${primer}#reverse-proxy`]: `${primer}#reverse-proxy-web-server`,
  [`${primer}#memcached`]: 'https://memcached.org/',
  // The System Design Exercises Deck, from the solution write-ups.
  [`${primer}#index-of-system-design-topics-1`]: `${primer}#index-of-system-design-topics`,
  [`${primer}##representational-state-transfer-rest`]: `${primer}#representational-state-transfer-rest`,
  [`${primer}#master-slave`]: `${primer}#master-slave-replication`,
  [`${primer}#Sharding`]: `${primer}#sharding`,
  [`${primer}#aysnchronism`]: `${primer}#asynchronism`,
  [`${primer}#sql`]: `${primer}#relational-database-management-system-rdbms`,
  [`${primer}#consistent-hashing`]: `${primer}#under-development`,
  [`${primer}#scatter-gather`]: `${primer}#under-development`,
}

// The write-ups linked topics the README did not have yet to `#`. Link text → the link they have now.
export const flashcardPlaceholderLinks: Record<string, string> = {
  'system design topics': `${primer}#index-of-system-design-topics`,
  Microservices: `${primer}#microservices`,
  'Key-value store': `${primer}#key-value-store`,
  'Document store': `${primer}#document-store`,
  'Wide column store': `${primer}#wide-column-store`,
  'Graph database': `${primer}#graph-database`,
  'SQL vs NoSQL': `${primer}#sql-or-nosql`,
  'Message queues': `${primer}#message-queues`,
  'Task queues': `${primer}#task-queues`,
  'Back pressure': `${primer}#back-pressure`,
}

// The System Design Exercises Deck links into the primer under the name the repo had in 2017.
export const flashcardFormerRepoUrls: string[] = [`${primer}-interview`]
