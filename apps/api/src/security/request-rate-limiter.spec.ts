import { RequestRateLimiter } from './request-rate-limiter';

describe('RequestRateLimiter', () => {
  it('fails closed when Redis cannot enforce the budget', async () => {
    const redis = { eval: jest.fn().mockRejectedValue(new Error('unavailable')) };
    const limiter = new RequestRateLimiter(redis as never, { API_RATE_LIMIT: 120, OIDC_RATE_LIMIT: 120 } as never);
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() }; const next = jest.fn();
    await limiter.middleware({ path: '/token', method: 'POST', ip: '127.0.0.1' } as never, response as never, next);
    expect(response.status).toHaveBeenCalledWith(503); expect(next).not.toHaveBeenCalled();
  });
});
