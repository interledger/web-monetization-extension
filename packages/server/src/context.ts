import { type AuthenticatedClient } from '@interledger/open-payments';
import { operations as Operations } from '@interledger/wm-openapi';
import KoaRouter from '@koa/router';
import Koa from 'koa';
import { type ParsedUrlQuery } from 'node:querystring';

export interface ContextExtension<TResponseBody = unknown>
  extends Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, TResponseBody> {
  client: AuthenticatedClient;
}

interface Request<TBody = never, TQuery = ParsedUrlQuery>
  extends Omit<ContextExtension['request'], 'body'> {
  body: TBody;
  query: ParsedUrlQuery & TQuery;
}

export interface ConnectWalletContext extends ContextExtension {
  request: Request<Operations['connect-wallet']['requestBody']['content']['application/json']>;
}

export type Context = Koa.ParameterizedContext<Koa.DefaultState, ContextExtension>;

export class Router extends KoaRouter<Koa.DefaultState, ContextExtension> {}
