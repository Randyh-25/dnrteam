// ESM resolve hook: maps the project's "@/..." path alias to src/ so the Node
// test runner can import modules that use the alias (mirrors tsconfig
// "paths": { "@/*": ["./src/*"] }). Extensionless imports get ".ts" appended.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const base = fileURLToPath(
      new URL(`../src/${specifier.slice(2)}`, import.meta.url)
    );
    const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`];
    const found = candidates.find((c) => existsSync(c));
    if (found) {
      return next(new URL(`file://${found.replace(/\\/g, "/")}`).href, context);
    }
  }
  return next(specifier, context);
}
