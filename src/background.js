import browser from 'webextension-polyfill';

import * as openpgp from 'openpgp';

import Minimize from 'minimize';

function regex(pattern, input) {
  const re = new RegExp(pattern);
  return re.test(input);
}

function transformPatternsFromStorage(items) {
  let ret = {};
  items.forEach((item) => {
    ret['^' + item.regex + '$'] = item.pubkey;
  });

  return ret;
}

let patterns = {};
browser.storage.local.get('items').then((result) => {
  if (result.items) {
    patterns = transformPatternsFromStorage(result.items);
  }
});
browser.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') {
    return;
  }

  if (changes.items) {
    patterns = transformPatternsFromStorage(changes.items.newValue);
  }
});

const createSignatureData = (icon, title, disable) => ({icon, title, disable});
const goodSignature = createSignatureData('images/sigGood.png', 'Valid Signature!');
const badSignature = createSignatureData('images/sigBad.png', 'Bad or Missing Signature!');
const neutralSignature = createSignatureData('images/sigNeutral.png', 'No signature expected.', true);

function updateBrowserAction(data, tabId) {
  browser.browserAction.setIcon({
    path: data.icon,
    tabId,
  });

  browser.browserAction.setTitle({
    title: data.title,
    tabId,
  });

  if (data.disable) {
    browser.browserAction.disable(tabId);
  } else {
    browser.browserAction.enable(tabId);
  }
}

function processPage(rawContent, signature, url, tabId) {
  const content = new Minimize({ spare:true, conditionals: true, empty: true, quotes: true }).parse(rawContent)
    .replace(/^\s*<!doctype[^>]*>/i, '');

  const shouldCheck = Object.keys(patterns).find((x) => (regex(x, url)));

  if (shouldCheck) {
    try {
      const pubkey = patterns[shouldCheck];

      const options = {
        message: openpgp.message.fromBinary(openpgp.util.str2Uint8Array(content)),
        signature: openpgp.signature.readArmored(signature),
        publicKeys: openpgp.key.readArmored(pubkey).keys,
      };

      openpgp.verify(options).then((verified) => {
        const signatureData = (verified.signatures[0].valid) ? goodSignature : badSignature;
        updateBrowserAction(signatureData, tabId);
      });
    } catch (e) {
      updateBrowserAction(badSignature, tabId);
    }
  } else {
    updateBrowserAction(neutralSignature, tabId);
  }
}

browser.runtime.onMessage.addListener(
  (request, sender) => {
    processPage(request.content, request.signature, sender.url, sender.tab.id)
  }
);
