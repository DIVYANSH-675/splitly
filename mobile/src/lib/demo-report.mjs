// Small, dependency-free exports for the isolated sample ledger. Real cloud
// reports continue to use the server's full renderer.
const bytes = text => Uint8Array.from(text, c => c.charCodeAt(0));
const ascii = value => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '?');
const xml = value => Array.from(String(value ?? ''), c => /[A-Za-z0-9 .,;:_/()+-]/.test(c) ? c : `&#${c.codePointAt(0)};`).join('');
const amount = (value, trip) => Number(value) / 10 ** ({ JPY: 0, VND: 0 }[trip.currency] ?? 2);
const fixed = (value, trip) => amount(value, trip).toFixed(['JPY', 'VND'].includes(trip.currency) ? 0 : 2);
const member = (trip, id) => trip.members.find(m => m.id === id)?.name || 'Member';
const chunk = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));
const cell = (value, width) => ascii(value).slice(0, width).padEnd(width + 1);

function pdfReport(trip, analytics) {
  const lines = [`SplitBill demo - ${ascii(trip.name)}`, `SAMPLE DATA ONLY | ${trip.currency} | ${new Date().toISOString()}`, ''];
  for (const people of chunk(trip.members, 6)) {
    lines.push('SHARED EXPENSES', cell('Date', 10) + cell('Description', 23) + cell('Total', 11) + cell('Paid by', 13) + people.map(p => cell(`${p.name} share`, 11)).join(''));
    for (const e of trip.expenses) lines.push(cell(e.date, 10) + cell(e.title, 23) + cell(fixed(e.amount, trip), 11) + cell(e.payers.map(p => member(trip, p.memberId)).join(', '), 13) + people.map(m => cell(fixed(e.shares.find(s => s.memberId === m.id)?.amount || 0, trip), 11)).join(''));
    lines.push(cell('TOTAL', 10) + cell('', 23) + cell(fixed(trip.total, trip), 11) + cell('', 13) + people.map(m => cell(fixed(trip.expenses.reduce((n, e) => n + (e.shares.find(s => s.memberId === m.id)?.amount || 0), 0), trip), 11)).join(''), '');
  }
  lines.push('BALANCES', 'Person                   Paid           Share          Balance');
  for (const b of trip.balances) lines.push(cell(b.name, 24) + cell(fixed(b.paid, trip), 14) + cell(fixed(b.spent, trip), 14) + fixed(b.balance, trip));
  lines.push('', 'SETTLEMENTS');
  for (const s of trip.settlements) lines.push(`${ascii(member(trip, s.from))} pays ${ascii(member(trip, s.to))}: ${fixed(s.amount, trip)} ${trip.currency}`);
  if (!trip.settlements.length) lines.push('All square.');
  lines.push('', 'TRANSFERS (excluded from expense totals)');
  for (const t of trip.transfers) lines.push(`${t.date}  ${ascii(member(trip, t.from))} -> ${ascii(member(trip, t.to))}: ${fixed(t.amount, trip)} ${trip.currency}`);
  if (!trip.transfers.length) lines.push('No transfers.');
  const pages = chunk(lines, 42).map(page => page.map((line, i) => `BT /F1 8 Tf 36 ${560 - i * 12} Td (${line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')}) Tj ET`).join('\n'));
  if (analytics) {
    const totals = new Map();
    for (const e of trip.expenses) totals.set(e.category, (totals.get(e.category) || 0) + e.amount);
    const all = [...totals.entries()], max = Math.max(1, ...all.map(([, n]) => n));
    for (const group of chunk(all, 15)) {
      let content = 'BT /F1 14 Tf 36 550 Td (Sample spending by category) Tj ET\n';
      group.forEach(([name, n], i) => {
        const y = 510 - i * 28;
        content += `BT /F1 9 Tf 36 ${y} Td (${ascii(name).replace(/[()\\]/g, ' ').slice(0, 25)}) Tj ET\n0.16 0.33 0.26 rg 210 ${y - 3} ${400 * n / max} 14 re f 0 0 0 rg\nBT /F1 9 Tf 630 ${y} Td (${fixed(n, trip)} ${trip.currency}) Tj ET\n`;
      });
      pages.push(content);
    }
  }
  if (!pages.length) pages.push('');
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${4 + i * 2} 0 R`).join(' ')}] >>`, '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>'];
  pages.forEach((page, i) => {
    const content = `${page}\nBT /F1 8 Tf 36 20 Td (Demo report - page ${i + 1} of ${pages.length}. Sample labels use basic Latin in PDF.) Tj ET\n`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`, `<< /Length ${content.length} >>\nstream\n${content}endstream`);
  });
  let text = '%PDF-1.4\n', offsets = [0];
  objects.forEach((obj, i) => { offsets.push(text.length); text += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const xref = text.length;
  text += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return bytes(text);
}

function zip(files) {
  const records = [], directory = [];
  let offset = 0;
  const header = (length, fields) => {
    const b = new Uint8Array(length), v = new DataView(b.buffer);
    for (const [at, value, size] of fields) {
      if (size === 2) v.setUint16(at, value, true);
      else v.setUint32(at, value >>> 0, true);
    }
    return b;
  };
  for (const [name, text] of files) {
    const data = bytes(text), filename = bytes(name);
    let crc = -1;
    for (const b of data) { crc ^= b; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
    crc = (crc ^ -1) >>> 0;
    records.push(header(30, [[0, 0x04034b50, 4], [4, 20, 2], [14, crc, 4], [18, data.length, 4], [22, data.length, 4], [26, filename.length, 2]]), filename, data);
    directory.push(header(46, [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [16, crc, 4], [20, data.length, 4], [24, data.length, 4], [28, filename.length, 2], [42, offset, 4]]), filename);
    offset += 30 + filename.length + data.length;
  }
  const dirSize = directory.reduce((n, b) => n + b.length, 0);
  const all = [...records, ...directory, header(22, [[0, 0x06054b50, 4], [8, files.length, 2], [10, files.length, 2], [12, dirSize, 4], [16, offset, 4]])];
  const result = new Uint8Array(offset + dirSize + 22);
  let at = 0; for (const b of all) { result.set(b, at); at += b.length; }
  return result;
}
function workbook(trip) {
  const people = trip.members;
  const sheets = [
    ['Expenses', [['Date', 'Description', 'Category', `Total (${trip.currency})`, 'Paid by', ...people.map(m => `${m.name} share`)], ...trip.expenses.map(e => [e.date, e.title, e.category, amount(e.amount, trip), e.payers.map(p => member(trip, p.memberId)).join(', '), ...people.map(m => amount(e.shares.find(s => s.memberId === m.id)?.amount || 0, trip))]), ['TOTAL', '', '', amount(trip.total, trip), '', ...people.map(m => amount(trip.expenses.reduce((n, e) => n + (e.shares.find(s => s.memberId === m.id)?.amount || 0), 0), trip))]]],
    ['Transfers', [['Date', 'From', 'To', 'Amount', 'Note'], ...trip.transfers.map(t => [t.date, member(trip, t.from), member(trip, t.to), amount(t.amount, trip), t.note])]],
    ['Balances', [['Person', 'Paid', 'Share', 'Balance'], ...trip.balances.map(b => [b.name, amount(b.paid, trip), amount(b.spent, trip), amount(b.balance, trip)])]],
    ['Activity', [['Date/time', 'Person', 'Change'], ...trip.activity.map(a => [a.at, a.user, a.message])]],
  ];
  const main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const files = [
    ['[Content_Types].xml', `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
    ['_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', `<?xml version="1.0"?><workbook xmlns="${main}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map(([name], i) => `<sheet name="${name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`],
  ];
  const column = index => { let label = ''; for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) label = String.fromCharCode(65 + (n - 1) % 26) + label; return label; };
  sheets.forEach(([, rows], i) => files.push([`xl/worksheets/sheet${i + 1}.xml`, `<?xml version="1.0"?><worksheet xmlns="${main}"><sheetData>${rows.map((row, r) => `<row r="${r + 1}">${row.map((value, c) => typeof value === 'number' ? `<c r="${column(c)}${r + 1}"><v>${value}</v></c>` : `<c r="${column(c)}${r + 1}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`]));
  return zip(files);
}
export function demoReport(trip, format, analytics = false) {
  if (format === 'pdf') return pdfReport(trip, analytics);
  if (format === 'xlsx') return workbook(trip);
  throw new Error('Choose PDF or XLSX.');
}
