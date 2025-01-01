#!/usr/bin/env node

import { Command } from 'commander';
import { analyze, AnalyzeOptions } from './index';
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
        .action(async (directory: string, options: AnalyzeOptions) => {
            try {
                // Resolve project directory
                const projectDir = path.resolve(directory);

                // Get project name from package.json or fallback to directory name
                const packageJsonPath = path.join(__dirname, '../package.json');
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                let projectName = packageJson.name || 'default-name';

                // Sanitize project name for filenames
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

                // Perform analysis
                const result = await analyze(projectDir, {
                    output: options.output,
                    exclude: options.exclude,
                    include: options.include,
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
