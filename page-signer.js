#!/usr/bin/env node
/* eslint-env node */
/* eslint-disable no-console */

const fs = require('fs');
const child_process = require('child_process');
const Minimize = require('minimize@2.1.0');

function errorAbort(text) {
  console.error(text);
  process.exit(1);
}

function getSignature(content, keyid, callback) {
  const tmpfile = `/tmp/${process.pid}`;
  fs.writeFileSync(tmpfile, content, 'utf-8');
  const gpg = child_process.spawnSync('gpg', ['--armor', '--output', '-', '--local-user', keyid, '--detach-sign', tmpfile], {
    stdio: [
      0,
      'pipe',
    ]
  });

  fs.unlink(tmpfile, () => {});
  const signature = gpg.stdout.toString();
  if (callback) 
    callback(signature);
  return signature;
}

function getPublicKey( keyid, callback) {
  const gpg = child_process.spawnSync('gpg', ['--armor', '--output', '-', '--export', keyid], {
    stdio: [
      0,
      'pipe',
    ]
  });
  const key = gpg.stdout.toString();
  if (callback)
    callback(key);
  return key;
}

let args = process.argv.slice(2);

const keyid = args.shift();
const filename = args.shift();
const outfile = args.shift();

if (!filename || !keyid) {
  errorAbort(`Usage: ${process.argv[1]} <keyid> <infile> [outfile]`);
}

fs.readFile(filename, 'utf8', (err, data) => {
  if (err) {
    errorAbort(err);
  }

  const key = getPublicKey(keyid);

  // replace public keys
  var out  = data.replace('%%%SIGNED_PAGES_PUBLICKEY%%%',  key);

  // Strip placeholders (and whitespace around them)
  const signed_content = out.replace(/\s*%%%SIGNED_PAGES_PGP_SIGNATURE\w*%%%\s*/g, '');

  console.log(signed_content);

  // Signature of entire document (like pulled from filterResponseData)
  var signature = getSignature(signed_content, keyid);
  out  = out.replace('%%%SIGNED_PAGES_PGP_SIGNATURE%%%', signature);

  // Signature using minimize
  // Minimize and strip the doctype
  const min_content = new Minimize({ spare:true, conditionals: true, empty: true, quotes: true }).parse(signed_content)
    .replace(/^\s*<!doctype[^>]*>/i, '');

  signature = getSignature(min_content, keyid);
  out = out.replace('%%%SIGNED_PAGES_PGP_SIGNATURE_MIN%%%', signature);

  if (outfile) {
    fs.writeFile(outfile, out, 'utf8', (writeErr) => {
      if (writeErr) {
        errorAbort(writeErr);
      }
    });
  } else {
    process.stdout.write(out);
  }
});
