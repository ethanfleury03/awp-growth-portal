# Marketing Agent transfer bundle

This branch exists because the local GitHub credential on the build machine could not push Git objects to the repo directly.

To restore the exact commits from the build machine after pulling this branch:

```bash
git fetch origin codex/marketing-agent-workspace
git switch -c codex/marketing-agent-workspace origin/codex/marketing-agent-workspace
node .codex-transfer/apply-marketing-agent-bundle.mjs
```

The script reconstructs a Git bundle from the part files, verifies it, fetches the bundled HEAD into `codex/marketing-agent-workspace-full`, and switches to that restored branch.

Bundled HEAD: `7f88b19a95edc54595bea3de18bdc347a105af06`
Base: `4bdfa68ed2b570228539afbbb118ff425426da7f`
