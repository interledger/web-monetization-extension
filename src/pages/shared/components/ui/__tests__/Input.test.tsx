import { render } from '@testing-library/react';
import React from 'react';

import { Input } from '@/pages/shared/components/ui/Input';

describe('Input', () => {
  it('should default to `type="text"`', () => {
    const { queryByLabelText } = render(<Input aria-label="test input" />);

    expect(queryByLabelText('test input')).toBeInTheDocument();
    expect(queryByLabelText('test input')).toHaveAttribute('type', 'text');
  });

  it('should not have the `disabled` attribute and `aria-disabled="false"` if `loading` is false', () => {
    const { queryByLabelText } = render(<Input aria-label="test input" />);

    expect(queryByLabelText('test input')).toBeInTheDocument();
    expect(queryByLabelText('test input')).not.toHaveAttribute('disabled');
    expect(queryByLabelText('test input')).toHaveAttribute(
      'aria-disabled',
      'false',
    );
    expect(queryByLabelText('test input')).not.toBeDisabled();
  });

  it('should have the `outline-base` class by default', () => {
    const { queryByLabelText } = render(<Input aria-label="test input" />);

    const input = queryByLabelText('test input')!;
    expect(input).toBeInTheDocument();
    expect(input.closest('div')).toHaveClass('outline-base');
  });

  it('should display `leadingAddOn`', () => {
    const { queryByLabelText } = render(
      <Input aria-label="test input" leadingAddOn="$" />,
    );

    const input = queryByLabelText('test input')!;
    expect(input).toBeInTheDocument();
    expect(input.previousElementSibling).toHaveTextContent('$');
    expect(input.nextElementSibling).toBeNull();
  });

  it('should display the `trailingAddon`', () => {
    const { queryByLabelText } = render(
      <Input aria-label="test input" trailingAddOn="$" />,
    );

    const input = queryByLabelText('test input')!;
    expect(input).toBeInTheDocument();
    expect(input.nextElementSibling).toHaveTextContent('$');
    expect(input.previousElementSibling).toBeNull();
  });

  it('should have the `bg-disabled` and `outline-transparent` classes when the `disabled` variant is passed', () => {
    const { queryByLabelText } = render(
      <Input aria-label="test input" disabled />,
    );

    const input = queryByLabelText('test input')!;
    expect(input).toBeInTheDocument();
    const wrapper = input.closest('div');
    expect(wrapper).toHaveClass('bg-disabled');
    expect(wrapper).toHaveClass('outline-transparent');
  });

  it('should have the `aria-invalid` and `aria-describedby` attributes if errorMessage is present', () => {
    const { queryByLabelText, queryByText } = render(
      <Input aria-label="test input" errorMessage="some error" />,
    );

    expect(queryByLabelText('test input')).toBeInTheDocument();
    expect(queryByLabelText('test input')).toHaveAttribute('aria-invalid');
    expect(queryByLabelText('test input')).toHaveAttribute('aria-describedby');
    expect(queryByText('some error')).toBeInTheDocument();
  });
});
