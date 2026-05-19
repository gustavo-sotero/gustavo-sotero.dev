import { DEVELOPER_PUBLIC_PROFILE } from '@portfolio/shared/constants/developerProfile';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getResumeAggregateMock } = vi.hoisted(() => ({
  getResumeAggregateMock: vi.fn(),
}));

vi.mock('../../services/resume.service', () => ({
  getResumeAggregate: getResumeAggregateMock,
}));

import { publicResumeRouter } from './resume';

const stubAggregate = {
  profile: DEVELOPER_PUBLIC_PROFILE,
  experience: [],
  education: [],
  skills: [],
  projects: [],
};

describe('public resume route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getResumeAggregateMock.mockResolvedValue(stubAggregate);
  });

  it('returns 200 with the resume aggregate payload', async () => {
    const app = new Hono();
    app.route('/resume', publicResumeRouter);

    const response = await app.request('/resume');
    const body = (await response.json()) as {
      success: boolean;
      data: typeof stubAggregate;
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      profile: expect.objectContaining({ name: DEVELOPER_PUBLIC_PROFILE.name }),
      experience: [],
      education: [],
      skills: [],
      projects: [],
    });
  });

  it('calls getResumeAggregate exactly once per request', async () => {
    const app = new Hono();
    app.route('/resume', publicResumeRouter);

    await app.request('/resume');

    expect(getResumeAggregateMock).toHaveBeenCalledTimes(1);
  });
});
