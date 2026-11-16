const fs = require('fs');
const content = fs.readFileSync('scripts/run_phase3_integration_suite.ts', 'utf8');

const regex = /recordTest\(\s*['"](TC-[^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/g;
let match;
const testHeaders = [];
while ((match = regex.exec(content)) !== null) {
  testHeaders.push({
    index: match.index,
    id: match[1],
    category: match[2],
    name: match[3]
  });
}

const classified = [];
for (let i = 0; i < testHeaders.length; i++) {
  const current = testHeaders[i];
  const next = testHeaders[i + 1];
  const body = content.slice(current.index, next ? next.index : undefined);

  const hasRouteCall = /(reportsRoute|reportsLookupRoute|reportPublicIdRoute|reportStatusRoute|reportSimilarRoute|bulkActionRoute|incidentDraftsRoute|incidentBulkReplyRoute|incidentsRoute|dashboardRoute|analyticsRoute)\.(POST|GET|PATCH|DELETE)/.test(body);
  const hasDirectRpc = /supabase(Admin|Anon)\.rpc\(/.test(body);
  const hasDirectPostgREST = /staffClient\.(from|rpc)/.test(body);
  const hasDbQuery = /supabaseAdmin\.from\(/.test(body);
  const hasAnonRpc = /supabaseAnon\.rpc\(/.test(body);

  let layer = '';
  if (hasRouteCall && hasDbQuery) {
    layer = 'Next.js API Route + DB State Verification';
  } else if (hasRouteCall) {
    layer = 'Next.js API Route (In-process Web Request)';
  } else if (hasDirectRpc && hasDbQuery) {
    layer = 'Direct PostgreSQL RPC + DB State Verification';
  } else if (hasAnonRpc || hasDirectRpc) {
    layer = 'Direct PostgreSQL RPC Call';
  } else if (hasDirectPostgREST) {
    layer = 'Direct PostgREST API (Authenticated RLS Client)';
  } else if (hasDbQuery) {
    layer = 'Direct Database Query (PostgreSQL via Admin SDK)';
  } else {
    layer = 'TypeScript / Service Unit Logic';
  }

  classified.push({ ...current, layer });
}

console.log('Total tests identified:', classified.length);
const counts = {};
classified.forEach(c => { counts[c.layer] = (counts[c.layer] || 0) + 1; });
console.log('\nLayer Breakdown:');
console.log(JSON.stringify(counts, null, 2));

console.log('\nAll 59 Test Classifications:');
classified.forEach(c => {
  console.log(`${c.id.padEnd(12)} | ${c.layer.padEnd(46)} | ${c.name}`);
});

