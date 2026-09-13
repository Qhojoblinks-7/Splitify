# Savings Pockets — Implementation Plan

## Context

Users want to set aside portions of their Splitify balance toward specific savings goals (e.g., "Trip to Accra", "Emergency Fund"). This is an app-only feature (not available via USSD) — non-app users interact with balances only through the USSD core flow.

## Decisions Resolved

| Decision | Choice |
|----------|--------|
| Type | Multiple savings pockets/goals (max 5 per user) |
| Money flow | Transfer only: balance ↔ pocket (no direct spending from pockets) |
| Location | Profile tab (`app/(tabs)/profile.jsx`) → Savings section |
| Pocket naming | Free text (1-100 chars) |
| Progress | Progress bar toward target amount |
| Target cap | Cannot exceed target via transfers (create new pocket or adjust target instead) |

## Data Model

```python
# accounts/models.py (extend existing User model)
class SavingsPocket(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='savings_pockets'
    )
    name = models.CharField(max_length=100)  # Goal name
    target_amount = models.DecimalField(max_digits=10, decimal_places=2)
    current_amount = models.DecimalField(
        max_digits=10, decimal_places=2, default=0
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'name'],
                name='unique_user_pocket_name'
            )
        ]

    @property
    def progress_percent(self):
        if self.target_amount == 0:
            return 0
        return min((self.current_amount / self.target_amount) * 100, 100)

    def can_transfer_in(self, amount):
        return self.current_amount + amount <= self.target_amount

    def can_transfer_out(self, amount):
        return self.current_amount >= amount

    def can_delete(self):
        return self.current_amount == 0
```

**Rules:**
- Max 5 pockets per user (enforced at service layer)
- Unique pocket name per user
- `current_amount` can never exceed `target_amount`
- Can only delete empty pockets
- All money operations are atomic (single DB transaction)

## Backend Changes

### New API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/savings/` | GET | JWT | List user's savings pockets (with amounts + progress) |
| `/api/savings/` | POST | JWT | Create new pocket (name, target_amount) |
| `/api/savings/{id}/` | DELETE | JWT | Delete pocket (must be empty) |
| `/api/savings/{id}/transfer/` | POST | JWT | Transfer money in or out of pocket |

### Transfer Request Body

```json
POST /api/savings/{id}/transfer/
{
    "type": "in",     // "in" = balance → pocket, "out" = pocket → balance
    "amount": 50.00   // GHC amount
}
```

### Response Shape

```json
GET /api/savings/
{
    "pockets": [
        {
            "id": 1,
            "name": "Trip to Accra",
            "target_amount": "500.00",
            "current_amount": "125.00",
            "progress_percent": 25.0,
            "created_at": "2026-09-12T10:00:00Z",
            "updated_at": "2026-09-12T14:00:00Z"
        }
    ]
}
```

### Service Layer

```python
# savings/services.py
class SavingsService:
    
    @staticmethod
    def list_pockets(user):
        return user.savings_pockets.all()
    
    @staticmethod
    def create_pocket(user, name, target_amount):
        # Validation: max 5 pockets, name unique, target > 0
        # Create pocket, return it
    
    @staticmethod
    def delete_pocket(user, pocket_id):
        # Validation: pocket belongs to user, is empty
        # Delete pocket
    
    @staticmethod
    def transfer(user, pocket_id, type, amount):
        """
        type: "in" or "out"
        "in": check user has enough main balance, pocket won't exceed target
        "out": check pocket has enough balance
        Atomic: updates both User balance and pocket current_amount in one transaction
        """
```

### Key Validation Rules (Server-Side)

| Rule | Error |
|------|-------|
| User already has 5 pockets | "Maximum 5 savings pockets allowed" |
| Duplicate pocket name | "A pocket with this name already exists" |
| Target amount ≤ 0 | "Target amount must be at least 1 GHC" |
| Transfer amount ≤ 0 | "Amount must be at least 1 GHC" |
| Transfer "in" exceeds target | "This pocket is full (reached its target)" |
| Transfer "out" exceeds current | "Insufficient amount in this pocket" |
| Transfer "in" exceeds balance | "Insufficient main balance" |
| Delete non-empty pocket | "Transfer all money before deleting this pocket" |
| Pocket not found | "Savings pocket not found" |

## React Native App Changes

### Profile Tab Updates (`app/(tabs)/profile.jsx`)

Add a "Savings" section below existing profile content:
```
Profile Screen
  ├── User info (name, email, phone)
  ├── Linked phone number (USSD)
  ├── --- Savings Section ---
  ├── SavingsPocketCard x N (scrollable list)
  │     ├── Name (e.g., "Trip to Accra")
  │     ├── Progress bar (current/target)
  │     ├── "125 GHC / 500 GHC"
  │     └── Tap → SavingsPocketDetail screen
  ├── "+ New Savings" button
  └── --- End Savings Section ---
```

### New Screen: SavingsPocketDetail

```
SavingsPocketDetail
  ├── Pocket Name (editable)
  ├── Progress visualization (circular or linear progress bar)
  ├── "125 GHC / 500 GHC (25%)"
  ├── --- Transfer Actions ---
  │     ├── "Add Money" button → TransferModal (type: in)
  │     └── "Withdraw" button → TransferModal (type: out)
  ├── --- Transfer History ---
  │     └── List of transfers (date, type, amount, balance after)
  └── Delete Pocket button (only if empty)
```

### New Components

**Molecule: `SavingsPocketCard.jsx`**
```jsx
Props: name, currentAmount, targetAmount, progressPercent, onPress
Renders: Name, ProgressBar, "X GHC / Y GHC", pressable → detail screen
```

**Molecule: `SavingsProgressBar.jsx`**
```jsx
Props: progress (0-100), height (default 8)
Renders: Background track + filled portion in accent color (#fbb81c)
```

**Organism: `SavingsList.jsx`**
```jsx
Props: pockets (array), onAddNew
Renders: Scrollable list of SavingsPocketCard + "+ New Savings" button
```

**Modal: `TransferModal.jsx`**
```jsx
Props: pocketId, type ("in" | "out"), pocketName, onConfirm, onCancel
Renders: Amount input, pocket name, max available, confirm/cancel buttons
```

### Navigation

- Profile tab → Savings section → Tap pocket → `/savings/{id}/` (SavingsPocketDetail)
- Profile tab → Savings section → "+ New Savings" → inline form (name + target)
- No new tab needed — savings lives within Profile tab

### Existing Screen Impact

- **HomeScreen**: No changes. Balance stays as "Current Balance." Savings is personal/optional.
- **USSD flow**: No changes. Savings is app-only. See [USSD Plan](USSD-PAYMENT-INTEGRATION.md).
- **Auth flow**: No changes. Savings created after account setup.

## Data Flow

```
User taps "Add Money" on Trip to Accra pocket
  → TransferModal appears
  → User enters 100 GHC
  → POST /api/savings/1/transfer/ {type: "in", amount: 100}
  → Server validates:
  │   ├── User balance ≥ 100? ✓
  │   ├── Current (125) + 100 = 225 ≤ Target (500)? ✓
  │   └── Within 5 pocket limit? ✓
  → Django transaction:
  │   ├── User.balance -= 100
  │   ├── SavingsPocket.current_amount += 100
  │   └── SavingsTransfer.create(user, pocket, "in", 100)
  → Response: updated pocket data
  → UI updates: new amount 225, progress 45%
```

## Error Handling

| Scenario | User-Facing Message |
|----------|-------------------|
| Max 5 pockets reached | "You can have up to 5 savings pockets. Delete one to create a new one." |
| Duplicate pocket name | "A pocket named 'X' already exists. Try a different name." |
| Insufficient balance | "You don't have enough balance for this transfer." |
| Transfer exceeds target | "'Trip to Accra' is full. You've reached your target amount." |
| Transfer exceeds pocket | "You can't withdraw more than what's in this pocket." |
| Invalid amount (negative/zero) | "Please enter a valid amount." |
| Network error | "Something went wrong. Please try again." |
| Pocket deleted mid-transfer | (Server catches — pocket must exist and belong to user) |

## Empty State

- **No pockets**: Show empty state with "Start saving" prompt, "+ New Savings" button highlighted, brief description of what savings pockets are for
- **Pocket with 0 GHC**: Show progress bar at 0%, "0 GHC / Target" text, "Add Money" CTA prominent

## Security

- JWT authentication on all endpoints (same as existing app API)
- User can only access their own pockets (`filter(user=request.user)`)
- All amount validations are server-side (never trust client-calculated amounts)
- `progress_percent` calculated server-side
- DELETE requires pocket to be empty (atomic check + delete in transaction)
- Transfer operations use `select_for_update()` row locking to prevent race conditions

## Testing Strategy

### Backend Tests
- Create pocket: valid name, invalid name (duplicate), too many pockets (6th)
- Transfer "in": success, insufficient balance, exceeds target
- Transfer "out": success, exceeds current amount, zero amount
- Delete pocket: success (empty), failure (has balance), failure (not found)
- Progress calculation: 0%, 50%, 100%, over-target (clamped at 100%)
- Transaction atomicity: balance transfer fails → pocket update also fails
- Concurrency: two simultaneous transfers (select_for_update test)

### App-Side Tests
- Render SavingsPocketCard with various progress values
- TransferModal validation (empty input, negative, exceeds max)
- Profile tab renders savings section when pockets exist
- Empty state displays correctly
- Navigation to detail screen and back
- Delete button only visible when empty

## Rollout Plan

1. **Phase 1** — Backend: SavingsPocket model, endpoints, service layer, tests
2. **Phase 2** — App: Profile tab savings section, SavingsPocketCard, TransferModal, detail screen
3. **Phase 3** — E2E testing: full transfer flows, edge cases, error handling
4. **Phase 4** — Beta release, monitor for balance sync issues

## Risks

| Risk | Mitigation |
|------|------------|
| Double-spend / race condition on transfers | `select_for_update()` row locking, atomic transactions |
| User creates 5 full pockets then can't save more | Clear "pocket full" messaging; offer delete or adjust target |
| Pocket balance out of sync with actual balance | Atomic transfers, periodic balance audit endpoint |
| Unclear savings value proposition | Tooltip/info explaining what pockets are for; progress visualization |
| Accidental delete (though blocked when non-empty) | Two-step confirm on delete; no undo needed since blocked when non-empty |

## Open Questions

1. **Transfer history** — Should transfers be visible in detail screen? (Recommended: Yes, basic list — date, type, amount)
2. **Pocket editing** — Can users edit pocket name or target after creation? (Recommended: Allow name edit only, no target increase)
3. **Minimum transfer amount** — 1 GHC minimum? Or allow smaller amounts? (Recommended: 1 GHC minimum to match existing transaction patterns)
4. **Expiring goals** — Should pockets support a target date? (Recommended: No — out of scope for MVP, add later)

## Implementation Task List

1. **Backend — SavingsPocket model** — Create model with fields, constraints, properties
2. **Backend — API endpoints** — List, create, delete, transfer endpoints
3. **Backend — SavingsService** — Service layer with all validation rules
4. **Backend — Atomic transfer logic** — select_for_update, balance+pocket update in one transaction
5. **Backend — Tests** — All backend test cases (create, transfer, delete, concurrency)
6. **Frontend — SavingsPocketCard component** — Molecule with progress bar
7. **Frontend — SavingsProgressBar component** — Molecule progress bar
8. **Frontend — SavingsList component** — Organism with pocket list + add button
9. **Frontend — TransferModal component** — Modal for in/out transfers
10. **Frontend — SavingsPocketDetail screen** — Full detail with transfers + history
11. **Frontend — Profile tab integration** — Add savings section to profile.jsx
12. **Frontend — Navigation** — Route to savings detail from profile tab
13. **Frontend — Empty state** — No-pockets and zero-amount states
14. **Integration — Full transfer flow** — Balance → pocket, verify both update correctly
