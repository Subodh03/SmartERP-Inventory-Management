const ExcelJS = require('exceljs');

// columns: [{ header, key, width }], rows: array of plain objects
async function streamExcel(res, filename, sheetName, columns, rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns;
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A1628' } };
  sheet.getRow(1).eachCell((cell) => { cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; });
  rows.forEach((r) => sheet.addRow(r));

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
}

module.exports = { streamExcel };
