import ExcelJS from 'exceljs';

export const EXCEL_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface ExcelFile {
  buffer: Buffer;
  filename: string;
}

export interface ExcelColumn {
  header: string;
  key: string;
  width: number;
  wrap?: boolean;
  numFmt?: string;
}

export interface SummarySection {
  title: string;
  rows: Array<[string, string | number]>;
}

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF15803D' },
};

/** Wall-clock used for Excel date cells (matches the admin UI in Cambodia). */
export const CAMPUS_TIME_ZONE = 'Asia/Phnom_Penh';

/**
 * ExcelJS writes JS Date values as UTC serials; Excel then prints that UTC
 * clock with no timezone. Shift so the UTC components equal campus local time
 * (`2026-08-20T16:30:00.000Z` → 11:30 PM, not 4:30 PM).
 */
export function excelDateFromIso(
  iso: string | null | undefined,
  timeZone = CAMPUS_TIME_ZONE,
): Date | string {
  if (iso == null || iso === '') {
    return '';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  return new Date(
    Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    ),
  );
}

export function fileDateStamp(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createWorkbook(): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Smart Campus';
  workbook.lastModifiedBy = 'Smart Campus';
  workbook.created = new Date();
  workbook.modified = new Date();
  return workbook;
}

export function addDataSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  columns: ExcelColumn[],
  rows: Array<Record<string, unknown>>,
): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width,
  }));

  const header = sheet.getRow(1);
  header.font = {
    bold: true,
    color: { argb: 'FFFFFFFF' },
    name: 'Calibri',
    size: 11,
  };
  header.fill = HEADER_FILL;
  header.alignment = { vertical: 'middle', wrapText: true };
  header.height = 22;

  for (const row of rows) {
    const added = sheet.addRow(row);
    added.alignment = { vertical: 'top' };
    for (const column of columns) {
      const cell = added.getCell(column.key);
      if (column.wrap) {
        cell.alignment = { wrapText: true, vertical: 'top' };
      }
      if (column.numFmt) {
        cell.numFmt = column.numFmt;
      }
    }
    if (columns.some((column) => column.wrap)) {
      added.height = 32;
    }
  }

  if (columns.length > 0) {
    const last = sheet.getColumn(columns.length).letter;
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = `A1:${last}1`;
  }

  return sheet;
}

export function addSummarySheet(
  workbook: ExcelJS.Workbook,
  sections: SummarySection[],
): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet('Summary');
  sheet.columns = [
    { header: 'Field', key: 'field', width: 28 },
    { header: 'Value', key: 'value', width: 64 },
  ];

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
  header.fill = HEADER_FILL;
  header.alignment = { vertical: 'middle' };

  let rowIndex = 2;
  for (const section of sections) {
    if (rowIndex > 2) {
      rowIndex += 1;
    }
    const titleRow = sheet.getRow(rowIndex);
    titleRow.getCell(1).value = section.title;
    titleRow.getCell(1).font = {
      bold: true,
      color: { argb: 'FF14532D' },
      name: 'Calibri',
    };
    sheet.mergeCells(rowIndex, 1, rowIndex, 2);
    rowIndex += 1;
    for (const [field, value] of section.rows) {
      const row = sheet.getRow(rowIndex);
      row.getCell(1).value = field;
      const valueCell = row.getCell(2);
      valueCell.value = value;
      valueCell.alignment = { wrapText: true };
      rowIndex += 1;
    }
  }

  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  return sheet;
}

export async function workbookToBuffer(
  workbook: ExcelJS.Workbook,
): Promise<Buffer> {
  const data = await workbook.xlsx.writeBuffer();
  return Buffer.from(data);
}
