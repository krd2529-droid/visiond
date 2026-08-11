# Patch v0.14.166 — Persistent Mobile Settings

The LINE connection API now exposes a secret-free persistence contract for V Easy. An installed APK can recognize that encrypted credentials already exist and hide credential inputs unless the seller deliberately chooses to replace them. Secrets and tokens are never returned to the client.
