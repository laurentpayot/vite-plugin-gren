# vite-plugin-gren

This plugin is based on [hmsk/vite-plugin-elm](https://github.com/hmsk/vite-plugin-elm). It enables you to compile a [Gren](https://gren-lang.org/) application/document/element on your [Vite](https://github.com/vitejs/vite) project. [Hot module replacement](https://vitejs.dev/guide/features.html#hot-module-replacement) works roughly in development.

## Setup

*For now,* install the plugin directly from GitHub (works with npm, yarn and pnpm):

```
npm i -D github:laurentpayot/vite-plugin-gren
```

Update `vite.config.(js|ts)`:

```ts
import { defineConfig } from 'vite'
import grenPlugin from 'vite-plugin-gren'

export default defineConfig({
  plugins: [grenPlugin()]
})
```

Then you can start Gren in your main Vite script:

```ts
import { Gren } from './Main.gren'

// Mount "Hello" Browser.{element,document} on #root
Gren.Main.init({
  node: document.getElementById('root'),
  flags: "Initial Message"
})
```

See this [counter web app](https://github.com/laurentpayot/gren-counter-web-app) example repository to play with an actual Vite project using Gren.

## Plugin Options

See the original [Elm plugin README](https://github.com/hmsk/vite-plugin-elm#plugin-options).

## Acknowledgement

- [hmsk/vite-plugin-elm](https://github.com/hmsk/vite-plugin-elm) for the original Elm plugin
- [gabriela-sartori/vite-plugin-gren](https://github.com/gabriela-sartori/vite-plugin-gren) for the Gren conversion idea
- [klazuka/elm-hot](https://github.com/klazuka/elm-hot) for a helpful referrence of the HMR implementation
- [ChristophP/elm-esm](https://github.com/ChristophP/elm-esm/issues/2) for publishing IIFE -> ESM logic

## License

[MIT](/LICENSE)
