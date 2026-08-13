import { Controller, Get, Headers } from '@nestjs/common';
import { AppService } from './app.service';
import type { ScanOriginResponse } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * Public: LAN origin the teacher QR should encode so phones on the same
   * Wi-Fi can open /student/scan (instead of localhost).
   */
  @Get('runtime/scan-origin')
  getScanOrigin(
    @Headers('origin') origin?: string,
    @Headers('referer') referer?: string,
  ): ScanOriginResponse {
    return this.appService.getScanOrigin(origin || referer || null);
  }
}
