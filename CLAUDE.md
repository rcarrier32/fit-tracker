# Fit Tracker: notes for Claude sessions

## Ending a session: delete branches that are done

When the work on a branch is finished **and** merged into `main`, delete the branch on
GitHub as the last step of the session. Do not delete it in any other case.

A branch counts as merged only when one of these holds (check after `git fetch --prune origin`):
- it is an ancestor of `main`: `git merge-base --is-ancestor origin/<branch> origin/main`, or
- its pull request shows as merged on GitHub (squash and rebase merges give new commit
  IDs, so the ancestor check fails for them), **and** the branch has no commits pushed after
  that merge.

Then: `git push origin --delete <branch>`.

Never delete:
- `main`
- a branch with an open pull request, or work that never reached `main`, even if it looks
  out of date. If `main` fixed the same thing another way, ask the user first.
- another session's branch, unless the user asks you to tidy up branches.

If deleting is blocked (permissions, network), tell the user which branches are left and why.
