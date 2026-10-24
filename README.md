# pi-prompt-stash-status

A quiet, session-scoped prompt stash for Pi.

- `Ctrl+S` stashes the current editor text and clears the editor.
- `Ctrl+S` with an empty editor restores the stash.
- The stash survives restart and resume for the same Pi session.
- A single Nerd Font status indicator appears while a stash exists.
- Stashing and restoring do not emit notifications or transcript output.

Install:

```text
pi install git:github.com/alchemmist/pi-prompt-stash-status
```

The extension stores data under `~/.pi/agent/pi-prompt-stash-status/sessions/`.

The default icon is `` (`nf-oct-package`). Override it in
`~/.pi/agent/pi-prompt-stash-status/config.json`:

```json
{
  "icon": "󰏖"
}
```
