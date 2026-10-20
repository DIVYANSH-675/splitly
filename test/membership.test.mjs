import {test} from 'node:test';
import {strict as a} from 'node:assert';
import {createApp} from '../server/index.mjs';
import {projectActions} from '../mobile/src/lib/offline-actions.mjs';

test('username invites, guest claims and new joins preserve identities, ledger and author permissions',async(t)=>{
  const app=createApp({database:':memory:'});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>app.server.close(resolve));app.db.close();});
  const call=async(path,method='GET',body,token,status=200)=>{
    const response=await fetch(`http://127.0.0.1:${app.server.address().port}/api${path}`,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const result=await response.json();a.equal(response.status,status,JSON.stringify(result));return result;
  };
  const guest=(name,username)=>call('/guest','POST',{name,username});
  const owner=await guest('Group owner','group_owner'),j=await guest('Jigyasu Patel','jp_actual'),friend=await guest('Priya Shah','priya_shah'),newcomer=await guest('New Person','new_person');
  await call('/trips','POST',{name:'Invalid',guests:['Temporary','@missing_username']},owner.token,400);
  a.deepEqual(await call('/trips','GET',undefined,owner.token),[]);
  await call('/trips','POST',{name:'Duplicate',guests:['@priya_shah','@PRIYA_SHAH']},owner.token,409);
  await call('/trips','POST',{name:'Self',guests:['@group_owner']},owner.token,409);
  let group=await call('/trips','POST',{id:'stable_group_id_12345',me:'stable_owner_id_12345',memberIds:['stable_jigyasu_12345','stable_priya_id_12345'],name:'Trip',guests:['Jigyasu','@PRIYA_SHAH']},owner.token,201);
  const path=`/trips/${group.id}`,ownerId=group.me,jId=group.members.find(m=>m.name==='Jigyasu').id;
  a.equal(jId,'stable_jigyasu_12345');
  const invited=(await call('/trips','GET',undefined,friend.token))[0];
  a.equal(invited.id,group.id);a.equal(invited.me,'stable_priya_id_12345');a.equal(invited.isOwner,false);
  a.ok(invited.members.some(m=>m.name==='Priya Shah'&&m.username==='priya_shah'&&m.linked));
  a.equal((await call('/join/preview','POST',{code:group.code},friend.token)).joined,true);
  // An already-invited user cannot consume someone else's unclaimed placeholder.
  await call('/join','POST',{code:group.code,memberId:jId},friend.token);
  a.ok((await call('/join/preview','POST',{code:group.code},j.token)).guests.some(m=>m.id===jId));
  const bill={title:'Old dinner',amount:'600',currency:'INR',date:'2026-10-20',category:'Food & drinks',mode:'equal',payers:[{memberId:ownerId}],shares:[{memberId:jId}]};
  group=await call(`${path}/expenses`,'POST',bill,owner.token);
  const oldBill=group.expenses[0];
  group=await call(`${path}/transfers`,'POST',{from:jId,to:ownerId,amount:'100',date:'2026-10-20'},owner.token);
  const oldTransfer=group.transfers[0],balance=group.balances.find(m=>m.id===jId).balance;
  group=await call('/join','POST',{code:group.code,memberId:jId},j.token);
  a.equal(group.me,jId);a.equal(group.total,60000);a.equal(group.balances.find(m=>m.id===jId).balance,balance);
  a.ok(group.members.some(m=>m.id===jId&&m.name==='Jigyasu Patel'&&m.username==='jp_actual'&&m.linked));
  a.equal(group.expenses[0].createdBy,owner.user.id);a.deepEqual(group.expenses[0],oldBill);a.deepEqual(group.transfers[0],oldTransfer);
  a.ok(group.activity[0].changes.some(change=>change.before.includes('Jigyasu')&&change.after.includes('Jigyasu Patel')));
  await call(`${path}/expenses/${oldBill.id}`,'PATCH',{...bill,title:'Claim cannot edit authors bill'},j.token,403);
  await call(`${path}/transfers/${oldTransfer.id}`,'DELETE',{},j.token,403);
  const claimedAgain=await call('/join','POST',{code:group.code,memberId:jId},j.token);
  a.equal(claimedAgain.members.length,3);
  await call('/join','POST',{code:group.code,memberId:jId},newcomer.token,409);
  const asNew=await call('/join','POST',{code:group.code},newcomer.token);
  a.notEqual(asNew.me,jId);a.equal(asNew.balances.find(m=>m.id===asNew.me).balance,0);
  await call('/me','PATCH',{name:'Jigyasu P. Patel'},j.token);
  a.equal((await call(path,'GET',undefined,owner.token)).members.find(m=>m.id===jId).name,'Jigyasu P. Patel');
  await call(`${path}/members/${jId}`,'PATCH',{name:'Owner override'},owner.token,409);
  const ownBill=await call(`${path}/expenses`,'POST',{...bill,title:'My bill'},j.token);
  await call(`${path}/expenses/${ownBill.expenses.at(-1).id}`,'PATCH',{...bill,title:'My updated bill'},j.token);
  await call(`${path}/members`,'POST',{name:'@priya_shah'},owner.token,409);
  await call(`${path}/members`,'POST',{name:'@missing_username'},owner.token,400);
  const next=await guest('Next Friend','next_friend');
  const added=await call(`${path}/members`,'POST',{name:'@next_friend'},owner.token);
  a.equal((await call('/trips','GET',undefined,next.token))[0].id,group.id);
  a.ok(added.members.some(m=>m.name==='Next Friend'&&m.linked));
  // Plain names never link merely because they resemble a username or carry a forged userId.
  const plain=await call(`${path}/members`,'POST',{name:'jp_actual',userId:j.user.id},owner.token);
  a.equal(plain.members.at(-1).linked,false);
});

test('offline username invites retain stable member IDs and remain pending until server resolution',()=>{
  const action={id:'queue-create',path:'/trips',method:'POST',createdAt:'2026-10-20T06:00:00Z',body:{id:'g',me:'owner-member',memberIds:['guest-member','invited-member'],name:'Trip',currency:'INR',guests:['Jigyasu','@jp_actual']}};
  const [group]=projectActions([],JSON.parse(JSON.stringify([action])),{id:'owner',name:'Owner'});
  a.equal(group.members[1].name,'Jigyasu');a.equal(group.members[2].id,'invited-member');a.equal(group.members[2].username,'jp_actual');a.equal(group.members[2].linked,false);
  const [added]=projectActions([group],[{path:'/trips/g/members',method:'POST',body:{id:'later-member',name:'@another_user'}}],{id:'owner',name:'Owner'});
  a.equal(added.members.at(-1).username,'another_user');a.equal(added.members.at(-1).linked,false);
});
