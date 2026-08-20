import { HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { EXCEL_MIME, ExcelFile } from './excel.util';

export function sendExcelFile(res: Response, file: ExcelFile): void {
  res
    .status(HttpStatus.OK)
    .set({
      'Content-Type': EXCEL_MIME,
      'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Content-Length': String(file.buffer.length),
    })
    .send(file.buffer);
}
