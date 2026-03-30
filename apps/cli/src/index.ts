#!/usr/bin/env node

import { Command } from "commander";
import { registerCommand } from "./commands/register.js";
import { statusCommand } from "./commands/status.js";
import { indexCommand } from "./commands/index-video.js";
import { discoverCommand } from "./commands/discover.js";
import { storeCommand } from "./commands/store.js";
import { validateCommand } from "./commands/validate.js";
import { queryCommand } from "./commands/query.js";

const program = new Command();

program
  .name("vidgrid")
  .description("VidGrid CLI — decentralized video intelligence")
  .version("0.0.1");

program.addCommand(registerCommand);
program.addCommand(statusCommand);
program.addCommand(indexCommand);
program.addCommand(discoverCommand);
program.addCommand(storeCommand);
program.addCommand(validateCommand);
program.addCommand(queryCommand);

program.parse();
