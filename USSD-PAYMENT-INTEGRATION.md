# USSD Payment Integration — Implementation Plan

## Context

Splitify currently serves smartphone users via the React Native/Expo app. In Ghana, a significant portion of the target market uses feature phones and relies on USSD (e.g., `*123#`) for mobile money. This plan adds a USSD channel so non-app users can check balances, see debts, and settle payments via phone number + MPIN.

## Decisions Resolved

| Decision | Choice |
|----------|--------|
| Backend | Extend existing Django API (new `/ussd/` router) |
| USSD Gateway | Africa's Talking (API) + Ghana telco (mobile money) |
| Account linking | Existing app users link phone number; new users register via USSD |
| USSD scope | Core only: check balance, settle debt, request money |
| Auth | Phone number + MPIN (set during USSD registration) |
| Mobile money | MTN MoMo + Vodafone Cash |
| Real-time sync | FCM push notifications when USSD action affects app user; DB updated instantly |
| Error handling | Pending on timeout, retry/cancel on payment failure, expire on network drop |
| Testing | Mock AT API for unit tests, AT sandbox for E2E |

## USSD Menu Flow

```
Dial *123#
  ├── 1. Check Balance
  │     └── Shows total balance + split amounts
  ├── 2. Settle Debt
  │     ├── Select group/debtor
  │     ├── Enter amount
  │     ├── Select mobile money (MTN MoMo / Vodafone Cash)
  │     ├── Enter MPIN
  │     └── Confirm → Success/Failure
  └── 3. Request Money
        ├── Enter debtor phone number
        ├── Enter amount + description
        └── Confirm → Request sent
```

New USSD registration flow (first-time users):
```
Dial *123# → "Welcome to Splitify"
  ├── 1. Register → Enter name, phone, set MPIN (6 digits)
  └── 2. I already have an account → Enter phone, verify, set MPIN
```

## Backend Changes (Django)

### New Models

```python
# ussd/models.py
class USSDSession(models.Model):
    """Tracks an active USSD session lifecycle (Africa's Talking sessionId)."""
    session_id = models.CharField(max_length=255, unique=True)  # AT sessionId
    phone_number = models.CharField(max_length=15)  # user's phone number (links to User)
    started_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()  # 30s after last AT callback
    menu_state = models.CharField(max_length=50, default='main')
    # menu_state values: main, auth, balance, settle_select, settle_confirm, request, register_name, register_pin
    session_data = models.JSONField(default=dict)  # temp in-session context (selected_debtor, amount, etc.)
    is_active = models.BooleanField(default=True)

    class Meta:
        indexes = [models.Index(fields=['phone_number', 'is_active'])]

# No USSDRegistration model — USSD users are User objects with phone_number + mpin fields

# No PaymentProvider model — MTN MoMo and Vodafone Cash handled as constants in payment service
# Can be promoted to a model later if more providers are added
```

### New Views (ussd/views.py)

```python
# POST /ussd/initiate  — Called by Africa's Talking when user dials *123#
#   Request: sessionId, phoneNumber, serviceId, sessionState (N=new, O=ongoing, C=closed)
#   Response: USSD menu text + nextAction (3 options: Balance, Settle, Request)
#   Logic: If sessionState=N → check if user exists (by phone_number); if not → show registration menu

# POST /ussd/progress  — Called by Africa's Talking on each menu selection
#   Request: sessionId, phoneNumber, serviceId, text (user input), sessionState
#   Response: USSD response text + nextAction
#   Logic: Routes based on current menu_state and user input (digits/text)
#   Handles: MPIN entry, amount entry, phone number entry, menu selection

# POST /ussd/callback/payment  — Payment gateway callback from MTN MoMo / Vodafone Cash
#   Handles: payment success, payment failure, pending status
#   Updates: Transaction model + fires Django signal for real-time sync

# Note: No separate /ussd/register endpoint — registration happens within /ussd/progress
# when an unregistered phone number hits the main menu and selects "Register"
```

### New URL routes

```python
# project/urls.py (add to existing Django router)
path('ussd/initiate/', views.ussd_initiate),
path('ussd/progress/', views.ussd_progress),
path('ussd/callback/payment/', views.payment_callback),
```

### Existing Model Extensions

```python
# accounts/models.py — Add to User model (auth.User or custom user)
phone_number = models.CharField(max_length=15, blank=True, unique=True)
mpin = models.CharField(max_length=6, blank=True, null=True)  # hashed via make_password()
ussd_registered = models.BooleanField(default=False)

# REMOVED from groups/models.py: ussd_shortcode field
# (Contradicts core-only USSD scope — group selection happens in-app)
```

### Session Cleanup

```python
# management/commands/cleanup_ussd_sessions.py
# Cron job: runs every 5 minutes
# Deletes USSDSession records where expires_at < now() and is_active=True → set is_active=False
# Then delete sessions older than 24 hours
```

## Shared Business Logic Layer

The balance check, debt listing, settlement, and money request logic lives in shared Django services (not duplicated endpoints). USSD and app channels both call the same service functions, just with different auth:

- **App channel**: User is authenticated via JWT → `request.user` identifies the user
- **USSD channel**: User is authenticated via phone_number + MPIN → `USSDAuth` middleware identifies the user

### Shared Services

```python
# ussd/services.py
class BalanceService:
    @staticmethod
    def get_balance(user): ...

class DebtService:
    @staticmethod
    def get_debts(user): ...  # Returns list of (debtor_name, amount, group_name)

class SettlementService:
    @staticmethod
    def settle_debt(user, debtor_id, amount, provider): ...
    @staticmethod
    def request_money(user, debtor_phone, amount, description): ...
```

### AT Callback Endpoint Detail

Africa's Talking sends callbacks to two URLs:
- `/ussd/initiate` — When user dials *123# (new session)
- `/ussd/progress` — On each subsequent menu interaction (user enters text/selection)

Both receive: `sessionId`, `phoneNumber`, `serviceId`, `text` (user input), `sessionState` (N=New, O=Ongoing, C=Closed)

**Session state machine:**
```
N (New) → Check phone_number in User →
  ├── Not found → Show registration menu (auth_state='register_name')
  ├── Found, no MPIN → Show MPIN setup (auth_state='register_pin')
  └── Found, has MPIN → Show main menu (auth_state='authenticated')

O (Ongoing) → Parse user input based on menu_state →
  ├── main → Route to balance/settle/request sub-flows
  ├── auth → Verify MPIN → route to main menu
  ├── settle_select → Show numbered list of debts (max 7 per screen)
  ├── settle_confirm → Confirm amount + provider → process payment
  └── ...

C (Closed) → Mark USSDession.is_active=False → Schedule cleanup
```

**USSD screen limit**: Africa's Talking displays ~7 menu items max per screen. The debt list in `settle_select` must paginate if user has more than 7 outstanding debts. Show "8. More" option that leads to next page.

## Real-Time Sync

```
USSD settles debt
  → SettlementService.settle_debt() executes (inside Django transaction)
  → Django signal fires (debt.settled)
  → Receiver checks: is the affected user's app session active?
    ├── Yes → Send push notification via FCM (already in app infrastructure)
    └── No → DB updated; app fetches on next refresh/navigate
```

**Implementation**: Use FCM push notifications as the primary sync mechanism. The app already has push notification infrastructure (see [State Management Plan](STATE-MANAGEMENT.md)). No Django Channels needed.

React Native app changes:
- Add push notification handler for "Debt Settled via USSD" events
- On notification tap, navigate to the relevant group/activity screen

## React Native App Changes

### New Screen: USSD Instructions
- Display USSD shortcode (`*123#`) on profile/home
- "Use USSD if you don't have the app" prompt

### Profile Updates
- Add phone number field (for linking)
- Show linked phone number status
- "Link Phone for USSD Access" toggle

### Notification Updates
- Push notification when debt settled via USSD by another user

## Security

- MPIN hashed with Django's `make_password()` (same as Django auth)
- USSD sessions expire after 30 seconds (Africa's Talking timeout)
- Rate limit USSD endpoints (max 5 requests per session per minute)
- MPIN attempts limited to 3 before session termination
- All USSD callbacks validate Africa's Talking signature
- Mobile money transactions require MPIN confirmation

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Session timeout mid-payment | Mark as "pending"; user redials to see complete/cancel |
| Mobile money failure | Show error, offer retry or cancel; auto-rollback on confirmed failure |
| Network interruption | AT sends timeout callback; session marked expired; user redials |
| Invalid MPIN (>3 attempts) | Terminate session; user must redial and re-authenticate |
| Duplicate settlement | Idempotency check via transaction reference |

## Testing Strategy

### Unit Tests (Mock Africa's Talking)
- Mock AT API responses in Django tests
- Test each USSD menu state transition
- Test payment callback handling (success, failure, timeout)
- Test MPIN validation logic
- Test session expiry and cleanup

### Integration Tests (AT Sandbox)
- Test full USSD flow with AT sandbox phone number
- Test MTN MoMo sandbox payments
- Test Vodafone Cash sandbox payments
- Test session persistence across requests

### App-Side Tests
- Test USSD instruction screen display
- Test phone number linking flow
- Test push notification on USSD settlement

## Rollout Plan

1. **Phase 1** — Deploy Django USSD backend + AT sandbox testing (internal only)
2. **Phase 2** — Register shortcode `*123#` with telco; soft launch to beta testers
3. **Phase 3** — Add USSD instructions to app profile/home screen
4. **Phase 4** — Public launch; monitor error rates and session completion

## Risks

| Risk | Mitigation |
|------|------------|
| AT sandbox doesn't support all flows | Build mock server for unsupported flows during development |
| Telco approval delays for shortcode | Start approval process early; use AT sandbox for testing in parallel |
| MPIN brute force via USSD | 3-attempt limit + session timeout + rate limiting |
| Session state desync between AT and Django | Idempotent operations + transaction-level DB commits |
| Users confused about when to use USSD vs app | Clear UI messaging in app about use cases |

## Open Questions

1. **USSD shortcode number** — What is the actual `*XXX#` code to register with telco? (`*123#` is a placeholder)
2. **Africa's Talking account** — Is an AT account already set up, or does it need creation?
3. **Telco shortcode registration** — Is there an existing relationship with MTN Ghana / Vodafone Ghana?
4. **Push notification infrastructure** — Does the React Native app already use FCM or OneSignal, or is push not yet implemented?
5. **Debt list pagination** — How should the USSD debt menu paginate? (Max 7 items per screen; what's a reasonable page size?)

## Implementation Task List

1. **Backend — Django USSD router** — Create `ussd/` app with `initiate`, `progress`, `payment_callback` views
2. **Backend — USSDSession model** — Create model with session_id, phone_number, menu_state, session_data, expires_at
3. **Backend — User model extension** — Add `phone_number`, `mpin`, `ussd_registered` fields to User model
4. **Backend — Shared services** — Create `ussd/services.py` with BalanceService, DebtService, SettlementService
5. **Backend — USSDAuth middleware** — Phone number + MPIN authentication for USSD endpoints
6. **Backend — Session cleanup command** — Cron job to purge expired USSD sessions
7. **Backend — Payment callback handler** — Handle MTN MoMo / Vodafone Cash gateway callbacks
8. **Backend — Tests** — Unit tests with mock AT API, integration tests with AT sandbox
9. **Frontend — USSD Instructions screen** — Display `*123#` shortcode, "Use USSD" prompt
10. **Frontend — Profile updates** — Phone number field, linked status, USSD toggle
11. **Frontend — Push notification handler** — Handle "Debt Settled via USSD" push events
12. **Frontend — Deep link** — `splitify://notification/:id` deep link for USSD payment notifications
13. **Integration — AT sandbox testing** — Full USSD flow with real AT sandbox
14. **Integration — FCM push verification** — Verify push notifications fire on USSD settlement
