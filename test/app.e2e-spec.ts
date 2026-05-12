import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('SystemController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/v1/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/v1/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('/v1/capabilities (GET)', () => {
    return request(app.getHttpServer())
      .get('/v1/capabilities')
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          apiVersion: 'v1',
          chainId: 31337,
          activation: {
            availableModes: ['serial'],
            flags: {
              serial: true,
              contractBatch: false,
              walletBatchEip5792: false,
            },
          },
        });
        expect(JSON.stringify(response.body)).not.toContain('postgres://');
      });
  });
});
