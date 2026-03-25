import { render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { redirectMock, validateAdminSessionMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(),
  validateAdminSessionMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

vi.mock('next/server', () => ({
  connection: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/auth.server', () => ({
  validateAdminSession: validateAdminSessionMock,
}));

vi.mock('@/components/admin/AdminShell', () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="admin-shell">{children}</div>
  ),
}));

import ProtectedAdminLayout from './layout';

describe('ProtectedAdminLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /admin/login when session is invalid', async () => {
    validateAdminSessionMock.mockResolvedValue(false);

    // redirect() in Next.js throws an internal NEXT_REDIRECT error;
    // the mock just records the call and returns undefined
    await ProtectedAdminLayout({ children: <div /> });

    expect(validateAdminSessionMock).toHaveBeenCalledOnce();
    expect(redirectMock).toHaveBeenCalledWith('/admin/login');
  });

  it('renders AdminShell with children when session is valid', async () => {
    validateAdminSessionMock.mockResolvedValue(true);

    const element = await ProtectedAdminLayout({
      children: <span data-testid="child-content">page content</span>,
    });

    render(element as React.ReactElement);

    expect(screen.getByTestId('admin-shell')).toBeDefined();
    expect(screen.getByTestId('child-content')).toBeDefined();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
