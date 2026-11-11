import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client, type QueryArrayConfig } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import * as schema from '../db/schema.js';
import { ItPurchaseOrdersService } from './it-purchase-orders.service.js';

const actor: AuthenticatedEmployee = {
  id: 'it-employee',
  email: 'it@example.test',
  roleId: 'employee',
  roleName: 'EMPLOYEE',
  departmentId: 'it',
  departmentName: 'IT',
  isDepartmentHead: false,
};
const orderId = '1be3acbb-4c54-4f9a-83aa-d0d6f2088bf9';
const orderRow = [
  orderId,
  'PO-001',
  'supplier',
  'Supplier',
  'WAREHOUSE',
  'partially_received',
  '2026-11-01',
  '2026-11-10',
  '18000000',
];

describe('ItPurchaseOrdersService', () => {
  const query =
    vi.fn<
      (
        config: QueryArrayConfig,
        values: unknown[],
      ) => Promise<{ rows: unknown[][] }>
    >();
  const client = Object.assign(new Client(), { query });
  const service = new ItPurchaseOrdersService(drizzle(client, { schema }));

  beforeEach(() => {
    query.mockReset();
  });

  it('rejects accounts outside IT and Procurement before reading purchase data', async () => {
    const outsider = { ...actor, departmentName: 'ACCOUNTING' };

    await expect(service.findAll(outsider)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.findOne(outsider, orderId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(query).not.toHaveBeenCalled();
  });

  it('defaults to Procurement and lets both departments switch owners', async () => {
    const procurement = { ...actor, departmentName: 'PROCUREMENT' };

    query.mockResolvedValue({ rows: [] });

    await service.findAll(procurement);
    await service.findAll(procurement, 'it');
    await service.findAll(actor, 'procurement');

    expect(query.mock.calls.map(([, values]) => values[0])).toEqual([
      'procurement',
      'it',
      'procurement',
    ]);
  });

  it('rejects an invalid owner before querying', async () => {
    await expect(service.findAll(actor, 'all')).rejects.toMatchObject({
      status: 400,
    });
    expect(query).not.toHaveBeenCalled();
  });

  it('applies Procurement scope to the detail total and lines', async () => {
    query
      .mockResolvedValueOnce({ rows: [orderRow] })
      .mockResolvedValueOnce({ rows: [] });

    await service.findOne(actor, orderId, 'procurement');

    expect(query.mock.calls[0]?.[1][0]).toBe('procurement');
    expect(query.mock.calls[1]?.[1]).toEqual([orderId, 'procurement']);
  });

  it('scopes the list and its total to ordered IT lines, regardless of requester department', async () => {
    query.mockResolvedValueOnce({ rows: [orderRow] });

    await expect(service.findAll(actor)).resolves.toMatchObject([
      { id: orderId, department: 'WAREHOUSE', total: '18000000' },
    ]);
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringMatching(
          /sum\("purchase_order_items"\."total_incl_vat"\).*where \("purchase_request_items"\."management_owner_snapshot" = \$1/,
        ),
      }),
      [
        'it',
        'issued',
        'partially_received',
        'fully_received',
        'closed_short',
        'cancelled',
      ],
    );
  });

  it('returns not found when an order is outside the IT list scope', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await expect(service.findOne(actor, orderId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('scopes detail to IT lines and matches receipt counts and asset codes per line', async () => {
    query
      .mockResolvedValueOnce({ rows: [orderRow] })
      .mockResolvedValueOnce({
        rows: [
          ['laptop-line', 'Laptop', 3, 2, 1, 1, '17000000'],
          ['mouse-line', 'Mouse', 2, 0, 0, 0, '1000000'],
        ],
      })
      .mockResolvedValueOnce({ rows: [['laptop-line', 'IT-001']] });

    await expect(service.findOne(actor, orderId)).resolves.toMatchObject({
      total: '18000000',
      lines: [
        {
          name: 'Laptop',
          ordered: 3,
          received: 2,
          accepted: 1,
          rejected: 1,
          assetCodes: ['IT-001'],
        },
        { name: 'Mouse', received: 0, assetCodes: [] },
      ],
    });
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        text: expect.stringContaining(
          '"purchase_request_items"."management_owner_snapshot" = $2',
        ),
      }),
      [orderId, 'it'],
    );
    expect(query).toHaveBeenNthCalledWith(3, expect.anything(), [
      'laptop-line',
      'mouse-line',
    ]);
  });
});
