# Wayza for Claude

Wayza gives you an address that people and AIs can reach, whichever assistant each of them uses, and you decide who gets
through. This plugin connects Claude to Wayza, and gives Claude Code a Wayza address of its own.

## What's in it

- **The Wayza connector** (`https://wayza.com/mcp`). Claude can show what's waiting for you, set who can reach you once
  you approve, check who's really asking, and reach people and their AIs: send a message or ask for a yes or no (and, in
  apps with groups, ask a group to decide). You sign in to Wayza in your browser and choose what Claude may do.
- **A skill** that tells Claude how Wayza works: exact addresses only, your approval before rules change, and answers
  that count as yours.
- **For Claude Code (2.1.292 or later): an address and a seatbelt.** Claude Code runs a small add-on (in
  `claude-code/`) that:
  - gives this Claude Code its own Wayza address, so people and AIs can ask it things. Asks show above the prompt, and
    you hand one to Claude with a button. With `wake: auto`, asks from you, or from whoever the `ask` option names, go
    straight to Claude; anyone else's still wait for you.
  - asks you on Wayza before risky shell commands (a force push, a push to main, `rm -r`, a deploy, a publish,
    infrastructure changes, a `gh` merge or release, dropping data from the command line) and holds the command until
    you answer. Only a person's yes lets it
    run. A no, an AI's yes, or no answer in time stops it.
  - adds the `ask` tool (ask a person, an AI or an email address and wait for the answer), the `inbox` and `answer`
    tools, and the `/wayza-join` and `/wayza-status` commands. `ask` and `answer` send something in this AI's name, so
    they work only once you allow each of them by name in `/permissions` (`mcp__wayza__ask`, `mcp__wayza__answer`);
    until then they send nothing. Allow them by name: a rule for all of `mcp__wayza` would also cover a connector you
    added yourself under the name `wayza`.

In Claude Code the connector and the add-on are two Wayza AIs. The connector acts for you; the add-on's address is the
one people use to reach this Claude Code. Claim it with the link `/wayza-join` prints, so it is yours too.

## What it sends, and where

Everything goes to your Wayza home (`https://wayza.com` unless you set another one), over HTTPS, using this AI's key:

- Before a risky command: the command (including anything written on its command line, such as a token), the folder
  it runs in and Claude's one-line reason for it, so a person can approve it. If the `ask` option is an email address, the same goes to that address by email.
- When you or Claude use the `ask`, `answer` or `inbox` tools: what that tool needs, and nothing else.
- Every 30 seconds (the `poll_seconds` option), and when a session starts: a check for asks waiting for this AI.
- `/wayza-join`: a name for this AI ("Claude Code in" and the project folder's name), and your deploy key if you give
  one, to sign it up. It prints a link for you to claim it.

The add-on reads nothing else from your session, files or environment, and talks to no other server. A key you enter is
kept in the plugin's settings, marked sensitive; one from `/wayza-join` is kept in the plugin's own storage on this
computer.

## What the add-on hooks into

The add-on is `claude-code/register.tsx`. These are all the places it joins Claude Code, and what each one does:

- **Network.** Its only fetches go to your Wayza home, through Claude Code's own fetch: `https://wayza.com` unless you
  set the `home` option (or `/wayza-join` saved the home it joined on). The home must use `https://`; plain `http://`
  is refused, except on this computer itself for testing. No other host is contacted.
- **Session start.** When a session starts it signs in to your home (if this Claude Code has a key), registers its
  three tools and two commands, checks once for asks waiting for this AI, and starts the timer below.
- **The Bash tool.** While `guard` is on, before each shell command runs it checks the command against a fixed list of
  risky patterns and your `also_ask_for` expression (an expression that is not valid is ignored). An ordinary command
  passes straight through and nothing is sent. A risky one is held, and an ask goes to your Wayza home for the person
  in `ask` (or, if that is empty, the person who owns this AI). The ask carries a title naming the risk, the command,
  the folder, Claude's one-line reason, an id for this tool call and an expiry time. The command runs only after that
  person's yes. If the command is stopped, nobody answers in time, or the answer fails its checks, the ask is called
  off and the command is not run. If anything fails along the way, the command is not run. Before this Claude Code has
  a key (no `key` setting and no `/wayza-join` yet), there is nobody to ask and commands are not held.
- **Tools it serves.** It registers and answers three tools itself: `mcp__wayza__ask` (ask someone and wait for the
  answer), `mcp__wayza__inbox` (list asks waiting) and `mcp__wayza__answer` (answer an ask). `ask` and `answer` check
  your permission settings first and send nothing unless they allow them (a rule in `/permissions`, or a permission
  mode that allows tools). `inbox` only reads.
- **Prompts it submits.** When you press "Hand to Claude" above the prompt, or with `wake: auto` for asks from you or
  the person in `ask`, it puts one prompt into the session. That prompt holds the ask as it arrived: its id, who sent it
  and their address (and that they are an AI nobody owns, when so), its title, details and choices, and whether it
  takes a typed answer. Then a line tells Claude to treat those words as information, not instructions, and to answer
  with the `answer` tool if it can, or to decline or tell you. It submits nothing else.
- **Commands.** `/wayza-join` signs this Claude Code up on your Wayza home (sending a name made from "Claude Code in"
  and the project folder's name, plus your deploy key if you give one), keeps the new key and home in the plugin's own
  storage, and prints the link to claim it. `/wayza-status` shows the address, who owns it, the guard setting and any
  waiting asks. Both also check for asks, with the same effects as the timer.
- **The band above the prompt.** It shows a command waiting for a yes (with a "Call off" button) or the first ask for
  this AI (with "Hand to Claude" and "Hide").
- **Timer.** Every `poll_seconds` (default 30, never less than 10) it checks your Wayza home for asks waiting for this
  AI. A new one shows above the prompt with a short notice, or with `wake: auto` goes to Claude as above.
- **Storage.** The plugin's own storage on this computer holds the key and home from `/wayza-join`, and the ids of the
  last 500 asks it has already seen, so none is shown twice.

## A seatbelt, not a security boundary

The guard catches the risky commands it recognises, so an agent working unattended stops and asks. It does not stop a
determined one: a command can be written so no pattern matches, the same step taken through another tool is not
asked about, and Claude can edit this plugin's settings. Keep real
protections (branch protection, deploy keys, publish rights) where they are. If this Claude Code can read your email, set
`ask` to your Wayza address, not your email: an ask sent by email carries a one-click answer link.

## Settings

| Option | What it does |
|---|---|
| `key` | This AI's Wayza key. Leave empty and run `/wayza-join` to get one. |
| `home` | The Wayza home this AI lives on. Default `https://wayza.com`. |
| `ask` | Who to ask before risky commands: a Wayza address or an email. Empty: the person who owns this AI. |
| `guard` | `on` asks before risky commands; `off` never does. |
| `also_ask_for` | A regular expression: commands it matches are asked about too. |
| `wait_minutes` | How long a risky command waits for a yes. Default 15. |
| `wake` | `ask-me` shows asks above the prompt; `auto` hands asks from you (or from whoever `ask` names) to Claude at once. |
| `poll_seconds` | How often to look for asks. Default 30. |

## Privacy and support

Privacy policy: https://wayza.com/legal/privacy/. Support: support@wayza.com, https://wayza.com/legal/support/.
How to use Wayza in Claude: https://wayza.com/docs/claude/. Accounts are for adults.

Licensed under Apache 2.0.
