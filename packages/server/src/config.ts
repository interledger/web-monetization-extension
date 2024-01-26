function getEnvVariable(name: string, defaultValue?: any): string {
  if (!process.env[name]) {
    return defaultValue;
  }

  return process.env[name]!;
}

export type Config = typeof config;

export const config = {
  PORT: parseInt(getEnvVariable('PORT', 3000), 10),
  WALLET_ADDRESS: getEnvVariable('WALLET_ADDRESS'),
  PRIVATE_KEY: getEnvVariable('PRIVATE_KEY'),
  KEY_ID: getEnvVariable('KEY_ID'),
} as const;
