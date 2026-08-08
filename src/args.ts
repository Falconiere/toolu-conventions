export interface ParsedArgs {
  targetDirectory?: string;
  config?: string;
  stack?: string;
  name?: string;
  displayName?: string;
  integrations?: string[];
  operations?: string[];
  staging?: boolean;
  theme?: string;
  themeFrom?: string;
  pages?: string[];
  domain?: string;
  consoleUrl?: string;
  port?: number;
  help?: boolean;
  version?: boolean;
}

const valueOptions = new Map<string, keyof ParsedArgs>([
  ["--config", "config"],
  ["--stack", "stack"],
  ["--name", "name"],
  ["--display-name", "displayName"],
  ["--theme", "theme"],
  ["--theme-from", "themeFrom"],
  ["--domain", "domain"],
  ["--console-url", "consoleUrl"],
]);

const repeatableOptions = new Map<string, "integrations" | "operations" | "pages">([
  ["--integration", "integrations"],
  ["--operation", "operations"],
  ["--page", "pages"],
]);

export class InvalidArgumentsError extends Error {
  override name = "InvalidArgumentsError";
}

function takeValue(
  argv: readonly string[],
  index: number,
  inlineValue: string | undefined,
  option: string,
) {
  const value = inlineValue ?? argv[index + 1];
  if (value === undefined || (inlineValue === undefined && value.startsWith("--"))) {
    throw new InvalidArgumentsError(`${option} requires a value`);
  }
  return { value, consumed: inlineValue === undefined ? 2 : 1 };
}

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const parsed: ParsedArgs = {};

  for (let index = 0; index < argv.length;) {
    const argument = argv[index];
    if (argument === undefined) break;

    if (!argument.startsWith("-")) {
      if (parsed.targetDirectory !== undefined) {
        throw new InvalidArgumentsError(`unexpected positional argument: ${argument}`);
      }
      parsed.targetDirectory = argument;
      index += 1;
      continue;
    }

    if (argument === "--help" || argument === "-h") {
      parsed.help = true;
      index += 1;
      continue;
    }
    if (argument === "--version" || argument === "-v") {
      parsed.version = true;
      index += 1;
      continue;
    }
    if (argument === "--staging") {
      parsed.staging = true;
      index += 1;
      continue;
    }
    if (argument === "--no-staging") {
      parsed.staging = false;
      index += 1;
      continue;
    }

    const equalsAt = argument.indexOf("=");
    const option = equalsAt === -1 ? argument : argument.slice(0, equalsAt);
    const inlineValue = equalsAt === -1 ? undefined : argument.slice(equalsAt + 1);

    if (option === "--port") {
      const { value, consumed } = takeValue(argv, index, inlineValue, option);
      if (!/^\d+$/.test(value)) throw new InvalidArgumentsError("--port must be an integer");
      const port = Number(value);
      if (port < 1 || port > 65535) {
        throw new InvalidArgumentsError("--port must be between 1 and 65535");
      }
      parsed.port = port;
      index += consumed;
      continue;
    }

    const repeatableKey = repeatableOptions.get(option);
    if (repeatableKey !== undefined) {
      const { value, consumed } = takeValue(argv, index, inlineValue, option);
      (parsed[repeatableKey] ??= []).push(value);
      index += consumed;
      continue;
    }

    const valueKey = valueOptions.get(option);
    if (valueKey !== undefined) {
      const { value, consumed } = takeValue(argv, index, inlineValue, option);
      Object.assign(parsed, { [valueKey]: value });
      index += consumed;
      continue;
    }

    throw new InvalidArgumentsError(`unknown option: ${option}`);
  }

  return parsed;
}
