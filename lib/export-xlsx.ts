import JSZip from 'jszip'

export type XlsxCell = string | number | boolean | Date | null | undefined

export interface XlsxSheet {
  name: string
  rows: XlsxCell[][]
  widths?: number[]
}

export async function exportJsonXlsx(
  filename: string,
  sheetName: string,
  rows: Record<string, XlsxCell>[],
  widths?: number[],
) {
  const headers = rows[0] ? Object.keys(rows[0]) : []
  await exportXlsx(filename, [{
    name: sheetName,
    rows: [headers, ...rows.map(row => headers.map(header => row[header]))],
    widths,
  }])
}

export async function exportXlsx(filename: string, sheets: XlsxSheet[]) {
  const normalized = normalizeSheets(sheets.length ? sheets : [{ name: 'Datos', rows: [] }])
  const zip = new JSZip()
  const now = new Date().toISOString()

  zip.file('[Content_Types].xml', contentTypesXml(normalized.length))
  zip.folder('_rels')?.file('.rels', rootRelsXml())
  zip.folder('docProps')?.file('core.xml', coreXml(now))
  zip.folder('docProps')?.file('app.xml', appXml())

  const xl = zip.folder('xl')
  xl?.file('workbook.xml', workbookXml(normalized.map(sheet => sheet.name)))
  xl?.file('styles.xml', stylesXml())
  xl?.folder('_rels')?.file('workbook.xml.rels', workbookRelsXml(normalized.length))

  const worksheets = xl?.folder('worksheets')
  normalized.forEach((sheet, index) => {
    worksheets?.file(`sheet${index + 1}.xml`, worksheetXml(sheet))
  })

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  downloadBlob(blob, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`)
}

function normalizeSheets(sheets: XlsxSheet[]) {
  const used = new Map<string, number>()
  return sheets.map(sheet => {
    const base = sanitizeSheetName(sheet.name || 'Datos')
    const count = used.get(base) ?? 0
    used.set(base, count + 1)
    const suffix = count ? ` ${count + 1}` : ''
    const name = `${base.slice(0, 31 - suffix.length)}${suffix}`
    return { ...sheet, name, rows: sheet.rows ?? [] }
  })
}

function sanitizeSheetName(name: string) {
  const clean = name.replace(/[\[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').trim()
  return (clean || 'Datos').slice(0, 31)
}

function worksheetXml(sheet: XlsxSheet) {
  const rowCount = Math.max(sheet.rows.length, 1)
  const colCount = Math.max(...sheet.rows.map(row => row.length), 1)
  const dimension = `A1:${columnName(colCount - 1)}${rowCount}`
  const cols = sheet.widths?.length
    ? `<cols>${sheet.widths.map((width, index) => {
        const safeWidth = Math.max(4, Math.min(80, Math.round(width)))
        return `<col min="${index + 1}" max="${index + 1}" width="${safeWidth}" customWidth="1"/>`
      }).join('')}</cols>`
    : ''

  const rows = sheet.rows.map((row, rowIndex) => {
    const rowNumber = rowIndex + 1
    const cells = row
      .map((cell, colIndex) => cellXml(cell, `${columnName(colIndex)}${rowNumber}`))
      .join('')
    return `<row r="${rowNumber}">${cells}</row>`
  }).join('')

  return xmlDoc(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="${dimension}"/>${cols}<sheetData>${rows}</sheetData></worksheet>`)
}

function cellXml(cell: XlsxCell, ref: string) {
  if (cell === null || cell === undefined || cell === '') return ''
  if (typeof cell === 'number' && Number.isFinite(cell)) {
    return `<c r="${ref}"><v>${cell}</v></c>`
  }
  if (typeof cell === 'boolean') {
    return `<c r="${ref}" t="b"><v>${cell ? 1 : 0}</v></c>`
  }
  const value = cell instanceof Date ? cell.toISOString() : String(cell)
  return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`
}

function contentTypesXml(sheetCount: number) {
  const sheets = Array.from({ length: sheetCount }, (_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  ).join('')
  return xmlDoc(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${sheets}</Types>`)
}

function rootRelsXml() {
  return xmlDoc('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>')
}

function workbookXml(sheetNames: string[]) {
  const sheets = sheetNames.map((name, index) =>
    `<sheet name="${escapeXml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
  ).join('')
  return xmlDoc(`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets}</sheets></workbook>`)
}

function workbookRelsXml(sheetCount: number) {
  const sheets = Array.from({ length: sheetCount }, (_, i) =>
    `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
  ).join('')
  return xmlDoc(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets}<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`)
}

function stylesXml() {
  return xmlDoc('<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>')
}

function coreXml(now: string) {
  return xmlDoc(`<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>HidroCRM</dc:creator><cp:lastModifiedBy>HidroCRM</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`)
}

function appXml() {
  return xmlDoc('<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>HidroCRM</Application></Properties>')
}

function columnName(index: number) {
  let dividend = index + 1
  let name = ''
  while (dividend > 0) {
    const modulo = (dividend - 1) % 26
    name = String.fromCharCode(65 + modulo) + name
    dividend = Math.floor((dividend - modulo) / 26)
  }
  return name
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function xmlDoc(body: string) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${body}`
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
