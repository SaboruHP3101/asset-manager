import {
  addMonths,
  calculateDepreciation,
  lastDueMonth,
  monthOf,
} from './depreciation-calculation.js';
import type { assetDepreciationProfiles } from '../db/schema.js';

const profile: typeof assetDepreciationProfiles.$inferSelect = {
  assetId: 'asset',
  originalCost: '60000000',
  openingValue: '60000000',
  firstMonth: '2026-01-01',
  startDate: '2026-01-01',
  termMonths: 60,
  remainingMonths: 60,
  stopDate: null,
  updatedAt: new Date(),
  updatedBy: null,
};

describe('monthly depreciation', () => {
  it('keeps date-only month boundaries', () => {
    expect(monthOf('2026-10-16')).toBe('2026-10-01');
    expect(monthOf('2028-02-29')).toBe('2028-02-01');
  });

  it('counts calendar days across a daylight-saving transition', () => {
    expect(
      calculateDepreciation(
        { ...profile, stopDate: '2026-03-09' },
        '2026-03-01',
        profile.openingValue,
      )?.depreciationAmount,
    ).toBe('290323');
  });

  it('calculates a full month with exact VND arithmetic', () => {
    expect(
      calculateDepreciation(profile, '2026-01-01', profile.openingValue),
    ).toMatchObject({
      depreciationAmount: '1000000',
      remainingValue: '59000000',
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
    });
  });

  it('prorates a mid-month start by calendar days', () => {
    expect(
      calculateDepreciation(
        { ...profile, startDate: '2026-01-16' },
        '2026-01-01',
        profile.openingValue,
      )?.depreciationAmount,
    ).toBe('516129');
  });

  it('prorates a stop without writing off the remaining balance', () => {
    expect(
      calculateDepreciation(
        { ...profile, stopDate: '2026-02-14' },
        '2026-02-01',
        '59000000',
      ),
    ).toMatchObject({
      depreciationAmount: '500000',
      remainingValue: '58500000',
      toDate: '2026-02-14',
    });
  });

  it('handles leap days', () => {
    expect(
      calculateDepreciation(
        { ...profile, stopDate: '2028-02-14' },
        '2028-02-01',
        profile.openingValue,
      )?.depreciationAmount,
    ).toBe('482759');
  });

  it('uses the confirmed opening balance and remaining term for an existing asset', () => {
    const existing = {
      ...profile,
      startDate: '2023-01-01',
      firstMonth: '2026-01-01',
      remainingMonths: 24,
      openingValue: '24000000',
    };

    expect(
      calculateDepreciation(existing, '2026-01-01', existing.openingValue)
        ?.remainingValue,
    ).toBe('23000000');
    expect(
      calculateDepreciation(existing, '2027-12-01', '1000001')
        ?.depreciationAmount,
    ).toBe('1000001');
    expect(calculateDepreciation(existing, '2028-01-01', '0')).toBeNull();
  });

  it('caps depreciation at the opening balance', () => {
    expect(
      calculateDepreciation(profile, '2026-01-01', '100')?.remainingValue,
    ).toBe('0');
  });

  it('preserves precision above the safe integer range', () => {
    expect(
      calculateDepreciation(
        { ...profile, originalCost: '999999999999999999' },
        '2026-01-01',
        '999999999999999999',
      )?.depreciationAmount,
    ).toBe('16666666666666667');
  });

  it('absorbs rounding into the final scheduled month', () => {
    const short = {
      ...profile,
      originalCost: '100',
      termMonths: 3,
      remainingMonths: 3,
    };

    expect(
      calculateDepreciation(short, '2026-01-01', '100')?.depreciationAmount,
    ).toBe('33');
    expect(
      calculateDepreciation(short, '2026-02-01', '67')?.depreciationAmount,
    ).toBe('33');
    expect(
      calculateDepreciation(short, '2026-03-01', '34')?.depreciationAmount,
    ).toBe('34');
  });

  it.each([
    ['2025-12-01', '60000000'],
    ['2031-01-01', '60000000'],
    ['2026-01-01', '0'],
  ])(
    'does not depreciate outside the schedule or after exhaustion: %s',
    (month, opening) => {
      expect(calculateDepreciation(profile, month, opening)).toBeNull();
    },
  );

  it('clamps month-end anniversaries', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
  });

  it('waits until 00:05 server time and handles month/year boundaries', () => {
    expect(lastDueMonth(new Date(2026, 10, 1, 0, 4, 59))).toBe('2026-09-01');
    expect(lastDueMonth(new Date(2026, 10, 1, 0, 5))).toBe('2026-10-01');
    expect(lastDueMonth(new Date(2027, 0, 1, 0, 5))).toBe('2026-12-01');
    expect(lastDueMonth(new Date(2026, 10, 20, 10))).toBe('2026-10-01');
  });
});
