// src/services/codesnap.ts
import path from "path";
import fs from "fs-extra";
import { AnalyzeOptions, AnalyzeResult } from "../types/types";
import { DirectoryAnalyzer } from "../core/analyzer";
import { OutputFormatter } from "../services/formatter";
import { FileUtils } from "../utils/file";

export class CodeSnap {
  static async analyze(
    directory: string,
    options: AnalyzeOptions = {},
  ): Promise<AnalyzeResult> {
    const absolutePath = path.resolve(directory);

    if (!(await fs.pathExists(absolutePath))) {
      throw new Error(`Directory not found: ${directory}`);
    }

    const analyzer = new DirectoryAnalyzer(absolutePath, options);
    const { files, stats, tokenCounts } = await analyzer.analyze();

    const summary = OutputFormatter.createSummary(
      absolutePath,
      stats,
      tokenCounts,
    );
    const tree = OutputFormatter.createTree(files);

    if (options.output) {
      // Write the complete analysis to the output file
      const content = OutputFormatter.createContent(files);
      await FileUtils.writeOutput(
        options.output,
        `${summary}\n\n${tree}\n\n${content}`,
      );
    }

    return {
      files,
      stats,
      tokenCounts,
      summary,
      tree,
    };
  }
}
