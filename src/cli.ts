#!/usr/bin/env node
import { Command } from 'commander';
import { analyze } from './index';
import path from 'path';
import fs from 'fs-extra';

async function main() {
    const program = new Command();

    program
        .name('codesnap')
        .description('Create a comprehensive snapshot of your codebase')
        .argument('[directory]', 'Directory to analyze', '.')
        .option('-o, --output <path>', 'Output file path')
        .option('-e, --exclude <patterns...>', 'Additional patterns to exclude')
        .option('-i, --include <patterns...>', 'Patterns to include')
        .action(async (directory: string, options: any) => {
            try {
                // Get the current working directory
                const projectDir = path.resolve(directory);
                
                // Get the project name from package.json if exists, otherwise use directory name
                let projectName = path.basename(projectDir);
                try {
                    const packageJson = require(path.join(projectDir, 'package.json'));
                    projectName = packageJson.name;
                } catch {
                    // Keep using directory name if package.json not found
                }

                // Sanitize project name for filename
                projectName = projectName.replace(/[^a-zA-Z0-9-_]/g, '_');

                // Default output path if not specified
                if (!options.output) {
                    const outputDir = path.join(projectDir, 'codesnap');
                    await fs.ensureDir(outputDir);
                    options.output = path.join(outputDir, `${projectName}.txt`);
                }

                console.log('📸 Starting CodeSnap analysis...');
                console.log(`📁 Project: ${projectName}`);
                console.log(`📂 Directory: ${projectDir}`);
                console.log(`📝 Output will be saved to: ${options.output}`);

                const result = await analyze(projectDir, {
                    output: options.output,
                    excludePatterns: options.exclude,
                    includePatterns: options.include
                });

                console.log('\n✅ Analysis completed successfully!');
                console.log('📊 Summary:');
                console.log(result.summary);

            } catch (error) {
                console.error(`\n❌ Error: ${(error as Error).message}`);
                process.exit(1);
            }
        });

    program.parse();
}

main();