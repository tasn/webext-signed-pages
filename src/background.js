import browser from 'webextension-polyfill';

import { hasFilteredResponse } from 'browser-check';
import { matchPatternToRegExp } from 'match-pattern';

import * as openpgp from 'openpgp';

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

// Versioned minimize
function minimize_1_0(rawContent) {
  const Minimize = require('minimize@2.1.0');
  const content = new Minimize({ spare:true, conditionals: true, empty: true, quotes: true }).parse(rawContent)
  .replace(/^\s*<!doctype[^>]*>/i, '');
  return content;
}

// Version match. 
// returns true if major and minor are equal and patch less than or equal to taget
function matchVersions(version, target) {
  let v = version.split(".").map(i => parseInt(i,10));
  let t = target.split(".").map(i => parseInt(i,10));
  if (v.length != 3) 
    return false;
  return (v[0] == t[0]) && (v[1] == t[1]) && (v[2] <= t[2]);
}

function defaultOptions() {
  return {
    signatures: [],
    trustedPublicKeys: [],
    trustedDNS: false,
  };
}

function defaultSignature() {
  return {
    allowedmethods:['filteredrequestdata', 'outsidehtml']
  }
}

function parseOptions(content) {
  let options = defaultOptions();
  const head = content.split(/<\/head\s*>/i)[0];

  // Parse signature metadata
  const signatureRegex = RegExp('<meta\\s+name="signature"\\s+content="([^"]*)"\\s*>', 'gi');
  const nameRegex = RegExp('\\s*([\\w-]+)=([^,"]*),?', 'gi');
  let sigMatch;
  while( (sigMatch = signatureRegex.exec(head)) !== null ) {
    let signature = defaultSignature();
    let nameMatch;
    while ( (nameMatch = nameRegex.exec(sigMatch[1])) !== null ) {
      const name = nameMatch[1].toLowerCase();
      if (name == 'signature') {
        // preserve whitespace to ensure all of it is stripped out
        signature[name] = nameMatch[2];
      } else if (name == 'allowedmethods') {
        // split on spaces
        signature[name] = nameMatch[2].split(" ").map(s => s.trim().toLowerCase());
      } else {
        signature[name] = nameMatch[2].trim().toLowerCase();
       }
    }
    if (signature.type && signature.version && signature.signature)
      options.signatures.push(signature);
  }

  return options;
}

// Strip all signatures from content for signature verification
function stripSignatures(content, options) {
  let newContent = content;
  for (let signature of options.signatures)  {
    newContent = newContent.replace(signature.signature, "");
    signature.signature = signature.signature.trim();
  }
  return newContent;
}

function validateSignature(content, signature, pageOptions, pubkey) {
  const options = {
    message: openpgp.message.fromBinary(openpgp.util.str2Uint8Array(content)),
    signature: openpgp.signature.readArmored(signature),
    publicKeys: openpgp.key.readArmored(pubkey).keys,
  };

  return openpgp.verify(options).then((verified) => {
    return verified.signatures[0].valid;
  });
}

function validateSignatures(content, options, pubKey, method) {
  let last = Promise.resolve(false);
  for (let signature of options.signatures) {
    let promise = null;
    if (signature.allowedmethods.includes(method.toLowerCase())) {
      if (signature.type == 'pgp') {
        promise = validateSignature(content, signature.signature, options, pubKey);
      } else if (signature.type == 'pgpMinimized') {
        if (matchVersions(signature.version, '1.0.0')) {
          const signedContent = minimize_1_0(content);
          promise =  validateSignature(signedContent, signature.signature, options, pubKey);
        }
      }
    }
    // Chain promises returning when the first one is true
    if (promise) {
      last = last.then(verified => {
        if (verified)
          return verified;
        else
          return promise;
      })
    }
  }
  return last;
}

function processPage(rawContent, legacySignature, url, tabId, method) {
  const pattern = getPubkey(patterns, url);
  if (pattern) {
    // only test if the user defined a pattern
    try {  
      const pubkey = patterns[pattern].trim();
      let options, content;
      if (legacySignature) {
        // Legacy signature
        options = defaultOptions();
        options.signatures = [{
          type: 'pgp_minimized',
          version: '1.0.0',
          signature: legacySignature,
          allowedmethods: ['filterrequestmetadata', 'outsidehtml']
        }];
        // ?? Do we need to strip signature? Old code relied on minimizer
        content = rawContent;
      } else {
        options = parseOptions(rawContent);
        content = stripSignatures(rawContent, options);
      }
      if (options !== null) {
        validateSignatures(content, options, pubkey, method)
        .then((verified) => {
          const signatureData = (verified) ? goodSignature : badSignature;
          updateBrowserAction(signatureData, tabId);
          statusCache[url] = signatureData;
        })
        .catch(() => {
          updateBrowserAction(badSignature, tabId);
          statusCache[url] = badSignature;
        });
      } else {
        updateBrowserAction(badSignature, tabId);
        statusCache[url] = badSignature;
      }
    } catch (e) {
      updateBrowserAction(badSignature, tabId);
      statusCache[url] = badSignature;
    }
  } else {
    updateBrowserAction(neutralSignature, tabId);
  }
}

// extract legacy signature
function extractSignature(str) {
  const signatureMatch = /<!--!\s*(-----BEGIN PGP SIGNATURE-----[^-]*-----END PGP SIGNATURE-----)/g.exec(str);
  return signatureMatch ? signatureMatch[1] : undefined;
}

if (hasFilteredResponse()) {
  const listener = (details) => {
    // FIXME: Only filter pages that we care about, the rest can skip this.
    let filter = browser.webRequest.filterResponseData(details.requestId);
    let decoder = new TextDecoder('utf-8');

    filter.ondata = event => {
      const str = decoder.decode(event.data, {stream: true});

      const signature = extractSignature(str);

      processPage(str, signature, details.url, details.tabId, "filterResponseData");

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
      processPage(request.content, extractSignature(request.signature), sender.url, sender.tab.id, "outsideHTML")
    }
  );
}
