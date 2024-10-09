import './globalBuffer';
import { configureContainer } from './container';

const container = configureContainer();
container.resolve('background').start();
