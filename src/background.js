import browser from 'webextension-polyfill';

import { hasFilteredResponse } from 'browser-check';

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

if (hasFilteredResponse()) {
  const listener = (details) => {
    // FIXME: Only filter pages that we care about, the rest can skip this.
    let filter = browser.webRequest.filterResponseData(details.requestId);
    let decoder = new TextDecoder('utf-8');
    let encoder = new TextEncoder('utf-8');

    filter.ondata = event => {
      const str = decoder.decode(event.data, {stream: true});

      const signatureMatch = /-----BEGIN PGP SIGNATURE-----[^-]*-----END PGP SIGNATURE-----/g.exec(str);
      const signature = signatureMatch ? signatureMatch[0] : undefined;

      processPage(str, signature, details.url, details.tabId);

      filter.write(encoder.encode(str));
      filter.disconnect();
    }

    return {};
  }

  browser.webRequest.onBeforeRequest.addListener(
    listener,
    {urls: ["<all_urls>"], types: ["main_frame"]},
    ["blocking"]
  );
} else {
  browser.runtime.onMessage.addListener(
    (request, sender) => {
      processPage(request.content, request.signature, sender.url, sender.tab.id)
    }
  );
}
