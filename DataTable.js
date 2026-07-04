'use client';

export default function DataTable({ columns, rows, emptyText = 'No records yet.', rowKey = 'id' }) {
  if (!rows || rows.length === 0) {
    return <div className="panel p-8 text-center text-ink-muted text-sm">{emptyText}</div>;
  }
  return (
    <div className="panel overflow-x-auto">
      <table className="w-full data-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.numeric ? 'text-right' : ''}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row[rowKey] ?? idx}>
              {columns.map((c) => (
                <td key={c.key} className={c.numeric ? 'text-right font-mono' : ''}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
