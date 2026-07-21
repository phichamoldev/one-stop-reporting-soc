const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else if (file.endsWith('.ts')) { 
      results.push(file);
    }
  });
  return results;
}

const files = walk('app/api');
let updatedCount = 0;
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  content = content.replace(/const supabaseClient = createClient\([\s\S]*?NEXT_PUBLIC_SUPABASE_ANON_KEY!\s*\);\s*const \{ data: \{ user \}, error: authError \} = await supabaseClient\.auth\.getUser\(token\);/g, 'const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);');
  
  if (content !== original) {
    content = content.replace(/import \{ createClient \} from [\"']@supabase\/supabase-js[\"'];\r?\n?/g, '');
    if (!content.includes('supabaseAdmin')) {
      content = 'import { supabaseAdmin } from "@/lib/supabase-admin";\n' + content;
    }
    fs.writeFileSync(file, content);
    console.log('Updated ' + file);
    updatedCount++;
  }
});
console.log('Total updated: ' + updatedCount);
