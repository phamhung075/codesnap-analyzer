#!/usr/bin/env node

import { Command } from "commander";
import { analyze, AnalyzeOptions } from "./index";
import { LayeredAnalyzer } from "./services/layered-analyzer";
import type { ComponentRelation, LayeredAnalysis, LayerOptions } from "./types/layer-types";
import path from "path";
import fs from "fs-extra";

interface ExtendedAnalyzeOptions extends AnalyzeOptions {
  layer?: "top" | "middle" | "detail";
  focus?: string;
  includeTests?: boolean;
  maxDepth?: number; // Will be automatically converted from CLI input
  format?: "text" | "json";
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("codesnap")
    .description("Create a comprehensive snapshot of your codebase")
    .argument("[directory]", "Directory to analyze", ".")
    .option("-o, --output <path>", "Output file path")
    .option("-e, --exclude <patterns...>", "Additional patterns to exclude")
    .option("-i, --include <patterns...>", "Patterns to include")
    .option("-l, --layer <depth>", "Analysis depth (top, middle, detail)", "top")
    .option("-f, --focus <path>", "Path to focus detailed analysis on")
    .option("-t, --include-tests", "Include test files in analysis")
    .option("-d, --max-depth <number>", "Maximum depth for dependency analysis", parseFloat, 3)
    .option("--format <type>", "Output format (text, json)", "text")
    .action(async (directory: string, options: ExtendedAnalyzeOptions) => {
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
          // Fallback to folder name if package.json doesn't exist
          projectName = path.basename(projectDir);
        }

        // Sanitize project name for filenames
        projectName = projectName.replace(/[^a-zA-Z0-9-_]/g, "_");

        // Default output path if not specified
        if (!options.output) {
          const outputDir = path.join(projectDir, "codesnap");
          await fs.ensureDir(outputDir);
          const extension = options.format === "json" ? "json" : "txt";
          options.output = path.join(outputDir, `${projectName}.${extension}`);
        }

        console.log("📸 Starting CodeSnap analysis...");
        console.log(`📁 Project: ${projectName}`);
        console.log(`📂 Directory: ${projectDir}`);
        console.log(`📝 Output will be saved to: ${options.output}`);

        if (options.layer) {
          // Use LayeredAnalyzer
          console.log(`🔍 Analysis depth: ${options.layer}`);
          if (options.focus) {
            console.log(`🎯 Focus path: ${options.focus}`);
          }

          const layerOptions: LayerOptions = {
            depth: options.layer,
            focusPath: options.focus,
            includeTests: options.includeTests,
            maxDepth: options.maxDepth,
            exclude: options.exclude,
            include: options.include,
            output: options.output
          };

          const analyzer = new LayeredAnalyzer(projectDir, layerOptions);
          const result = await analyzer.analyze();

          // Format and save the output
          if (options.format === "json") {
            await fs.writeJSON(options.output, result, { spaces: 2 });
          } else {
            const formattedOutput = formatLayeredAnalysis(result);
            await fs.writeFile(options.output, formattedOutput);
          }

          console.log("\n✅ Layered analysis completed successfully!");
          console.log("📊 Analysis depth:", options.layer);
          console.log(`📈 Components analyzed: ${result.components.length}`);
          console.log(`🔗 Relations found: ${result.relations.length}`);
          
          // Display metrics summary
          console.log("\n📊 Metrics Summary:");
          console.log(`   Complexity: ${result.metrics.averageComplexity.toFixed(2)}`);
          console.log(`   Cohesion: ${(result.metrics.cohesion * 100).toFixed(1)}%`);
          console.log(`   Coupling: ${(result.metrics.coupling * 100).toFixed(1)}%`);
          if (result.metrics.testCoverage) {
            console.log(`   Test Coverage: ${result.metrics.testCoverage.toFixed(1)}%`);
          }

        } else {
          // Use traditional analyzer
          const result = await analyze(projectDir, {
            output: options.output,
            exclude: options.exclude,
            include: options.include,
          });

          console.log("\n✅ Analysis completed successfully!");
          console.log("📊 Summary:");
          console.log(result.summary);
        }
      } catch (error) {
        console.error(`\n❌ Error: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  program.parse();
}

function formatLayeredAnalysis(analysis: LayeredAnalysis): string {
  const lines: string[] = [
    `Analysis Type: ${analysis.layer}`,
    `Timestamp: ${new Date(analysis.timestamp).toISOString()}`,
    `Version: ${analysis.version}`,
    "\nComponents:",
  ];

  // Format components
  analysis.components.forEach((component) => {
    lines.push(`\n  ${component.name} (${component.type})`);
    lines.push(`    Path: ${component.path}`);
    lines.push(`    Complexity: ${component.complexity}`);
    lines.push(`    Dependencies: ${component.dependencies.length}`);
    if (component.maintainability) {
      lines.push(`    Maintainability: ${component.maintainability.toFixed(2)}`);
    }
  });

  // Format relations
  lines.push("\nRelations:");
  analysis.relations.forEach((relation: ComponentRelation) => {
    lines.push(
      `\n  ${relation.source} -> ${relation.target} (${relation.type})`
    );
    if (relation.description) {
      lines.push(`    ${relation.description}`);
    }
  });

  // Format metrics
  lines.push("\nMetrics:");
  const metrics = analysis.metrics;
  lines.push(`  Total Components: ${metrics.totalComponents}`);
  lines.push(`  Average Complexity: ${metrics.averageComplexity.toFixed(2)}`);
  lines.push(`  Dependency Depth: ${metrics.dependencyDepth}`);
  lines.push(`  Cohesion: ${(metrics.cohesion * 100).toFixed(1)}%`);
  lines.push(`  Coupling: ${(metrics.coupling * 100).toFixed(1)}%`);
  if (metrics.testCoverage) {
    lines.push(`  Test Coverage: ${metrics.testCoverage.toFixed(1)}%`);
  }
  if (metrics.duplicateCode) {
    lines.push(`  Duplicate Code: ${metrics.duplicateCode.toFixed(1)}%`);
  }

  return lines.join("\n");
}

main();