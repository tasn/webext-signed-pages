# Changelog

## Version 0.5.0
* Add pim.etesync.com to the list of default signatures

## Version 0.4.2
* Downgrade openpgp which made the plugin stop working

## Version 0.4.1
* Abort signature verification earlier if url not in patterns
  * This should fix broken downloads in some cases (#17)
* Update some dependencies

## Version 0.4.0
* Add support for multiple sites per key.
* Add a default configuration to help users bootstrap their list of trusted websites.

## Version 0.3.0
* Switch from regex pattern matching to the simpler, browser native match patterns

## Version 0.2.2
* Fix issues with Firefox not showing the pageAction icon when the page is loaded from cache (memory or disk).

## Version 0.2.1
* Set minimum Firefox version to 57


## Version 0.2.0
* Fix the extension on Firefox and switch to the more robust filterResponseData there.
* Switch to pageAction from browserAction to show the action in the url.

## Version 0.1.1
* Fix types in manifest

## Version 0.1.0
* Initial release
