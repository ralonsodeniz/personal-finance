---
id: authentication
title: Native authentication flow
sidebar_label: Authentication flow
---

The accepted identity provider is Auth0, while authorization remains
application-owned. The native flow is a future implementation seam and must
not be confused with the web/PWA session model.

## Intended flow

1. The Expo app starts an Authorization Code flow through the system browser or
   a secure browser tab. It must not use an embedded WebView or the implicit
   flow.
2. The native client uses PKCE with `S256` and an exact, environment-specific
   redirect URI. Prefer an app-claimed HTTPS link for production; a
   reverse-domain custom scheme is the fallback while native link setup is
   being established.
3. Auth0 returns an authorization code to the app, which exchanges it through
   the native SDK. The app has no client secret.
4. Access tokens are short-lived and are sent to the API as `Authorization:
Bearer ...`. Rotating refresh credentials with reuse detection belong in
   platform secure storage managed by the provider SDK.
5. The API validates issuer, audience, signature, expiry, and required scopes
   before loading any authorized Resource. Authentication identifies who is
   acting; it does not grant access to another User's Workspace or Resource.
6. Sign-out clears local native credentials and invokes the provider sign-out or
   revocation path where supported. Application-side disabled/deleted state
   and Resource authorization still apply after sign-out or token expiry.

The internal identity key is the provider issuer and subject pair, `(iss, sub)`.
Email is a mutable contact attribute, not an authorization key.

## Web and native are deliberately different

The web app is intended to use a server-managed, encrypted cookie session. It
must not put long-lived refresh tokens in `localStorage` or ordinary browser
JavaScript. Native apps have an OS-protected credential store and a system
browser redirect, so they use the native token path above instead.

The shared boundary is the identity/session interface and the API's token
validation contract. Storage mechanics, redirect handling, lifecycle events,
and UI remain platform-specific.

## Still to implement

The native Auth0 application, callback allowlists, universal/app links, token
rotation configuration, secure-storage adapter, deep-link tests, and step-up
authentication behavior are future work. This documentation does not require
real Auth0 credentials.
