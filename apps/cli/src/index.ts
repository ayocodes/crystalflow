#!/usr/bin/env node

import { Command } from "commander";
import { registerCommand } from "./commands/register.js";
import { statusCommand } from "./commands/status.js";
import { indexCommand } from "./commands/index-video.js";
import { discoverCommand } from "./commands/discover.js";
import { storeCommand } from "./commands/store.js";
import { validateCommand } from "./commands/validate.js";
import { queryCommand } from "./commands/query.js";
import { agentCommand } from "./commands/agent.js";
import { connectCommand } from "./commands/connect.js";
import { jobsCommand } from "./commands/jobs.js";
import { processCommand } from "./commands/process.js";
import { submitCommand } from "./commands/submit.js";

const program = new Command();

program
  .name("crystalflow")
  .description("CrystalFlow CLI — decentralized video intelligence")
  .version("0.0.1");

program.addCommand(registerCommand);
program.addCommand(statusCommand);
program.addCommand(indexCommand);
program.addCommand(discoverCommand);
program.addCommand(storeCommand);
program.addCommand(validateCommand);
program.addCommand(queryCommand);
program.addCommand(agentCommand);
program.addCommand(connectCommand);
program.addCommand(jobsCommand);
program.addCommand(processCommand);
program.addCommand(submitCommand);

program.parse();
