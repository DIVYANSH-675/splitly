import { test } from 'node:test';
import { strict as a } from 'node:assert';
import ExcelJS from 'exceljs';
import { createApp } from '../server/index.mjs';
async function fixture(t, emailAuth) {
  const app = createApp({ database: ':memory:', emailAuth });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  t.after(async () => {
    await new Promise((r) => app.server.close(r));
    app.db.close();
  });
  const base = `http://127.0.0.1:${app.server.address().port}/api`;
  const response = (path, method = 'GET', body, token) =>
    fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const request = async (path, method, body, token, status = 200) => {
    const r = await response(path, method, body, token);
    const data = await r.json();
    a.equal(r.status, status, JSON.stringify(data));
    return data;
  };
  const owner = await request('/guest', 'POST', { name: 'Admin' }),
    author = await request('/guest', 'POST', { name: 'Sam' }),
    peer = await request('/guest', 'POST', { name: 'Lee' });
  let trip = await request('/trips', 'POST', { name: 'Weekend trip' }, owner.token, 201);
  trip = await request('/join', 'POST', { code: trip.code }, author.token);
  trip = await request('/join', 'POST', { code: trip.code }, peer.token);
  const body = {
    title: 'Dinner',
    amount: '900',
    currency: 'INR',
    category: 'Food & drinks',
    date: '2026-10-20',
    mode: 'equal',
    shares: trip.members.map((m) => ({ memberId: m.id })),
    payers: [{ memberId: trip.members[1].id }],
  };
  return { ...app, request, response, owner, author, peer, trip, path: `/trips/${trip.id}`, body };
}
test('authors edit their entries, admin edits anyone, peers cannot; history keeps old/new values', async (t) => {
  const { request, owner, author, peer, path, body, db, trip: initial } = await fixture(t);
  let trip = await request(`${path}/expenses`, 'POST', body, author.token);
  const eid = trip.expenses[0].id;
  await request(`${path}/expenses/${eid}`, 'PATCH', { ...body, amount: '1200' }, peer.token, 403);
  await request(`${path}/expenses/${eid}`, 'DELETE', undefined, peer.token, 403);
  trip = await request(
    `${path}/expenses/${eid}`,
    'PATCH',
    { ...body, amount: '1200' },
    owner.token,
  );
  a.equal(trip.expenses[0].createdBy, author.user.id);
  let entry = trip.activity[0];
  a.equal(entry.user, 'Admin');
  a.match(entry.message, /updated expense/);
  a.ok(
    entry.changes.some(
      (c) => c.field.endsWith('Amount') && c.before === 'INR 900.00' && c.after === 'INR 1200.00',
    ),
  );
  trip = await request(
    `${path}/expenses/${eid}`,
    'PATCH',
    { ...body, category: 'Transport' },
    author.token,
  );
  a.equal(trip.activity[0].user, 'Sam');
  a.ok(
    trip.activity[0].changes.some((c) => c.field.endsWith('Category') && c.after === 'Transport'),
  );
  const transfer = {
    from: trip.members[2].id,
    to: trip.members[1].id,
    amount: '50',
    date: '2026-10-20',
    note: 'Advance',
  };
  trip = await request(`${path}/transfers`, 'POST', transfer, author.token);
  const tid = trip.transfers[0].id;
  await request(
    `${path}/transfers/${tid}`,
    'PATCH',
    { ...transfer, amount: '80' },
    peer.token,
    403,
  );
  trip = await request(
    `${path}/transfers/${tid}`,
    'PATCH',
    { ...transfer, amount: '80' },
    owner.token,
  );
  a.equal(trip.transfers[0].createdBy, author.user.id);
  a.equal(trip.total, 90000);
  a.ok(
    trip.activity[0].changes.some(
      (c) => c.field === 'Transfer · Amount' && c.before === 'INR 50.00' && c.after === 'INR 80.00',
    ),
  );
  trip = await request(
    `${path}/transfers/${tid}`,
    'PATCH',
    { ...transfer, note: 'Corrected' },
    author.token,
  );
  a.equal(trip.transfers[0].note, 'Corrected');
  const stored = JSON.parse(db.prepare('SELECT data FROM trips WHERE id=?').get(initial.id).data);
  stored.activity.push(
    ...Array.from({ length: 350 }, (_, i) => ({
      id: `legacy-${i}`,
      user: 'Admin',
      message: 'older update',
      at: '2026-10-01T00:00:00Z',
    })),
  );
  db.prepare('UPDATE trips SET data=? WHERE id=?').run(JSON.stringify(stored), initial.id);
  const oldLength = stored.activity.length;
  trip = await request(`${path}/expenses/${eid}`, 'DELETE', undefined, author.token);
  a.equal(trip.activity.length, oldLength + 1);
  a.ok(trip.activity[0].changes.some((c) => c.before === 'Dinner' && c.after === ''));
  a.ok(trip.activity.some((e) => e.id === 'legacy-349'));
});
test('offline request replay is idempotent, even after the saved bill is deleted', async (t) => {
  const { request, path, body, author } = await fixture(t);
  const payload = { ...body, clientRequestId: 'bill_device_1234567890' };
  let trip = await request(`${path}/expenses`, 'POST', payload, author.token);
  const version = trip.version,
    count = trip.activity.length,
    id = trip.expenses[0].id;
  trip = await request(`${path}/expenses`, 'POST', payload, author.token);
  a.equal(trip.version, version);
  a.equal(trip.activity.length, count);
  a.equal(trip.expenses.length, 1);
  await request(`${path}/expenses`, 'POST', { ...payload, amount: '901' }, author.token, 409);
  await request(`${path}/expenses/${id}`, 'DELETE', undefined, author.token);
  trip = await request(`${path}/expenses`, 'POST', payload, author.token);
  a.equal(trip.expenses.length, 0);
  a.equal(trip.total, 0);
});
test('PDF/XLSX exports require membership and reconcile expenses, transfers, shares and history', async (t) => {
  const { request, response, path, body, owner, author } = await fixture(t);
  const trip = await request(`${path}/expenses`, 'POST', body, author.token);
  await request(
    `${path}/transfers`,
    'POST',
    {
      from: trip.members[2].id,
      to: trip.members[1].id,
      amount: '100',
      date: '2026-10-20',
      note: 'Not an expense',
    },
    owner.token,
  );
  a.equal((await response(`${path}/export/xlsx`)).status, 401);
  const stranger = await request('/guest', 'POST', { name: 'Outsider' });
  a.equal((await response(`${path}/export/pdf`, 'GET', undefined, stranger.token)).status, 403);
  const xlsx = await response(`${path}/export/xlsx`, 'GET', undefined, author.token);
  a.equal(xlsx.status, 200);
  a.match(xlsx.headers.get('content-type'), /spreadsheetml/);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(Buffer.from(await xlsx.arrayBuffer()));
  a.deepEqual(
    book.worksheets.map((s) => s.name),
    ['Summary', 'Balances', 'Expenses', 'Shares', 'Payers', 'Transfers', 'Activity'],
  );
  a.equal(book.getWorksheet('Summary').getCell('C2').value, 900);
  a.equal(book.getWorksheet('Expenses').getCell('F2').value, 900);
  a.equal(book.getWorksheet('Transfers').getCell('D2').value, 100);
  a.equal(book.getWorksheet('Shares').getCell('D2').value, 300);
  a.ok(book.getWorksheet('Activity').rowCount > 4);
  a.equal(
    book
      .getWorksheet('Balances')
      .getColumn(4)
      .values.slice(2)
      .reduce((n, v) => n + v, 0),
    0,
  );
  const pdf = await response(`${path}/export/pdf`, 'GET', undefined, owner.token);
  a.equal(pdf.status, 200);
  a.equal(pdf.headers.get('content-type'), 'application/pdf');
  const bytes = Buffer.from(await pdf.arrayBuffer());
  a.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  a.ok(bytes.length > 5000);
});

test('a one-page report keeps its footer on that page without blank trailing pages',async()=>{
  const {exportTrip}=await import('../server/export.mjs');
  const bytes=await exportTrip({name:'Empty group',currency:'INR',members:[],expenses:[],transfers:[],activity:[],balances:[],total:0},'pdf');
  const pageObjects=bytes.toString('latin1').match(/\/Type \/Page\b/g)||[];
  a.equal(pageObjects.length,1);
});

test('custom categories, private attachments and usernames persist across members and edits', async t => {
  const {request,response,owner,author,peer,path,body,db}=await fixture(t);
  let group=await request(`${path}/categories`,'POST',{name:'Camping'},author.token);
  a.ok(group.categories.includes('Camping'));
  a.ok((await request(path,'GET',undefined,peer.token)).categories.includes('Camping'));
  const uploaded=await request(`${path}/attachments`,'POST',{id:'file_synthetic_123456789',name:'receipt.pdf',mime:'application/pdf',data:Buffer.from('%PDF-1.4\nSynthetic test only').toString('base64')},author.token);
  a.equal((await response(`${path}/attachments/${uploaded.id}`,'GET',undefined,peer.token)).status,404);
  group=await request(`${path}/expenses`,'POST',{...body,category:'Camping',attachments:[uploaded]},author.token);
  a.equal(group.expenses[0].attachments[0].name,'receipt.pdf');
  a.equal((await response(`${path}/attachments/${uploaded.id}`,'GET',undefined,peer.token)).status,200);
  a.equal((await response(`${path}/attachments/${uploaded.id}`)).status,401);
  await request(`${path}/attachments`,'POST',{id:'file_invalid_1234567890',name:'bad.pdf',mime:'application/pdf',data:Buffer.from('not a PDF').toString('base64')},author.token,400);
  group=await request(`${path}/expenses/${group.expenses[0].id}`,'PATCH',{...body,attachments:[]},owner.token);
  a.equal(group.expenses[0].attachments.length,0);
  a.ok(group.activity[0].changes.some(change => change.field.endsWith('Attachments') && change.before === 'receipt.pdf' && change.after === ''));
  a.ok(JSON.parse(db.prepare('SELECT data FROM trips WHERE id=?').get(group.id).data).categories.includes('Camping'));
  const profile=await request('/me','PATCH',{name:'Admin',username:'unique_admin'},owner.token);
  a.equal(profile.username,'unique_admin');
  await request('/me','PATCH',{name:'Peer',username:'UNIQUE_ADMIN'},peer.token,409);
  await request('/guest','POST',{name:'Duplicate',username:'unique_admin'},undefined,409);
});

test('queued group/member IDs survive sync and all mutation retries are duplicate safe', async t => {
  const {request,owner}=await fixture(t);
  const input={id:'op_group_1234567890',me:'op_member_123456789',memberIds:['op_guest_1234567890'],name:'Offline group',guests:['Jo'],currency:'INR',clientRequestId:'op_create_123456789'};
  let group=await request('/trips','POST',input,owner.token,201);
  a.equal(group.id,input.id); a.equal(group.me,input.me); a.equal(group.members[1].id,input.memberIds[0]);
  const replay=await request('/trips','POST',input,owner.token); a.equal(replay.id,group.id);
  const path=`/trips/${group.id}`;
  const transfer={id:'op_transfer_123456789',from:group.me,to:group.members[1].id,amount:'75',date:'2026-10-20',clientRequestId:'op_transfer_req_123456789'};
  group=await request(`${path}/transfers`,'POST',transfer,owner.token);
  group=await request(`${path}/transfers`,'POST',transfer,owner.token);
  a.equal(group.transfers.length,1); a.equal(group.total,0);
  a.equal(group.balances.find(b=>b.id===group.me).balance,7500);
  await request(`${path}/transfers`,'POST',{...transfer,amount:'99'},owner.token,409);
  const remove={clientRequestId:'op_delete_req_123456789'};
  group=await request(`${path}/transfers/${transfer.id}`,'DELETE',remove,owner.token);
  const again=await request(`${path}/transfers/${transfer.id}`,'DELETE',remove,owner.token);
  a.equal(again.activity.length,group.activity.length);
  // DELETE bodies are parsed too, so a replay does not create a second audit event.
});


test('backup email must be verified and restores the same identity without a username', async t => {
  const codes=new Map();
  const emailAuth={send:async email=>{codes.set(email,'123456');}, verify:async (email,code)=>{
    if(codes.get(email)!==code) throw Object.assign(new Error('Incorrect or expired code'),{status:401});
    codes.delete(email);return {email,email_confirmed_at:new Date().toISOString()};
  }};
  const {request,owner,peer,trip}=await fixture(t,emailAuth);
  await request('/backup-email/start','POST',{email:'owner@example.test'},owner.token);
  await request('/backup-email/verify','POST',{email:'other@example.test',code:'123456'},owner.token,400);
  await request('/backup-email/verify','POST',{email:'owner@example.test',code:'999999'},owner.token,401);
  const linked=await request('/backup-email/verify','POST',{email:'owner@example.test',code:'123456'},owner.token);
  a.equal(linked.backupEmail,'owner@example.test');
  await request('/backup-email/start','POST',{email:'owner@example.test'},peer.token,409);
  await request('/email-login/start','POST',{email:'missing@example.test'});
  a.equal(codes.has('missing@example.test'),false);
  await request('/email-login/start','POST',{email:'owner@example.test'});
  await request('/email-login/verify','POST',{email:'owner@example.test',code:'000000'},undefined,401);
  const recovered=await request('/email-login/verify','POST',{email:'owner@example.test',code:'123456'});
  a.equal(recovered.user.id,owner.user.id);
  const group=await request(`/trips/${trip.id}`,'GET',undefined,recovered.token);
  a.equal(group.isOwner,true);
  await request('/email-login/verify','POST',{email:'owner@example.test',code:'123456'},undefined,401);
});


test('offline entity IDs cannot replace another group or collide with ledger entries', async t => {
 const {request,owner,author,trip,path,body}=await fixture(t);
 await request('/trips','POST',{id:trip.id,name:'Replacement attempt'},author.token,409);
 const unchanged=await request(path,'GET',undefined,owner.token);
 a.equal(unchanged.ownerId,owner.user.id);a.equal(unchanged.name,trip.name);
 await request(path+'/expenses','POST',{...body,id:'bill_collision_123456789'},author.token);
 await request(path+'/expenses','POST',{...body,id:'bill_collision_123456789'},author.token,409);
 const transfer={id:'transfer_collision_123456789',from:trip.members[0].id,to:trip.members[1].id,amount:'1',date:'2026-10-20'};
 await request(path+'/transfers','POST',transfer,author.token);
 await request(path+'/transfers','POST',transfer,author.token,409);
 const final=await request(path,'GET',undefined,owner.token);
 a.equal(final.expenses.length,1);a.equal(final.transfers.length,1);
});
test('replaying an old request does not let a removed member read the group', async t=>{
 const {request,owner,peer,trip,path}=await fixture(t);
 const body={name:'Camping',clientRequestId:'op_removed_member_123456789'};
 await request(path+'/categories','POST',body,peer.token);
 await request(path+'/members/'+trip.members[2].id,'DELETE',undefined,owner.token);
 await request(path+'/categories','POST',body,peer.token,403);
 await request(path,'GET',undefined,peer.token,403);
});
