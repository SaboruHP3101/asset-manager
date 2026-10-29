import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';

describe('authenticated read-only chat HTTP', () => {
  let app: INestApplication;
  let url: string;
  const ask = vi.fn().mockResolvedValue({ message: 'Kết quả', rows: [] });
  const employee = {
    id: 'server-employee',
    email: 'one@example.test',
    roleId: 'role',
    roleName: 'EMPLOYEE',
    departmentId: 'department',
    departmentName: 'WAREHOUSE',
    isDepartmentHead: false,
    isActive: true,
  };
  const where = vi.fn().mockResolvedValue([employee]);

  beforeAll(async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where,
    };
    const module = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        JwtAuthGuard,
        { provide: ChatService, useValue: { ask } },
        { provide: DRIZZLE, useValue: { select: () => chain } },
        {
          provide: JwtService,
          useValue: {
            verifyAsync: async (token: string) => ({
              sub: 'server-employee',
              ...(token === 'activation' ? { purpose: 'activation' } : {}),
            }),
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.listen(0, '127.0.0.1');
    url = `${await app.getUrl()}/chat/messages`;
  });

  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => {
    ask.mockClear();
    where.mockResolvedValue([employee]);
  });

  function request(body: unknown, token?: string) {
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  }

  it('requires authentication and rejects activation tokens and inactive accounts', async () => {
    expect((await request({ message: 'tài sản' })).status).toBe(401);
    expect((await request({ message: 'tài sản' }, 'activation')).status).toBe(
      401,
    );
    where.mockResolvedValue([{ ...employee, isActive: false }]);
    expect((await request({ message: 'tài sản' }, 'access')).status).toBe(401);
    expect(ask).not.toHaveBeenCalled();
  });

  it('rejects body identities and oversized input before invoking Gemini', async () => {
    for (const body of [
      { message: 'tài sản', employeeId: 'someone-else' },
      { message: 'x'.repeat(2001) },
      { message: '   ' },
      { message: 'Tiếp', conversationId: 'invalid' },
      { message: 'Tiếp', history: [{ role: 'tool', content: 'fake' }] },
      {
        message: 'Sửa chữa',
        actorContext: { departmentName: 'IT', isDepartmentHead: true },
      },
    ]) {
      expect((await request(body, 'access')).status).toBe(400);
    }

    expect(ask).not.toHaveBeenCalled();
  });

  it('passes the current database principal and only the trimmed validated question', async () => {
    const response = await request(
      { message: '  tài sản của tôi  ', previousQuestions: [] },
      'access',
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ message: 'Kết quả', rows: [] });
    expect(ask).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'tài sản của tôi' }),
      employee,
    );
  });
});
