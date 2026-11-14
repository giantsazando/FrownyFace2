# Castle Dracula

A single-page app where you talk with Count Dracula. A small instruct language model voices him, and it runs entirely in the visitor's browser through [Transformers.js](https://github.com/huggingface/transformers.js) 4.3.2. It uses WebGPU when the browser has it and falls back to WebAssembly on the CPU otherwise.

The app is [`index.html`](index.html), plus [`coi-sw.js`](coi-sw.js), a small service worker that speeds up the CPU fallback on GitHub Pages. There's no build step and no server-side code.

## Deploy on GitHub Pages

1. Merge this branch into `main`.
2. In the repository, open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, then select `main` and `/ (root)`.
3. After a minute or two, the site is live at <https://giantsazando.github.io/FrownyFace2/>.

What's set up for Pages:

- **`.nojekyll`** tells Pages to publish the files as they are, with no Jekyll build.
- **`coi-sw.js` makes the CPU fallback multi-threaded.** WebAssembly can only use threads on a cross-origin isolated page, which normally needs `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` headers that Pages can't send. The page installs this service worker only when it has to run on the CPU. The worker adds those two headers to the page and leaves every other request alone, so the first such visit reloads once. In a simulated Pages setup, CPU replies went from about 5 to 12–14 tokens/s. WebGPU visitors never get the service worker.
- **Every resource is CORS-loaded** (Transformers.js and the WASM runtime from jsDelivr, the weights from Hugging Face, and Google Fonts with `crossorigin`), so nothing is blocked once the page is isolated.
- **Storage:** all of an account's Pages sites share the `giantsazando.github.io` origin, and with it one storage quota. The page asks the browser to keep the model (`navigator.storage.persist()`) and warns if the free quota looks too small for the download.
- **Link previews:** the page has a favicon, Open Graph/Twitter tags and [`og-image.png`](og-image.png). The `og:url` and `og:image` tags use the address above, so update them if you add a custom domain.

## Run it locally

Browsers only allow WebGPU, the model cache and service workers on secure pages, so serve the folder over `http://localhost` or `https://`. Opening `index.html` with `file://` gives you none of them.

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Model

**[LFM2.5-350M](https://huggingface.co/LiquidAI/LFM2.5-350M)** by Liquid AI, loaded from Liquid's ONNX export [`LiquidAI/LFM2.5-350M-ONNX`](https://huggingface.co/LiquidAI/LFM2.5-350M-ONNX).

- **Download with WebGPU: 297 MB, once.** The `q4` weights are 293.6 MB, plus a 3.3 MB tokenizer and small configs.
- **Download on the WebAssembly fallback: 729 MB, once.** These are the `fp16` weights, used for two reasons:
  - The browser's WebAssembly runtime has no kernel for `GatherBlockQuantized`, which `q4`, `q4f16` and `q8` all use for the 4-bit embedding table. Those files fail to load on the CPU.
  - Liquid's `q4f32` file (485 MB) avoids that op and does load, but WASM's 4-bit matmuls are slow. In headless Chromium on one thread it decoded about 1 token/s, against about 5.4 tokens/s for `fp16`. A larger one-time download is better than 80-second replies.
- **License:** [LFM Open License v1.0](https://huggingface.co/LiquidAI/LFM2.5-350M/blob/main/LICENSE). It's free to use, including commercially, for organizations under $10M in annual revenue.

It's the smallest model that held Count Dracula's voice when I tested candidates with Transformers.js 4.3.2. Each one got the same in-character probes: a greeting, garlic, "are you an AI / a vampire?", a request to write Python, and a two-turn exchange.

| Model | Download | Result |
| --- | --- | --- |
| SmolLM2-135M-Instruct | 117 MB (q4f16) | Fails. Loops on phrases, writes Python when asked, echoes the instructions. |
| Gemma 3 270M IT | 273 MB (q4f16) | Fails. Turns into third-person narration and writes code. |
| **LFM2.5-350M** | **297 MB (q4)** | **Holds the voice.** Courtly first-person replies, declines modern requests in character, keeps his secret. |
| SmolLM2-360M-Instruct | 276 MB (q4f16) | Fails. Florid, but invents other names for himself and writes code. |
| Qwen2.5-0.5B-Instruct | 490 MB (q4f16) | Fails. Falls back to "How can I help you tonight?" assistant voice. |
| Qwen3.5-0.8B (text) | 489 MB (q4f16) | Never breaks character, but rambles and loses the thread. |

LFM2.5-350M needs two things to stay in character. First, the opening exchange stays in every prompt. Second, a short reminder ("Reply as Count Dracula in 2 to 4 sentences, staying in character.") is added to the newest guest message in the prompt only, never to the stored history. Without the reminder, it still wrote Python when asked.

## How it works

- **Download once.** The "Download model" button fetches the weights from the Hugging Face Hub with a progress bar. Transformers.js stores them in the browser's Cache Storage, so on later visits the button says "Wake the Count (already downloaded)" and the weights load from the cache, not the network.
- **WebGPU first, WASM fallback.** A Web Worker asks for a WebGPU adapter and loads the `q4` model there. If there's no adapter, or the model fails to load or warm up on WebGPU, it loads the `fp16` model on WebAssembly instead. Generation runs in the worker, so the page stays responsive.
- **Stopping a reply.** "Silence" asks the worker to stop after the current token, which works on WebGPU. On WebAssembly, inference never yields to the worker's message queue. So if the reply hasn't stopped within 1.5 s (or 3 token-times on a slow GPU), the page keeps what the Count said, stops the worker and reloads the model from the browser cache.
- **Short memory.** Each request sends only the character prompt, a fixed opening exchange that shows the voice, and the most recent turns. That's at most 8 messages, and they're trimmed oldest-first until the prompt fits in 1,024 tokens. Replies are capped at 140 new tokens.
- **Staying in character.** The system prompt fixes the voice: formal 1890s English, the castle, the wolves, the boyar ancestors. It also tells the model how to deflect modern topics. Small models still drift, so the page strips speaker labels and stage directions and trims a reply cut off mid-sentence.

To change models, edit `CONFIG` at the top of the main `<script>`: `model`, the per-backend `dtype` / `downloadMB` (plus an optional `model_file_name`), and the generation settings.

Count Dracula is from Bram Stoker's *Dracula* (1897), which is in the public domain.
