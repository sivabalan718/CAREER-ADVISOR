import fs from 'node:fs';
import path from 'node:path';

/** Locates the monorepo root (the folder whose package.json declares workspaces). */
export function findRepoRoot(start: string = process.cwd()): string {
  let dir = path.resolve(start);
  for (let i = 0; i < 8; i++) {
    const pkg = path.join(dir, 'package.json');
    try {
      if (fs.existsSync(pkg) && JSON.parse(fs.readFileSync(pkg, 'utf-8')).workspaces) return dir;
    } catch {
      // keep walking
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(start);
}

export const REPO_ROOT = findRepoRoot();
