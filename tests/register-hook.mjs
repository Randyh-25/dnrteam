// Registers the "@/..." path-alias resolve hook for the Node test runner.
import { register } from "node:module";
register("./resolve-hook.mjs", import.meta.url);
