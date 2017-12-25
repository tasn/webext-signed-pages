import browser from 'webextension-polyfill';

function findSignature(document_root) {
  let node = document_root.firstChild;
  while (node) {
    if (node.nodeType === Node.COMMENT_NODE) {
      return node.nodeValue;
    }

    node = node.nextSibling;
  }
}


let ran = false;
const signatureCheck = () => {
  if (ran)
    return;

  ran = true;
  // XXX: Ignore errors for now due to the webextension-polyfill
  browser.runtime.sendMessage({ signature, content: document.documentElement.outerHTML }).then(() => {}, () => {});
};

const mutationObserver = (mutationList, thisObserver) => {
  for (const mutation of mutationList) {
    for (const node of mutation.addedNodes) {
      if (node.tagName === 'BODY') {
        signatureCheck();
        thisObserver.disconnect();
        return;
      }
    }
  }
}

const signature = findSignature(document);

if (signature) {
  const observer = new MutationObserver(mutationObserver);
  observer.observe(document, {childList: true, subtree: true});
  document.onreadystatechange = signatureCheck;
} else {
  // XXX: Ignore errors for now due to the webextension-polyfill
  browser.runtime.sendMessage({ }).then(() => {}, () => {});
}
