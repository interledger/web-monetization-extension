export const isValidationError = (err: unknown): boolean =>
  Boolean(
    err &&
      typeof err === 'object' &&
      'errors' in err &&
      Array.isArray((err as { errors: unknown }).errors),
  );

export const HttpMethod = {
  GET: 'get',
  PUT: 'put',
  POST: 'post',
  DELETE: 'delete',
  OPTIONS: 'options',
  HEAD: 'head',
  PATCH: 'patch',
  TRACE: 'trace',
} as const;

export const isHttpMethod = (o: unknown): boolean =>
  Object.values(HttpMethod).includes(
    o as (typeof HttpMethod)[keyof typeof HttpMethod],
  );

export class OpenAPIValidatorMiddlewareError extends Error {}

export const createValidatorMiddleware = () => () => {};

export const createOpenAPI = async () => ({
  createRequestValidator: () => () => {},
  createResponseValidator: () => () => {},
});
