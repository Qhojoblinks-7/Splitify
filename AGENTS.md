# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ or v57 before writing any code.


---

```markdown

## 1. Developer Profile & Preferred Tech Stack

### Web & Mobile Stack
- **Frontend Framework:** React 19 (Vite 7) with pure JavaScript (`.js` / `.jsx`). **NO TypeScript.** Use `prop-types` for component property validation when necessary.
- **UI & Styling:** Tailwind CSS v4, `shadcn/ui` component primitives, and Lucide React icons.
- **State & Data Fetching:** TanStack Query v5 (React Query) for server state/caching, Zustand v5 for global client state, the platform `fetch` (no HTTP client dependency) for API requests. Do not add Axios: eight disclosed CVEs in 2026, including a CVSS 10.0 SSRF (CVE-2026-40175) and a prototype-pollution gadget that silently rewrites JSON responses (CVE-2026-42033). All HTTP access goes through one wrapper owning the base URL, auth header, timeout, and idempotency key, so no caller can supply its own absolute URL.
- **Routing & Visuals:** React Router v7 and Recharts v2.x for analytics.
- **Backend Framework:** Django 5.x with Django REST Framework (DRF) 3.14+, Python 3.10+, and SQLite (local dev) / PostgreSQL (production target).
- **Mobile Target (when applicable):** React Native (Expo) with TanStack Query and Zustand.

---



<ElicitationsGroup message="Where would you like to place or expand this rules file?">
  <Elicitation label="Save as .kilocode/rules for Kilo Code AI assistant" query="How do I place this configuration into the .kilocode/rules folder for VS Code and Kilo Code integration?"/>
  <Elicitation label="Add offline IndexedDB error recovery rules" query="Add specific error handling and local storage fallback rules for offline Wi-Fi drops to the configuration."/>
</ElicitationsGroup>

```