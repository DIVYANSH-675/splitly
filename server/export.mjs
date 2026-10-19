import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { fileURLToPath } from 'node:url';
import { currencies } from './finance.mjs';
const regular = fileURLToPath(new URL('./assets/Manrope-Regular.ttf', import.meta.url));
const bold = fileURLToPath(new URL('./assets/Manrope-Bold.ttf', import.meta.url));
const value = (n, c) => n / 10 ** currencies[c];
const money = (n, c) =>
  `${c} ${value(n, c).toLocaleString('en-IN', { minimumFractionDigits: currencies[c], maximumFractionDigits: currencies[c] })}`;
export async function exportTrip(trip, format) {
  const name = (id) => trip.members.find((m) => m.id === id)?.name || 'Former member';
  if (format === 'xlsx') {
    const book = new ExcelJS.Workbook();
    book.creator = 'Splitly';
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
          row.height = title === 'Activity' ? 48 : 34;
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
      ['ID', 'Date', 'Description', 'Category', 'Paid by', 'Amount', 'Split method', 'Note'],
      trip.expenses.map((e) => [
        e.id,
        e.date,
        e.title,
        e.category,
        e.payers.map((p) => name(p.memberId)).join(', '),
        value(e.amount, trip.currency),
        e.mode,
        e.note,
      ]),
      [38, 16, 38, 22, 32, 23, 18, 40],
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
      ['Date', 'From', 'To', 'Amount', 'Note'],
      trip.transfers.map((t) => [
        t.date,
        name(t.from),
        name(t.to),
        value(t.amount, trip.currency),
        t.note,
      ]),
      [16, 30, 30, 23, 45],
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
    info: { Title: `${trip.name} - Splitly report`, Author: 'Splitly' },
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
  paragraph('splitly.', { size: 28, strong: true, color: '#193E30' });
  doc.moveDown(0.4);
  paragraph(trip.name, { size: 22, strong: true });
  paragraph(`Exported ${new Date().toISOString()} · Confirmed records only`, {
    size: 9,
    color: '#66725F',
  });
  doc.moveDown();
  paragraph(`Trip expenses: ${money(trip.total, trip.currency)}`, { size: 18, strong: true });
  paragraph(
    `${trip.expenses.length} bills · ${trip.transfers.length} transfers. Transfers are excluded from expenses.`,
    { size: 9 },
  );
  heading('Everyone’s balance');
  table(
    ['Member', 'Paid', 'Share', 'Balance'],
    trip.balances.map((b) => [
      b.name,
      money(b.paid, trip.currency),
      money(b.spent, trip.currency),
      `${b.balance > 0 ? '+' : ''}${money(b.balance, trip.currency)}`,
    ]),
    [160, 117, 117, 117],
  );
  heading('Bills');
  table(
    ['Date', 'Description / category', 'Paid by', 'Amount'],
    trip.expenses.map((e) => [
      e.date,
      `${e.title}\n${e.category}`,
      e.payers
        .slice(0, 3)
        .map((p) => name(p.memberId))
        .join(', ') + (e.payers.length > 3 ? ` +${e.payers.length - 3} more` : ''),
      money(e.amount, trip.currency),
    ]),
    [70, 190, 134, 117],
  );
  heading('Who paid for each bill');
  table(
    ['Bill', 'Member', 'Paid'],
    trip.expenses.flatMap((e) =>
      e.payers.map((p) => [e.title, name(p.memberId), money(p.amount, trip.currency)]),
    ),
    [230, 164, 117],
  );
  heading('Each person’s bill share');
  table(
    ['Bill', 'Member', 'Share'],
    trip.expenses.flatMap((e) =>
      e.shares.map((s) => [e.title, name(s.memberId), money(s.amount, trip.currency)]),
    ),
    [230, 164, 117],
  );
  heading('Transfers - not expenses');
  table(
    ['Date', 'From / to', 'Amount', 'Note'],
    trip.transfers.map((t) => [
      t.date,
      `${name(t.from)} → ${name(t.to)}`,
      money(t.amount, trip.currency),
      t.note,
    ]),
    [70, 174, 117, 150],
  );
  heading('Activity history');
  for (const a of trip.activity || []) {
    ensure(62);
    paragraph(`${a.user} ${a.message}`, { strong: true });
    paragraph(a.at, { size: 8, color: '#66725F' });
    for (const c of a.changes || [])
      paragraph(`${c.field}: ${c.before || '(none)'} → ${c.after || '(none)'}`, { size: 9 });
    doc.moveDown(0.5);
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
      .text(`Splitly · ${i + 1} / ${pages.count}`, 42, 810, {
        width: 511,
        lineBreak: false,
        align: 'right',
      });
    doc.page.margins.bottom = bottom;
  }
  doc.end();
  return complete;
}
