# Magic Algorand Extension Opt in Transaction Bug

## 🧩 Steps to Reproduce

1. Clone [this repo](https://github.com/techtree-dev/magic-algo-optin-bug)
2. Add a test email in `index.ts`
3. `npm install && npm run dev`
4. Click on "Login With Magic!" => Wait until the address displays, I did not add a loader.
5. Try signing an opt in Tx with a mock account
6. Try signing an opt in Tx with Magic => Crashes
