---
id: intro
title: Developer guide
sidebar_label: Overview
---

This information space is for contributors and implementers. It records the
accepted workspace boundaries and future platform seams without pretending that
the finance product or native application already exists.

## Start with the boundaries

- [Workspace architecture](architecture/workspace) explains the current apps
  and packages and what each one is allowed to own.
- [Future Expo/mobile workspace](architecture/mobile) describes the native
  boundary and the packages it may consume.
- [Native authentication](native/authentication) describes the intended Auth0
  flow for a future native client.
- [Native testing candidates](native/testing) lists the test layers to spike
  when the native workspace is implemented.
- [Deferred work](deferred-work) keeps finance-domain behavior and native code
  outside this bootstrap.

The developer and user-help spaces are intentionally separate. A link to the
other space means that the reader is changing audience, not that the two
information models have been merged.
