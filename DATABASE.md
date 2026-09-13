# Splitify — Database Plan

## Context

Splitify needs a database that serves: core bill splitting, auth, USSD payments, savings pockets, and group susu. All plans are finalized — this plan consolidates every model into one coherent schema with relationships, constraints, indexes, and migration strategy.

## Decisions Resolved

| Decision | Choice |
|----------|--------|
| Bill/Split model | Bill + BillItem (individual line items with payer + amount) |
| Group model | Single Group with type: `bill` / `susu` |
| Transaction model | Single Transaction table with type discriminator |
| Payment providers | PaymentProvider model (MTN MoMo, Vodafone Cash, future) |
| Soft delete | Group and Bill only (financial records never soft-deleted) |
| Notifications | Hybrid — DB model + FCM push, with delivery tracking |
| Dev/Prod DB | SQLite (dev) → PostgreSQL (prod) |
| Susu membership | GroupMember with susu-specific fields (order, is_active) |
| Susu group data | SusuProfile (OneToOne with Group) |

## Migration Strategy

| Concern | Approach |
|---------|----------|
| Dev database | SQLite (`dev.sqlite3`) — no setup, fast iteration |
| Production database | PostgreSQL — concurrency, JSON support, reliability |
| Migration compatibility | Django ORM abstracts differences. All field types compatible between SQLite and PostgreSQL. JSONField → JSONField (works both). Avoid raw SQL. |
| Migration files | `python manage.py makemigrations` per app. Test migrations on SQLite first, then apply to PostgreSQL. |
| Seed data | PaymentProvider seeds (MTN MoMo, Vodafone Cash) via data migration |
| Rollback | `python manage.py migrate <app> <previous>` — test rollbacks in dev |

## Environment Variables

```env
# Database
DATABASE_URL=sqlite:///dev.sqlite3          # dev
DATABASE_URL=postgres://user:pass@host:5432/splitify_prod  # prod
```

## Complete Schema

### 1. User

```
users.User
├── id                 UUID (PK, auto-generated)
├── email              EmailField (unique, max_length=254)
├── password           PasswordField (hashed)
├── first_name         CharField (max_length=100, blank=True)
├── last_name          CharField (max_length=100, blank=True)
├── phone_number       CharField (max_length=15, blank=True, unique=True)  ← USSD link
├── mpin               CharField (max_length=6, blank=True, null=True)    ← USSD auth (hashed)
├── ussd_registered    BooleanField (default=False)
├── avatar             ImageField (blank=True, null=True)
├── is_active          BooleanField (default=True)
├── is_staff           BooleanField (default=False)
├── date_joined        DateTimeField (auto_now_add=True)
├── updated_at         DateTimeField (auto_now=True)
└── last_login         DateTimeField (blank=True, null=True)
```

**Indexes:**
- `email` — unique (built-in)
- `phone_number` — unique (built-in)

**Notes:**
- Password hashed via Django's `make_password()` / `PBKDF2Hasher`
- Phone number + MPIN for USSD auth (plain MPIN stored hashed)
- MPIN hashed same as password: `make_password(mpin)`
- `is_active` controls account deactivation (not soft delete)

---

### 2. Group

```
groups.Group
├── id                 UUID (PK)
├── name               CharField (max_length=100)
├── description        TextField (blank=True)
├── type               CharField (max_length=10, choices: 'bill', 'susu')  ← NEW
├── target_amount      DecimalField (max_digits=10, decimal_places=2, null=True)  ← for susu groups
├── total_rounds       PositiveIntegerField (null=True)  ← for susu groups
├── current_round      PositiveIntegerField (default=1)  ← for susu groups
├── current_turn_index PositiveIntegerField (default=0)  ← for susu groups
├── is_active          BooleanField (default=True)
├── is_deleted         BooleanField (default=False)  ← soft delete (Group + Bill only)
├── created_by         UUID (FK → User)
├── created_at         DateTimeField (auto_now_add=True)
└── updated_at         DateTimeField (auto_now=True)
```

**Indexes:**
- `type` — partial index for frequent filtering by group type
- `created_by` — FK index (built-in)
- `is_active` — partial index (common filter)

**Constraints:**
- `name` + `created_by` unique together (user can't create duplicate group names)

**Notes:**
- `type` distinguishes bill groups from susu groups
- Susu-specific fields (target_amount, total_rounds, etc.) are NULL for bill groups
- Soft delete (`is_deleted`) only on Group and Bill — all financial data preserved
- A susu group is a Group with `type='susu'`; susu-specific data also in SusuProfile

---

### 3. GroupMember

```
groups.GroupMember
├── id                 UUID (PK)
├── group              UUID (FK → Group, CASCADE)
├── user               UUID (FK → User, CASCADE)
├── role               CharField (max_length=20, choices: 'admin', 'member', 'viewer', default='member')
├── order              PositiveIntegerField (null=True)  ← susu rotation order (NULL for bill groups)
├── is_active          BooleanField (default=True)  ← susu: False after 2 misses (NULL for bill groups)
├── joined_at          DateTimeField (auto_now_add=True)
└── removed_at         DateTimeField (null=True, blank=True)  ← when removed from group
```

**Indexes:**
- `group` + `user` — unique together (no duplicate memberships)
- `group` — FK index (built-in)
- `user` — FK index (built-in)
- `role` — partial index for admin lookups

**Constraints:**
- `group` + `user` unique together
- For susu groups: `order` must be set, no two members can have same order in same group

**Notes:**
- Replaces `SusuMember` from original plan — same table, different context
- For bill groups: `role` matters (admin/member/viewer), `order`/`is_active` are NULL
- For susu groups: `order` determines rotation, `is_active=False` means removed after 2 misses
- `removed_at` tracks when a member was removed (preserved for audit trail)
- Soft remove: record stays, `removed_at` is set
- Removed members can't transact in the group
- For susu groups, removed members don't participate in rotation
- Admin liability: admin can be debited for fake transactions (handled at service layer)

---

### 4. Bill

```
bills.Bill
├── id                 UUID (PK)
├── group              UUID (FK → Group, CASCADE)
├── title              CharField (max_length=200)
├── description        TextField (blank=True)
├── total_amount       DecimalField (max_digits=10, decimal_places=2)
├── payer              UUID (FK → User)  ← who created/paid the bill
├── category           CharField (max_length=50, blank=True)  ← food, transport, etc.
├── date               DateField (default=today)
├── status             CharField (max_length=20, choices: 'active', 'overdue', 'settled', 'cancelled', default='active')
├── is_deleted         BooleanField (default=False)  ← soft delete (Bill + Group only)
├── deleted_at         DateTimeField (null=True, blank=True)
├── created_at         DateTimeField (auto_now_add=True)
└── updated_at         DateTimeField (auto_now=True)
```

**Indexes:**
- `group` — FK index (built-in)
- `payer` — FK index (built-in)
- `status` — partial index (common filter: active vs settled)
- `date` — for chronological listing
- Partial index: `is_deleted=False` for active bill queries

**Constraints:**
- `total_amount` must equal sum of all BillItem amounts (enforced at service layer)
- `payer` must be a member of the group (enforced at service layer)

**Notes:**
- Soft delete only on Bill (and Group) — settled bills are kept for history
- `status='overdue'` for bills past due date (auto-marked by Celery daily task)
- A bill belongs to exactly one group (bill-type group or susu group)

---

### 5. BillItem

```
bills.BillItem
├── id                 UUID (PK)
├── bill               UUID (FK → Bill, CASCADE)
├── description        CharField (max_length=200)
├── amount             DecimalField (max_digits=10, decimal_places=2)
├── payer              UUID (FK → User)  ← who paid this item
├── paid_by            UUID (FK → User)  ← who this item is for (settled by)
├── settled            BooleanField (default=False)
├── settled_at         DateTimeField (null=True, blank=True)
├── created_at         DateTimeField (auto_now_add=True)
└── updated_at         DateTimeField (auto_now=True)
```

**Indexes:**
- `bill` — FK index (built-in)
- `payer` — FK index (built-in)
- `paid_by` — FK index (built-in)
- `settled` — partial index (common filter)

**Constraints:**
- Sum of all BillItem amounts for a bill must equal `Bill.total_amount` (service layer)
- Each item must have a payer (who paid) and paid_by (who owes)

**Notes:**
- Each item is an individual line entry — payer and paid_by can be different people
- `settled` tracks whether this specific item has been paid
- Supports both equal and custom splits (different amounts per item)
- Created within Django transaction (atomic with parent Bill)

---

### 6. Transaction

```
transactions.Transaction
├── id                 UUID (PK)
├── user               UUID (FK → User, CASCADE)  ← initiator
├── type               CharField (max_length=30, choices:
│                        'send', 'request', 'topup', 'withdraw',
│                        'susu_contribution', 'susu_payout',
│                        'savings_in', 'savings_out')
├── amount             DecimalField (max_digits=10, decimal_places=2)
├── balance_after      DecimalField (max_digits=10, decimal_places=2, null=True)  ← user balance after
├── recipient          UUID (FK → User, null=True, blank=True)  ← for send/request
├── group              UUID (FK → Group, null=True, blank=True)  ← for susu/savings
├── provider           UUID (FK → PaymentProvider, null=True, blank=True)  ← for mobile money
├── provider_ref       CharField (max_length=100, null=True, blank=True)  ← mobile money ref #
├── reference          CharField (max_length=30, unique=True)  ← idempotency key, format: TXN-YYYYMMDD-NNNN
├── status             CharField (max_length=20, choices:
│                        'pending', 'completed', 'failed', 'flagged', default='pending')
├── metadata           JSONField (default=dict, blank=True)  ← type-specific data
├── created_at         DateTimeField (auto_now_add=True)
└── updated_at         DateTimeField (auto_now=True)
```

**Indexes:**
- `user` — FK index (built-in)
- `type` — for filtering by transaction type
- `status` — partial index (common filter: pending/completed/failed)
- `reference` — unique (idempotency)
- `created_at` — for chronological listing
- Composite: `user` + `status` for "pending transactions" queries
- Composite: `user` + `type` for "my sends" / "my requests" queries

**Constraints:**
- `reference` unique (idempotency — prevents duplicate processing)
- `amount` must be > 0 (service layer)

**Notes:**
- Single table for ALL financial movements (send, request, topup, withdraw, susu_contribution, susu_payout, savings_in, savings_out)
- `metadata` JSON field for type-specific data (e.g., `{"debtor_id": "...", "group_id": "..."}` for susu contributions)
- `balance_after` enables instant balance display without recalculation
- `provider_ref` for mobile money verification (MTN MoMo ref, Vodafone Cash ref)
- `reference` is the idempotency key — same reference = same transaction (prevents double-charges)
- `status='flagged'` for suspicious transactions (fake refs, disputes)
- All financial operations within Django `@transaction.atomic`

---

### 7. PaymentProvider

```
payments.PaymentProvider
├── id                 UUID (PK)
├── name               CharField (max_length=50, unique=True)  ← "MTN MoMo", "Vodafone Cash"
├── code               CharField (max_length=30, unique=True)  ← "mtn_momo", "vodafone_cash"
├── is_active          BooleanField (default=True)
├── api_endpoint       URLField (blank=True, null=True)  ← provider API URL for verification
├── fee_percent        DecimalField (max_digits=5, decimal_places=2, null=True, blank=True)
├── created_at         DateTimeField (auto_now_add=True)
└── updated_at         DateTimeField (auto_now=True)
```

**Indexes:**
- `code` — unique (built-in)
- `is_active` — partial index

**Notes:**
- Seed data: MTN MoMo (`mtn_momo`), Vodafone Cash (`vodafone_cash`)
- `fee_percent` for displaying transfer fees to users
- `api_endpoint` for automated verification (if provider offers API)
- Can add AirtelTigo, Zoomlion without code changes

---

### 8. Notification

```
notifications.Notification
├── id                 UUID (PK)
├── user               UUID (FK → User, CASCADE)
├── type               CharField (max_length=50)  ← 'bill_settled', 'susu_turn', 'payment_received', etc.
├── title              CharField (max_length=200)
├── body               TextField (blank=True)
├── data               JSONField (default=dict, blank=True)  ← deep link data, amounts, etc.
├── read               BooleanField (default=False)
├── push_sent          BooleanField (default=False)  ← FCM push delivered
├── push_delivered     BooleanField (null=True, blank=True)  ← FCM push acknowledged
├── push_sent_at       DateTimeField (null=True, blank=True)
├── deep_link          CharField (max_length=500, null=True, blank=True)  ← splitify://...
├── created_at         DateTimeField (auto_now_add=True)
└── updated_at         DateTimeField (auto_now=True)
```

**Indexes:**
- `user` — FK index (built-in)
- `read` — partial index (common filter: unread notifications)
- `type` — for filtering by notification type
- `created_at` — for chronological listing
- Composite: `user` + `read` for "unread notifications" queries

**Notes:**
- Required by Screen Documentation's notification screen
- `data` JSON for deep link params (e.g., `{"group_id": 5, "susu_id": 3}`)
- `push_sent`/`push_delivered` track FCM delivery status
- `deep_link` for deep linking from notification to specific screen
- Mark-as-read via PATCH endpoint (bulk and individual)
- Periodic cleanup: Celery daily task deletes notifications older than 90 days
- Users can manually clear notifications anytime

---

### 9. USSDSession

```
ussd.USSDSession
├── id                 CharField (max_length=255, primary_key=True)  ← AT sessionId
├── user               UUID (FK → User, null=True, blank=True)  ← explicit link for registered users
├── phone_number       CharField (max_length=15)  ← links to User.phone_number
├── started_at         DateTimeField (auto_now_add=True)
├── expires_at         DateTimeField()  ← 30s after last AT callback
├── menu_state         CharField (max_length=50, default='main')
│                        ← 'main', 'auth', 'balance', 'settle_select', 'settle_confirm', 'request', 'register_name', 'register_pin'
├── session_data       JSONField (default=dict)  ← temp context (selected_debtor, amount, etc.)
├── is_active          BooleanField (default=True)
└── created_at         DateTimeField (auto_now_add=True)
```

**Indexes:**
- `user` — FK index (built-in, nullable, for registered users)
- `phone_number` + `is_active` — composite index (find active USSD session by phone)
- `expires_at` — for cleanup cron (filter expired sessions)

**Notes:**
- Session expires after 30 seconds (Africa's Talking timeout)
- Cleanup cron job runs every 5 minutes: soft-delete expired sessions, hard-delete sessions older than 24 hours
- `session_data` stores in-session context (selected debtor, amount, provider, etc.)
- `user` is nullable — unregistered USSD users have `user=NULL`, registered users have explicit FK
- For registered users: `user` FK is faster than phone_number lookup, and provides direct User access
- Phone_number remains unique on User model (for USSD auth)
- No separate USSDRegistration model — USSD users are User objects

---

### 10. SusuProfile

```
susu.SusuProfile
├── id                 UUID (PK)
├── group              UUID (OneToOne → Group, CASCADE)  ← extends a Group with type='susu'
├── target_amount      DecimalField (max_digits=10, decimal_places=2)  ← pot size per round
├── total_rounds       PositiveIntegerField()  ← number of rounds
├── current_round      PositiveIntegerField (default=1)
├── current_turn_index PositiveIntegerField (default=0)  ← index in rotation
├── is_complete        BooleanField (default=False)
├── next_receiver      UUID (FK → GroupMember, null=True, blank=True)  ← next in rotation
└── created_at         DateTimeField (auto_now_add=True)
```

**Indexes:**
- `group` — unique OneToOne (built-in)

**Constraints:**
- `group.type` must be `'susu'` (enforced at service layer / model validation)
- One SusuProfile per Group (OneToOne)

**Notes:**
- Only exists for groups where `type='susu'`
- Extends Group with susu-specific data
- `next_receiver` computed from `current_turn_index` and `GroupMember.order`
- `is_complete` = `current_round > total_rounds`

---

### 11. SusuContribution

```
susu.SusuContribution
├── id                 UUID (PK)
├── member             UUID (FK → GroupMember, CASCADE)  ← contributor (must be in a susu group)
├── round_number       PositiveIntegerField()
├── amount             DecimalField (max_digits=10, decimal_places=2)
├── provider           UUID (FK → PaymentProvider)  ← MTN MoMo / Vodafone Cash
├── reference_number   CharField (max_length=100)  ← mobile money transaction ref
├── status             CharField (max_length=20, choices:
│                        'pending', 'verified', 'failed', 'flagged', default='pending')
├── transaction        UUID (FK → Transaction, null=True, blank=True)  ← link to financial transaction
├── paid_at            DateTimeField (null=True, blank=True)
├── verified_at        DateTimeField (null=True, blank=True)
├── created_at         DateTimeField (auto_now_add=True)
└── updated_at         DateTimeField (auto_now=True)
```

**Indexes:**
- `member` — FK index (built-in)
- `round_number` — for filtering by round
- `status` — partial index (common filter: pending contributions)
- `reference_number` — for verification lookups
- `provider` — FK index (built-in)

**Constraints:**
- `member` + `round_number` unique together (one contribution per member per round)
- `amount` must be > 0 (minimum 1 GHC)
- `reference_number` must be unique per provider (prevent duplicate refs)
- `round_number` must be ≤ `SusuProfile.total_rounds` (service layer)

**Notes:**
- Links to Transaction for financial tracking (when payment is processed)
- `status='pending'` → not yet verified, payout blocked
- `status='verified'` → verified via mobile money API, payout can proceed
- `status='flagged'` → disputed/fake, admin review needed
- Auto-verification task runs every 5 minutes (Celery)
- Admin liability: flagged contributions trigger admin debit

---

### 12. SusuRound

```
susu.SusuRound
├── id                 UUID (PK)
├── group              UUID (FK → Group, CASCADE)  ← the susu group
├── round_number       PositiveIntegerField()
├── receiver           UUID (FK → GroupMember)  ← who receives the pot this round
├── payout_amount      DecimalField (max_digits=10, decimal_places=2)  ← always = SusuProfile.target_amount
├── payout_status      CharField (max_length=20, choices:
│                        'pending', 'processing', 'completed', 'failed', default='pending')
├── payout_reference   CharField (max_length=100, null=True, blank=True)  ← mobile money ref for payout
├── transaction        UUID (FK → Transaction, null=True, blank=True)  ← payout transaction record
├── completed_at       DateTimeField (null=True, blank=True)
├── created_at         DateTimeField (auto_now_add=True)
└── updated_at         DateTimeField (auto_now=True)
```

**Indexes:**
- `group` — FK index (built-in)
- `round_number` — for filtering by round
- `receiver` — FK index (built-in)
- `payout_status` — partial index

**Constraints:**
- `payout_amount` = `SusuProfile.target_amount` (service layer — always the full pot)
- `round_number` must be unique per group
- All contributions verified before payout (service layer)

**Notes:**
- Payout processed via Transaction (type='susu_payout')
- `payout_reference` = mobile money transaction reference for the payout transfer
- `payout_status='pending'` → contributions not all verified
- `payout_status='processing'` → mobile money transfer in progress
- `payout_status='completed'` → successfully transferred
- `payout_status='failed'` → transfer failed, retry or admin intervention
- Race condition prevention: `select_for_update()` on round state changes

---

### 13. SavingsPocket

```
savings.SavingsPocket
├── id                 UUID (PK)
├── user               UUID (FK → User, CASCADE)
├── name               CharField (max_length=100)
├── target_amount      DecimalField (max_digits=10, decimal_places=2)
├── current_amount     DecimalField (max_digits=10, decimal_places=2, default=0)
├── created_at         DateTimeField (auto_now_add=True)
└── updated_at         DateTimeField (auto_now=True)
```

**Indexes:**
- `user` — FK index (built-in)

**Constraints:**
- `user` + `name` unique together (one pocket per name per user)
- `user` + unique constraint: max 5 pockets per user (service layer)
- `current_amount` ≤ `target_amount` (service layer)

**Notes:**
- App-only feature (not available via USSD)
- Transfer-only: balance ↔ pocket (no direct spending)
- `can_transfer_in()`, `can_transfer_out()`, `can_delete()` methods at service layer
- All operations within Django transaction (atomic balance + pocket update)
- `select_for_update()` row locking on transfers (prevents race conditions)

---

## Entity Relationship Summary

```
User ──┬──< Group (created_by)
       ├──< GroupMember (user_id) ──> Group
       ├──< Transaction (user_id)
       ├──< Notification (user_id)
       ├──< SavingsPocket (user_id)
       └──> USSDSession (nullable FK, for registered users)

Group ──┬──< GroupMember (group_id) ──> User
        ├──< Bill (group_id) ──< BillItem
        ├──< Transaction (group_id)
        └── 1:1 SusuProfile (type='susu') ──> SusuRound, SusuContribution

Bill ──< BillItem (bill_id)

SusuProfile ──> SusuRound (group_id)
             └─> SusuContribution (via GroupMember)

GroupMember ──< SusuContribution (member_id)
              └─> SusuRound (receiver_id)

Transaction ──┬──< SusuContribution (transaction FK, nullable)
              └──< SusuRound (transaction FK, nullable)

PaymentProvider ──< Transaction (provider FK)
                  └──< SusuContribution (provider FK)
```

## Index Summary

| Table | Index/Unique Constraint | Type | Purpose |
|-------|------------------------|------|---------|
| User | email | Unique | Login lookup |
| User | phone_number | Unique | USSD auth lookup |
| Group | name + created_by | Unique | Prevent duplicate group names |
| Group | type | Partial | Filter by group type |
| Group | is_active | Partial | Active groups query |
| GroupMember | group + user | Unique | Prevent duplicate memberships |
| GroupMember | role | Partial | Admin lookups |
| Bill | is_deleted + status | Partial | Active bills query |
| Transaction | reference | Unique | Idempotency |
| Transaction | user + status | Composite | Pending transactions query |
| Transaction | user + type | Composite | Filtered transaction lists |
| Transaction | status | Partial | Pending/failed query |
| Notification | user + read | Composite | Unread notifications query |
| USSDSession | user | FK index | Registered user lookup |
| USSDSession | phone_number + is_active | Composite | Active USSD session lookup |
| USSDSession | expires_at | Regular | Cleanup cron |
| SusuContribution | member + round_number | Unique | One contribution per round |
| SusuContribution | reference_number | Unique | Duplicate ref prevention |
| SusuContribution | status | Partial | Pending contributions query |
| SavingsPocket | user + name | Unique | Pocket name uniqueness |
| PaymentProvider | code | Unique | Provider code lookup |

## Soft Delete Rules

| Model | Soft Delete | Hard Delete |
|-------|-------------|-------------|
| User | No (deactivate via `is_active`) | After 30 days GDPR request |
| Group | Yes (`is_deleted=True`) | After 90 days |
| GroupMember | No (preserve history) | N/A |
| Bill | Yes (`is_deleted=True`) | After 90 days |
| BillItem | No (preserve settlement history) | N/A |
| Transaction | **Never** | N/A (financial audit trail) |
| Notification | No (auto-delete after 90 days) | N/A |
| USSDSession | No (auto-cleanup after 24h) | N/A |
| SusuProfile | No (preserve susu history) | N/A |
| SusuContribution | **Never** | N/A (financial audit trail) |
| SusuRound | **Never** | N/A (financial audit trail) |
| SavingsPocket | No | N/A |
| PaymentProvider | No | N/A |

## Constraints Enforced at Service Layer (Not DB)

| Constraint | Model(s) | Enforcement |
|------------|----------|-------------|
| Max 5 savings pockets per user | SavingsPocket | Service layer check before create |
| Max 50 members per susu group | GroupMember | Service layer check before add |
| Min contribution: 1 GHC | SusuContribution, SavingsPocket transfer | Service layer validation |
| USSD screen limit: 7 items | USSDSession (UI) | UssdService paginate_debts() |
| MPIN attempts: 3 max | User (USSD auth) | UssdAuth middleware |
| Balance ≥ transfer amount | Transaction (send), SavingsPocket (transfer in) | Service layer atomic check |
| Sum of BillItems = Bill.total | Bill, BillItem | Service layer validation |
| All contributions verified before payout | SusuRound | Payout service check |
| Admin liability shortfall | Transaction, User balance | Admin liability service |
| `group.type='susu'` for SusuProfile | SusuProfile | Model validation |

## Django App Structure

```
splitify/
├── apps/
│   ├── accounts/         → User model (extends AbstractUser)
│   ├── groups/           → Group, GroupMember
│   ├── bills/            → Bill, BillItem
│   ├── transactions/     → Transaction
│   ├── payments/         → PaymentProvider
│   ├── notifications/    → Notification
│   ├── ussd/             → USSDSession
│   ├── susu/             → SusuProfile, SusuContribution, SusuRound
│   └── savings/          → SavingsPocket
```

## Migration Plan

### Phase 1: Initial Schema (Week 1)
```bash
# Create all apps
python manage.py startapp accounts groups bills transactions payments notifications ussd susu savings

# Initial migrations
python manage.py makemigrations accounts groups bills transactions payments notifications
python manage.py migrate  # Apply to SQLite dev
```

### Phase 2: Susu + USSD (Week 2)
```bash
python manage.py makemigrations ussd susu savings
python manage.py migrate
```

### Phase 3: PostgreSQL Deployment (Week 3)
```bash
# Create PostgreSQL database
# Update DATABASE_URL in production env
# Test migration on PostgreSQL staging
python manage.py migrate --database=postgres
python manage.py createsuperuser
```

### Phase 4: Data Migrations
```bash
# Seed PaymentProvider data
python manage.py seed_providers  # MTN MoMo, Vodafone Cash
```

## Testing Strategy

### Unit Tests
- Model field constraints (max_length, decimal_places)
- Unique constraints (email, phone_number, pocket names)
- FK relationships (cascade behavior)
- JSONField structure for metadata, session_data

### Integration Tests
- Transaction atomicity (failure → full rollback)
- `select_for_update()` race condition prevention
- Idempotency (duplicate reference rejected)
- Susu contribution → verification → payout flow
- Savings transfer → balance + pocket sync
- Soft delete (Group, Bill) preserves data
- Hard delete protection (Transaction, SusuContribution, SusuRound)

### Migration Tests
- Apply all migrations from scratch on SQLite
- Apply all migrations from scratch on PostgreSQL
- Rollback all migrations (verify no data corruption)
- Cross-database compatibility (same models work on both)

## Rollout Plan

1. **Phase 1** — Create Django apps, User model extensions, Group, GroupMember
2. **Phase 2** — Bill, BillItem, Transaction, PaymentProvider, Notification
3. **Phase 3** — USSDSession, SusuProfile, SusuContribution, SusuRound, SavingsPocket
4. **Phase 4** — All indexes, constraints, and optimization
5. **Phase 5** — Migration testing (SQLite + PostgreSQL), seed data, deployment

## Security Considerations

- All monetary fields use `DecimalField` (never float)
- `Transaction.reference` for idempotency (prevent duplicate charges)
- MPIN hashed via `make_password()` (same as User password)
- `select_for_update()` on all balance-affecting operations
- All financial operations within `@transaction.atomic`
- `JSONField` for extensible metadata (no schema lock)
- Audit trail: `created_at`/`updated_at` on all models
- `is_active` + `is_deleted` for account/group lifecycle
- `deleted_at` on soft-deleted models for GDPR compliance
- No soft delete on financial records (Transaction, SusuContribution, SusuRound)

## Open Questions

1. **Transaction reference format** — UUID or structured like `TXN-20260913-001`? (Resolved: Structured `TXN-YYYYMMDD-NNNN`)
2. **Bill status lifecycle** — `active → settled/cancelled` only, or add `overdue`? (Resolved: 3 statuses with `overdue`)
3. **GroupMember removal** — Soft delete or hard remove? (Resolved: Mark `removed_at`, preserve history)
4. **Notification cleanup** — 90 days? 30 days? Until user clears? (Resolved: 90 days auto-delete + manual clear)
5. **USSDSession User FK** — Add explicit User FK? (Resolved: Yes, nullable FK for registered users)
