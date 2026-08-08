import { describe, it, expect, vi, beforeEach } from 'vitest';

const retrieveMock = vi.fn();
vi.mock('dodopayments', () => ({
  default: class DodoPayments {
    constructor() {
      this.products = { retrieve: retrieveMock };
      this.checkoutSessions = { create: vi.fn() };
    }
  },
}));

const { getProductPrice } = await import('../../src/services/dodoService.js');

beforeEach(() => {
  retrieveMock.mockReset();
});

describe('getProductPrice', () => {
  it('shapes a recurring price into the expected fields', async () => {
    retrieveMock.mockResolvedValue({
      price: {
        price: 500,
        currency: 'USD',
        type: 'recurring_price',
        payment_frequency_interval: 'Month',
        payment_frequency_count: 1,
      },
    });

    const price = await getProductPrice('pdt_123');

    expect(price).toEqual({
      amount: 500,
      currency: 'USD',
      type: 'recurring_price',
      interval: 'Month',
      intervalCount: 1,
    });
  });

  it('returns null when the product has no price set', async () => {
    retrieveMock.mockResolvedValue({});
    const price = await getProductPrice('pdt_no_price');
    expect(price).toBeNull();
  });

  it('caches the result — a second call within the TTL does not hit the API again', async () => {
    retrieveMock.mockResolvedValue({
      price: { price: 500, currency: 'USD', type: 'recurring_price', payment_frequency_interval: 'Month' },
    });

    await getProductPrice('pdt_cache_test');
    await getProductPrice('pdt_cache_test');

    expect(retrieveMock).toHaveBeenCalledTimes(1);
  });

  it('fetches independently for different product ids', async () => {
    retrieveMock.mockResolvedValue({
      price: { price: 500, currency: 'USD', type: 'recurring_price', payment_frequency_interval: 'Month' },
    });

    await getProductPrice('pdt_a');
    await getProductPrice('pdt_b');

    expect(retrieveMock).toHaveBeenCalledTimes(2);
  });
});
