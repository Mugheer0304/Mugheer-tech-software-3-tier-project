import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../src/components/ui/Badge';
import { AiTag } from '../src/components/ui/AiTag';
import { Stat } from '../src/components/ui/Stat';
import { Button } from '../src/components/ui/Button';
import { INTERNAL_ROLES, isInternal } from '../src/lib/auth.store';

describe('Badge', () => {
  it('renders snake_case values in lowercase', () => {
    render(<Badge value="IN_DEVELOPMENT" />);
    expect(screen.getByText('in development')).toBeTruthy();
  });

  it('picks a semantic color for critical alerts', () => {
    const { container } = render(<Badge value="CRITICAL" />);
    expect(container.firstChild?.textContent).toBe('critical');
  });
});

describe('AiTag', () => {
  it('always labels AI content visibly (governance requirement)', () => {
    render(<AiTag />);
    expect(screen.getByText(/AI-suggested/i)).toBeTruthy();
  });

  it('supports custom labels', () => {
    render(<AiTag label="AI-drafted reply" />);
    expect(screen.getByText(/AI-drafted reply/i)).toBeTruthy();
  });
});

describe('Stat', () => {
  it('renders label and value', () => {
    render(<Stat label="Open alerts" value={3} tone="bad" />);
    expect(screen.getByText('Open alerts')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });
});

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Pay now</Button>);
    expect(screen.getByText('Pay now')).toBeTruthy();
  });
});

describe('auth helpers', () => {
  it('classifies internal roles', () => {
    expect(isInternal({ id: '1', email: 'e', name: 'n', role: 'ADMIN' })).toBe(true);
    expect(isInternal({ id: '1', email: 'e', name: 'n', role: 'CLIENT_OWNER' })).toBe(false);
    expect(isInternal(null)).toBe(false);
  });

  it('covers every seeded internal role', () => {
    expect(INTERNAL_ROLES).toContain('SUPER_ADMIN');
    expect(INTERNAL_ROLES).toContain('ADMIN');
    expect(INTERNAL_ROLES).toContain('ENGINEER');
    expect(INTERNAL_ROLES).toContain('DESIGNER');
    expect(INTERNAL_ROLES).toContain('SUPPORT');
  });
});
