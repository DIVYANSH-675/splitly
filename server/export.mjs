import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { fileURLToPath } from 'node:url';
import { currencies } from './finance.mjs';
const regular = fileURLToPath(new URL('./assets/Manrope-Regular.ttf', import.meta.url));
const bold = fileURLToPath(new URL('./assets/Manrope-Bold.ttf', import.meta.url));
const value = (n, c) => n / 10 ** currencies[c];
const money = (n, c) =>
  `${c} ${value(n, c).toLocaleString('en-IN', { minimumFractionDigits: currencies[c], maximumFractionDigits: currencies[c] })}`;
const ledgerDate = entry => entry.createdAt ? `${entry.date}\nLogged ${new Date(entry.createdAt).toISOString().slice(0,16).replace('T',' ')} UTC` : entry.date;
export async function exportTrip(trip, format, { analytics = false } = {}) {
  const name = (id) => trip.members.find((m) => m.id === id)?.name || 'Former member';
  if (format === 'xlsx') {
    const book = new ExcelJS.Workbook();
    book.creator = 'SplitBill';
    book.created = new Date();
    const sheet = (title, headers, rows, widths, numbers = []) => {
      const ws = book.addWorksheet(title, { views: [{ state: 'frozen', ySplit: 1 }] });
      ws.addRow(headers);
      ws.addRows(rows);
      ws.columns.forEach((column, i) => {
        column.width = widths[i] || 24;
      });
      ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF193E30' } };
      ws.getRow(1).height = 28;
      ws.eachRow((row, index) => {
        row.alignment = { vertical: 'top', wrapText: true };
        if (index > 1) {
          row.height = ['Activity','Expenses','Transfers'].includes(title) ? 54 : 34;
          row.font = { name: 'Calibri', size: 11 };
        }
      });
      for (const col of numbers)
        ws.getColumn(col).numFmt =
          `"${trip.currency}" #,##0.${'0'.repeat(currencies[trip.currency])};[Red]-"${trip.currency}" #,##0.${'0'.repeat(currencies[trip.currency])}`
            .replaceAll('0.;', '0;')
            .replace(/0\.$/, '0');
      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: Math.max(1, ws.rowCount), column: headers.length },
      };
      return ws;
    };
    sheet(
      'Summary',
      ['Group', 'Currency', 'Expense total', 'Bills', 'Transfers', 'Exported at'],
      [
        [
          trip.name,
          trip.currency,
          value(trip.total, trip.currency),
          trip.expenses.length,
          trip.transfers.length,
          new Date().toISOString(),
        ],
      ],
      [32, 14, 23, 12, 12, 29],
      [3],
    );
    sheet(
      'Balances',
      ['Member', 'Paid for bills', 'Share of bills', 'Net balance'],
      trip.balances.map((b) => [
        b.name,
        value(b.paid, trip.currency),
        value(b.spent, trip.currency),
        value(b.balance, trip.currency),
      ]),
      [30, 23, 23, 23],
      [2, 3, 4],
    );
    sheet(
      'Expenses',
      ['ID', 'Bill date / logged UTC', 'Description', 'Category', 'Paid by', 'Amount', 'Split method', 'Note'],
      trip.expenses.map((e) => [
        e.id,
        ledgerDate(e),
        e.title,
        e.category,
        e.payers.map((p) => name(p.memberId)).join(', '),
        value(e.amount, trip.currency),
        e.mode,
        e.note,
      ]),
      [38, 28, 38, 22, 32, 23, 18, 40],
      [6],
    );
    sheet(
      'Shares',
      ['Expense ID', 'Description', 'Member', 'Share'],
      trip.expenses.flatMap((e) =>
        e.shares.map((s) => [e.id, e.title, name(s.memberId), value(s.amount, trip.currency)]),
      ),
      [38, 38, 30, 23],
      [4],
    );
    sheet(
      'Payers',
      ['Expense ID', 'Description', 'Member', 'Paid'],
      trip.expenses.flatMap((e) =>
        e.payers.map((p) => [e.id, e.title, name(p.memberId), value(p.amount, trip.currency)]),
      ),
      [38, 38, 30, 23],
      [4],
    );
    sheet(
      'Transfers',
      ['Transfer date / logged UTC', 'From', 'To', 'Amount', 'Note'],
      trip.transfers.map((t) => [
        ledgerDate(t),
        name(t.from),
        name(t.to),
        value(t.amount, trip.currency),
        t.note,
      ]),
      [28, 30, 30, 23, 45],
      [4],
    );
    sheet(
      'Activity',
      ['Time', 'Who', 'Action', 'Field', 'Before', 'After'],
      (trip.activity || []).flatMap((a) =>
        (a.changes?.length ? a.changes : [{ field: '', before: '', after: '' }]).map((c) => [
          a.at,
          a.user,
          a.message,
          c.field,
          c.before,
          c.after,
        ]),
      ),
      [28, 25, 45, 45, 60, 60],
    );
    return Buffer.from(await book.xlsx.writeBuffer());
  }
  const doc = new PDFDocument({
    size: 'A4',
    margin: 42,
    bufferPages: true,
    info: { Title: `${trip.name} - SplitBill report`, Author: 'SplitBill' },
  });
  doc.registerFont('Regular', regular);
  doc.registerFont('Bold', bold);
  doc.font('Regular');
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const complete = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  const maxY = 785;
  const ensure = (height) => {
    if (doc.y + height > maxY) doc.addPage();
  };
  const paragraph = (text, { size = 10, color = '#233C30', strong = false } = {}) => {
    doc
      .font(strong ? 'Bold' : 'Regular')
      .fontSize(size)
      .fillColor(color);
    doc.text(String(text), 42, doc.y, { width: 511, paragraphGap: 5 });
  };
  const heading = (title) => {
    ensure(60);
    doc.moveDown(0.8);
    paragraph(title, { size: 16, strong: true, color: '#285443' });
    doc.moveDown(0.3);
  };
  const table = (headers, rows, widths) => {
    const render = (cells, header = false) => {
      doc.font(header ? 'Bold' : 'Regular').fontSize(9);
      const h = Math.max(
        27,
        ...cells.map((c, i) => doc.heightOfString(String(c), { width: widths[i] - 12 }) + 16),
      );
      if (doc.y + h > maxY) {
        doc.addPage();
        if (!header) render(headers, true);
      }
      doc.font(header ? 'Bold' : 'Regular').fontSize(9);
      const y = doc.y;
      let x = 42;
      if (header) doc.rect(42, y, 511, h).fill('#193E30');
      cells.forEach((c, i) => {
        doc
          .fillColor(header ? '#FFFFFF' : '#233C30')
          .text(String(c), x + 6, y + 8, { width: widths[i] - 12 });
        x += widths[i];
      });
      if (!header)
        doc
          .moveTo(42, y + h)
          .lineTo(553, y + h)
          .strokeColor('#E4E8DE')
          .stroke();
      doc.y = y + h;
    };
    render(headers, true);
    for (const row of rows) render(row);
    if (!rows.length) paragraph('No records yet.', { color: '#66725F' });
    doc.moveDown(0.4);
  };
  paragraph('Trip Expense Ledger', { size: 22, strong: true, color: '#193E30' });
  paragraph(trip.name, {size:14, strong:true});
  paragraph(`Exported ${new Date().toISOString()} · ${trip.currency} · Confirmed records`, {size:8,color:'#66725F'});
  paragraph('Transfers are recorded separately and excluded from shared expenses.', {size:8});
  const timestamp = ledgerDate;
  for (let start = 0; start < trip.members.length; start += 3) {
    const members = trip.members.slice(start,start+3);
    heading(start ? 'Shared expenses · shares continued' : 'Shared expenses');
    const memberWidth = 153 / Math.max(1,members.length);
    table(
      ['Bill date / logged UTC', 'Description / category', `Total (${trip.currency})`, 'Paid by', ...members.map(m => `${m.name}’s share`)],
      [...trip.expenses.map(e => [
        timestamp(e), `${e.title}\n${e.category}`, value(e.amount,trip.currency).toFixed(currencies[trip.currency]),
        e.payers.map(p => name(p.memberId)).join(', '),
        ...members.map(m => value(e.shares.find(s => s.memberId === m.id)?.amount || 0,trip.currency).toFixed(currencies[trip.currency])),
      ]), ['TOTAL', '', value(trip.total,trip.currency).toFixed(currencies[trip.currency]), '', ...members.map(m => value(trip.balances.find(b => b.id === m.id)?.spent || 0,trip.currency).toFixed(currencies[trip.currency]))]],
      [70,145,65,78, ...members.map(() => memberWidth)],
    );
  }
  heading('Settlement summary');
  table(['Member', 'Paid for bills', 'Share', 'Net balance'], trip.balances.map(b => [b.name,money(b.paid,trip.currency),money(b.spent,trip.currency),`${b.balance > 0 ? '+' : ''}${money(b.balance,trip.currency)}`]), [160,117,117,117]);
  for (const settlement of trip.settlements || []) {
    ensure(35);
    paragraph(`${name(settlement.from)} owes ${name(settlement.to)} ${money(settlement.amount,trip.currency)}`, {strong:true});
  }
  if (trip.transfers.length) {
    heading('Transfers · excluded from expenses');
    table(['Date / logged UTC','From / to','Amount','Note'],trip.transfers.map(t => [timestamp(t),`${name(t.from)} → ${name(t.to)}`,money(t.amount,trip.currency),t.note]),[70,174,117,150]);
  }
  if (analytics) {
    heading('Spending by category');
    const totals = {};
    for (const e of trip.expenses) totals[e.category] = (totals[e.category] || 0) + e.amount;
    for (const [category,total] of Object.entries(totals).sort((a,b)=>b[1]-a[1])) {
      ensure(55);
      paragraph(`${category} · ${money(total,trip.currency)} · ${Math.round(total/trip.total*100)}%`,{size:10});
      const y=doc.y+3;
      doc.roundedRect(42,y,511,9,4).fill('#E8EDE0');
      doc.roundedRect(42,y,Math.max(8,511*total/trip.total),9,4).fill('#285443');
      doc.y=y+25;
    }
  }
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .font('Regular')
      .fontSize(8)
      .fillColor('#66725F')
      .text(`SplitBill · ${i + 1} / ${pages.count}`, 42, 810, {
        width: 511,
        lineBreak: false,
        align: 'right',
      });
    doc.page.margins.bottom = bottom;
  }
  doc.end();
  return complete;
}
