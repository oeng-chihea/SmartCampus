import ExcelJS from 'exceljs';
import {
  addDataSheet,
  addSummarySheet,
  createWorkbook,
  excelDateFromIso,
  fileDateStamp,
  workbookToBuffer,
} from './excel.util';
import { formatCampusLocationLabel } from './format.util';

describe('excel.util', () => {
  it('stamps filenames with the local calendar day', () => {
    expect(fileDateStamp(new Date(2026, 7, 20, 12, 0, 0))).toBe('2026-08-20');
  });

  it('shifts ISO instants so Excel shows Asia/Phnom_Penh wall-clock', () => {
    // 16:30 UTC = 11:30 PM in Cambodia (UTC+7), not 4:30 PM.
    expect(excelDateFromIso('2026-08-20T16:30:00.000Z')).toEqual(
      new Date('2026-08-20T23:30:00.000Z'),
    );
    // 13:12 UTC = 8:12 PM in Cambodia, not 1:12 PM.
    expect(excelDateFromIso('2026-08-20T13:12:00.000Z')).toEqual(
      new Date('2026-08-20T20:12:00.000Z'),
    );
  });

  it('returns an empty cell when the timestamp is missing or invalid', () => {
    expect(excelDateFromIso(null)).toBe('');
    expect(excelDateFromIso('')).toBe('');
    expect(excelDateFromIso('not-a-date')).toBe('');
  });

  it('writes Time cells as campus local clock after xlsx round-trip', async () => {
    const workbook = createWorkbook();
    addDataSheet(
      workbook,
      'Location visits',
      [
        {
          header: 'Time',
          key: 'time',
          width: 22,
          numFmt: 'mmm d, yyyy h:mm AM/PM',
        },
      ],
      [{ time: excelDateFromIso('2026-08-20T16:30:00.000Z') }],
    );

    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(await workbookToBuffer(workbook));
    const cell = loaded.getWorksheet('Location visits')?.getRow(2).getCell(1);
    expect(cell?.value).toBeInstanceOf(Date);
    expect((cell?.value as Date).toISOString()).toBe('2026-08-20T23:30:00.000Z');
    expect(cell?.numFmt).toBe('mmm d, yyyy h:mm AM/PM');
  });

  it('round-trips comma-rich and Khmer scanned-at text in an xlsx buffer', async () => {
    const place =
      'Street 430, Boeung Trabek, សង្កាត់បឹងត្របែក, Phnom Penh';
    const workbook = createWorkbook();
    addDataSheet(
      workbook,
      'Location visits',
      [
        { header: 'Student', key: 'student', width: 18 },
        { header: 'Scanned at', key: 'scannedAt', width: 48, wrap: true },
      ],
      [{ student: 'Chihea', scannedAt: place }],
    );
    addSummarySheet(workbook, [
      { title: 'Export', rows: [['Exported rows', 1]] },
    ]);

    const buffer = await workbookToBuffer(workbook);
    expect(buffer.subarray(0, 2).toString()).toBe('PK');

    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(buffer);
    const sheet = loaded.getWorksheet('Location visits');
    expect(sheet).toBeDefined();
    expect(sheet?.getRow(1).getCell(1).value).toBe('Student');
    expect(sheet?.getRow(2).getCell(2).value).toBe(place);
    expect(loaded.getWorksheet('Summary')?.getRow(2).getCell(1).value).toBe(
      'Export',
    );
  });
});

describe('formatCampusLocationLabel', () => {
  it('formats building and room as Building A-Room 201', () => {
    expect(formatCampusLocationLabel('Building A', '201')).toBe(
      'Building A-Room 201',
    );
    expect(formatCampusLocationLabel('Building A, Room 201')).toBe(
      'Building A-Room 201',
    );
  });
});
