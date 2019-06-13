<p align="center">
  <img width="120" src="graphics/icon.svg" />
  <h1 align="center">Signed Pages</h1>
</p>

A browser extension to verify the authenticity (PGP signature) of web pages.

![GitHub tag](https://img.shields.io/github/tag/tasn/webext-signed-pages.svg)
[![Mozilla Add-on](https://img.shields.io/amo/v/signed-pages.svg)](https://addons.mozilla.org/addon/signed-pages/)
[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/pdhofgeoopaglkejgpjojeikbdmkmkbp.svg)](https://chrome.google.com/webstore/detail/signed-pages/pdhofgeoopaglkejgpjojeikbdmkmkbp)

# Overview

## Why?

This extension was originally created to improve the security of the [EteSync web app](https://www.etesync.com). One of the biggest issues with securing web applications is the fact that the app (JavaScript) is delivered to you every time you open the page. This means that a malicious (or compromised) web server could change the code to steal your supposedly client-side-only and secure data.

This extension solves this by verifying the code really came from the developer. While this doesn't protect you from a malicious developer, it at least brings the security of the web app to a similar level to that of native apps.

## How does it work?

Developers sign their web pages using their secure PGP key **before** uploading the pages to the server (for example, on their development machine).
Users add a website's configuration (paths and matching publickey), if not already present.
Then, every time the users access the website, the extension will indicate if the HTML pages are correctly signed, and thanks to subresource-integrity, also verify the integrity of external resources.

# Usage

## Installation

The official extensions represent the current stable release.

- [Chrome extension](https://chrome.google.com/webstore/detail/signed-pages/pdhofgeoopaglkejgpjojeikbdmkmkbp)
- [Firefox extension](https://addons.mozilla.org/addon/signed-pages/)

Opera users can [enable Chrome extensions](https://addons.opera.com/extensions/details/download-chrome-extension-9/) and then install the [Chrome extension](https://chrome.google.com/webstore/detail/signed-pages/pdhofgeoopaglkejgpjojeikbdmkmkbp).


## As a user

All you need to do is install the extension, and from its settings page, add patterns to match pages you'd like to verify, and their corresponding publisher's public key. The developers of those websites must have their pages signed for this extension to work.

Users with the browser extension configured will then see a green shield icon for verified pages, and a red one for pages with a bad or missing signature (assuming they were expected to have one).

For example:

![Good signature](https://stosb.com/blog/signed-web-pages/images/signed-pages/screenshot-good.png)

### Example pages

You can try the following example pages to see how the extension behaves:

Install the extension and add the pattern and pubkey shown in the page from the extension's settings.

* A page with a good signature: https://stosb.com/~tom/signed-pages/good.html
* A page with a bad signature: https://stosb.com/~tom/signed-pages/bad.html
* A page with a missing (but expected) signature: https://stosb.com/~tom/signed-pages/missing.html

## As a developer

The signatures are specified in html `<meta>` tags with the name `signature` within the document `<head>`.  There are two types of signatures available: one over the whole document, and one over a minimized version.  The signature over the minimized version helps with cross compatiblility accross different browsers.  The whole document signatures may be more secure, but only works with browsers that support `filteredResponseData` (Currently only Firefox).  Both types of signatures can be included in a document.

The `content` of the `signature` `<meta` tag are name-value pairs separated by commas.  The fields are:
 - type - *required*: (`pgp` or `pgp_minimized`)
 - version - *required* - ( major.minor.patch )
 - signature - *required* - (the actual armored gpg signature)
 - allowedMethods - *optional* - Space seperated list of (`filteredResponseData`, `outsideHTML`). 
   - Default: "`filteredResponseData outsideHTML`"

To sign the document, you must include all of content of each signature `<meta>` tag except for the signature itself.  There can be no whitespace between the `signature=` and the next item or end of tag.

Example:
 ```
   <meta name="signature" content="
      type=pgp,
      version=1.0.0,
      allowedMethods=filteredResponseData,
      signature=">
```

For the whole document signature (type `pgp`), all you need to do is sign the document and include the signature in the meta tag.

For the minimized signature (type `pgp_minimized`), you will need to minimize with [minimize](https://github.com/Swaagie/minimize), version 2.1.0, with a specific set of settings. You will then sign this minimized version and include the signature in the original document `<meta>` tag

As you can see, it's a bit involved, so we created a script that does all of this for you. All you need to do is make sure you include specific placeholders as in [example.html](example.html).

And then just run, on a secure machine, preferably with a PGP key on a separate hardware token:

```
# find key id for signing key
$ gpg --list-keys

# Print the signed page to stdout (You will have a different keyid)
$ ./page-signer.js 9C43B88E input.html

# Print the signed page to a file (can be the same as the input file)
$ ./page-signer.js 9C43B88E input.html output.html
```

It's important that all of the external resources to the page (JS and CSS, whether hosted on the same server, or not) will have [subresource integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity) correctly set. This way you only need to sign the html page, and the rest will be automatically validated by the browser, ensuring that all of the scripts and styles used in the page are indeed what you expect.

### A note on dynamic websites

The `page-signer.js` tool above was designed to work with static html files, meaning html files that are not generated on the fly by the server. The reason for that is that for the signing to be most effective, pages need to be signed by the author in advance, and can't be done dynamically by the server.

This is perfect for statically generated websites and blogs using tools such as Pelican and Jekyll, or web apps like that draw their dynamic content through JavaScript such as applications created with React, VueJS, Angular and Ember.

There are some workaronuds to dynamic websites work, by for example including dynamic content that doesn't matter like comments in an `<iframe>`, but those are quite involved and out of scope for this document.

# Supported Sites

Adding support is easy. If you are a user and would like a website to be supported, please contact the site's owner and point them to this readme.

If your site already supports Signed Pages please consider adding the following badge (as a link to your settings) to let your users know about it.

![Signed Pages Badge](graphics/badge.svg)

List of websites that support Signed Pages:
* [EteSync Web App](https://client.etesync.com)

# Building

Setup the environment needed for this extension and `page-signer.js`:

`npm install`

To build the extension for development run:

`npm run-script build`

To build it for deployment run:

`npm run-script package`

# Technical details

On Firefox, this extension relies on [`webRequest.filterResponseData`](https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/webRequest/filterResponseData) which lets it intercept the request and sign the page as transferred by the server, so it can verify the page exactly as sent.

Unfortunately, other browsers don't support this API yet, which means we have to resort to a less clean way of doing it. On other browsers, the extension waits until the DOM has loaded, and just before scripts have been executed to get `document.documentElement.outerHTML`. This means that on these browsers it only has the ability to verify the `<html>` tag and its contents.

What makes matters even worse is that browsers don't return the html as delivered, but may mangle it a bit, which means we have to transform the content into a canonical form before signing (and verifying). This forces us to use a minifier on the html.

Be aware that the minifier may have bugs that can cause a page to pass verification while being different! Unlikely, but possible, so watch out for minifier bugs.

# Versions

All signature types must have a version and they must match the supported versions within this extension.  A version matches if the major and minor numbers match, and the patch level on the page is less than or equal to the supported patch level.  This allows backwards-compatible patches without invalidating previous signatures.  Also, when there is new version, the older version will be supported for time.

Current Supported Versions:
- pgp: 1.0.0
- pgp_minimized: 1.0.0

# Potential attacks

* This extension rejects pages with `<script>` tags outside of the `<html>` tag, so while this could have potentially been an issue, it has been mitigated.

The whole page, other than the doctype is validated in Firefox since it implements `browser.webRequest.filterResponseData`.

Other browsers are implemented slightly differently and may be exposed to similar attacks.

# Known issues

* On Firefox, you may need to refresh a page for the first time after installing the extension if the page was already in cache.

# FAQ

## Can I sign only parts of the page? Or only external JavaScript?

**No you can't.** Verifying only part of a page would be very useful. One could, for example, automatically verify authorship of blog posts. Unfortunately, because of HTML's flexibility, it's not possible.

Let's first take a look at verifying only external JS. The main problem would be that the page itself could have javascript there (or additional unverified external javascript) that can run and do whatever it wants, so this is obviously not safe.
Let's continue with this use case, and just disallow any embedded scripts in the page, or external, unverified javascript. We now have a problem that a malicious server could for example have a div overlay that when clicked triggers javascript.
Let's assume for the sake of discussion that we don't require any inline JS and that, so we can just block all of the inline JS using CSP.

Even with the above solved, an attacker can still for example, modify buttons to be forms, rather than AJAX requests (of if already a form, change the target), which means the data will be sent to an attacker controlled server. This is obviously not good. Another thing an attacker could do, is change your announcements, bitcoin addresses, PGP keys, and a variety of other parts. OK, so allowing changing the HTML is a bad idea.

What about CSS? This can also be problematic! An attacker can hide important text, replace text with malicious text (think again, bitcoin, PGP keys and etc) and probably more issues that I haven't considered.

This is why I verify the whole page an suggest using SRI even for CSS. HTML is very complex, so the attack surface is very wide.

# Attribution

Icons are based on the following icons:

* Shield made by [Smashicons](https://www.flaticon.com/authors/smashicons) and licensed as [CC 3.0 BY](http://creativecommons.org/licenses/by/3.0/)
* Checked made by [Eleonor Wang](https://www.flaticon.com/authors/eleonor-wang) and licensed as [CC 3.0 BY](http://creativecommons.org/licenses/by/3.0/)
* Fingerprint made by [Google](https://www.flaticon.com/authors/google) and licensed as [CC 3.0 BY](http://creativecommons.org/licenses/by/3.0/)
