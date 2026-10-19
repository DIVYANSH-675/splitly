import {test} from 'node:test';
import {strict as a} from 'node:assert';
import {projectActions} from '../mobile/src/lib/offline-actions.mjs';
test('offline group, transfer and custom category survive a restart without changing confirmed data',()=>{
 const user={id:'u',name:'Alex'};
 const create={id:'op1',path:'/trips',method:'POST',createdAt:'2026-10-20T10:00:00Z',body:{id:'local_group',me:'a',memberIds:['j'],name:'Trip',currency:'INR',guests:['Jo']}};
 const actions=[create,{id:'op2',path:'/trips/local_group/transfers',method:'POST',body:{id:'payment',from:'j',to:'a',amount:'100',date:'2026-10-20'}},{id:'op3',path:'/trips/local_group/categories',method:'POST',body:{name:'Camping'}}];
 const restored=JSON.parse(JSON.stringify(actions));
 const [group]=projectActions([],restored,user);
 a.equal(group.total,0);a.equal(group.transfers.length,1);a.equal(group.balances.find(b=>b.id==='a').balance,-10000);a.deepEqual(group.categories,['Camping']);a.equal(group.code,'');
 a.deepEqual(projectActions([group],actions,user)[0].transfers.length,1);
});
test('offline edits recalculate allocations without mutating the confirmed cache',()=>{
 const user={id:'u',name:'Alex'};
 const initial={id:'g',name:'Trip',members:[{id:'a',name:'Alex'},{id:'j',name:'Jo'}],expenses:[],transfers:[],currency:'INR',categories:[]};
 const action={path:'/trips/g/expenses/b',method:'PATCH',createdAt:'2026-10-20T10:00:00Z',body:{id:'b',title:'Lunch',category:'Food & drinks',amount:'99.99',currency:'INR',mode:'equal',payers:[{memberId:'a'}],shares:[{memberId:'a'},{memberId:'j'}]}};
 const [group]=projectActions([initial],[action],user);
 a.equal(initial.expenses.length,0);a.equal(group.total,9999);a.equal(group.balances.reduce((s,b)=>s+b.balance,0),0);a.equal(group.expenses[0].shares.reduce((s,p)=>s+p.amount,0),9999);
});
