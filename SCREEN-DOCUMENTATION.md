# Splitify — Screen Documentation

## Atomic Components Inventory

### Atoms
| Component | File | Used On |
|-----------|------|---------|
| `BaseButton` | `components/atoms/BaseButton.jsx` | Auth Landing, Login, CreateAccount, OTP, ForgotPassword, NewPassword |
| `CustomInput` | `components/atoms/CustomInput.jsx` | Login, CreateAccount, OTP, ForgotPassword, NewPassword |
| `SkipButton` | `components/atoms/SkipButton.jsx` | Onboarding |
| `NextButton` | `components/atoms/NextButton.jsx` | Onboarding |

### Molecules
| Component | File | Used On |
|-----------|------|---------|
| `ActivityCard` | `components/molecule/ActivityCard.jsx` | HomeScreen |
| `FriendRow` | `components/molecule/FriendRow.jsx` | Group Detail (future), Profile (future) |
| `BillTotal` | `components/molecule/BillTotal.jsx` | Group Detail (future), HomeScreen (future) |

## Screen States (All Screens)

Every screen must define:
- **Loading state** — What shows while data is being fetched (skeleton, spinner)
- **Empty state** — What shows when there's no data (placeholder, CTA)
- **Error state** — What shows on failure (error message, retry button)

## Deep Link Handling

| Trigger | Deep Link | Opens |
|---------|-----------|-------|
| Push notification (USSD payment received) | `splitify://notification/:id` | Notifications screen |
| Push notification (susu turn) | `splitify://susu/:groupId` | Group Detail screen |
| Payment request link | `splitify://pay/:token` | Request Money flow |
| App launch (cold) | — | Onboarding (first time) or HomeScreen (returning) |

## Auth Guard Matrix

| Screen | Requires Auth | Notes |
|--------|---------------|-------|
| Onboarding | No | Shown once, then skipped |
| Auth Landing | No | Shown when not authenticated |
| Login | No | Part of auth flow |
| Forgot Password | No | Part of auth flow |
| OTP | No | Part of auth flow |
| New Password | No | Part of auth flow |
| Create Account | No | Part of auth flow |
| HomeScreen | Yes | Main dashboard |
| Notifications | Yes | Requires user data |
| Profile | Yes | User-specific data |
| Group Detail | Yes | Requires user membership |
| Susu screens | Yes | User-specific data |
| Savings screens | Yes | User-specific data |

## 1. Onboarding

**File:** `app/onboarding.jsx`
**Route:** `/onboarding` (first launch)

### Purpose
Introductory carousel that explains Splitify's value proposition before authentication.

### What Goes Into It
- **3-slide FlatList** (horizontal, paging enabled)
  - Slide 1: "Seamless Payments, Effortless Splits" — bill splitting basics
  - Slide 2: "Share Bills, Share Moments" — group expenses, trips, shared activities
  - Slide 3: "Stay Connected, Split Confidently" — reminders, notifications
- **Color-coded placeholder circles** per slide (red, green, blue)
- **Pagination indicators** (dots, expands when active)
- **Skip button** (left side) → routes to `/Auth/Auth`
- **Next button** (right side) → advances carousel; on last slide, routes to `/Auth/Auth`
- **Curve SVG divider** between carousel zone and bottom content
- **Dark bottom sheet** with title, description per slide

### Components Used
- `SkipButton` (atom) — left side, routes to `/Auth/Auth`
- `NextButton` (atom) — right side, advances carousel or completes onboarding
- `FlatList` (React Native) — horizontal carousel

### Data Flow
- No API calls; fully static content
- Onboarding state tracked via FlatList `onViewableItemsChanged`

---

## 2. Auth Landing

**File:** `app/Auth/Auth.jsx`
**Route:** `/Auth/Auth`

### Purpose
Main authentication gateway — social sign-in, login, and sign-up entry point.

### What Goes Into It
- **App logo** (centered)
- **Title:** "Let's Get Started"
- **Subtitle:** "With Splitify, splitting bills and expenses is easier than ever before"
- **Social sign-in buttons:**
  - "Continue with Google" (`BaseButton`, secondary variant, GoogleIcon SVG)
  - "Continue with Apple" (`BaseButton`, secondary variant, Apple PNG icon)
- **"or" divider text**
- **Auth buttons:**
  - "Sign Up" (`BaseButton`, primary variant) → routes to `/Auth/CreateAccount`
  - "Login" (`BaseButton`, outline variant) → routes to `/Auth/Login`
- **Footer:** "Privacy Policy | Terms of Service" text links

### Components Used
- `BaseButton` (atom) — x4 instances
- GoogleIcon (SVG asset)
- Apple.png (image asset)

### Data Flow
- No API calls visible; social sign-in handlers are stubbed (`// Handle Google Sign-In logic here`)

### Loading State
- Button press → loading state on button (built into `BaseButton`?)

### Empty State
- N/A

### Error State
- Social sign-in failure → error message (not implemented)

---

## 3. Login

**File:** `app/Auth/Login.jsx`
**Route:** `/Auth/Login`

### Purpose
Email/password authentication with remember-me and forgot password options.

### What Goes Into It
- **App logo**
- **Title:** "Welcome Back!"
- **Subtitle:** "Please login to your account"
- **Email input** (CustomInput with Mail icon, `keyboardType="email-address"`)
- **Password input** (CustomInput with Lock icon, `secureTextEntry`)
- **Remember Me checkbox** (expo-checkbox, gold border)
- **"Forgot Password?" link** → routes to `/Auth/ForgotPassword`
- **Login button** (primary, full width) → routes to `/screens/HomeScreen`

### Data Flow
- Login handler currently hardcoded to navigate to HomeScreen; backend integration needed
- Remember Me state managed via `useState`

---

## 4. Forgot Password

**File:** `app/Auth/ForgotPassword.jsx`
**Route:** `/Auth/ForgotPassword`

### Purpose
Initiates password reset flow by sending OTP to user's email.

### What Goes Into It
- **Title:** "Reset Your Password"
- **Subtitle:** Instructions about OTP delivery
- **Email input** (CustomInput with Mail icon)
- **"Continue" button** (primary, full width) → routes to `/Auth/OTP`

### Data Flow
- Email entered here is passed (implicitly) to OTP screen for verification

### Loading State
- Button press → loading state (no async loading — no backend call)

### Empty State
- N/A (form-based screen)

### Error State
- Invalid credentials → error message (not implemented)

---

## 5. OTP Verification

**File:** `app/Auth/OTP.jsx`
**Route:** `/Auth/OTP`

### Purpose
4-digit OTP code entry for password reset or account verification.

### What Goes Into It
- **Title:** "OTP Code Verification"
- **Subtitle:** Shows masked email ("we have sent an OTP code to your email and*******lay@gmail.com")
- **4 OTP input boxes** (CustomInput, `keyboardType="number-pad"`, `maxLength={1}`, centered text)
- **Resend timer:** "Didn't receive email? You can resend code in 55s"
- **"Verify" button** (primary, full width) → routes to `/Auth/NewPassword`

### Data Flow
- Each input box accepts 1 digit; maxLength=1 enforces single-character entry
- OTP verification handler stubbed (`// Handle code submission logic here`)

---

## 6. New Password

**File:** `app/Auth/NewPassword.jsx`
**Route:** `/Auth/NewPassword`

### Purpose
Set a new password after OTP verification.

### What Goes Into It
- **Title:** "Create new password"
- **Subtitle:** "You're almost there! Please create a new password for your Splitify account."
- **New Password input** (CustomInput, Lock icon, secure entry, right icon)
- **Confirm New Password input** (CustomInput, Lock icon, secure entry, right icon)
- **"Continue" button** (primary, full width) → routes to `/HomeScreen`

### Data Flow
- Password validation (match, strength) not implemented; handler hardcoded

---

## 7. Create Account

**File:** `app/Auth/CreateAccount.jsx`
**Route:** `/Auth/CreateAccount`

### Purpose
New user registration with email, password, and terms agreement.

### What Goes Into It
- **Title:** "Create Account"
- **Subtitle:** "Please enter your email and password to sign up"
- **Email input** (CustomInput, Mail icon)
- **Password input** (CustomInput, Lock icon, secure entry)
- **Confirm Password input** (CustomInput, Lock icon, secure entry)
- **Terms checkbox:** "I agree to Splitify Terms & Policies" (expo-checkbox, gold border)
- **Divider line** (1px gray)
- **"Already have an account? Sign In"** link → routes to `/Auth/Login`
- **"Sign Up" button** (primary, full width) → routes to `/screens/HomeScreen`

### Data Flow
- All fields controlled via `useState`
- Agreement toggle managed via `useState`
- Sign-up handler hardcoded to navigate to HomeScreen

---

## 8. HomeScreen

**File:** `app/screens/HomeScreen.jsx`
**Route:** `/screens/HomeScreen`

### Purpose
Main dashboard — balance display, quick actions, and recent activity.

### What Goes Into It

**Fixed Top Section (yellow background #fbb81c):**
- **Header:** Logo image (left), notification bell icon (right) → routes to `/screens/Notifications`
- **Balance display:** "1,250.00 GHC" (large), "Current Balance" label
- **Action buttons (5 circular icons in row):**
  - **Send** (Send icon) → routes to `/SendMoney` (not built)
  - **Request** (Download icon) → routes to `/RequestMoney` (not built)
  - **Top** (Upload icon) → routes to `/TopUp` (not built)
  - **Withdraw** (LogOut icon) → routes to `/Withdraw` (not built)
  - **History** (Clock icon) → routes to `/History` (not built)

**Scrollable Activity Section (dark background):**
- **Header:** "Activity" title + "View All" link → routes to `/Activity` (not built)
- **ActivityCard list** (4+ hardcoded items, ScrollView):
  - Each card: title, amount, recipient/sender name, status (pay/request/paid)
  - Status determines: subtext, color (red=owe, gold=owed to you, gray=settled), button label (Pay/Remind/Paid)
  - Pressable action button → logs to console + updates status

### Data Flow
- Balance hardcoded ("1,250.00 GHC")
- Activity items hardcoded for demo
- All navigation routes lead to unbuilt screens

### Components Used
- `ActivityCard` (molecule) — x4+ instances
- `BaseButton` (atom) — potentially for actions
- Lucide icons: Send, Download, Upload, Clock, Bell, LogOut

### Loading State
- Not implemented. On API integration, show spinner while fetching balance and activity.

### Empty State
- No activity items → "No activity yet" + icon, CTA "Start by sending or requesting money"

### Error State
- API failure → "Something went wrong" + retry button

---

## 9. Notifications

**File:** `app/screens/Notifications.jsx`
**Route:** `/screens/Notifications`

### Purpose
Displays user notifications organized by time period.

### What Goes Into It
- **Header:** "Notifications" title, Settings gear icon → routes to `/Settings` (not built)
- **Notification list** (ScrollView):
  - **Time frame section:** "Today" header with divider line
  - **Notification item:**
    - Icon (SquareExclamationPoint, gold color)
    - Title: "New Feature Available!"
    - Description: "Check out the new Splitify feature..."
  - Items are swipeable (mentioned in code comments, not implemented)
- **Dark theme** (#16171b background)

### Data Flow
- Notifications are hardcoded for demo; would be fetched from API in production
- Settings icon navigates to non-existent `/Settings` route

### Known Issues
- Typo: `stlye` instead of `style` on line 33 and 34 (notification item and time frame)
- `notificationsTimeFrame` style applied to wrong element

---

## 10. Profile (Tab)

**File:** `app/(tabs)/profile.jsx`
**Route:** `/profile` (tab target)

### Purpose
User profile management, savings, and group overview.

### What Will Go Into It (Future)
- **User info:** Avatar, name, email, phone number
- **Linked phone number:** Shows linked number, "Link for USSD" CTA (see [USSD Plan](USSD-PAYMENT-INTEGRATION.md))
- **Savings Pockets section:** List of savings pockets with progress bars (see [Savings Plan](SAVINGS-POCKETS.md))
- **Susu groups section:** List of susu groups user belongs to (see [Group Susu Plan](GROUP-SUSU.md))
- **Settings links:** Notifications, Privacy, Currency, Language
- **Theme toggle** (Dark/Light)
- **Logout button**
- **App version info**

### Loading State
- Profile skeleton while fetching user data

### Empty State
- New user → "Complete your profile" CTA

### Error State
- API failure → "Failed to load profile" + retry button

---

## 11. Home Tab

**File:** `app/(tabs)/index.jsx`
**Route:** `/` (default tab route)

### Purpose
Home tab in the tab navigator — currently empty stub that will contain the HomeScreen.

### What Will Go Into It (Future)
- Renders `app/screens/HomeScreen.jsx` content
- Currently has only a React import

### Data Flow
- No implementation yet; empty file

---

## 12. Group Detail

**File:** `app/group/[id].jsx`
**Route:** `/group/:id`

### Purpose
Displays a specific group's details, bills, balances, and susu (if applicable).

### What Will Go Into It (Future)
- Group name, icon, description
- Group members list (with roles)
- Group balances (who owes whom) — displayed as simplified net balances
- Group expenses/bills list (like ActivityCard for groups)
- "Add Expense" button (not yet implemented)
- Susu section (if group has active susu — see [Group Susu Plan](GROUP-SUSU.md))

### Data Flow
- `[id]` is dynamic route parameter fetched from API
- No implementation yet; empty file

### Components Used (Future)
- `ActivityCard` (molecule) — for group expenses
- `BillTotal` (molecule) — currently empty, for group totals
- `FriendRow` (molecule) — currently empty, for member list

### Loading State
- Skeleton while fetching group data

### Empty State
- New group → "No expenses yet" + "Add your first expense" CTA

### Error State
- Group not found → "Group not found" + back button

---

## 13. Settings (Referenced)

**File:** Does not exist yet
**Route:** `/Settings` (referenced from Notifications)

### Purpose
App settings and preferences.

### What Will Go Into It
- Profile editing
- Notification preferences
- Currency settings
- Language settings
- Theme toggle (Dark/Light)
- Biometric lock toggle
- Change password
- Delete account
- Terms of Service / Privacy Policy links
- App version

### Data Flow
- Referenced in Notifications.jsx line 21: `router.push('/Settings')`
- Route not registered in `app/_layout.jsx`

---

## 14. Send Money (Referenced)

**File:** Does not exist yet
**Route:** `/SendMoney` (referenced from HomeScreen)

### Purpose
Money transfer to another user.

### What Will Go Into It
- Recipient selector (search by phone/name)
- Amount input
- Note/description
- Confirm button
- Transaction processing

### Data Flow
- Referenced in HomeScreen.jsx line 13: `router.push('/SendMoney')`

---

## 15. Request Money (Referenced)

**File:** Does not exist yet
**Route:** `/RequestMoney` (referenced from HomeScreen)

### Purpose
Request money from another user.

### What Will Go Into It
- Similar to Send Money but reversed flow
- Request amount, description
- Send request to recipient

### Data Flow
- Referenced in HomeScreen.jsx line 14

---

## 16. Top Up (Referenced)

**File:** Does not exist yet
**Route:** `/TopUp` (referenced from HomeScreen)

### Purpose
Add money to user's balance (mobile money deposit).

### What Will Go Into It
- Amount input
- Mobile money provider selection
- Payment processing

### Data Flow
- Referenced in HomeScreen.jsx line 15

---

## 17. Withdraw (Referenced)

**File:** Does not exist yet
**Route:** `/Withdraw` (referenced from HomeScreen)

### Purpose
Withdraw money from balance to mobile money or bank.

### What Will Go Into It
- Amount input
- Destination (mobile money/bank)
- Processing

### Data Flow
- Referenced in HomeScreen.jsx line 16

---

## 18. History (Referenced)

**File:** Does not exist yet
**Route:** `/History` (referenced from HomeScreen)

### Purpose
Transaction history / financial records.

### What Will Go Into It
- List of all transactions (sent, received, top-up, withdraw)
- Filter by date/type
- Pagination

### Data Flow
- Referenced in HomeScreen.jsx line 17

---

## 19. Activity (Referenced)

**File:** Does not exist yet
**Route:** `/Activity` (referenced from HomeScreen)

### Purpose
Full activity feed (expanded version of HomeScreen's activity section).

### What Will Go Into It
- Complete transaction history
- Filter/sort options
- Activity cards (same as HomeScreen but full list)

### Data Flow
- Referenced in HomeScreen.jsx line 18

---

## Navigation Reference

### App Tab Navigator
```
/ (Home Tab → renders HomeScreen)
/profile
```

### Auth Flow
```
/onboarding → /Auth/Auth (first launch only)
/Auth/Auth → /Auth/Login
/Auth/Auth → /Auth/CreateAccount
/Auth/Auth → /Auth/ForgotPassword → /Auth/OTP → /Auth/NewPassword
```

### App Stack
```
/screens/HomeScreen → /screens/Notifications
/screens/HomeScreen → /SendMoney (not built)
/screens/HomeScreen → /RequestMoney (not built)
/screens/HomeScreen → /TopUp (not built)
/screens/HomeScreen → /Withdraw (not built)
/screens/HomeScreen → /History (not built)
/screens/HomeScreen → /Activity (not built)
/group/:id
```

### USSD Navigation
```
*123# → Main menu → Balance / Settle Debt / Request Money
```

### USSD Registration Flow
```
*123# → Register → Name → Phone → MPIN Setup → Complete
*123# → I have an account → Phone → MPIN → Main Menu
```
