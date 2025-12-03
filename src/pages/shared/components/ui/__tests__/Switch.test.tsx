import '@testing-library/jest-dom';

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { Switch, SwitchButton } from '@/pages/shared/components/ui/Switch';

describe('Switch, SwitchButton', () => {
  it('renders without crashing', () => {
    render(<SwitchButton id="test" checked={false} onChange={() => {}} />);
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('applies default classes', () => {
    render(<SwitchButton id="test" checked={false} onChange={() => {}} />);
    const switchElement = screen.getByRole('switch').nextSibling;
    expect(switchElement).toHaveClass(
      'w-[42px] h-[26px] before:h-5 before:w-5',
    );
  });

  it('applies small size classes when size prop is small', () => {
    render(
      <SwitchButton
        size="small"
        id="test"
        checked={false}
        onChange={() => {}}
      />,
    );
    const switchElement = screen.getByRole('switch').nextSibling;
    expect(switchElement).toHaveClass(
      'w-9 h-[22px] before:h-4 before:w-4 before:left-[3px]',
    );
  });

  it('SwitchButton - forwards ref to input element', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(
      <SwitchButton ref={ref} id="test" checked={false} onChange={() => {}} />,
    );
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('Switch - forwards ref to input element', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Switch ref={ref} label="test" />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('maps label to switch input', () => {
    render(<Switch label="my label" checked />);
    expect(screen.getByLabelText('my label')).toBeChecked();
  });

  it('forwards checked prop to input element', () => {
    render(<SwitchButton id="test" checked={true} onChange={() => {}} />);
    const inputElement = screen.getByRole('switch');
    expect(inputElement).toBeChecked();
  });

  it('handles additional props', () => {
    render(
      <SwitchButton
        aria-label="Custom Switch"
        id="test"
        checked={false}
        onChange={() => {}}
      />,
    );
    const inputElement = screen.getByRole('switch');
    expect(inputElement).toHaveAttribute('aria-label', 'Custom Switch');
  });

  it('toggles switch state when clicked', () => {
    const TestComponent = () => {
      const [checked, setChecked] = React.useState(false);
      return (
        <SwitchButton
          id="test"
          checked={checked}
          onChange={() => setChecked((v) => !v)}
        />
      );
    };
    render(<TestComponent />);

    const inputElement = screen.getByRole('switch');
    expect(inputElement).not.toBeChecked();

    fireEvent.click(inputElement);
    expect(inputElement).toBeChecked();

    fireEvent.click(inputElement);
    expect(inputElement).not.toBeChecked();
  });

  it('handles additional HTML attributes', () => {
    const testId = 'switch-test';
    render(<Switch label="label" data-testid={testId} />);
    const switchElement = screen.getByTestId(testId);
    expect(switchElement).toBeInTheDocument();
  });
});
