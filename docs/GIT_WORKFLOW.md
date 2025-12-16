# Git Workflow

## Branch Naming Convention

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/<name>` | `feature/wishlist` |
| Bug fix | `fix/<name>` | `fix/cart-image-display` |
| Hotfix | `hotfix/<name>` | `hotfix/payment-error` |
| Refactor | `refactor/<name>` | `refactor/api-structure` |

## Workflow

### 1. Starting New Work

Always create a branch from `master`:

```bash
git checkout master
git pull  # if remote exists
git checkout -b feature/my-feature
```

### 2. Making Commits

Use clear, descriptive commit messages:

```
<type>: <short description>

<optional longer description>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `style:` - Formatting, no code change
- `refactor:` - Code change that neither fixes a bug nor adds a feature
- `perf:` - Performance improvement
- `test:` - Adding tests
- `chore:` - Maintenance tasks

### 3. Completing Work

When feature/fix is complete:

```bash
git checkout master
git merge feature/my-feature
git branch -d feature/my-feature  # delete local branch
```

### 4. Hotfixes

For urgent production fixes:

```bash
git checkout master
git checkout -b hotfix/critical-bug
# make fix
git commit -m "hotfix: Fix critical payment issue"
git checkout master
git merge hotfix/critical-bug
git branch -d hotfix/critical-bug
```

## Branch Protection (Future)

When remote is configured:
- `master` should require PR review
- Direct commits to `master` blocked
- CI must pass before merge

## Current Branches

To see all branches:
```bash
git branch -a
```

To clean up old branches:
```bash
git branch -d feature/old-branch
```

## Quick Reference

```bash
# Start new feature
git checkout -b feature/my-feature

# Check current branch
git branch

# Switch branches
git checkout master

# Merge feature to master
git checkout master && git merge feature/my-feature

# Delete merged branch
git branch -d feature/my-feature
```
