import type { Runtime } from 'webextension-polyfill';
import { configureContainer } from './container';

console.log('HERE')
let container = configureContainer();
container.resolve('contentScript').start();
onDisconnect(container).addListener(invalidation);

function invalidation(e: Runtime.Port) {
  console.log(
    'invalidation',
    e.error,
    container.cradle.browser.runtime?.lastError,
  );
  try {
    onDisconnect(container).removeListener(invalidation);
  } catch (error) {
    console.warn(error);
  }
  container.resolve('contentScript').end();
  container.dispose();

  container = configureContainer();
  container.resolve('contentScript').start();
  onDisconnect(container).addListener(invalidation);
}

function onDisconnect(container: ReturnType<typeof configureContainer>) {
  return container.cradle.browser.runtime.connect().onDisconnect;
}
