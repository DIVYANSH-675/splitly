import { readFile, writeFile } from 'node:fs/promises';
// Produce one dashboard-deployable source file from the same tested server modules.
let finance = await readFile('mobile/src/lib/finance.mjs', 'utf8');
let audit = (await readFile('server/audit.mjs', 'utf8')).replace(/^import[\s\S]*?;\n/gm, '');
let report = (await readFile('server/export.mjs', 'utf8')).replace(/^import[\s\S]*?;\n/gm, '');
for (const [name, path] of [
  ['regular', 'Manrope-Regular.ttf'],
  ['bold', 'Manrope-Bold.ttf'],
]) {
  report = report.replace(
    new RegExp(`const ${name} = .*?;`),
    `const ${name} = Buffer.from('${(await readFile('server/assets/' + path)).toString('base64')}', 'base64');`,
  );
}
let google = (await readFile('server/google.mjs', 'utf8')).replace(/^import[\s\S]*?;\n/gm, '');
let core = (await readFile('server/core.mjs', 'utf8')).replace(/^import[\s\S]*?;\n/gm, '');
// Avoid helper name collisions when combining modules.
core = core.replace(/\btext\b/g, 'inputText');
const prelude = `import { Buffer } from 'node:buffer';
import { randomBytes, randomUUID, scrypt, createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import PDFDocument from 'npm:pdfkit@0.20.2';
import ExcelJS from 'npm:exceljs@4.4.0';
import postgres from 'npm:postgres@3.4.7';\n`;
// audit and report use separate currency formatting helper names.
audit = audit.replace(/\bmoney\b/g, 'auditMoney');
const runtime = `
const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, {prepare:false,max:1, idle_timeout:20, connection:{search_path:'splitbill'}});
const edgeAttempts = new Map();
Deno.serve(async (request) => {
  const original = new URL(request.url);
  const path = original.pathname.replace(/^.*?\\/splitbill-api/, '');
  if (!path.startsWith('/api/')) return Response.json({error:'Not found'},{status:404});
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length > 3000000) return Response.json({error:'Request is too large'},{status:413});
  for (let attempt=0;attempt<3;attempt++) {
    try {
      return await sql.begin(async transaction => {
        // A small ledger service: one transactional lock prevents lost updates across isolates.
        // All authorization, idempotency, group changes and history commit atomically.
        await transaction.unsafe("set local statement_timeout = '15s'");
        await transaction.unsafe("set local lock_timeout = '10s'");
        await transaction\x60select pg_advisory_xact_lock(6751200)\x60;
        await transaction.unsafe('set local role splitbill_api');
        const db = {prepare(statement) {
          let n=0; const query=statement.replace(/\\?/g,()=>'$'+(++n));
          const run=(...params)=>transaction.unsafe(query,params);
          return {run,all:run,get:async (...params)=>(await run(...params))[0]};
        }};
        const headers = {};
        let status=200, ended=false, output;
        const res={headersSent:false,setHeader(k,v){headers[k]=v;},writeHead(code,values={}){status=code;Object.assign(headers,values);},end(value){ended=true;output=value;this.headersSent=true;}};
        const req={method:request.method,url:path+original.search,headers:Object.fromEntries(request.headers),socket:{remoteAddress:request.headers.get('x-forwarded-for') || 'edge'}, async *[Symbol.asyncIterator](){if(bytes.length) yield Buffer.from(bytes);}};
        await createHandler(db,edgeAttempts)(req,res);
        if (!ended) throw new Error('Incomplete response');
        return new Response(output ?? null,{status,headers});
      });
    } catch(error) {
      if (['40001','40P01'].includes(error.code) && attempt<2) continue;
      console.error('Database request failed',error.code || error.name);
      return Response.json({error:'Service unavailable. Your saved changes can retry.'},{status:503});
    }
  }
});
`;
await writeFile(
  'supabase/functions/splitbill-api/index.ts',
  prelude +
    [finance, audit, report, google, core]
      .map((source) => source.replace(/^export /gm, ''))
      .join('\n') +
    runtime,
);
console.log('Generated dashboard-ready Edge Function');
