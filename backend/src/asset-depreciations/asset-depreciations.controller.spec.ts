import {
  type ExecutionContext,
  type INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import request from 'supertest';
import { vi } from 'vitest';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import { AssetDepreciationsController } from './asset-depreciations.controller.js';
import { AssetDepreciationsService } from './asset-depreciations.service.js';

const periodId = '00000000-0000-4000-8000-000000000001';
const profile = {
  originalCost: '60000000',
  openingValue: '60000000',
  firstMonth: '2026-09-01',
  startDate: '2026-09-01',
  termMonths: 60,
  remainingMonths: 60,
};

describe('AssetDepreciationsController', () => {
  let app: INestApplication;
  const service = {
    findAll: vi.fn(async () => []),
    getSettings: vi.fn(async () => null),
    initialize: vi.fn(async () => ({})),
    configureAsset: vi.fn(async () => ({})),
    decide: vi.fn(async () => ({})),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AssetDepreciationsController],
      providers: [{ provide: AssetDepreciationsService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context
            .switchToHttp()
            .getRequest<Request & { user?: AuthenticatedEmployee }>();
          const token = req.headers.authorization;

          if (!token) throw new UnauthorizedException();

          req.user = {
            id: periodId,
            email: 'test@example.com',
            departmentId: periodId,
            departmentName: token === 'Bearer it' ? 'IT' : 'ACCOUNTING',
            isDepartmentHead: token === 'Bearer head',
          };

          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => app?.close());

  it('requires authentication and the Accounting department', async () => {
    await request(app.getHttpServer())
      .get('/asset-depreciations/periods')
      .expect(401);
    await request(app.getHttpServer())
      .get('/asset-depreciations/periods')
      .set('Authorization', 'Bearer it')
      .expect(403);
    await request(app.getHttpServer())
      .get('/asset-depreciations/periods')
      .set('Authorization', 'Bearer staff')
      .expect(200);
  });

  it('keeps preparation and approval separate', async () => {
    await request(app.getHttpServer())
      .put(`/asset-depreciations/assets/${periodId}/configuration`)
      .set('Authorization', 'Bearer head')
      .send(profile)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/asset-depreciations/periods/${periodId}/decision`)
      .set('Authorization', 'Bearer staff')
      .send({ decision: 'approve' })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/asset-depreciations/periods/${periodId}/decision`)
      .set('Authorization', 'Bearer head')
      .send({ decision: 'approve' })
      .expect(201);
  });

  it('validates calendar dates, integer VND, term limits and unknown input', async () => {
    for (const patch of [
      { firstMonth: '2026-09-15' },
      { startDate: '2026-02-30' },
      { originalCost: '1.50' },
      { termMonths: 0 },
      { remainingMonths: 1201 },
      { openingValue: '-1' },
      { injected: true },
    ]) {
      await request(app.getHttpServer())
        .put(`/asset-depreciations/assets/${periodId}/configuration`)
        .set('Authorization', 'Bearer staff')
        .send({ ...profile, ...patch })
        .expect(400);
    }

    await request(app.getHttpServer())
      .put(`/asset-depreciations/assets/${periodId}/configuration`)
      .set('Authorization', 'Bearer staff')
      .send(profile)
      .expect(200);
    expect(service.configureAsset).toHaveBeenCalledOnce();
  });

  it('removes the legacy CRUD paths that bypass approval', async () => {
    await request(app.getHttpServer())
      .post('/asset-depreciations')
      .set('Authorization', 'Bearer staff')
      .send({})
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/asset-depreciations/${periodId}`)
      .set('Authorization', 'Bearer staff')
      .send({})
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/asset-depreciations/${periodId}`)
      .set('Authorization', 'Bearer staff')
      .expect(404);
  });
});
