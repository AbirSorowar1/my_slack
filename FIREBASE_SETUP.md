# Firebase setup

Project: `testing-31984` (change in `.env` / `.firebaserc` to use your own).

> **Check the API key first.** The key in the brief (`AIzaSyCy0yAoWfblZ4XVJrXKvvkhzcmoCAcdFW`) is 38 characters; Firebase web keys are normally 39 and start with `AIza`. It may have lost a character when pasted. Copy the exact value from **Project settings → General → Your apps → SDK setup and configuration** into `.env` (see step 8).

## 1. Enable Google sign-in
Console → **Build → Authentication → Get started → Sign-in method → Google → Enable**, choose a support email, Save.

## 2. Create the Realtime Database
Console → **Build → Realtime Database → Create database**. Pick a location and **start in locked mode** (our rules replace it). Confirm the URL matches `VITE_FIREBASE_DATABASE_URL` (non-US regions look like `https://<project>-default-rtdb.<region>.firebasedatabase.app`).

## 3. Enable Storage
Console → **Build → Storage → Get started**. (Storage now requires the Blaze plan on new projects; the free usage tier still applies.)

## 4. Authorized domains
Authentication → **Settings → Authorized domains**. `localhost` is there by default; add your hosting domain (`<project>.web.app` is added automatically when you use Firebase Hosting).

## 5–6. Deploy rules
```bash
npm install -g firebase-tools
firebase login
firebase use testing-31984        # or your project id
npm run rules:build               # regenerates database.rules.json from scripts/build-rules.mjs
firebase deploy --only database,storage
```
`database.rules.json` is generated; edit `scripts/build-rules.mjs`, not the JSON.

## 7. Indexes
Indexes are declared inside the rules (`.indexOn: ["createdAt"]` for messages, thread replies, files and notifications). Nothing else to configure. If the console logs an "index not defined" warning, re-deploy the rules.

## 8. Run
```bash
cp .env.example .env     # fill in the values from the console
npm install
npm run dev              # http://localhost:5173
```
First run: sign in with Google → create a workspace (a `#general` channel is created for you). Settings → Workspace → *Create starter channels* adds `#announcements` and `#random`.

To test with two people, sign in from a second browser profile with another Google account, then invite that email from **Settings → Workspace → Invitations**; the invitee sees it after signing in.

## 9. Deploy to Firebase Hosting (optional)
```bash
npm run build
firebase deploy --only hosting     # firebase.json already rewrites all routes to index.html
```

## Cloud Functions
None are required. All logic (notifications, unread counters, invitations) is client-side, protected by the security rules. See README → Limitations for what Functions would improve.
