import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('scan-origin', () => {
    it('returns an origin string for QR deep links', () => {
      const result = appController.getScanOrigin('http://localhost:4200');
      expect(result.origin).toMatch(/^https?:\/\//);
      expect(typeof result.connected).toBe('boolean');
    });
  });
});
