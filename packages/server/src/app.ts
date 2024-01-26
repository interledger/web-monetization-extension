import { type AuthenticatedClient } from '@interledger/open-payments';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import { Server } from 'node:http';

import { type Config } from './config';
import { type Context, Router } from './context';
import { registerPublicRoutes } from './routes/public';

export class Application {
  #config: Config;
  #koa: Koa<Koa.DefaultState, Context>;
  #router: Router;
  #server?: Server;
  #client: AuthenticatedClient;

  constructor(config: Config, client: AuthenticatedClient) {
    this.#config = config;
    this.#client = client;
    this.#koa = new Koa();
    this.#router = new Router();

    this.#decorateContext();
    this.#koa.use(bodyParser());

    registerPublicRoutes(this.#router);

    this.#koa.use(this.#router.routes());
    this.#koa.use(this.#router.allowedMethods());
  }

  #decorateContext(): void {
    this.#koa.context.client = this.#client;
  }

  async start(): Promise<void> {
    await new Promise<void>(res => {
      this.#server = this.#koa.listen(this.#config.PORT, res);
    });
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.#server?.close(err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}
