import {test} from 'node:test';
import {strict as a} from 'node:assert';
import {createApp} from '../server/index.mjs';
import {createGoogleAuth} from '../server/google.mjs';
import {googleAuthorizeUrl,googleCallback} from '../mobile/src/lib/google-flow.mjs';

test('Google callback binds the device, API, path and PKCE verifier; expires and rejects denial',()=>{
  const p={state:'random-state',verifier:'v'.repeat(64),redirect:'splitly://auth/google',apiUrl:'https://api.test',createdAt:1000,link:false};
  const url=new URL(googleAuthorizeUrl('https://project.supabase.co/auth/v1/authorize',p.redirect,p.state,'challenge'));
  a.equal(url.searchParams.get('provider'),'google');
  a.equal(url.searchParams.get('code_challenge_method'),'s256');
  a.equal(new URL(url.searchParams.get('redirect_to')).searchParams.get('state'),p.state);
  a.deepEqual(googleCallback('splitly://auth/google?state=random-state&code=one-use',p,p.apiUrl,2000),{code:'one-use',verifier:p.verifier});
  for (const bad of ['splitly://auth/google?state=other&code=x','splitly://auth/other?state=random-state&code=x','evil://auth/google?state=random-state&code=x','splitly://auth/google?state=random-state&error=access_denied','splitly://auth/google?state=random-state']) a.throws(()=>googleCallback(bad,p,p.apiUrl,2000));
  a.throws(()=>googleCallback('splitly://auth/google?state=random-state&code=x',p,'https://other.test',2000));
  a.throws(()=>googleCallback('splitly://auth/google?state=random-state&code=x',p,p.apiUrl,601001));
  a.throws(()=>googleCallback('splitly://auth/google?code=x',null,p.apiUrl,2000));
});

test('Google adapter exchanges PKCE server-side and trusts only a confirmed provider identity',async()=>{
  let identity={sub:'google-subject',email:'friend@gmail.com',email_verified:true,name:'Friend',picture:'https://lh3.googleusercontent.com/a/example=s96-c'};
  const requests=[];
  const google=createGoogleAuth({url:'https://project.supabase.co',key:'test-publishable',request:async(url,options)=>{
    requests.push({url,options});
    if(url.endsWith('/settings')) return Response.json({external:{google:true}});
    if(url.endsWith('/token?grant_type=pkce')) return Response.json({access_token:'private-short-lived-token'});
    return Response.json({email:'friend@gmail.com',email_confirmed_at:'today',identities:[{provider:'google',identity_data:identity}],user_metadata:{role:'admin',userId:'victim'}});
  }});
  a.equal((await google.config()).authorizeUrl,'https://project.supabase.co/auth/v1/authorize');
  a.deepEqual(await google.exchange('one-use','v'.repeat(64)),{subject:'google-subject',email:'friend@gmail.com',name:'Friend',photo:'https://lh3.googleusercontent.com/a/example=s96-c'});
  a.deepEqual(JSON.parse(requests[1].options.body),{auth_code:'one-use',code_verifier:'v'.repeat(64)});
  a.equal(requests[2].options.headers.Authorization,'Bearer private-short-lived-token');
  identity={...identity,picture:'https://attacker.example/photo.jpg'};
  a.equal((await google.exchange('x','v'.repeat(64))).photo,'');
  identity={...identity,picture:'https://googleusercontent.com.attacker.example/photo.jpg'};
  a.equal((await google.exchange('x','v'.repeat(64))).photo,'');
  identity={...identity,email_verified:false};
  await a.rejects(()=>google.exchange('x','v'.repeat(64)),/verified Google/);
  identity={...identity,email_verified:true,email:'other@gmail.com'};
  await a.rejects(()=>google.exchange('x','v'.repeat(64)),/email could not be verified/);
  await a.rejects(()=>google.exchange('x','short'),/start.*again/i);
  const disabled=createGoogleAuth({url:'https://project.test',key:'public',request:async()=>Response.json({external:{google:false}})});
  await a.rejects(()=>disabled.config(),/not configured yet/);
  const failure=createGoogleAuth({url:'https://project.test',key:'public',request:async()=>Response.json({error:'invalid_grant'},{status:400})});
  await a.rejects(()=>failure.exchange('x','v'.repeat(64)),/could not be verified/);
});

test('Google sign-in preserves connected accounts and permissions, prevents takeover and duplicate identities',async(t)=>{
  const proofs=new Map(); let sequence=0;
  const proof=(subject,email='friend@gmail.com')=>{
    const code=`code-${++sequence}`;proofs.set(code,{subject,email,name:'Google Friend',photo:'https://lh3.googleusercontent.com/a/example=s96-c'});return {code,verifier:'v'.repeat(64)};
  };
  const app=createApp({allowLegacyAuth:true,database:':memory:',googleAuth:{config:async()=>({authorizeUrl:'https://project.test/auth/v1/authorize'}),exchange:async(code)=>{
    const identity=proofs.get(code);proofs.delete(code);
    if(!identity) throw Object.assign(new Error('Invalid or used code'),{status:401});
    return identity;
  }}});
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
  t.after(async()=>{await new Promise(r=>app.server.close(r));app.db.close();});
  const request=async(path,body,token,status=200)=>{
    const res=await fetch(`http://127.0.0.1:${app.server.address().port}/api${path}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const data=await res.json();a.equal(res.status,status,JSON.stringify(data));return data;
  };
  const owner=await request('/guest',{name:'Original owner',username:'original_owner'});
  const group=await request('/trips',{name:'Keep my group',currency:'INR'},owner.token,201);
  await request('/google/link',proof('google-owner'),null,401);
  const linked=await request('/google/link',proof('google-owner'),owner.token);
  a.equal(linked.id,owner.user.id);a.equal(linked.username,'original_owner');a.equal(linked.googleEmail,'friend@gmail.com');
  await request('/logout',{},owner.token);
  await request(`/trips/${group.id}`,null,owner.token,401);
  const loginProof=proof('google-owner');
  const recovered=await request('/google/login',loginProof);
  a.equal(recovered.user.id,owner.user.id);
  const saved=await request(`/trips/${group.id}`,null,recovered.token);
  a.equal(saved.isOwner,true);a.equal(saved.name,'Keep my group');
  await request('/google/login',loginProof,null,401);
  const outsider=await request('/guest',{name:'Outsider',username:'outsider_google'});
  await request('/google/link',proof('google-owner'),outsider.token,409);
  await request('/google/link',proof('different-subject'),recovered.token,409);
  // No automatic claiming by a legacy/unverified profile email.
  const legacy=await request('/register',{name:'Legacy',email:'legacy@gmail.com',password:'safe-test-password'});
  const fresh=await request('/google/login',proof('new-subject','legacy@gmail.com'));
  a.notEqual(fresh.user.id,legacy.user.id);a.ok(fresh.user.username);a.ok(fresh.token);
  a.deepEqual(await request('/trips',null,fresh.token),[]);
  const again=await request('/google/login',proof('new-subject','legacy@gmail.com'));
  a.equal(again.user.id,fresh.user.id);
  // A matching email alone never joins or replaces a legacy account.
  app.db.prepare('INSERT INTO backup_emails VALUES(?,?,?)').run(outsider.user.id,'backup@gmail.com',new Date().toISOString());
  const separate=await request('/google/login',proof('backup-subject','backup@gmail.com'));
  a.notEqual(separate.user.id,outsider.user.id);
  a.equal(app.db.prepare('SELECT count(*) as n FROM oauth_identities').get().n,3);
  a.equal(fresh.user.name,'Google Friend');
  a.equal(fresh.user.photo,'https://lh3.googleusercontent.com/a/example=s96-c');
  a.match(fresh.user.username,/^goog[0-9]{4}$/);
  a.notEqual(fresh.user.username,separate.user.username);
  const saveProfile=async(body)=>fetch(`http://127.0.0.1:${app.server.address().port}/api/me`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${fresh.token}`},body:JSON.stringify(body)});
  a.equal((await saveProfile({name:'Google photo retained',photo:fresh.user.photo})).status,200);
  a.equal((await saveProfile({photo:'https://attacker.example/image.jpg'})).status,400);
  const photo='data:image/jpeg;base64,/9j/2Q==';
  a.equal((await saveProfile({photo})).status,200);
  const withPhoto=await request('/google/login',proof('new-subject','legacy@gmail.com'));
  a.equal(withPhoto.user.photo,photo);a.equal(withPhoto.user.name,'Google photo retained');
  // User-edited names, usernames and removed photos survive fresh sign-in.
  const edit=await fetch(`http://127.0.0.1:${app.server.address().port}/api/me`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${fresh.token}`},body:JSON.stringify({name:'My chosen name',username:'my_chosen_handle',photo:''})});
  a.equal(edit.status,200);
  const edited=await request('/google/login',proof('new-subject','legacy@gmail.com'));
  a.equal(edited.user.name,'My chosen name');a.equal(edited.user.username,'my_chosen_handle');a.equal(edited.user.photo,'');
  // Google email changes do not change the stable subject -> app user mapping.
  const updated=await request('/google/login',proof('google-owner','new-address@gmail.com'));
  a.equal(updated.user.id,owner.user.id);a.equal(updated.user.googleEmail,'new-address@gmail.com');
});


test('production sign-in accepts Google only and removes email and username registration', async(t)=>{
  const app=createApp({database:':memory:'});
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
  t.after(async()=>{await new Promise(r=>app.server.close(r));app.db.close();});
  for (const path of ['guest','register','login','backup-email/start','backup-email/verify','email-login/start','email-login/verify']) {
    const res=await fetch(`http://127.0.0.1:${app.server.address().port}/api/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Someone',username:'someone',email:'someone@example.com',password:'long-password'})});
    a.equal(res.status,410,path);a.match((await res.json()).error,/Google/);
  }
  a.equal(app.db.prepare('SELECT count(*) as n FROM users').get().n,0);
});
