import { registerHooks } from "node:module";
import { load, resolve } from "./typescript-loader.mjs";

// `module.register()` (off-thread async hooks) is runtime-deprecated since Node 26
// (DEP0205). `registerHooks()` installs the same resolve/load pair synchronously
// in the main thread and works on both Node 24 and Node 26.
registerHooks({ resolve, load });
