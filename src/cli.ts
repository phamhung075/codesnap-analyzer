#!/usr/bin/env node

import { Command } from "commander";
import { analyze, AnalyzeOptions } from "./index";
import path from "path";
import fs from "fs-extra";
import { LayeredAnalyzer } from "./services/layered-analyzer";

async function main(): Promise<void> {
  const program = new Command();

  /**
   * Default Command (Basic Analysis)
   */
  program
    .name("codesnap")
    .description("Create a comprehensive snapshot of your codebase")
    .argument("[directory]", "Directory to analyze", ".")
    .option("-o, --output <path>", "Output file path")
    .option("-e, --exclude <patterns...>", "Additional patterns to exclude")
    .option("-i, --include <patterns...>", "Patterns to include")
    .action(async (directory: string, options: AnalyzeOptions) => {
      try {
        // Resolve project directory
        const projectDir = path.resolve(directory);

        let projectName = path.basename(projectDir);
        try {
          const packageJsonPath = path.join(projectDir, "package.json");
          if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(
              fs.readFileSync(packageJsonPath, "utf-8"),
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
    });

  /**
   * Layered Analysis Command
   */
  program
    .command("layer")
    .description("Create a comprehensive snapshot of your codebase with layer analysis")
    .argument("[directory]", "Directory to analyze", ".")
    .option("-o, --output <path>", "Output file path")
    .option("-e, --exclude <patterns...>", "Additional patterns to exclude")
    .option("-i, --include <patterns...>", "Patterns to include")
    .option("-l, --layer <depth>", "Analysis depth (top, middle, detail)", "top")
    .option("-f, --focus <path>", "Path to focus detailed analysis on")
    .option("-t, --include-tests", "Include test files in analysis")
    .option("-d, --max-depth <number>", "Maximum depth for dependency analysis", parseFloat, 3)
    .option("--format <type>", "Output format (text, json)", "text")
    .action(async (directory: string, options: any) => {
      try {
        const projectDir = path.resolve(directory);

        let projectName = path.basename(projectDir);
        try {
          const packageJsonPath = path.join(projectDir, "package.json");
          if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(
              fs.readFileSync(packageJsonPath, "utf-8"),
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
          const extension = options.format === "json" ? "json" : "txt";
          options.output = path.join(outputDir, `${projectName}.${extension}`);
        }

        console.log("📸 Starting Layered Analysis...");
        console.log(`📁 Project: ${projectName}`);
        console.log(`📂 Directory: ${projectDir}`);
        console.log(`📝 Output will be saved to: ${options.output}`);
        console.log(`🔍 Analysis depth: ${options.layer}`);
        if (options.focus) {
          console.log(`🎯 Focus path: ${options.focus}`);
        }

        const layerOptions = {
          depth: options.layer,
          focusPath: options.focus,
          includeTests: options.includeTests,
          maxDepth: options.maxDepth,
          exclude: options.exclude,
          include: options.include,
          output: options.output,
        };

        const analyzer = new LayeredAnalyzer(projectDir, layerOptions);
        const result = await analyzer.analyze();

        if (options.format === "json") {
          await fs.writeJSON(options.output, result, { spaces: 2 });
        } else {
          const formattedOutput = formatLayeredAnalysis(result);
          await fs.writeFile(options.output, formattedOutput);
        }

        console.log("\n✅ Layered analysis completed successfully!");
        console.log(`📈 Components analyzed: ${result.components.length}`);
        console.log(`🔗 Relations found: ${result.relations.length}`);
      } catch (error) {
        console.error(`\n❌ Error: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  program.parse();
}

/**
 * Format Layered Analysis Output
 */
function formatLayeredAnalysis(analysis: any): string {
  const lines: string[] = [
    `Analysis Type: ${analysis.layer}`,
    `Timestamp: ${new Date(analysis.timestamp).toISOString()}`,
    `Version: ${analysis.version}`,
    "\nComponents:",
  ];

  analysis.components.forEach((component: any) => {
    lines.push(`\n  ${component.name} (${component.type})`);
    lines.push(`    Path: ${component.path}`);
    lines.push(`    Complexity: ${component.complexity}`);
    lines.push(`    Dependencies: ${component.dependencies.length}`);
    if (component.maintainability) {
      lines.push(`    Maintainability: ${component.maintainability.toFixed(2)}`);
    }
  });

  lines.push("\nRelations:");
  analysis.relations.forEach((relation: any) => {
    lines.push(`\n  ${relation.source} -> ${relation.target} (${relation.type})`);
    if (relation.description) {
      lines.push(`    ${relation.description}`);
    }
  });

  const metrics = analysis.metrics;
  lines.push("\nMetrics:");
  lines.push(`  Total Components: ${metrics.totalComponents}`);
  lines.push(`  Average Complexity: ${metrics.averageComplexity.toFixed(2)}`);
  lines.push(`  Dependency Depth: ${metrics.dependencyDepth}`);
  lines.push(`  Cohesion: ${(metrics.cohesion * 100).toFixed(1)}%`);
  lines.push(`  Coupling: ${(metrics.coupling * 100).toFixed(1)}%`);
  if (metrics.testCoverage) {
    lines.push(`  Test Coverage: ${metrics.testCoverage.toFixed(1)}%`);
  }

  return lines.join("\n");
}

main();
