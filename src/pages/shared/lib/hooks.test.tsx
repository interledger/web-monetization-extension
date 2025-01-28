import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { useLocalStorage } from './hooks';

describe('useLocalStorage', () => {
  const defaultMaxAge = 1000 * 24 * 60 * 60;
  let now = Date.now();
  let defaultExpiresAt = now + defaultMaxAge;
  beforeAll(() => {
    jest.useFakeTimers();
  });
  beforeEach(() => {
    localStorage.clear();
    now = jest.getRealSystemTime();
    defaultExpiresAt = now + defaultMaxAge;
  });
  afterAll(() => {
    jest.useRealTimers();
    localStorage.clear();
  });

  function TestComponent({ maxAge = defaultMaxAge }: { maxAge?: number }) {
    const [data, setData, clear] = useLocalStorage('name', 'John Doe', {
      maxAge,
    });
    return (
      <>
        <p data-testid="data">{data}</p>
        <button
          type="button"
          data-testid="set"
          onClick={() => setData('John Wick')}
        >
          Set data
        </button>
        <button
          type="button"
          data-testid="set-cb"
          onClick={() => setData((data) => `${data}Foo`)}
        >
          Set data callback
        </button>
        <button type="button" data-testid="clear" onClick={() => clear()}>
          Clear data
        </button>
      </>
    );
  }

  it('sets localStorage based on default value', () => {
    const { getByTestId } = render(<TestComponent />);
    expect(getByTestId('data')).toHaveTextContent('John Doe');
    expect(localStorage.getItem('name')).not.toBeNull();
    const stored = JSON.parse(localStorage.getItem('name')!);
    expect(stored.value).toBe('John Doe');
    expect(stored.expiresAt).toBeGreaterThan(defaultExpiresAt);
  });

  it('gets localStorage value instead of default', () => {
    localStorage.setItem(
      'name',
      JSON.stringify({ value: 'Johnny', expiresAt: defaultExpiresAt }),
    );
    const { getByTestId } = render(<TestComponent />);
    expect(getByTestId('data')).toHaveTextContent('Johnny');
  });

  it('changes localStorage and state value', () => {
    localStorage.setItem(
      'name',
      JSON.stringify({ value: 'Johnny', expiresAt: defaultExpiresAt }),
    );
    const { getByTestId } = render(<TestComponent />);

    fireEvent.click(getByTestId('set'));
    expect(getByTestId('data')).toHaveTextContent('John Wick');

    expect(localStorage.getItem('name')).not.toBeNull();
    const stored = JSON.parse(localStorage.getItem('name')!);
    expect(stored.value).toBe('John Wick');
    expect(stored.expiresAt).toBeGreaterThan(defaultExpiresAt);
  });

  it('changes localStorage and state value using callback', () => {
    localStorage.setItem(
      'name',
      JSON.stringify({ value: 'Johnny', expiresAt: defaultExpiresAt }),
    );
    const { getByTestId } = render(<TestComponent />);

    fireEvent.click(getByTestId('set-cb'));
    expect(getByTestId('data')).toHaveTextContent('JohnnyFoo');

    expect(localStorage.getItem('name')).not.toBeNull();
    const stored = JSON.parse(localStorage.getItem('name')!);
    expect(stored.value).toBe('JohnnyFoo');
    expect(stored.expiresAt).toBeGreaterThan(defaultExpiresAt);
  });

  it('should remove item from localStorage when clear is called', () => {
    const { getByTestId } = render(<TestComponent />);

    fireEvent.click(getByTestId('clear'));
    expect(getByTestId('data')).toHaveTextContent('John Doe');
    expect(localStorage.getItem('name')).toBeNull();
  });

  it('should be able to set value again after it was removed from localStorage', () => {
    const { getByTestId } = render(<TestComponent />);

    fireEvent.click(getByTestId('clear'));
    fireEvent.click(getByTestId('set'));

    expect(localStorage.getItem('name')).not.toBeNull();
    const stored = JSON.parse(localStorage.getItem('name')!);
    expect(stored.value).toBe('John Wick');
    expect(stored.expiresAt).toBeGreaterThan(defaultExpiresAt);
  });

  it('should respect maxAge', () => {
    const maxAge = 5;
    const ui = <TestComponent maxAge={maxAge} />;

    expect(localStorage.getItem('name')).toBeNull();

    const { getByTestId, unmount } = render(ui);
    expect(getByTestId('data')).toHaveTextContent('John Doe');
    expect(localStorage.getItem('name')).not.toBeNull();

    fireEvent.click(getByTestId('set'));
    const now = Date.now();
    expect(getByTestId('data')).toHaveTextContent('John Wick');
    expect(localStorage.getItem('name')).not.toBeNull();
    const stored = JSON.parse(localStorage.getItem('name')!);
    expect(stored.value).toBe('John Wick');
    expect(stored.expiresAt).toBeGreaterThanOrEqual(now + maxAge * 1_000);
    expect(stored.expiresAt).toBeLessThan(defaultExpiresAt);

    jest.setSystemTime(now + (maxAge + 1) * 1_000);
    jest.advanceTimersByTime(now + (maxAge + 1) * 1_000);

    unmount();
    const remounted = render(ui);
    expect(remounted.getByTestId('data')).toHaveTextContent('John Doe');
    expect(localStorage.getItem('name')).not.toBeNull();
    expect(JSON.parse(localStorage.getItem('name')!).value).toBe('John Doe');
  });
});
