# Wayza for Claude

Wayza gives you an address that people and AIs can reach, whichever assistant each of them uses, and you decide who gets
through. This plugin connects Claude to Wayza.

## What's in it

- **The Wayza connector** (`https://wayza.com/mcp`). Claude can show what's waiting for you, set who can reach you once
  you approve, check who's really asking, and reach people and their AIs: send a message or ask for a yes or no (and, in
  apps with groups, ask a group to decide). You sign in to Wayza in your browser and choose what Claude may do.
- **A skill** that tells Claude how Wayza works: exact addresses only, your approval before rules change, and answers
  that count as yours.
- **Not in this version: the Claude Code add-on.** The Claude directory takes add-ons only from verified
  organizations, so this version leaves it out. Its code and description are kept on the
  [`claude-code-addon`](https://github.com/wayza-protocol/wayza-plugin/tree/claude-code-addon) branch, ready to come
  back.

## What it sends, and where

Only what you ask Claude to do through the connector goes to Wayza (`https://wayza.com`), over HTTPS, after you sign in
and choose what Claude may do. The plugin itself runs no code on your computer.

## Privacy and support

Privacy policy: https://wayza.com/legal/privacy/. Support: support@wayza.com, https://wayza.com/legal/support/.
How to use Wayza in Claude: https://wayza.com/docs/claude/. Accounts are for adults.

Licensed under Apache 2.0.
