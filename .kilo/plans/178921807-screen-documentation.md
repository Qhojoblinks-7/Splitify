# Screen Documentation

Reference for the screens that exist today. Scope: **group susu only.**

Screens deleted with the split-bill product (`HomeScreen`, `SendMoney`, `RequestMoney`, `TopUp`,
`Withdraw`, `Activity`, `History`, `Settings`, `Security`, `BillingSubscription`, `UpgradePlan`,
`SelectPaymentMethod`, `ContactProfile`, `ContactSupport`, `DeviceManagement`, `ReviewSummary`,
`Congrats`, `profile`, `group/[id]`) are **not coming back.** See `178921950-master-roadmap.md`.

## Component Inventory

### Atoms — `components/atoms/`

| Component | Used On |
|-----------|---------|
| `BaseButton` | Auth landing, Login, CreateAccount, OTP, ForgotPassword, NewPassword, onboarding |
| `CustomInput` | Login, CreateAccount, OTP, ForgotPassword, NewPassword, contribution modal |
| `SkipButton` | Onboarding |
| `NextButton` | Onboarding |

### Molecules — `components/molecule/`

| Component | Used On |
|-----------|---------|
| `SusuGroupCard` | Susu Home |
| `SusuRotationIndicator` | Group Detail |
| `SusuContributionRow` | Group Detail, contribution list |
| `SusuCreateForm` | Create Susu |
| `BottomSheet` | Join with code, log contribution, confirm payout, help contact |
| `EmptyState` | Susu Home (no groups), Activity (no entries), Group Detail (no history) |
| `GrowlToast` / `GrowlDialog` | Global feedback via `context/FeedbackContext.jsx` |

## Screens

### Navigation

```
app/_layout.jsx                    Root — providers, feedback context
├── app/onboarding.jsx            3-slide intro, first launch only
├── app/Auth/                      Auth flow (unauthenticated)
│   ├── Auth.jsx                   Landing: social buttons, sign in / sign up
│   ├── Login.jsx
│   ├── CreateAccount.jsx
│   ├── ForgotPassword.jsx  →  NewPassword.jsx
│   └── OTP.jsx
├── app/(tabs)/_layout.jsx         Tab navigator
│   ├── index.jsx                  Susu Home          → /susu/[id]
│   ├── activity.jsx               Activity feed
│   └── account.jsx                Account
├── app/susu/create.jsx            Create group       → /susu/[id]
├── app/susu/[id].jsx              Group Detail — the core flow
└── app/AboutUs · HelpSupport · PrivacyPolicy · TermsOfService
```

### Screen States

Every screen must define all three:

| State | Requirement |
|-------|-------------|
| **Loading** | Skeleton, not a spinner, for group lists. Group detail must not render a rotation until data arrives — showing the wrong receiver is worse than showing nothing |
| **Empty** | No groups → explain susu in one sentence + "Create your first group". No activity → "Nothing yet". No history → "The ledger starts at the first contribution" |
| **Error** | Message + retry. Offline → "Saved offline" for queued writes, not an error |

### Susu Home — `app/(tabs)/index.jsx`

```
SusuHome
├── Brand header
├── Due contributions card    overdue / due today / due soon
├── Summary                   active susus · weekly pot
├── "My Susu Groups"
│     └── SusuGroupCard x N   name, round, next receiver, pot, status
└── BottomSheet: Join with code
```

### Group Detail — `app/susu/[id].jsx`

**The core screen. Everything in the app serves this.**

```
SusuGroupDetail
├── Pot card                    collected vs remaining this round
├── Receiver banner            who collects this round
├── Contribution modal          amount · provider · reference
├── Rotation                   SusuRotationIndicator
├── Admin actions
│     Release pot · Close round · Add member · Restart cycle · End group
├── Member list                 incl. missed-share debtors
├── Activity ledger             contributions + payouts
└── Admin trust score
```

### Activity — `app/(tabs)/activity.jsx`

All contributions and payouts across the user's groups. Filters: **All / Contributions / Payouts /
Needs attention.** "Needs attention" is the retention surface — a group that opens the app to this
tab is a group about to churn.

## Deep Links

| Trigger | Deep link | Opens |
|---------|-----------|-------|
| Push — your turn is next | `growl://susu/:groupId` | Group Detail |
| Push — contribution verified | `growl://susu/:groupId` | Group Detail |
| Push — missed share recorded | `growl://susu/:groupId` | Group Detail |
| Invite link from WhatsApp | `growl://join/:code` | Join flow |
| Cold launch | — | Onboarding (first run) or Susu Home |

Scheme is `growl://`, matching `app.json`.

## Auth Guard Matrix

| Screen | Auth required | Notes |
|--------|---------------|-------|
| Onboarding | No | First launch only, then skipped |
| Auth landing, Login, CreateAccount, ForgotPassword, OTP, NewPassword | No | Unauthenticated only |
| AboutUs, PrivacyPolicy, TermsOfService, HelpSupport | No | Public |
| Susu Home, Activity, Account | **Yes** | Redirect to Login |
| Create Susu, Group Detail | **Yes** | Plus group membership for Detail |

**Current state: every auth handler is a stub.** Login, CreateAccount, OTP and the reset flow all
navigate without calling an API. `services/susu.js` hardcodes `CURRENT_USER_ID = "u1"`. Real auth
is Phase 1 of the roadmap.

## Known Gaps in the UI

| Gap | Impact |
|-----|--------|
| No loading skeletons | Lists render empty before data arrives — reads as "no groups" |
| No offline indication | A queued contribution looks identical to a sent one |
| No statement export | Required by the institutional tier; table stakes for competitors |
| No WhatsApp receipts | The best single UX idea in this market (MySusuApp) — not built |
| `account.jsx` is static | Profile is hardcoded "John Doe / john@example.com" |
| Help contact form sends nothing | Shows a local success alert |
| `NewPassword.jsx` routes to `/HomeScreen` | **Broken route** — that screen was deleted |
| Google / Apple buttons empty | `onPressGoogle` and `onPressApple` have no handlers |