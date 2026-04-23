export const transformBalance = (
  amount: string | bigint,
  scale: number,
): string => {
  const value = BigInt(amount);
  const divisor = BigInt(10 ** scale);

  const integerPart = (value / divisor).toString();
  const fractionalPart = (value % divisor).toString().padStart(scale, '0');

  return `${integerPart}.${fractionalPart}`;
};
