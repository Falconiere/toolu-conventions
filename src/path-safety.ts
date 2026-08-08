import { existsSync, lstatSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, resolve } from "node:path";

export interface SafeTarget {
  target: string;
  parent: string;
  name: string;
}

export class TargetPathError extends Error {
  override name = "TargetPathError";
}

export function resolveSafeTarget(input: string, cwd = process.cwd()): SafeTarget {
  if (input.trim() === "") throw new TargetPathError("target directory must not be empty");
  const unresolvedTarget = isAbsolute(input) ? resolve(input) : resolve(cwd, input);
  if (existsSync(unresolvedTarget)) {
    throw new TargetPathError(`target directory already exists: ${unresolvedTarget}`);
  }

  const unresolvedParent = dirname(unresolvedTarget);
  if (!existsSync(unresolvedParent)) {
    throw new TargetPathError(`target parent directory does not exist: ${unresolvedParent}`);
  }
  const parentStat = lstatSync(unresolvedParent);
  if (!parentStat.isDirectory() && !parentStat.isSymbolicLink()) {
    throw new TargetPathError(`target parent is not a directory: ${unresolvedParent}`);
  }

  const parent = realpathSync(unresolvedParent);
  const name = basename(unresolvedTarget);
  if (name === "" || name === "." || name === "..") {
    throw new TargetPathError(`unsafe target directory: ${input}`);
  }
  const target = resolve(parent, name);
  if (existsSync(target)) throw new TargetPathError(`target directory already exists: ${target}`);
  return { target, parent, name };
}
