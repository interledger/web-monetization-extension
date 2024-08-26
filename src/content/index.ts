import { configureContainer } from './container';

const container = configureContainer();
container.resolve('contentScript').start();
