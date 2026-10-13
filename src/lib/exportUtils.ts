/**
 * Helper to export array data into downloadable CSV
 */
export function exportToCSV(filename: string, rows: Record<string, any>[], headers?: { key: string; label: string }[]) {
  if (!rows || !rows.length) return

  const effectiveHeaders = headers || Object.keys(rows[0]).map((k) => ({ key: k, label: k }))

  const headerRow = effectiveHeaders.map((h) => `"${h.label.replace(/"/g, '""')}"`).join(',')

  const bodyRows = rows.map((row) => {
    return effectiveHeaders
      .map((h) => {
        let val = row[h.key]
        if (val === null || val === undefined) val = ''
        if (typeof val === 'object') val = JSON.stringify(val)
        return `"${String(val).replace(/"/g, '""')}"`
      })
      .join(',')
  })

  const csvContent = '\uFEFF' + [headerRow, ...bodyRows].join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}-${new Date().toISOString().slice(0, 10)}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
