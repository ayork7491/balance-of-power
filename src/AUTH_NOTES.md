# Balance of Power — Auth Architecture Notes

Reference for contributors and future prompts. Describes how Base44 authentication
works, how public vs protected routes are separated, and what the platform constraints are.

---

## 1. How Base44 Authentication Works

Base44 provides a **platform-managed auth system** accessed via the `base44.auth.*` SDK.

### Session model
- Auth tokens are stored as a cookie or local token managed entirely by the Base44 platform.
- `appParams.token` (from `lib/app-params.js`) contains the current session token on boot.
- `base44.auth.me()` fetches the current user from the platform using that token.
- Sessions are persistent — the token survives page refreshes until the user logs out or it expires.

### What Base44 provides natively
| Method | What it does |
|---|---|
| `base44.auth.loginViaEmailPassword(email, pw)` | Validates credentials, sets session token |
| `base44.auth.loginWithProvider("google", returnUrl)` | Initiates Google OAuth redirect flow |
| `base44.auth.register({ email, password })` | Creates account, does NOT log in — requires OTP |
| `base44.auth.verifyOtp({ email, otpCode })` | Verifies email OTP, returns `access_token` |
| `base44.auth.resendOtp(email)` | Resends verification code |
| `base44.auth.me()` | Returns the current user object (throws if unauthenticated) |
| `base44.auth.updateMe(data)` | Persists app-level fields on the User entity |
| `base44.auth.logout(redirectUrl?)` | Clears token, optionally redirects |
| `base44.auth.resetPasswordRequest(email)` | Sends reset email |
| `base44.auth.resetPassword({ resetToken, newPassword })` | Completes reset |
| `base44.auth.redirectToLogin(nextUrl?)` | Redirects to the platform login page |

### Custom login pages vs platform redirect
- **Custom pages are fully supported.** `Login.jsx`, `Register.jsx`, `ForgotPassword.jsx`, and
  `ResetPassword.jsx` use the SDK methods above and work as standard React pages.
- `base44.auth.redirectToLogin()` redirects to the **platform's** built-in login UI, which is
  a fallback for error states. We do **not** use this in the normal app flow.
- Normal redirect after login uses `window.location.href = '/'` (hard reload) so the
  `AuthProvider` re-initialises with the new session token.

### `requiresAuth` app setting
- The Base44 dashboard has a **"Require Authentication"** toggle for the app.
- When **off (false)**: public access is allowed; the platform returns public app settings to
  unauthenticated requests without a 403. Our public auth routes work correctly.
- When **on (true)**: the platform 403s all requests from unauthenticated users, including
  requests to fetch app public settings. In this state, even `/login` could be blocked if the
  `AuthContext` error handler calls `navigateToLogin()` before the route renders.
- **Recommended setting for this app: `requiresAuth = false`.**
  We handle authentication ourselves via `ProtectedRoute`. The platform toggle adds no benefit
  and actively breaks the custom login flow.

---

## 2. Public vs Protected Routes

### Route split in `App.jsx`

```
Public (no auth check):
  /login
  /register
  /forgot-password
  /reset-password

Protected (requires auth via <ProtectedRoute>):
  /                            Home dashboard
  /settings                    User profile settings
  /profiles                    Tabletop game profiles
  /profiles/create
  /profiles/:id/edit
  /campaigns/create
  /campaigns/join
  /campaigns/:id/lobby
  /campaigns/:id
  /campaigns/:id/battles/:battleId
  /campaigns/:id/battles/:battleId/result
  /campaigns/:id/history
  /campaigns/:id/admin         Admin test mode
```

### How `ProtectedRoute` works

`ProtectedRoute` is a React Router v6 **layout route** (renders `<Outlet />`).

1. On mount it reads `isAuthenticated` and `isLoadingAuth` from `AuthContext`.
2. While loading → renders a spinner fallback.
3. If authenticated → renders `<Outlet />` (the nested page).
4. If not authenticated → renders `unauthenticatedElement`, which is
   `<Navigate to="/login" replace />` for all app routes.

The public auth pages (`/login` etc.) are declared **outside** the `<ProtectedRoute>` layout
route, so they are never blocked.

### `AuthContext` role

`AuthContext` / `AuthProvider` owns the global auth state:
- `user` — the raw `AuthUser` from `base44.auth.me()`, or `null`
- `isAuthenticated` — derived from whether `me()` succeeded
- `isLoadingAuth` / `isLoadingPublicSettings` — loading flags
- `authError` — error object with `type` and `message`

The context does **not** redirect on its own. Redirect decisions are made by
`ProtectedRoute` using the context values.

---

## 3. User Profile — App-Level Extensions

Base44's User entity has fixed built-in fields (`id`, `email`, `full_name`, `role`).

App-level extension fields are stored on the same entity via `base44.auth.updateMe()`:

| Field | Type | Purpose |
|---|---|---|
| `display_name` | `string \| null` | Preferred in-game name (pre-fills campaign join) |
| `default_color` | `PlayerColorId \| null` | Preferred player color (pre-fills campaign join) |

These are written by the Settings page via `useUserProfile.updateProfile()`.

### `displayName` resolution order
```
user.display_name → user.full_name → email prefix → 'Commander'
```
This is computed in `useUserProfile` and exposed as `user.displayName` (never null).

---

## 4. File Locations

| Concern | File |
|---|---|
| Auth state / session | `lib/AuthContext.jsx` |
| Route protection | `components/ProtectedRoute.jsx` |
| Profile hook | `features/auth/useUserProfile.js` |
| TypeScript models | `features/auth/types.ts` |
| Color picker component | `components/auth/ProfileColorPicker.jsx` |
| User menu (top nav) | `components/auth/UserMenuButton.jsx` |
| Login page | `pages/Login.jsx` |
| Register page | `pages/Register.jsx` |
| Forgot password page | `pages/ForgotPassword.jsx` |
| Reset password page | `pages/ResetPassword.jsx` |
| Settings page | `pages/Settings.jsx` |

---

## 5. Known Limitations

1. **No refresh token rotation** — Base44 manages token lifecycle. We cannot intercept 401s
   and silently refresh. Expired sessions redirect to login.
2. **`base44.auth.updateMe` field restrictions** — Only fields defined on the User entity
   schema can be persisted. `display_name` and `default_color` must exist in `entities/User.json`.
3. **Google OAuth** — Fully supported via `base44.auth.loginWithProvider("google", returnUrl)`.
   The redirect is handled by the platform; no OAuth client ID setup is required on our side.
4. **OTP verification required for email registration** — There is no way to skip OTP after
   `register()`. The Register page must always present the OTP step.
5. **`base44.auth.me()` throws on unauthenticated** — It does not return `null`; it throws.
   Always call it in a try/catch (which `useUserProfile` and `AuthContext` both do).