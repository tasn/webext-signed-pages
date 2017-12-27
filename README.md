# Signed Pages

A browser extension to verify the authenticity (PGP signature) of web pages.

# Why?

This extension was originally created to improve the security of the [EteSync web app](https://www.etesync.com). One of the biggest issues with securing web applications is the fact that the app (JavaScript) is delivered to you every time you open the page. This means that a malicious (or compromised) web server could change the code to steal your supposedly client-side-only and secure data.

This extension solves this by verifying the code really came from the developer. While this doesn't protect you from a malicious developer, it at least brings the security of the web app to a similar level to that of native apps.

# Usage

## Installation

The official extensions represent the current stable release.

- [Chrome extension](https://chrome.google.com/webstore/detail/signed-pages/pdhofgeoopaglkejgpjojeikbdmkmkbp)
- [Firefox extension](https://addons.mozilla.org/addon/signed-pages/)

Opera users can [enable Chrome extensions](https://addons.opera.com/extensions/details/download-chrome-extension-9/) and then install the [Chrome extension](https://chrome.google.com/webstore/detail/signed-pages/pdhofgeoopaglkejgpjojeikbdmkmkbp).


## As a user

All you need to do is install the extension, and from its settings page, add patterns to match pages you'd like to verify, and their corresponding publisher's public key. The developers of those websites must have their pages signed for this extension to work.

### Example pages

You can try the following example pages to see how the extension behaves:

Install the extension and add the pattern and pubkey shown in the page from the extension's settings.

* A page with a good signature: https://stosb.com/~tom/signed-pages/good.html
* A page with a bad signature: https://stosb.com/~tom/signed-pages/bad.html
* A page with a missing (but expected) signature: https://stosb.com/~tom/signed-pages/missing.html

## As a developer

You need to add a comment at the top of the html file (right after the doctype if exists) that contains the detached PGP signature of the content of the `<html>` tag after it has been minified with [minimized](https://github.com/Swaagie/minimize) with a specific set of settings.

As you can see, it's a bit involved, so we created a script that does all of this for you. All you need to do is make sure you have a comment at the top of the file that contains the special replace tag like in [example.html](example.html).

And then just run:

```
# Print the signed page to stdout
$ ./page-signer.js input.html

# Print the signed page to a file (can be the same as the input file)
$ ./page-signer.js input.html output.html
```

It's important to have all of the script tags in the page included with [subresource integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity) correctly set. This way you only need to sign the html page, and the rest will be automatically validated by the browser, ensuring that all of the scripts and styles used in the page are indeed what you expect.

# Building

Setup the environment needed for this extension and `page-signer.js`:

`npm install`

To build the extension for development run:

`npm build`

To build it for deployment run:

`npm package`

# Technical details

This extension verifies the content of the minified `<html>` tag because getting the page's source as downloaded without extra white-spaces or other changes is currently impossible across browsers other than Firefox. This will change once `browser.webRequest.filterResponseData` is properly supported by browsers, but until then, this is what we are stuck with.

We therefore have to normalise `<html>`'s content, and the best way to do that is to just minify it. Be aware that the minifier may have bugs that can cause a page to pass verification while being different! Unlikely, but possible, so watch out for minifier bugs.

# Potential attacks

* This extension rejects pages with `<script>` tags outside of the `<html>` tag, so while this could have potentially been an issue, it has been mitigated.

The whole page, other than the doctype is validated in Firefox since it implements `browser.webRequest.filterResponseData`.

Other browsers are implemented slightly differently and may be exposed to similar attacks.

# Known issues

* The page action (badge showing the validity) disappears on Firefox when navigating back/forward.

# Attribution

Icons are based on the following icons:

* Shield made by [Smashicons](https://www.flaticon.com/authors/smashicons) and licensed as [CC 3.0 BY](http://creativecommons.org/licenses/by/3.0/)
* Checked made by [Eleonor Wang](https://www.flaticon.com/authors/eleonor-wang) and licensed as [CC 3.0 BY](http://creativecommons.org/licenses/by/3.0/)
* Fingerprint made by [Google](https://www.flaticon.com/authors/google) and licensed as [CC 3.0 BY](http://creativecommons.org/licenses/by/3.0/)
