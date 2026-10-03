# Growl

**Grow Your Wealth Together**

Growl is a mobile app for one thing: running a group susu — the rotating savings group common
across Ghana and West Africa. Everyone in the circle contributes a set amount each week, and
each member takes the full pot in turn.

## What Growl does

- **Create a susu group** — set the group name, the pot per round, the collection day, and the members in rotation order.
- **Fixed weekly rotation** — every member knows whose turn it is and when.
- **Contributions** — members log what they paid, the mobile money they used, and the transaction reference.
- **Verification before payout** — a pot is only released once every contribution for the round is verified.
- **Payouts with failure handling** — the pot goes to the collector's mobile money; a rejected transfer can be retried without losing the round.
- **Miss policy** — one free skip, the missed share carries forward, and a second miss removes a member from the rotation.
- **Admin accountability** — a trust score drops with each fake transaction, and two flags revoke the admin's privileges.
- **Group history** — every contribution, payout, and missed share stays visible to all members.

## Running the tests

```bash
npm test
```

## Tech Stack

- **Framework**: React Native with Expo (SDK 57)
- **Routing**: Expo Router
- **State**: Zustand
- **UI**: Lucide React Native icons
- **Platforms**: iOS, Android, Web

## Prerequisites

- Node.js (LTS)
- npm or yarn
- Expo CLI: `npm install -g expo-cli`

## Installation

```bash
git clone https://github.com/Qhojoblinks-7/growl.git
cd growl
npm install
```

## Running the app

```bash
npm start     # start the dev server
npm run ios   # iOS simulator
npm run android
npm run web
```

## Project Structure

```
growl/
├── app/
│   ├── (tabs)/          # Susu · Activity · Account
│   ├── Auth/            # Sign in / sign up / password flows
│   ├── susu/            # Create group, group detail
│   ├── onboarding.jsx
│   └── _layout.jsx
├── components/
│   ├── atoms/           # Buttons and inputs
│   └── molecule/        # BottomSheet, EmptyState, Susu cards, SusuCreateForm
├── services/
│   ├── susu.js          # Susu rules: rotation, pot, misses, validation
│   └── directory.js     # Member search
├── store/susu.js        # Susu state and actions
├── __tests__/           # Domain rule and store tests
└── app.json             # Expo config
```

## Current State

The app is currently front-end only. Susu groups, contributions, and payouts run against
in-memory mock data in `store/susu.js`, and are covered by 57 domain tests. The next step
is wiring those store actions to the backend endpoints and mobile money provider
verification described in `.kilo/plans/178921725-group-susu.md`.

## License

Open source, available for public use.

---

**Built by Qhojoblinks-7**