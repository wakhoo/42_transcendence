#!/bin/bash
# ============================================================
#  Git Repository Migration Script
#  Migrate from old repo to school-provided repo
#  (transfers full commit history)
# ============================================================
#
#  Before running, update the two lines below with your URLs:
#
#    NEW_REPO = URL of the school-provided repository
#
# ============================================================

OLD_REPO="git@github.com:wakhoo/42_transcendance.git"
NEW_REPO=""

# ------------------------------------------------------------
# STEP 1. Clone the old repo using mirror mode
#         (includes all branches, tags, and commit history)
# ------------------------------------------------------------
git clone --mirror "$OLD_REPO"

# Cloning creates a folder named "old-repo.git"
# Update the path below if the folder name differs
cd old-repo.git

# ------------------------------------------------------------
# STEP 2. Point origin to the new (school) repo
# ------------------------------------------------------------
git remote set-url origin "$NEW_REPO"

# ------------------------------------------------------------
# STEP 3. Push everything to the new repo
#         --mirror: copies all branches and tags as-is
# ------------------------------------------------------------
git push --mirror

# ------------------------------------------------------------
# STEP 4. Remove the local mirror folder (optional)
# ------------------------------------------------------------
cd ..
rm -rf old-repo.git

echo "Migration complete. Clone the new repo with:"
echo "  git clone $NEW_REPO"

# ============================================================
# For teammates who already have a local clone,
# they just need to run this one line:
#
#   git remote set-url origin <NEW_REPO_URL>
#
# To verify:
#   git remote -v
# ============================================================
