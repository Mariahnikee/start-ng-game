# Game Creator Copilot (unofficial start.ng prototype)

A standalone web prototype, inspired by [start.ng](https://start.ng), that helps a non-technical person go from a game idea to a playable browser game that's ready for start.ng.
start.ng's source code isn't public, so this is a separate project. It does **not** change the real start.ng site.

> **Demo mode.** The copilot answers from built-in rules (`src/agent/`), not an AI model. It never contacts start.ng or any other server, and it never publishes anything.

## The flow
1. **Describe:** type an idea, or pick one of the examples. Empty, too short, too long and unreadable input each get a clear message.
2. **Plan:** you get the game loop, controls, mechanics, look, start.ng categories and the steps to get there.
3. **Play & refine:** a real playable canvas game runs in a sandboxed frame. Ask for changes such as speed, lives, player size, theme, game type or title.
   - You see a before/after table and can play the proposed version.
   - Nothing changes until you **Accept**. Every accepted change is kept as a version you can go back to.
4. **Publish:**
   - A local copy of start.ng's checks runs on the game.
   - You can download `index.html`, `startng.json` and `cover.png`.
   - Before anything else happens, a confirmation dialog explains what publishing really does.
   - In demo mode, confirming only **prepares** the request to `api.start.ng` and shows the next steps. Nothing is sent.

Working states throughout: progress steps, errors with **Try again**, and a footer switch that makes the copilot's next answer fail, for testing. Your draft is saved in this browser. It works in light and dark themes, with the keyboard, and on phones down to 320px.

## Develop
```bash
npm install
npm run dev      # http://localhost:5173
npm test         # Vitest unit tests
npm run build    # outputs dist/
npm run preview  # serves dist/ at http://localhost:4173
```

## Deploy to Netlify
`netlify.toml` already sets the build command (`npm run build`), the publish folder (`dist`), Node 20, the SPA redirect and the headers.
- **Git:** push this folder to a GitHub repo. In Netlify, choose **Add new site → Import an existing project** and pick the repo. The settings are read from `netlify.toml`.
- **CLI:** `npx netlify-cli deploy --build` for a draft URL, then `npx netlify-cli deploy --build --prod`.
- **Drag and drop:** run `npm run build`, then drop the `dist/` folder onto app.netlify.com/drop.

## Swapping in a real agent
`src/agent/index.js` is the only boundary the UI talks to: `createPlan`, `buildPrototype`, `requestChange` and `runChecks`. Each one reports progress and throws `AgentError`. To use a real model, call your own backend (for example a Netlify Function that holds the API key) from these functions. Never put keys in the frontend.

## Known limitations
- No real AI. The copilot only understands the change types listed above and says so when it can't do something.
- Four game types and six themes. The generated games are simple.
- The checks are a partial local copy. The real `POST https://api.start.ng/games/check` is the one that counts.
- The prototype doesn't use the start.ng Kit or player character yet. The checks flag this as `no_start_ng_player`.
- Downloads are separate files, not a zip.
- Drafts live in `localStorage`, on this browser only.
