import { KeyAutoAdd } from './lib/keyAutoAdd';

new KeyAutoAdd([
  {
    id: 'step-1',
    run() {
      throw new Error('Step 1 error');
    },
  },
]).init();
