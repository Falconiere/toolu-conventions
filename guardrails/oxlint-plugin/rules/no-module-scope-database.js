// no-module-scope-database — build the database handle per request, never once.
//
// On workerd a module is evaluated once per isolate, before any request, and
// that isolate is shared by every request the isolate serves. A `const db =
// createDatabase(...)` at module scope therefore captures whatever config
// existed at startup and hands the same handle to every caller — which is a
// connection-pool bug wearing a different hat, and the failure only shows up
// under concurrency, in production.
//
// Contextual rather than textual: the exact same call one line further in, in a
// function body, is the correct form. That is the distinction a grep cannot
// make, and it is why this is a rule rather than a banned string.
import { isInTestDir, isUnderSrc, relative } from '../config.js';

const CONSTRUCTORS = new Set(['createDatabase', 'drizzle', 'createClient']);

/** Is this node inside a function body, or evaluated when the module loads? */
function isModuleScope(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    switch (parent.type) {
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
      case 'MethodDefinition':
      case 'ClassBody':
        return false;
      default:
        break;
    }
  }
  return true;
}

export const noModuleScopeDatabase = {
  meta: {
    type: 'problem',
    docs: { description: 'construct the database handle per request, not at module scope' },
  },
  create(context) {
    const relPath = relative(context.filename ?? context.getFilename?.() ?? '');
    if (!isUnderSrc(relPath) || isInTestDir(relPath)) return {};

    return {
      CallExpression(node) {
        if (node.callee?.type !== 'Identifier') return;
        if (!CONSTRUCTORS.has(node.callee.name)) return;
        if (!isModuleScope(node)) return;
        context.report({
          node,
          message:
            `no-module-scope-database: ${node.callee.name}() at module scope — a Worker ` +
            'evaluates a module once per isolate and shares that isolate across requests, ' +
            'so this handle outlives the request that made it; move the call inside the ' +
            'function that needs it and pass the config in',
        });
      },
    };
  },
};
