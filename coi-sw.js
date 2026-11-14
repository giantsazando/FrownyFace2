// Cross-origin isolation for static hosts that can't send custom headers (GitHub Pages).
//
// Multi-threaded WebAssembly needs SharedArrayBuffer, which browsers only allow on pages served
// with COOP/COEP headers. This service worker adds those two headers to the page itself and
// leaves every other request alone. index.html registers it only when the model has to run on
// the CPU (WebGPU doesn't need it). Its scope is this folder, so other sites on the same
// github.io origin are unaffected.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).then((response) => {
      // Redirects (e.g. /FrownyFace2 -> /FrownyFace2/) and network errors pass through untouched.
      if (response.type === "opaqueredirect" || response.status === 0) return response;
      const headers = new Headers(response.headers);
      headers.set("Cross-Origin-Opener-Policy", "same-origin");
      headers.set("Cross-Origin-Embedder-Policy", "require-corp");
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }),
  );
});
