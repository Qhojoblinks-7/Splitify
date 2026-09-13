# State Management — Implementation Plan

## Context

Splitify needs state management across: authentication, balances, groups, bills, payments, USSD sessions, susu groups, savings pockets, and notifications. AGENTS.md specifies TanStack Query v5 (server state) and Zustand v5 (global client state).

## Decisions Resolved

| Decision | Choice |
|----------|--------|
| Server state | TanStack Query v5 |
| Global client state | Zustand v5 |
| Local state | React useState/useReducer |
| Persistence | Zustand persist + SecureStore for auth, AsyncStorage for preferences |
| Optimistic updates | TanStack Query mutations (onMutate/onError rollback) |
| Offline queue | AsyncStorage |

## Zustand Stores

### Auth Store

```javascript
// stores/authStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      // NOTE: token is NOT stored in persist (AsyncStorage).
      // Token lives only in SecureStore (encrypted) and in-memory via set during login.
      // onRehydrateStorage checks SecureStore for token on app start.
      isAuthenticated: false,
      login: async (user, token) => {
        await SecureStore.setItemAsync('token', token);
        set({ user, token, isAuthenticated: true });
      },
      logout: async () => {
        await SecureStore.deleteItemAsync('token');
        set({ user: null, token: null, isAuthenticated: false });
      },
      updateUser: (updates) => set((state) => ({ user: { ...state.user, ...updates } })),
    }),
    {
      name: 'auth-storage',
      // Exclude token from AsyncStorage persistence
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        // token is intentionally excluded
      }),
      onRehydrateStorage: () => async (state) => {
        // On app start, check SecureStore for existing token
        const token = await SecureStore.getItemAsync('token');
        if (token && state) {
          const user = await api.get('/api/auth/me').then(r => r.data.user);
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

const useUIStore = create(
  persist(
    (set) => ({
      theme: 'dark',
      currency: 'GHC',
      notificationsEnabled: true,
      activeTab: 'home',
      setTheme: (theme) => set({ theme }),
      setCurrency: (currency) => set({ currency }),
      setActiveTab: (tab) => set({ activeTab: tab }),
    }),
    { name: 'ui-storage' }
  )
);
```

### USSD Session Store

```javascript
// stores/ussdStore.js
import { create } from 'zustand';

const useUSSDStore = create((set) => ({
  activeSession: null,        // { sessionId, phoneNumber, menuState, sessionData }
  setSession: (session) => set({ activeSession: session }),
  updateSessionData: (data) => set((state) => ({
    activeSession: { ...state.activeSession, sessionData: { ...state.activeSession.sessionData, ...data } },
  })),
  clearSession: () => set({ activeSession: null }),
}));
```

### Transaction Queue Store (Offline)

```javascript
// stores/transactionQueueStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useTransactionQueueStore = create(
  persist(
    (set) => ({
      pendingTransactions: [],   // [{ id, type, data, timestamp, retries }]
      setPendingTransactions: (transactions) => set({ pendingTransactions: transactions }),
      addTransaction: (tx) => set((state) => ({
        pendingTransactions: [...state.pendingTransactions, { ...tx, retries: 0, timestamp: Date.now() }],
      })),
      removeTransaction: (id) => set((state) => ({
        pendingTransactions: state.pendingTransactions.filter((t) => t.id !== id),
      })),
      incrementRetry: (id) => set((state) => ({
        pendingTransactions: state.pendingTransactions.map((t) =>
          t.id === id ? { ...t, retries: t.retries + 1 } : t
        ),
      })),
    }),
    { name: 'tx-queue-storage' }
  )
);
```

## TanStack Query Configuration

```javascript
// lib/queryClient.js
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,     // 5 minutes
      gcTime: 30 * 60 * 1000,       // 30 minutes garbage collection
      refetchOnWindowFocus: true,    // refresh when app regains focus
      retry: (failureCount, error) => {
        if (error?.status === 401) return false;  // don't retry auth errors
        return failureCount < 2;
      },
    },
    mutations: {
      retry: 1,
      onError: (error, variables, context) => {
        // Rollback is handled per-mutation via context
        // Generic: log error for monitoring (Sentry)
      },
    },
  },
});
```

## Axios Instance

```javascript
// lib/api.js
import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
import { queryClient } from './queryClient';
import * as SecureStore from 'expo-secure-store';

const api = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
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

## Token Refresh

```javascript
// lib/tokenRefresh.js
let isRefreshing = false;
let failedRequestsQueue = [];

const processQueue = (error, token = null) => {
  failedRequestsQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error); else resolve(token);
  });
  failedRequestsQueue = [];
};

// Add to api.js response interceptor:
// On 401: queue requests, refresh token, replay queue
```

## Query Definitions

### Auth Queries

| Query Key | Endpoint | Stale Time |
|-----------|----------|------------|
| `['auth', 'me']` | GET `/api/auth/me` | 2 min |

### Balance Queries

| Query Key | Endpoint | Stale Time |
|-----------|----------|------------|
| `['balance']` | GET `/api/balance/` | 1 min |

### Group Queries

| Query Key | Endpoint | Stale Time |
|-----------|----------|------------|
| `['groups']` | GET `/api/groups/` | 5 min |
| `['group', groupId]` | GET `/api/groups/:id/` | 2 min |
| `['group', groupId, 'members']` | GET `/api/groups/:id/members/` | 5 min |
| `['group', groupId, 'balances']` | GET `/api/groups/:id/balances/` | 1 min |

### Bill/Expense Queries

| Query Key | Endpoint | Stale Time |
|-----------|----------|------------|
| `['bills', 'group', groupId]` | GET `/api/bills/?group=groupId` | 2 min |
| `['bill', billId]` | GET `/api/bills/:id/` | 2 min |

### Payment Queries

| Query Key | Endpoint | Stale Time |
|-----------|----------|------------|
| `['transactions']` | GET `/api/transactions/` | 2 min |
| `['transaction', txId]` | GET `/api/transactions/:id/` | 2 min |

### Susu Queries

| Query Key | Endpoint | Stale Time |
|-----------|----------|------------|
| `['susu']` | GET `/api/susu/` | 2 min |
| `['susu', susuId]` | GET `/api/susu/:id/` | 1 min |
| `['susu', susuId, 'contributions']` | GET `/api/susu/:id/contributions/` | 30 sec |

### Savings Queries

| Query Key | Endpoint | Stale Time |
|-----------|----------|------------|
| `['savings']` | GET `/api/savings/` | 2 min |
| `['savings', pocketId]` | GET `/api/savings/:id/` | 2 min |

### Notification Queries

| Query Key | Endpoint | Stale Time |
|-----------|----------|------------|
| `['notifications']` | GET `/api/notifications/` | 5 min |
| `['notifications', 'unread']` | GET `/api/notifications/?unread=true` | 1 min |

## Mutation Definitions

### Auth Mutations

```javascript
// mutations/auth.js
const useLoginMutation = useMutation({
  mutationFn: (credentials) => api.post('/api/auth/login/', credentials),
  onSuccess: (data) => {
    useAuthStore.getState().login(data.user, data.token);
  },
  onError: (error) => {
    // Show error message (not optimistic — wait for server)
  },
});

const useLogoutMutation = useMutation({
  mutationFn: () => api.post('/api/auth/logout/'),
  onSuccess: () => {
    useAuthStore.getState().logout();
    queryClient.clear();
    useTransactionQueueStore.getState().setPendingTransactions([]);
  },
});

const useCreateAccountMutation = useMutation({
  mutationFn: (data) => api.post('/api/auth/register/', data),
  onSuccess: (data) => {
    useAuthStore.getState().login(data.user, data.token);
  },
});
```

### Payment Mutations (with optimistic updates)

```javascript
// mutations/payments.js
const useSendMoneyMutation = useMutation({
  mutationFn: (data) => api.post('/api/payments/send/', data),
  onMutate: async (newData) => {
    await queryClient.cancelQueries(['transactions']);
    const previousBalance = queryClient.getQueryData(['balance']);
    queryClient.setQueryData(['balance'], (old) => ({
      ...old,
      amount: old.amount - newData.amount,
    }));
    useTransactionQueueStore.getState().addTransaction({
      id: `tx-${Date.now()}`,
      type: 'send',
      data: newData,
    });
    return { previousBalance };
  },
  onError: (err, variables, context) => {
    queryClient.setQueryData(['balance'], context.previousBalance);
  },
  onSettled: () => {
    queryClient.invalidateQueries(['transactions']);
    queryClient.invalidateQueries(['balance']);
  },
});

const useRequestMoneyMutation = useMutation({
  mutationFn: (data) => api.post('/api/payments/request/', data),
  onMutate: async (newData) => {
    await queryClient.cancelQueries(['transactions']);
    const previousBalance = queryClient.getQueryData(['balance']);
    queryClient.setQueryData(['balance'], (old) => ({
      ...old,
      amount: old.amount + newData.amount,
    }));
    return { previousBalance };
  },
  onError: (err, variables, context) => {
    queryClient.setQueryData(['balance'], context.previousBalance);
  },
  onSettled: () => {
    queryClient.invalidateQueries(['transactions']);
    queryClient.invalidateQueries(['balance']);
  },
});
```

### Susu Mutations

```javascript
const useSusuContributeMutation = useMutation({
  mutationFn: (data) => api.post(`/api/susu/${data.susuId}/contributions/`, data),
  onMutate: async (newData) => {
    await queryClient.cancelQueries(['susu', newData.susuId]);
    const prev = queryClient.getQueryData(['susu', newData.susuId]);
    queryClient.setQueryData(['susu', newData.susuId], (old) => ({
      ...old,
      contributions: [...old.contributions, { ...newData, verified: false }],
    }));
    return { prev };
  },
  onError: (err, variables, context) => {
    queryClient.setQueryData(['susu', variables.susuId], context.prev);
  },
  onSettled: () => {
    queryClient.invalidateQueries(['susu', variables.susuId]);
  },
});
```

### Savings Mutations

```javascript
const useCreatePocketMutation = useMutation({
  mutationFn: (data) => api.post('/api/savings/', data),
  onSuccess: () => { queryClient.invalidateQueries(['savings']); },
});

const usePocketTransferMutation = useMutation({
  mutationFn: ({ pocketId, type, amount }) =>
    api.post(`/api/savings/${pocketId}/transfer/`, { type, amount }),
  onMutate: async ({ pocketId, type, amount }) => {
    await queryClient.cancelQueries(['savings', pocketId]);
    const prev = queryClient.getQueryData(['savings', pocketId]);
    queryClient.setQueryData(['savings', pocketId], (old) => ({
      ...old,
      current_amount: type === 'in' ? old.current_amount + amount : old.current_amount - amount,
    }));
    return { prev };
  },
  onError: (err, variables, context) => {
    queryClient.setQueryData(['savings', variables.pocketId], context.prev);
  },
  onSettled: () => {
    queryClient.invalidateQueries(['savings']);
    queryClient.invalidateQueries(['balance']);
  },
});

const useMarkReadMutation = useMutation({
  mutationFn: (id) => api.patch(`/api/notifications/${id}/`, { read: true }),
  onSuccess: () => { queryClient.invalidateQueries(['notifications']); },
});
```

## Query Hooks

```javascript
// hooks/useAuthQueries.js
export const useAuthMe = () => useQuery({
  queryKey: ['auth', 'me'],
  queryFn: () => api.get('/api/auth/me').then(r => r.data),
  enabled: useAuthStore.getState().isAuthenticated,
});

// hooks/useBalanceQueries.js
export const useBalance = () => useQuery({
  queryKey: ['balance'],
  queryFn: () => api.get('/api/balance/').then(r => r.data),
});

// hooks/useGroupQueries.js
export const useGroups = () => useQuery({
  queryKey: ['groups'],
  queryFn: () => api.get('/api/groups/').then(r => r.data),
});

export const useGroup = (groupId) => useQuery({
  queryKey: ['group', groupId],
  queryFn: () => api.get(`/api/groups/${groupId}/`).then(r => r.data),
  enabled: !!groupId,
});

export const useGroupMembers = (groupId) => useQuery({
  queryKey: ['group', groupId, 'members'],
  queryFn: () => api.get(`/api/groups/${groupId}/members/`).then(r => r.data),
  enabled: !!groupId,
});

// hooks/usePaymentMutations.js
export const useSendMoney = () => useMutation({
  mutationFn: (data) => api.post('/api/payments/send/', data),
});

export const useRequestMoney = () => useMutation({
  mutationFn: (data) => api.post('/api/payments/request/', data),
});

// hooks/useSusuMutations.js
export const useSusuContribute = (susuId) => useMutation({
  mutationFn: (data) => api.post(`/api/susu/${susuId}/contributions/`, data),
});

export const useSusuPayout = (susuId) => useMutation({
  mutationFn: () => api.post(`/api/susu/${susuId}/payout/`),
  onSuccess: () => {
    queryClient.invalidateQueries(['susu', susuId]);
    queryClient.invalidateQueries(['susu']);
  },
});

// hooks/useSavingsMutations.js
export const useCreatePocket = () => useMutation({
  mutationFn: (data) => api.post('/api/savings/', data),
});

export const usePocketTransfer = (pocketId) => useMutation({
  mutationFn: ({ type, amount }) =>
    api.post(`/api/savings/${pocketId}/transfer/`, { type, amount }),
});

// hooks/useNotificationMutations.js
export const useMarkRead = (id) => useMutation({
  mutationFn: () => api.patch(`/api/notifications/${id}/`, { read: true }),
  onSuccess: () => { queryClient.invalidateQueries(['notifications']); },
});
```

## Offline Queue Worker

```javascript
// lib/offlineWorker.js
import NetInfo from '@react-native-community/netinfo';
import { useTransactionQueueStore } from '../stores/transactionQueueStore';
import { queryClient } from '../lib/queryClient';
import api from './api';

const retryMutation = async (type, data) => {
  switch (type) {
    case 'send': return api.post('/api/payments/send/', data);
    case 'request': return api.post('/api/payments/request/', data);
    case 'susu-contribute': return api.post(`/api/susu/${data.susuId}/contributions/`, data);
    case 'savings-transfer': return api.post(`/api/savings/${data.pocketId}/transfer/`, data);
    default: throw new Error(`Unknown transaction type: ${type}`);
  }
};

const retryQueue = async () => {
  const pending = useTransactionQueueStore.getState().pendingTransactions;
  for (const tx of pending) {
    if (tx.retries >= 3) continue;
    try {
      await retryMutation(tx.type, tx.data);
      useTransactionQueueStore.getState().removeTransaction(tx.id);
      queryClient.invalidateQueries(['balance']);
      queryClient.invalidateQueries(['transactions']);
    } catch (error) {
      useTransactionQueueStore.getState().incrementRetry(tx.id);
    }
  }
};

const startOfflineWorker = () => {
  NetInfo.fetch().then((state) => {
    if (state.isConnected) retryQueue();
  });
  const unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected) retryQueue();
  });
  return unsubscribe;
};
```

## State Flow Diagram

```
User Action (e.g., Send Money)
  → React Component
    → Zustand Store (UI state update: loading = true)
      → TanStack Query Mutation (API call)
        → onMutate: Optimistic balance update + offline queue
        → API Response
          → onSuccess: Clear offline queue, invalidate queries
          → onError: Rollback balance, keep in queue
        → onSettled: Refresh balance + transactions queries
          → Components re-render with fresh data
```

## Cross-Component State Access

| Component | Reads | Writes |
|-----------|-------|--------|
| HomeScreen | `['balance']`, `['activity']`, `['notifications']` | — |
| Notifications | `['notifications']` | `['notification', id]` (mark read) |
| Profile | `useAuthStore` (user), `useUIStore` (theme) | `useAuthStore` (update user) |
| Login | — | `useAuthStore` (login) |
| Susu Detail | `['susu', id]`, `['susu', id, 'contributions']` | `useSusuContributeMutation` |
| Savings Detail | `['savings', id]` | `['savings', id]` (transfer mutation) |
| Group Detail | `['group', id]`, `['group', id, 'members']` | — |
| USSD Progress | `useUSSDStore` (activeSession) | `useUSSDStore` (updateSession) |

## Implementation Task List

1. **Install dependencies** — `@tanstack/react-query`, `zustand`, `expo-secure-store`, `@react-native-community/netinfo`, `axios`
2. **Create `lib/api.js`** — Axios instance with token interceptor, 401 handler
3. **Create `lib/queryClient.js`** — QueryClient configuration with stale times, retry logic
4. **Create `lib/offlineWorker.js`** — Retry queue, `retryMutation`, NetInfo listener
5. **Create `lib/tokenRefresh.js`** — Token refresh interceptor, request queuing
6. **Create `stores/authStore.js`** — Auth Zustand store with SecureStore persist
7. **Create `stores/uiStore.js`** — Theme, currency, active tab Zustand store
8. **Create `stores/ussdStore.js`** — USSD session Zustand store
9. **Create `stores/transactionQueueStore.js`** — Offline transaction queue Zustand store
10. **Create `hooks/useAuthQueries.js`** — Auth query hooks (`useAuthMe`)
11. **Create `hooks/useBalanceQueries.js`** — Balance query hooks
12. **Create `hooks/useGroupQueries.js`** — Group query hooks (list, detail, members, balances)
13. **Create `hooks/usePaymentMutations.js`** — Send, request mutations with optimistic updates
14. **Create `hooks/useSusuMutations.js`** — Susu contribution, payout mutations
15. **Create `hooks/useSavingsMutations.js`** — Create pocket, pocket transfer mutations
16. **Create `hooks/useNotificationMutations.js`** — Mark read mutation
17. **Integrate QueryClientProvider** in `index.js` or `App.jsx`
18. **Integrate Zustand stores** in app entry point
19. **Wire offline worker** in app entry point
20. **Test auth flow** with persisted session across app restart
21. **Test offline mode** — Queue transactions, reconnect, verify sync
22. **Test optimistic updates** — Verify rollback on failure

## Dev Tools

- React Query DevTools: `<ReactQueryDevtools initialIsOpen={false} />`
- Zustand DevTools: `devtools` middleware on stores

## Open Questions

1. **Query keys for USSD data** — Should USSD data use TanStack Query (cached) or Zustand only (ephemeral)? Since USSD sessions expire in 30s, Zustand-only makes sense.
2. **Push notification payload** — When FCM triggers, does it carry enough data to determine which query to invalidate? (e.g., `{ type: 'susu-payout', susuId: 5 }`)
3. **Transaction queue conflict** — What if user makes a payment while offline, then reconnects WHILE another payment is in-flight? Need locking mechanism.

## Security Considerations

- Auth token stored in SecureStore (encrypted), NOT AsyncStorage
- Zustand persist uses AsyncStorage for non-sensitive data (theme, currency)
- JWT token excluded from Zustand persist (stored separately in SecureStore)
- All API requests include `Authorization: Bearer ${token}` from SecureStore
- Axios 401 interceptor clears auth and redirects to login
- All amounts validated server-side (never trust client-calculated values)

## Testing Strategy

### Zustand Stores
- Test auth store: login, logout, updateUser
- Test UI store: theme toggle, currency change
- Test USSD store: session set/update/clear
- Test transaction queue: add, remove, increment retry

### TanStack Query
- Mock API responses, test query caching behavior
- Test mutation optimistic update + rollback
- Test query invalidation triggers
- Test offline queue retry logic

### Integration
- Test state sync across components (e.g., balance updates on HomeScreen after payment)
- Test auth state persistence across app restart
- Test offline mode: queue transactions, reconnect, verify sync
- Test token refresh flow (401 → queue → refresh → replay)
