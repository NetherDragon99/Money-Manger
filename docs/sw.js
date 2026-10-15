/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-7e5eb42b'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "registerSW.js",
    "revision": "402b66900e731ca748771b6fc5e7a068"
  }, {
    "url": "index.html",
    "revision": "d86662a6a17f0b556b853c9045e8a61c"
  }, {
    "url": "404.html",
    "revision": "3b690c463c1d81af9da7cf2217aa4d2a"
  }, {
    "url": "assets/index-DVSVI7o6.js",
    "revision": null
  }, {
    "url": "assets/index-Ccq3ZMTO.css",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "ac0e6bce480cd902d7bdd58fbbf32ed9"
  }, {
    "url": "favicon.png",
    "revision": "629452f3d3db0cbc5046ccde036a0f56"
  }, {
    "url": "icon.svg",
    "revision": "30604d824c062dd5c31797132d8c4616"
  }, {
    "url": "pwa-192x192.png",
    "revision": "dab6ba5aebbaf584d5b83b41fab5af40"
  }, {
    "url": "pwa-512x512.png",
    "revision": "716a23857593e0449441cef337bed093"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "716a23857593e0449441cef337bed093"
  }, {
    "url": "manifest.webmanifest",
    "revision": "d505f7ce1d67c0211df0a03b408fc1ba"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));

}));
