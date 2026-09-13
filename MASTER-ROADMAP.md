# Splitify — Master Implementation Roadmap

## Overview

This roadmap orders all plans by dependency and implementation priority. Each plan is a self-contained document in the project root.

## Plans

| # | Plan | File | Priority | Depends On |
|---|------|------|----------|------------|
| 1 | Backend Stack | Plan needed | Critical | None |
| 2 | Database Schema | `DATABASE.md` | Critical | Backend Stack |
| 3 | State Management | `STATE-MANAGEMENT.md` | Critical | Backend Stack, Database |
| 4 | Screen Documentation | `SCREEN-DOCUMENTATION.md` | Reference | State Management |
| 5 | Auth Flow (screens) | Existing code | High | State Management |
| 6 | HomeScreen (screens) | Existing code | High | State Management |
| 7 | USSD Payment Integration | `USSD-PAYMENT-INTEGRATION.md` | Medium | Backend Stack, State Mgmt |
| 8 | Savings Pockets | `SAVINGS-POCKETS.md` | Medium | State Mgmt, Backend |
| 9 | Group Susu | `GROUP-SUSU.md` | Medium | State Mgmt, Backend |

## Dependency Graph

```
Backend Stack (Django, DRF, Celery, Redis, FCM)
       │
       ├── Database Schema (14 models, relationships, constraints)
       │       │
       ├── State Management (Zustand, TanStack Query, offline queue)
       │       │
       │       ├── Auth Flow (login, register, OTP, password reset)
       │       │
       │       ├── HomeScreen (balance, actions, activity)
       │       │
       │       ├── USSD Payment Integration (backend + client)
       │       │
       │       ├── Savings Pockets (Profile → Savings)
       │       │
       │       └── Group Susu (new Susu tab)
       │
       └── Screen Documentation (reference for all screens)
```

## Implementation Order

### Phase 1: Foundation (Weeks 1-3)
1. Backend Stack — Django models, endpoints, Celery tasks, FCM setup
2. Database Schema — 14 models, relationships, constraints, migration strategy
3. State Management — Stores, query client, mutations, offline worker

### Phase 2: Core App (Weeks 4-7)
3. Auth Flow — Login, register, OTP, password reset (using State Management)
4. HomeScreen — Balance, actions, activity (using State Management)
5. Profile — User info, settings (using State Management)

### Phase 3: Extended Features (Weeks 8-12)
6. Savings Pockets — Profile → Savings section
7. USSD Payment Integration — Django backend + AT gateway + app instructions
8. Group Susu — Susu tab, creation, contribution flow

### Phase 4: Polish (Week 13)
9. Screen Documentation — All screens finalized
10. Testing — All plans' testing strategies executed
11. E2E testing — Full user flows

## Cross-Plan References

| Plan | References |
|------|-----------|
| Backend Stack | AGENTS.md (Django 5.x, DRF, SQLite/PostgreSQL, Celery, Redis, FCM) |
| Database Schema | Backend Stack (Django models), State Management (transaction types), all domain plans (models) |
| USSD | State Management (FCM), Screen Doc (USSD nav, profile updates), Database (USSDSession) |
| Savings | Screen Doc (Profile section), State Management (pocket transfer), Database (SavingsPocket) |
| Susu | Screen Doc (Susu tab), State Management (susu state), Database (SusuProfile, SusuContribution, SusuRound), USSD (clarification: app only) |
| State Mgmt | All plans (foundational) |
| Screen Doc | USSD, Savings, Susu (cross-references in Profile section) |

## Notes

- Backend Stack plan is implied (Django + DRF + Celery + Redis + FCM per AGENTS.md + discussions)
- Database Schema is finalized — 14 models, all decisions resolved (see DATABASE.md)
- All plans use JWT auth, TanStack Query, Zustand as established in State Management
- USSD is app-only for susu and savings — USSD core flow is Balance/Settle/Request only
- All 9 plans are at project root as standalone documents
