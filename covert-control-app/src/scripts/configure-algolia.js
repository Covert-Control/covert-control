// scripts/configure-algolia.js
import algoliasearch from 'algoliasearch';

// ⚠️ Use Admin API key here, not the Search key
const APP_ID = process.env.ALGOLIA_APP_ID;
const ADMIN_KEY = process.env.ALGOLIA_ADMIN_API_KEY;

const PRIMARY = 'stories';
const REPLICAS = {
  title_asc:  'stories_title_asc',
  author_asc: 'stories_author_asc',
  likes_desc: 'stories_likes_desc',
  views_desc: 'stories_views_desc',
  date_desc:  'stories_date_desc',
};

const client = algoliasearch(APP_ID, ADMIN_KEY);
const primary = client.initIndex(PRIMARY);

// Base ranking used by Algolia. We’ll prepend our sort criterion.
const baseRanking = ['typo','geo','words','filters','proximity','attribute','exact','custom'];

// Shared settings (make sure these match how you search/filter)
const sharedSettings = {
  searchableAttributes: [
    'title',
    'contentSnippet',
    'description',
    'username',
    'tags',
  ],
  attributesForFaceting: [
    'searchable(tags)',          // for tag filters/suggestions
    'filterOnly(createdAtNumeric)' // for numeric date range filters
  ],
  // Optional: relevance tiebreakers when not using a sort replica
  customRanking: [
    'desc(likesCount)',
    'desc(viewCount)',
    'desc(createdAtNumeric)'
  ],
};

async function main() {
  // 1) Ensure primary knows about its replicas
  await primary.setSettings({
    ...sharedSettings,
    replicas: Object.values(REPLICAS),
  });

  // 2) Configure each replica’s ranking (prepend the sort criterion)
  await client.initIndex(REPLICAS.title_asc).setSettings({
    ...sharedSettings,
    ranking: ['asc(titleSort)', ...baseRanking],
  });

  await client.initIndex(REPLICAS.author_asc).setSettings({
    ...sharedSettings,
    ranking: ['asc(authorSort)', ...baseRanking],
  });

  await client.initIndex(REPLICAS.likes_desc).setSettings({
    ...sharedSettings,
    ranking: ['desc(likesCount)', ...baseRanking],
  });

  await client.initIndex(REPLICAS.views_desc).setSettings({
    ...sharedSettings,
    ranking: ['desc(viewCount)', ...baseRanking],
  });

  await client.initIndex(REPLICAS.date_desc).setSettings({
    ...sharedSettings,
    ranking: ['desc(createdAtNumeric)', ...baseRanking],
  });

  console.log('✅ Algolia primary + replicas configured.');
}

main().catch((e) => {
  console.error('Algolia config failed:', e);
  process.exit(1);
});
