import type { DefaultState } from 'koa';

import type { ConnectWalletContext, Router } from '../context';

export function registerPublicRoutes(router: Router) {
  router.get<DefaultState, ConnectWalletContext>('/', async ctx => {
    const wallet = await ctx.client.walletAddress.get({
      url: 'https://ilp.rafiki.money/radu',
    });

    ctx.body = wallet;
  });
}
