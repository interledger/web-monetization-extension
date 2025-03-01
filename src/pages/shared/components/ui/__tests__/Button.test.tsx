import { render } from '@testing-library/react';
import React from 'react';

import { Button } from '@/pages/shared/components/ui/Button';

describe('Button', () => {
  it('should render a button with the `aria-label` attribute', () => {
    const { queryByRole } = render(
      <Button aria-label="test button">My Button</Button>,
    );

    expect(queryByRole('button')).toBeInTheDocument();
    expect(queryByRole('button')).toHaveAttribute('aria-label', 'test button');
  });

  it('should default to `type="button"`', () => {
    const { queryByRole } = render(
      <Button aria-label="test button">My Button</Button>,
    );

    expect(queryByRole('button')).toBeInTheDocument();
    expect(queryByRole('button')).toHaveAttribute('type', 'button');
  });

  it('should not have the `disabled` attribute and `aria-disabled="false"` if `loading` is false', () => {
    const { queryByRole } = render(
      <Button aria-label="test button">My Button</Button>,
    );

    expect(queryByRole('button')).toBeInTheDocument();
    expect(queryByRole('button')).not.toHaveAttribute('disabled');
    expect(queryByRole('button')).toHaveAttribute('aria-disabled', 'false');
    expect(queryByRole('button')).not.toBeDisabled();
  });

  it('should have the `disabled` and `aria-disabled="true"` attributes if `loading` is true', () => {
    const { queryByRole } = render(
      <Button aria-label="test button" loading>
        My Button
      </Button>,
    );

    expect(queryByRole('button')).toBeInTheDocument();
    expect(queryByRole('button')).toHaveAttribute('disabled');
    expect(queryByRole('button')).toHaveAttribute('aria-disabled', 'true');
    expect(queryByRole('button')).toBeDisabled();
  });

  it('should allow text along with loading spinner', () => {
    const { queryByRole } = render(
      <Button aria-label="test button" loading loadingText="me loading">
        My Button
      </Button>,
    );

    expect(queryByRole('button')).toBeInTheDocument();
    expect(queryByRole('button')).toHaveAttribute('disabled');
    expect(queryByRole('button')).toHaveAttribute('aria-disabled', 'true');
    expect(queryByRole('button')?.querySelector('svg')).toBeDefined();
    expect(queryByRole('button')).toHaveTextContent('me loading');
    expect(queryByRole('button')).toBeDisabled();
  });

  it('should have the `bg-button-base` class by default', () => {
    const { queryByRole } = render(
      <Button aria-label="test button">My Button</Button>,
    );

    expect(queryByRole('button')).toBeInTheDocument();
    expect(queryByRole('button')).toHaveClass('bg-button-base');
  });

  it('should have the `bg-error` class when the `destructive` variant is passed', () => {
    const { queryByRole } = render(
      <Button aria-label="test button" variant="destructive">
        My Button
      </Button>,
    );

    expect(queryByRole('button')).toBeInTheDocument();
    expect(queryByRole('button')).toHaveClass('bg-error');
  });
});
