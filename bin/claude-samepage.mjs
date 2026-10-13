#!/usr/bin/env node
import { main } from '../src/cli.mjs';

main(process.argv.slice(2)).catch(error => {
  console.error(`Same Page: ${error.message}`);
  process.exitCode = 1;
});
