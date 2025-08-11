# ReefBud

## Version History (excerpt)
### v2.2.0
- Switched to **Google-only** sign-in. Removed phone/PIN UI.
- Added `/auth/callback` handler and OAuth button.

### v2.2.1
- Ensure profile row exists on OAuth callback to avoid blank Dashboard.
- Dashboard renders safe empty state when no targets/readings yet.

### v2.2.2
- Restored **Home hub** at `/` with buttons to Dashboard, Calculator, Chemist, Products, Results.
- Made Dashboard the primary destination. Updated header auth to Google-only.
