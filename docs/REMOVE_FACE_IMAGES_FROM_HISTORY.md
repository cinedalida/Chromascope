# Removing face images from the git history (decision D3)

**Who:** the repository owner (`cinedalida`), once. **Why:** face photos (`me-1.jpg` … `me-6.jpg`), face masks made from
them, and four Deep Armocromia dataset images were committed to this **public** repo. Commit "remove face images"
deletes them from the current files, but every older commit still contains them, so anyone can still download them.
The dataset is licensed "for scientific and research purposes only", so redistributing it publicly is also a problem.

Rewriting history changes every commit ID. Everyone must re-clone afterwards, and open pull requests must be re-created.

## Files to purge
```
backend/app/core/skin_analysis/test/test_images/
backend/app/core/skin_analysis/test/test_output/
```

## Steps
1. Tell the team to push everything and stop pushing until step 6.
2. Install git-filter-repo (`pip install git-filter-repo`), then make a fresh **mirror** clone:
   ```
   git clone --mirror https://github.com/cinedalida/Chromascope.git chromascope-cleanup.git
   cd chromascope-cleanup.git
   ```
3. Remove the two folders from every commit on every branch:
   ```
   git filter-repo --invert-paths --path backend/app/core/skin_analysis/test/test_images/ --path backend/app/core/skin_analysis/test/test_output/
   ```
4. Check that nothing is left (both commands must print nothing):
   ```
   git log --all --name-only --format= | grep -E "test_images/|test_output/"
   git rev-list --all --objects | grep -E "me-[0-9]\.jpg|test_output/"
   ```
5. Push the rewritten history (this is the force push; only the owner should do it, deliberately):
   ```
   git push --force --mirror origin
   ```
6. Everyone deletes their local copy and clones again. Do **not** push from an old clone (it would bring the images back).
7. Ask GitHub Support to purge cached views of the old commits ("remove sensitive data", referencing the repo), and
   check that forks, if any, are also cleaned or deleted.

Reference: GitHub Docs, "Removing sensitive data from a repository".
