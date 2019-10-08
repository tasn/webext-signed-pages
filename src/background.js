import browser from 'webextension-polyfill';

import { hasFilteredResponse } from 'browser-check';
import { matchPatternToRegExp } from 'match-pattern';

import * as openpgp from 'openpgp';

import Minimize from 'minimize';

import defaultItems from 'default-items';

function regex(pattern, input) {
  const re = matchPatternToRegExp(pattern);
  return re.test(input);
}

function transformPatternsFromStorage(items) {
  let ret = {};
  items.forEach((item) => {
    const regexes = item.regex.trim().split('\n');
    regexes.forEach((regex) => {
      ret[regex] = item.pubkey;
    });
  });

  return ret;
}

let patterns = {};
browser.storage.local.get('items').then((result) => {
  if (result.items) {
    patterns = transformPatternsFromStorage(result.items);
  } else {
    browser.storage.local.set({ items: defaultItems });
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
const unsureSignature = createSignatureData('images/sigMaybe.png', 'Error! Please Refresh Page and Contact Developers');
const badSignature = createSignatureData('images/sigBad.png', 'Bad or Missing Signature!');
const neutralSignature = createSignatureData('images/sigNeutral.png', 'No signature expected.', true);

function updateBrowserAction(data, tabId) {
  browser.pageAction.setIcon({
    path: data.icon,
    tabId,
  });

  browser.pageAction.setTitle({
    title: data.title,
    tabId,
  });

  const pageAction = chrome ? chrome.pageAction : browser.pageAction;
  if (data.disable) {
    pageAction.hide(tabId);
  } else {
    pageAction.show(tabId);
  }
}

function getPubkey(pubkeyPatterns, url) {
  return Object.keys(pubkeyPatterns).find((x) => (regex(x, url)));
}

// Cache the result status in case we are not doing web requests.
let statusCache = {};

function processPage(rawContent, signature, url, tabId) {
  const content = new Minimize({ spare:true, conditionals: true, empty: true, quotes: true }).parse(rawContent)
    .replace(/^\s*<!doctype[^>]*>/i, '');

  const shouldCheck = getPubkey(patterns, url);

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
        statusCache[url] = signatureData;
      });
    } catch (e) {
      updateBrowserAction(badSignature, tabId);
      statusCache[url] = badSignature;
    }
  } else {
    updateBrowserAction(neutralSignature, tabId);
  }
}

function extractSignature(str) {
  const signatureMatch = /-----BEGIN PGP SIGNATURE-----[^-]*-----END PGP SIGNATURE-----/g.exec(str);
  return signatureMatch ? signatureMatch[0] : undefined;
}

if (hasFilteredResponse()) {
  const listener = (details) => {
    // FIXME: Only filter pages that we care about, the rest can skip this.
    let filter = browser.webRequest.filterResponseData(details.requestId);
    let decoder = new TextDecoder('utf-8');

    filter.ondata = event => {
      const str = decoder.decode(event.data, {stream: true});

      const signature = extractSignature(str);
      
      if (signature) {
        processPage(str, signature, details.url, details.tabId);
      }
      
      filter.write(event.data);
      filter.disconnect();
    }

    return {};
  }

  browser.webRequest.onBeforeRequest.addListener(
    listener,
    {urls: ["<all_urls>"], types: ["main_frame"]},
    ["blocking"]
  );

  // Load results from cache if the page is cached
  browser.webNavigation.onCommitted.addListener((details) => {
    if (details.url in statusCache) {
      updateBrowserAction(statusCache[details.url], details.tabId);
    } else if (getPubkey(patterns, details.url)) {
      // We should never get here, but if there are issues, at least show an icon indicating of that.
      updateBrowserAction(unsureSignature, details.tabId);
    }
  });
} else {
  browser.runtime.onMessage.addListener(
    (request, sender) => {
      processPage(request.content, extractSignature(request.signature), sender.url, sender.tab.id)
    }
  );
}
