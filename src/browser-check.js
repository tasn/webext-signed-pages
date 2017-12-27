import browser from 'webextension-polyfill';

export function hasFilteredResponse() {
  return (browser.webRequest && browser.webRequest.filterResponseData);
}
