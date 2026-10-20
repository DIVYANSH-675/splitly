import {test} from 'node:test';
import {strict as a} from 'node:assert';
import {transactionDays} from '../mobile/src/lib/transaction-days.mjs';
test('bills and transfers share one date heading, newest calendar day first',()=>{
  const expenses=[{id:'a',date:'2026-10-24',createdAt:'2026-10-25T01:00:00Z'},{id:'b',date:'2026-10-24',createdAt:'2026-10-25T02:00:00Z'},{id:'c',date:'2026-10-23'}];
  const transfers=[{id:'t',date:'2026-10-24',createdAt:'2026-10-25T01:30:00Z'},{id:'next',date:'2026-10-25'}];
  const before=JSON.stringify({expenses,transfers});
  const groups=transactionDays(expenses,transfers);
  a.deepEqual(groups.map(group=>group.date),['2026-10-25','2026-10-24','2026-10-23']);
  a.deepEqual(groups[1].entries.map(row=>[row.kind,row.entry.id]),[['bill','b'],['transfer','t'],['bill','a']]);
  a.equal(JSON.stringify({expenses,transfers}),before);
});
test('legacy rows retain stable ordering; undated and invalid dates have a safe final section',()=>{
  const groups=transactionDays([{id:'a',date:'2026-01-01'},{id:'b',date:'2026-01-01'},{id:'bad',date:'2026-02-31'},{id:'unknown'}],[{id:'old',date:'2025-12-31'}]);
  a.deepEqual(groups.map(group=>group.date),['2026-01-01','2025-12-31','']);
  a.deepEqual(groups[0].entries.map(row=>row.entry.id),['a','b']);
  a.deepEqual(groups.at(-1).entries.map(row=>row.entry.id),['bad','unknown']);
  a.deepEqual(transactionDays([],[]),[]);
});
