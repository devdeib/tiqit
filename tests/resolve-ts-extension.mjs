import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(import.meta.dirname, "..");

function isRelativeSpecifier(specifier) {
  return specifier.startsWith("./") || specifier.startsWith("../");
}

function hasExtension(specifier) {
  return /\.(?:m?js|cjs|ts|tsx|json)$/.test(specifier);
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const absolutePath = path.join(projectRoot, specifier.slice(2));
    return {
      shortCircuit: true,
      url: pathToFileURL(`${absolutePath}.ts`).href,
    };
  }

  if (isRelativeSpecifier(specifier) && !hasExtension(specifier)) {
    const parentDir = context.parentURL
      ? path.dirname(fileURLToPath(context.parentURL))
      : projectRoot;
    const absolutePath = path.resolve(parentDir, specifier);
    return {
      shortCircuit: true,
      url: pathToFileURL(`${absolutePath}.ts`).href,
    };
  }

  return nextResolve(specifier, context);
}
