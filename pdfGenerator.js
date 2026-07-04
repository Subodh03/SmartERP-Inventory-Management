const PDFDocument = require('pdfkit');

const DOC_LABELS = {
  gst_invoice: 'TAX INVOICE',
  proforma: 'PROFORMA INVOICE',
  quotation: 'QUOTATION',
  estimate: 'ESTIMATE',
  purchase: 'PURCHASE BILL',
};

// Streams a generated invoice PDF directly into the given res object.
function renderInvoicePdf(res, invoice) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${invoice.invoice_no.replace(/\//g, '-')}.pdf"`);
  doc.pipe(res);

  const label = DOC_LABELS[invoice.doc_type] || 'DOCUMENT';

  // Header
  doc.fontSize(18).fillColor('#0A1628').text(invoice.company.name, { continued: false });
  doc.fontSize(9).fillColor('#444');
  if (invoice.company.address) doc.text(invoice.company.address);
  const line2 = [invoice.company.state, invoice.company.gst_number ? `GSTIN: ${invoice.company.gst_number}` : null]
    .filter(Boolean).join('   ');
  if (line2) doc.text(line2);

  doc.moveDown(0.5);
  doc.fontSize(14).fillColor('#0A1628').text(label, { align: 'right' });
  doc.fontSize(9).fillColor('#444').text(`No: ${invoice.invoice_no}`, { align: 'right' });
  doc.text(`Date: ${new Date(invoice.invoice_date).toLocaleDateString('en-IN')}`, { align: 'right' });

  doc.moveDown(1);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#cccccc').stroke();
  doc.moveDown(0.5);

  // Party details
  doc.fontSize(10).fillColor('#0A1628').text('Bill To:', { underline: true });
  doc.fontSize(10).fillColor('#222').text(invoice.party_name);
  if (invoice.party_address) doc.text(invoice.party_address);
  if (invoice.party_gstin) doc.text(`GSTIN: ${invoice.party_gstin}`);
  if (invoice.party_mobile) doc.text(`Mobile: ${invoice.party_mobile}`);

  doc.moveDown(1);

  // Table header
  const tableTop = doc.y;
  const cols = { sn: 40, desc: 75, qty: 290, rate: 350, gst: 420, amount: 480 };
  doc.fontSize(9).fillColor('#fff');
  doc.rect(40, tableTop, 515, 20).fill('#0A1628');
  doc.fillColor('#fff');
  doc.text('#', cols.sn + 4, tableTop + 5);
  doc.text('Item', cols.desc, tableTop + 5);
  doc.text('Qty', cols.qty, tableTop + 5);
  doc.text('Rate', cols.rate, tableTop + 5);
  doc.text('GST%', cols.gst, tableTop + 5);
  doc.text('Amount', cols.amount, tableTop + 5);

  let y = tableTop + 24;
  doc.fillColor('#222').font('Helvetica');
  invoice.items.forEach((item, idx) => {
    const name = item.stock_item_name || item.description || '-';
    doc.fontSize(9);
    doc.text(String(idx + 1), cols.sn + 4, y);
    doc.text(name, cols.desc, y, { width: 200 });
    doc.text(String(item.quantity), cols.qty, y);
    doc.text(Number(item.rate).toFixed(2), cols.rate, y);
    doc.text(`${Number(item.gst_percent).toFixed(1)}%`, cols.gst, y);
    doc.text(Number(item.amount).toFixed(2), cols.amount, y);
    y += 18;
  });

  doc.moveTo(40, y + 4).lineTo(555, y + 4).strokeColor('#cccccc').stroke();
  y += 14;

  doc.fontSize(10);
  doc.text('Subtotal:', cols.gst, y); doc.text(Number(invoice.subtotal).toFixed(2), cols.amount, y); y += 16;
  doc.text('GST:', cols.gst, y); doc.text(Number(invoice.gst_amount).toFixed(2), cols.amount, y); y += 16;
  doc.font('Helvetica-Bold').text('Total:', cols.gst, y);
  doc.text(`Rs. ${Number(invoice.total).toFixed(2)}`, cols.amount, y);
  doc.font('Helvetica');

  doc.moveDown(3);
  doc.fontSize(8).fillColor('#888').text('This is a system-generated document from SmartERP.', 40, 740, { align: 'center', width: 515 });

  doc.end();
}

module.exports = { renderInvoicePdf };
