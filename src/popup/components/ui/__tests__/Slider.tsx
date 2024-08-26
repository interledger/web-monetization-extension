import '@testing-library/jest-dom';

import { render, screen } from '@testing-library/react';
import React from 'react';

import { Slider } from '../Slider';

describe('Slider Component', () => {
  it('renders without crashing', () => {
    render(<Slider />);
    expect(screen.getByRole('slider')).toBeInTheDocument();
  });

  it('handles disabled prop', () => {
    render(<Slider disabled={true} />);
    expect(screen.getByRole('slider')).toBeDisabled();
  });

  it('displays error message when provided', () => {
    const errorMessage = 'Error message';
    render(<Slider errorMessage={errorMessage} />);
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('passes additional props to the input', () => {
    const testName = 'test-name';
    render(<Slider name={testName} />);
    expect(screen.getByRole('slider')).toHaveAttribute('name', testName);
  });
});
