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
   * Public: site URL the teacher QR should encode so phones open
   * /student/scan over the internet (not a campus Wi-Fi LAN IP).
   */
  @Get('runtime/scan-origin')
  getScanOrigin(
    @Headers('origin') origin?: string,
    @Headers('referer') referer?: string,
  ): ScanOriginResponse {
    return this.appService.getScanOrigin(origin || referer || null);
  }
}
