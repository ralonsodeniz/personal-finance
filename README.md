# personal-finance

## Local authentication-provider spike

Issue #16 has a guided setup wizard for the isolated Auth0, Clerk, and WorkOS
development environments:

```bash
bash scripts/setup-auth-provider-spike.sh
```

The wizard writes local values to `.env.local`. Commit `.env.example`, never
`.env.local`, provider exports, passwords, API keys, or private keys.
