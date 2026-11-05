// TODO(M4): magic-link auth.
//   POST /api/auth/request  { email } -> emails a signed token (log it in dev)
//   GET  /api/auth/verify?token=...   -> sets session cookie
//   GET  /api/me                      -> { user, plan }
export {};
