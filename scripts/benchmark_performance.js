const { performance } = require('perf_hooks');
const fs = require('fs');

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
process.env.REPORT_DATA_SOURCE = 'test';
process.env.LINE_NOTIFICATIONS_ENABLED = 'false';

const { createClient } = require('@supabase/supabase-js');
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function getPercentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return Math.round(sorted[Math.max(0, index)] * 10) / 10;
}

async function runBenchmarks() {
  console.log('================================================================');
  console.log('PHASE 3 PERFORMANCE BENCHMARKING (Statistical Sample Size: 30)');
  console.log('================================================================');

  // Benchmark 1: Database Query (test_reports overview)
  const dbDurations = [];
  for (let i = 0; i < 30; i++) {
    const t0 = performance.now();
    await admin.from('test_reports').select('id, public_id, status, category_id').limit(50);
    dbDurations.push(performance.now() - t0);
  }

  // Benchmark 2: PostgREST Single Row Read by ID
  const pgrstDurations = [];
  for (let i = 0; i < 30; i++) {
    const t0 = performance.now();
    await admin.from('categories').select('*');
    pgrstDurations.push(performance.now() - t0);
  }

  // Benchmark 3: RPC test_confirm_incident_draft_atomic (Idempotent replay)
  const rpcDurations = [];
  for (let i = 0; i < 30; i++) {
    const t0 = performance.now();
    await admin.rpc('test_confirm_incident_draft_atomic', {
      p_title: 'Bench',
      p_description: 'Bench',
      p_category_id: 1,
      p_report_ids: ['00000000-0000-0000-0000-000000000000'],
      p_draft_fingerprint: 'bench_fp',
      p_staff_id: '00000000-0000-0000-0000-000000000000',
      p_idempotency_key: 'bench_key',
      p_request_hash: 'bench_hash'
    });
    rpcDurations.push(performance.now() - t0);
  }

  const results = [
    {
      operation: 'Database Overview Query (PostgREST table scan)',
      slaMs: 200,
      samples: dbDurations.length,
      p50: getPercentile(dbDurations, 50),
      p95: getPercentile(dbDurations, 95),
      p99: getPercentile(dbDurations, 99),
      mean: Math.round((dbDurations.reduce((a, b) => a + b, 0) / dbDurations.length) * 10) / 10
    },
    {
      operation: 'Category Reference Lookup',
      slaMs: 100,
      samples: pgrstDurations.length,
      p50: getPercentile(pgrstDurations, 50),
      p95: getPercentile(pgrstDurations, 95),
      p99: getPercentile(pgrstDurations, 99),
      mean: Math.round((pgrstDurations.reduce((a, b) => a + b, 0) / pgrstDurations.length) * 10) / 10
    },
    {
      operation: 'Atomic Procedure Execution (Draft Confirmation)',
      slaMs: 500,
      samples: rpcDurations.length,
      p50: getPercentile(rpcDurations, 50),
      p95: getPercentile(rpcDurations, 95),
      p99: getPercentile(rpcDurations, 99),
      mean: Math.round((rpcDurations.reduce((a, b) => a + b, 0) / rpcDurations.length) * 10) / 10
    }
  ];

  console.table(results);
  fs.writeFileSync('scripts/benchmark_results.json', JSON.stringify(results, null, 2));
}

runBenchmarks();
