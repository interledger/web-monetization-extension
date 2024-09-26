import { sleep } from '@/shared/helpers';
import { KeyAutoAdd } from './lib/keyAutoAdd';

new KeyAutoAdd([
  {
    id: 'Find',
    async run({ walletAddressUrl }) {
      const walletAddressURL = new URL(walletAddressUrl);
      if (!location.pathname.startsWith('/settings/developer-keys')) {
        throw new Error('Not on keys page. Are you not logged in?');
      }

      await sleep(2000);

      const buttons = document.querySelectorAll<HTMLButtonElement>(
        'main dl dt button[aria-expanded]', // disclosure button
      );
      for (const button of buttons) {
        button.click();
        await sleep(500);

        const dt = button.closest('dt');
        if (!dt) {
          throw new Error('Failed to find matching `dt`');
        }
        const dd = dt.nextElementSibling?.querySelector('dd ul');
        console.log(
          dt,
          dt.nextElementSibling,
          dt.nextElementSibling?.querySelector('dd ul'),
        );
        if (!(dd instanceof HTMLElement) || dd.tagName !== 'UL') {
          throw new Error('Failed to find matching `ul` list');
        }

        let keyListContainer;
        for (const subGroup of dd.querySelectorAll('li')) {
          const pointerHeading = subGroup.querySelector<HTMLParagraphElement>(
            ':scope > div > p.font-semibold',
          );
          if (!pointerHeading) {
            throw new Error('Failed to find payment pointer heading');
          }
          if (
            pointerHeading.textContent?.endsWith(
              walletAddressURL.host + walletAddressURL.pathname,
            )
          ) {
            // found right group for our wallet
            keyListContainer = pointerHeading.nextElementSibling;
            if (keyListContainer instanceof HTMLElement) {
              break;
            }
          }
        }
        if (!keyListContainer) {
          throw new Error('Failed to find key list container');
        }

        const uploadKeyButton =
          keyListContainer.querySelector<HTMLButtonElement>(
            'button[aria-label="upload keys"]',
          );
        if (!uploadKeyButton) {
          throw new Error('Failed to find upload key button');
        }
        uploadKeyButton.click();

        await sleep(1000); // wait for the popup with form open
        const inputNickname = document.querySelector<HTMLInputElement>(
          'input#nicknameUpload',
        );
        if (!inputNickname) {
          throw new Error('Failed to find input nickname');
        }
        return;
      }

      throw new Error('Failed to find the right key section');
    },
  },
  {
    id: 'Submit',
    async run({ publicKey }) {
      const inputNickname = document.querySelector<HTMLInputElement>(
        'input#nicknameUpload',
      );
      if (!inputNickname) {
        throw new Error('Failed to find input nickname');
      }

      const form = inputNickname.closest('form');
      if (!form) {
        throw new Error('Failed to find form');
      }
      const textArea = form?.querySelector('textarea');
      if (!textArea) {
        throw new Error('Failed to find text area');
      }
      const submitButton = form.querySelector<HTMLButtonElement>(
        'button[type="submit"][aria-label="upload"]',
      );
      if (!submitButton) {
        throw new Error('Failed to find submit button');
      }

      inputNickname.focus();
      inputNickname.value = 'web monetization extension';
      inputNickname.blur();
      await sleep(500);

      textArea.focus();
      textArea.value = publicKey;
      textArea.blur();
      await sleep(1000);

      submitButton.click();

      let remain = 10;
      while (form.isConnected && remain > 0) {
        await sleep(1000);
        remain--;
      }
      if (!remain && form.isConnected) {
        throw new Error('Form did not disappear on submit');
      }
    },
  },
]).init();
