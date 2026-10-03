# State Management — Implementation Plan

**Scope: group susu only.**

## Context

Growl needs state management for exactly four things: **auth**, **susu groups**, **contributions
and rounds**, and **notifications**. AGENTS.md specifies TanStack Query v5 (server state) and
Zustand v5 (global client state).

Dropped from the original scope: balances, bills/expenses, send/request money, savings pockets,
USSD sessions. None of those products exist.

## Decisions Resolved

| Decision | Choice |
|----------|--------|
| Server state | TanStack Query v5 |
| Global client state | Zustand v5 |
| Local state | React `useState` / `useReducer` |
| Persistence | Zustand persist + SecureStore for auth, AsyncStorage for preferences and the offline queue |
| Optimistic updates | Susu contributions and marks only |
| **Offline queue** | **AsyncStorage — first-class, not an afterthought.** Signal drops constantly in Ghana markets. This is our clearest advantage over every competitor. |

## Zustand Stores

### Auth Store

```javascript
// stores/authStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      // Token is NOT in the AsyncStorage persist payload. It lives only in SecureStore.
      isAuthenticated: false,
      login: async (user, token) => {
        await SecureStore.setItemAsync('token', token);
        set({ user, token, isAuthenticated: true });
      },
      logout: async () => {
        await SecureStore.deleteItemAsync('token');
        set({ user: null, token: null, isAuthenticated: false });
      },
      updateUser: (updates) =>
        set((state) => ({ user: { ...state.user, ...updates } })),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => async (state) => {
        const token = await SecureStore.getItemAsync('token');
        if (token && state) {
          const user = await api.get('/api/auth/me').then((r) => r.data.user);
          state.login(user, token);
        }
      },
    }
  )
);
```

### UI Store

```javascript
// stores/uiStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useUIStore = create(
  persist(
    (set) => ({
      theme: 'dark',
      notificationsEnabled: true,
      activeTab: 'susu',
      setTheme: (theme) => set({ theme }),
      setNotificationsEnabled: (on) => set({ notificationsEnabled: on }),
      setActiveTab: (tab) => set({ activeTab: tab }),
    }),
    { name: 'ui-storage' }
  )
);
```

### Offline Queue Store

**The most important store in the app.** A collector logging a contribution in a market with no
signal must be able to record it and have it sync later. If we get this wrong, real Ghanaian
markets cannot use the product.

```javascript
// stores/offlineQueueStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useOfflineQueueStore = create(
  persist(
    (set) => ({
      // [{ id, groupId, type, payload, createdAt, retries, status }]
      // type: 'contribution' | 'verify' | 'flag' | 'payout'
      queue: [],
      enqueue: (item) =>
        set((state) => ({
          queue: [
            ...state.queue,
            { ...item, id: `q-${Date.now()}-${Math.random()}`, retries: 0, status: 'pending', createdAt: Date.now() },
          ],
        })),
      markSynced: (id) =>
        set((state) => ({ queue: state.queue.filter((q) => q.id !== id) })),
      incrementRetry: (id) =>
        set((state) => ({
          queue: state.queue.map((q) =>
            q.id === id ? { ...q, retries: q.retries + 1 } : q
          ),
        })),
      clear: () => set({ queue: [] }),
    }),
    { name: 'offline-queue-storage' }
  )
);
```

**Note on duplicates.** A contribution queued offline could be replayed after a partial network
failure. Every queue item must carry a **client-generated idempotency key** that the backend
treats as unique, so a replay can never create a second contribution.

## Axios Instance

```javascript
// lib/api.js
import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
import { queryClient } from './queryClient';
import * as SecureStore from 'expo-secure-store';

export const api = axios.create({
  baseURL: 'https://api.growl.example',
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // Attach the idempotency key for any queued write
  if (config.headers['X-Idempotency-Key']) {
    config.headers['X-Idempotency-Key'] = config.headers['X-Idempotency-Key'];
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      queryClient.clear();
    }
    return Promise.reject(error);
  }
);

export default api;
```

## TanStack Query Configuration

```javascript
// lib/queryClient.js
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => {
        if (error?.status === 401) return false;
        return failureCount < 2;
      },
    },
    mutations: { retry: 1 },
  },
});
```

## Query Definitions

### Auth

| Query Key | Endpoint | Stale Time |
|-----------|----------|------------|
| `['auth', 'me']` | GET `/api/auth/me` | 2 min |

### Susu

| Query Key | Endpoint | Stale Time |
|-----------|----------|------------|
| `['susu']` | GET `/api/susu/` | 2 min |
| `['susu', groupId]` | GET `/api/susu/:id/` | 30 sec |
| `['susu', groupId, 'contributions']` | GET `/api/susu/:id/contributions/` | 30 sec |
| `['susu', groupId, 'members']` | GET `/api/susu/:id/members/` | 5 min |
| `['activity']` | GET `/api/activity/` | 1 min |

**Round state must never be cached long.** A stale rotation means a member is told the wrong person
is collecting. `staleTime` of 30 seconds on group detail is a product decision, not a performance one.

## Mutation Definitions

### Auth

```javascript
export const useLoginMutation = useMutation({
  mutationFn: (credentials) => api.post('/api/auth/login/', credentials).then((r) => r.data),
  onSuccess: (data) => useAuthStore.getState().login(data.user, data.token),
});

export const useLogoutMutation = useMutation({
  mutationFn: () => api.post('/api/auth/logout/'),
  onSuccess: () => {
    useAuthStore.getState().logout();
    queryClient.clear();
    useOfflineQueueStore.getState().clear();
  },
});
```

### Susu

```javascript
export const useContributeMutation = useMutation({
  mutationFn: ({ groupId, ...data }) =>
    api
      .post(`/api/susu/${groupId}/contributions/`, data, {
        headers: { 'X-Idempotency-Key': data.idempotencyKey },
      })
      .then((r) => r.data),
  onMutate: async (newData) => {
    await queryClient.cancelQueries(['susu', newData.groupId]);
    const prev = queryClient.getQueryData(['susu', newData.groupId]);
    // Optimistic: show immediately as PENDING — never as verified
    queryClient.setQueryData(['susu', newData.groupId], (old) => ({
      ...old,
      contributions: [
        ...(old?.contributions ?? []),
        { ...newData, status: 'pending', pendingSync: true },
      ],
    }));
    return { prev };
  },
  onError: (err, variables, context) => {
    queryClient.setQueryData(['susu', variables.groupId], context.prev);
  },
  onSettled: (data, error, variables) => {
    queryClient.invalidateQueries(['susu', variables.groupId]);
    queryClient.invalidateQueries(['susu']);
    queryClient.invalidateQueries(['activity']);
  },
});
```

**Critical rule: optimistic updates may set status to `pending`, never `verified`.** Verification is
server-side and payment-rail-backed. Showing a contribution as verified before the server confirms
it defeats the entire product promise.

```javascript
export const useVerifyMutation = useMutation({
  mutationFn: ({ groupId, contributionId }) =>
    api.post(`/api/susu/${groupId}/contributions/${contributionId}/verify/`).then((r) => r.data),
  onSuccess: () => {
    queryClient.invalidateQueries(['susu']);
    queryClient.invalidateQueries(['activity']);
  },
});

export const useFlagMutation = useMutation({
  mutationFn: ({ groupId, contributionId }) =>
    api.post(`/api/susu/${groupId}/contributions/${contributionId}/flag/`).then((r) => r.data),
  onSuccess: () => {
    queryClient.invalidateQueries(['susu']);
    queryClient.invalidateQueries(['activity']);
  },
});

export const usePayoutMutation = useMutation({
  mutationFn: ({ groupId }) => api.post(`/api/susu/${groupId}/payout/`).then((r) => r.data),
  onSuccess: () => {
    queryClient.invalidateQueries(['susu']);
    queryClient.invalidateQueries(['activity']);
  },
});

export const useJoinGroupMutation = useMutation({
  mutationFn: ({ inviteCode, name, phone }) =>
    api.post('/api/susu/join/', { inviteCode, name, phone }).then((r) => r.data),
  onSuccess: () => {
    queryClient.invalidateQueries(['susu']);
  },
});
```

## Query Hooks

```javascript
// hooks/useSusuQueries.js
export const useSusuGroups = () =>
  useQuery({ queryKey: ['susu'], queryFn: () => api.get('/api/susu/').then((r) => r.data) });

export const useSusuGroup = (groupId) =>
  useQuery({
    queryKey: ['susu', groupId],
    queryFn: () => api.get(`/api/susu/${groupId}/`).then((r) => r.data),
    enabled: !!groupId,
    refetchInterval: 30000, // keep round state fresh
  });

export const useSusuContributions = (groupId) =>
  useQuery({
    queryKey: ['susu', groupId, 'contributions'],
    queryFn: () => api.get(`/api/susu/${groupId}/contributions/`).then((r) => r.data),
    enabled: !!groupId,
  });

export const useActivity = (filter) =>
  useQuery({
    queryKey: ['activity', filter],
    queryFn: () => api.get('/api/activity/', { params: { filter } }).then((r) => r.data),
  });

// hooks/useAuthQueries.js
export const useAuthMe = () =>
  useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.get('/api/auth/me').then((r) => r.data),
    enabled: useAuthStore.getState().isAuthenticated,
  });
```

## Offline Sync Worker

```javascript
// lib/offlineWorker.js
import NetInfo from '@react-native-community/netinfo';
import { useOfflineQueueStore } from '../stores/offlineQueueStore';
import { queryClient } from './queryClient';
import api from './api';

const send = (item) => {
  const { groupId, type, payload, id } = item;
  const base = { headers: { 'X-Idempotency-Key': id } };
  switch (type) {
    case 'contribution':
      return api.post(`/api/susu/${groupId}/contributions/`, payload, base);
    case 'verify':
      return api.post(`/api/susu/${groupId}/contributions/${payload.contributionId}/verify/`);
    case 'flag':
      return api.post(`/api/susu/${groupId}/contributions/${payload.contributionId}/flag/`);
    default:
      throw new Error(`Unknown queue type: ${type}`);
  }
};

export const retryQueue = async () => {
  const queue = useOfflineQueueStore.getState().queue;
  // Oldest first, so a member's contributions replay in the order they were made
  for (const item of queue) {
    if (item.retries >= 5) continue;
    try {
      await send(item);
      useOfflineQueueStore.getState().markSynced(item.id);
    } catch {
      useOfflineQueueStore.getState().incrementRetry(item.id);
    }
  }
  queryClient.invalidateQueries({ queryKey: ['susu'] });
  queryClient.invalidateQueries({ queryKey: ['activity'] });
};

export const startOfflineWorker = () => {
  NetInfo.fetch().then((s) => s.isConnected && retryQueue());
  return NetInfo.addEventListener((s) => s.isConnected && retryQueue());
};
```

**Payouts are never queued.** A payout moves real money and is gated on server-side verification.
It must never fire from a stale offline client.

## State Flow Diagram

```
Member taps "Log contribution"
  → BottomSheet opens
    → Optimistic insert as PENDING (never VERIFIED)
      → Offline queue enqueue (idempotency key generated)
        → Network available?
          ├── No  → stays queued, UI shows "Saved offline"
          └── Yes → POST /contributions/
                → Rail verifies the reference server-side
                  → pending → verified | failed
                    → invalidate ['susu', groupId] + ['activity']
                      → all contributions verified?
                        → Yes → payout becomes eligible
```

## Cross-Component State Access

| Component | Reads | Writes |
|-----------|-------|--------|
| Susu Home | `['susu']` | `useJoinGroupMutation` |
| Susu Detail | `['susu', id]`, `['susu', id, 'contributions']` | `useContributeMutation`, `useVerifyMutation`, `useFlagMutation`, `usePayoutMutation` |
| Activity | `['activity', filter]` | — |
| Login / Create Account | — | `useLoginMutation`, `useCreateAccountMutation` |
| Account | `useAuthStore` | `useLogoutMutation` |

## Implementation Task List

1. Install `@tanstack/react-query`, `axios`, `expo-secure-store`, `@react-native-community/netinfo`
2. `lib/api.js` — Axios instance, auth interceptor, idempotency header, 401 handler
3. `lib/queryClient.js` — QueryClient with the stale times above
4. `lib/offlineWorker.js` — retry queue, NetInfo listener, ordered replay
5. `lib/tokenRefresh.js` — token refresh with request queueing
6. `stores/authStore.js` — SecureStore-backed auth
7. `stores/uiStore.js` — theme, active tab
8. `stores/offlineQueueStore.js` — the offline queue
9. `hooks/useAuthQueries.js`, `hooks/useSusuQueries.js`
10. `hooks/useSusuMutations.js` — contribute, verify, flag, payout, join
11. `QueryClientProvider` + store wiring + offline worker in the app entry point
12. **Backend**: idempotency key handling on `POST /contributions/` (unique constraint)
13. **Backend**: `SusuGroup`, `SusuMember`, `SusuContribution`, `SusuRound` + JWT auth
14. Replace the `CURRENT_USER_ID` stub with real session state
15. Test: auth persists across app restart
16. Test: contribution queued offline, syncs on reconnect, creates exactly one row
17. Test: optimistic insert shows `pending`, then reconciles to `verified`
18. Test: stale cache never shows the wrong current receiver

## Security Considerations

- Auth token in **SecureStore only** — never in the AsyncStorage persist payload
- **All amounts validated server-side.** Never trust client-calculated shares.
- Payout requires server-side confirmation that every contribution is verified
- `select_for_update()` on round state to prevent double payouts
- Idempotency keys on every contribution write
- Act 843: register as data controller, appoint a DPO, encrypt in transit and at rest

## Testing Strategy

### Zustand stores
- Auth: login, logout, rehydrate from SecureStore
- Offline queue: enqueue, markSynced, incrementRetry, clear
- **Queue ordering is oldest-first**

### TanStack Query
- Optimistic insert renders `pending` immediately
- Rollback restores previous state on error
- Invalidation refetches group detail and activity
- **Group detail refetches on focus so the current receiver is never stale**

### Offline
- Contribute with no network → queued, UI shows saved offline
- Reconnect → syncs in order, exactly one contribution created
- Replay of an already-applied item is a no-op (idempotency)

### Integration
- Round advances on confirmed payout; `currentTurnIndex` rotates
- Missing contributions do not block the member's own logged contribution
- Admin flagging a contribution blocks the round until resolved