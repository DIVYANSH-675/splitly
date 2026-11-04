import { test } from 'node:test';
import { strict as a } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { isCalendarDate } from '../mobile/src/lib/expense-date.mjs';

test('expense dates accept real calendar days, including leap days', () => {
  for (const date of ['2024-02-29', '2026-11-04', '2026-01-01']) a.equal(isCalendarDate(date), true);
  for (const date of ['', '2026-02-29', '2026-02-31', '2026-13-01', '2026-1-01', '2026-11-04T00:00:00Z']) a.equal(isCalendarDate(date), false);
});

test('picker dates stay on the selected local day across time zones and DST', () => {
  const script = `import {calendarDate,pickerDate} from './mobile/src/lib/expense-date.mjs';
    const days=['2026-01-01','2026-03-08','2026-11-01','2024-02-29'];
    process.stdout.write(JSON.stringify(days.map(day=>calendarDate(pickerDate(day)))));`;
  for (const TZ of ['Asia/Kolkata', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
    const result=execFileSync(process.execPath,['--input-type=module','-e',script],{env:{...process.env,TZ},encoding:'utf8'});
    a.deepEqual(JSON.parse(result), ['2026-01-01','2026-03-08','2026-11-01','2024-02-29'], TZ);
  }
});
