#!/usr/bin/env node

import { Command } from "commander";
import { analyze, AnalyzeOptions } from "./index";
import { generateAnalysis } from "./services/project-analyzer";
import path from "path";
import fs from "fs-extra";
import { generateFormattedArchitecture } from "./services/architecture-formatter";

async function handleSnapshot(directory: string, options: AnalyzeOptions) {
  try {
    const projectDir = path.resolve(directory);
    let projectName = path.basename(projectDir);

    try {
      const packageJsonPath = path.join(projectDir, "package.json");
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, "utf-8")
        );
        projectName = packageJson.name || projectName;
      }
    } catch {
      projectName = path.basename(projectDir);
    }

    projectName = projectName.replace(/[^a-zA-Z0-9-_]/g, "_");

    if (!options.output) {
      const outputDir = path.join(projectDir, "codesnap");
      await fs.ensureDir(outputDir);
      options.output = path.join(outputDir, `${projectName}.txt`);
    }

    console.log("📸 Starting CodeSnap analysis...");
    console.log(`📁 Project: ${projectName}`);
    console.log(`📂 Directory: ${projectDir}`);
    console.log(`📝 Output will be saved to: ${options.output}`);

    const result = await analyze(projectDir, {
      output: options.output,
      exclude: options.exclude,
      include: options.include,
    });

    console.log("\n✅ Analysis completed successfully!");
    console.log("📊 Summary:");
    console.log(result.summary);
  } catch (error) {
    console.error(`\n❌ Error: ${(error as Error).message}`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("codesnap")
    .description("Create comprehensive snapshots of your codebase")
    .version("1.0.0");

  // Default command (backward compatibility)
  program
    .argument("[directory]", "Directory to analyze", ".")
    .option("-o, --output <path>", "Output file path")
    .option("-e, --exclude <patterns...>", "Additional patterns to exclude")
    .option("-i, --include <patterns...>", "Patterns to include")
    .action((directory: string, options: AnalyzeOptions) => {
      handleSnapshot(directory, options);
    });

  // Explicit snapshot command
  program
    .command("snapshot")
    .description("Create a snapshot of your codebase with token counting")
    .argument("[directory]", "Directory to analyze", ".")
    .option("-o, --output <path>", "Output file path")
    .option("-e, --exclude <patterns...>", "Additional patterns to exclude")
    .option("-i, --include <patterns...>", "Patterns to include")
    .action((directory: string, options: AnalyzeOptions) => {
      handleSnapshot(directory, options);
    });

  // Architecture analysis command
  program
    .command("analyze")
    .description("Generate a detailed analysis of the project architecture")
    .argument("[directory]", "Directory to analyze", ".")
    .option("-o, --output <path>", "Output file path", "project-analysis.md")
    .option("-f, --format <format>", "Output format (md or json)", "md")
    .action(
      async (
        directory: string,
        cmdOptions: { output?: string; format?: "md" | "json" }
      ) => {
        try {
          console.log("📊 Starting project architecture analysis...");
          console.log(`📁 Analyzing directory: ${path.resolve(directory)}`);

          const result = await generateAnalysis({
            directory: path.resolve(directory),
            output: cmdOptions.output,
            format: cmdOptions.format as "md" | "json",
          });

          if (result.success) {
            console.log(`✅ Analysis completed successfully!`);
            console.log(`📝 Output saved to: ${result.outputPath}`);
          } else {
            console.error(`❌ Analysis failed: ${result.error}`);
            process.exit(1);
          }
        } catch (error) {
          console.error(
            `❌ Error during analysis: ${error instanceof Error ? error.message : "Unknown error"}`
          );
          process.exit(1);
        }
      }
    );

  program
    .command("architecture")
    .description("Generate project architecture documentation")
    .argument("[directory]", "Directory to analyze", ".")
    .option("-o, --output <path>", "Output file path", "architecture.md")
    .action(async (directory: string, options: { output: string }) => {
      try {
        const projectDir = path.resolve(directory);
        console.log("📝 Generating architecture documentation...");
        console.log(`📁 Analyzing directory: ${projectDir}`);

        await generateFormattedArchitecture(projectDir, options.output);

        console.log("✅ Architecture documentation generated successfully!");
        console.log(`📄 Output saved to: ${options.output}`);
      } catch (error) {
        console.error("❌ Error generating architecture:", error);
        process.exit(1);
      }
    });
  // Parse command line arguments
  program.parse();
}

main();
