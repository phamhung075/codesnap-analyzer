// src/core/analyzer.ts
import fs from "fs-extra";
import path from "path";
import { Minimatch } from "minimatch";
import {
  FileInfo,
  DirectoryStats,
  AnalyzeOptions,
  AnalyzeResult,
  TokenCount,
} from "../types/types";
import { FILE_LIMITS } from "../constants/analyze";
import { DEFAULT_IGNORE_PATTERNS } from "../constants/patterns";
import { FileUtils } from "../utils/file";
import { TokenCounter } from "../utils/token-counter";
import { OutputFormatter } from "../services/formatter";

export class DirectoryAnalyzer {
  private readonly directory: string;
  private readonly options: AnalyzeOptions;
  private readonly ignorePatterns: Set<string>;
  private readonly baseDirectory: string;

  constructor(directory: string, options: AnalyzeOptions = {}) {
    this.directory = path.resolve(directory);
    this.baseDirectory = this.directory;
    this.options = options;
    this.ignorePatterns = new Set<string>();
    this.loadIgnorePatterns();
  }

  private loadIgnorePatterns(): void {
    // Add default patterns first
    DEFAULT_IGNORE_PATTERNS.forEach((pattern) =>
      this.ignorePatterns.add(pattern)
    );

    // Find and process all .gitignore files from root to target directory
    let currentDir = this.directory;
    const gitignoreFiles: string[] = [];

    // Traverse up the directory tree to find all .gitignore files
    while (currentDir !== path.dirname(currentDir)) {
      const gitignorePath = path.join(currentDir, ".gitignore");
      if (fs.existsSync(gitignorePath)) {
        gitignoreFiles.unshift(gitignorePath); // Add to start for correct priority
      }

      currentDir = path.dirname(currentDir);
    }

    // Process found .gitignore files
    if (gitignoreFiles.length > 0) {
      console.log("\n📋 Found .gitignore files:");
      gitignoreFiles.forEach((filePath) => {
        console.log(`   ✅ ${filePath}`);
        this.processGitignoreFile(filePath);
      });
    } else {
      console.log("\n⚠️ No .gitignore files found in directory hierarchy");
      console.log("   Using default ignore patterns only");
    }

    // Log all active patterns
    console.log("\n📋 Active ignore patterns:");
    console.log("\n   Default patterns:");
    DEFAULT_IGNORE_PATTERNS.forEach((pattern) => {
      console.log(`   - ${pattern}`);
    });

    if (gitignoreFiles.length > 0) {
      console.log("\n   From .gitignore files:");
      Array.from(this.ignorePatterns)
        .filter((pattern) => !DEFAULT_IGNORE_PATTERNS.includes(pattern))
        .forEach((pattern) => {
          console.log(`   - ${pattern}`);
        });
    }
  }

  /**
   * Processes a `.gitignore` file to extract and handle ignore patterns.
   *
   * @param gitignorePath - The absolute or relative path to the `.gitignore` file.
   * @description
   * - Reads the `.gitignore` file content.
   * - Parses patterns while ignoring comments and empty lines.
   * - Supports both regular ignore patterns and negated patterns (starting with `!`).
   * - Updates `this.ignorePatterns` with normalized patterns.
   */
  private processGitignoreFile(gitignorePath: string): void {
    try {
      // Get the directory containing the .gitignore file
      const gitignoreDir = path.dirname(gitignorePath);

      // Read the content of the .gitignore file
      const content = fs.readFileSync(gitignorePath, "utf-8");

      // Parse and filter valid patterns (ignore comments and empty lines)
      const patterns = content
        .split("\n")
        .map((line) => line.trim()) // Remove leading/trailing whitespace
        .filter((line) => line && !line.startsWith("#")); // Ignore empty lines and comments

      // Process each pattern
      patterns.forEach((pattern) => {
        if (pattern.startsWith("!")) {
          // Handle negation patterns (remove from ignorePatterns)
          const negatedPattern = pattern.slice(1); // Remove the `!` prefix
          this.ignorePatterns.delete(
            this.normalizePattern(negatedPattern, gitignoreDir)
          );
        } else {
          // Handle regular ignore patterns (add to ignorePatterns)
          this.ignorePatterns.add(this.normalizePattern(pattern, gitignoreDir));
        }
      });
    } catch (error) {
      console.warn(`⚠️ Error processing ${gitignorePath}:`, error);
    }
  }

  /**
   * Normalizes a `.gitignore` pattern to ensure consistent handling across platforms.
   *
   * @param pattern - The ignore pattern from the `.gitignore` file.
   * @param gitignoreDir - The directory where the `.gitignore` file is located.
   * @returns The normalized ignore pattern with proper path resolution.
   *
   * @description
   * - Removes leading slashes (`/`) from patterns.
   * - Resolves the pattern relative to the base directory if needed.
   * - Converts backslashes (`\`) to forward slashes (`/`) for cross-platform compatibility.
   */
  private normalizePattern(pattern: string, gitignoreDir: string): string {
    // Step 1: Remove leading slash if present
    pattern = pattern.startsWith("/") ? pattern.slice(1) : pattern;

    // Step 2: Resolve absolute paths relative to the gitignore directory
    const relativeToBase = path.relative(this.baseDirectory, gitignoreDir);

    if (relativeToBase) {
      pattern = path.join(relativeToBase, pattern);
    }

    // Step 3: Ensure cross-platform compatibility by replacing backslashes with forward slashes
    return pattern.replace(/\\/g, "/");
  }

  /**
   * Determines whether a given file path should be ignored based on `.gitignore` patterns.
   *
   * @param filePath - The absolute path of the file to check.
   * @returns `true` if the file path matches any ignore pattern, otherwise `false`.
   *
   * @description
   * - Normalizes the file path relative to the base directory.
   * - Ignores specific directories (`.venv`, `venv`) by default.
   * - Checks against `.gitignore` patterns, including directory-specific and wildcard patterns.
   */
  private shouldIgnore(filePath: string): boolean {
    // Step 1: Normalize the file path relative to the base directory
    const relativePath = path
      .relative(this.baseDirectory, filePath)
      .replace(/\\/g, "/"); // Ensure cross-platform compatibility

    // Step 2: Explicitly ignore `.venv` and `venv` directories
    if (
      relativePath.startsWith(".venv/") ||
      relativePath.startsWith("venv/") ||
      relativePath === ".venv" ||
      relativePath === "venv"
    ) {
      return true;
    }

    // Step 3: Check the path against ignore patterns
    return Array.from(this.ignorePatterns).some((pattern) => {
      let minimatchPattern = pattern;

      // Handle patterns matching directories and their contents (e.g., "dir/**")
      if (pattern.endsWith("/**")) {
        return relativePath.startsWith(pattern.slice(0, -3));
      }

      // Handle directory-only patterns (e.g., "dir/")
      if (pattern.endsWith("/")) {
        minimatchPattern = pattern.slice(0, -1);
        return new Minimatch(minimatchPattern, {
          dot: true,
          matchBase: true,
        }).match(relativePath);
      }

      // Handle standard file patterns
      return new Minimatch(minimatchPattern, {
        dot: true,
        matchBase: true,
      }).match(relativePath);
    });
  }

  /**
   * Recursively retrieves all files from a given directory while respecting ignore patterns.
   *
   * @param dir - The directory path to scan for files.
   * @returns A promise resolving to an array of file paths.
   *
   * @description
   * - Scans the directory and all its subdirectories recursively.
   * - Skips `.venv` and `venv` directories explicitly.
   * - Applies `.gitignore` patterns to exclude specific files and directories.
   * - Ensures paths are returned in a sorted order.
   */
  private async getAllFiles(dir: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const files: string[] = [];

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path
          .relative(this.baseDirectory, fullPath)
          .replace(/\\/g, "/");

        // Step 1: Skip virtual environment directories explicitly
        if (
          entry.isDirectory() &&
          (entry.name === ".venv" || entry.name === "venv")
        ) {
          console.log(
            `   ⏭️  Skipping virtual environment directory: ${relativePath}`
          );
          continue;
        }

        // Step 2: Handle directories
        if (entry.isDirectory()) {
          if (this.shouldIgnore(fullPath)) {
            console.log(
              `   ⏭️  Skipping directory: ${relativePath} (matches ignore pattern)`
            );
            continue;
          }
          files.push(...(await this.getAllFiles(fullPath)));
        }
        // Step 3: Handle files
        else {
          if (this.shouldIgnore(fullPath)) {
            console.log(
              `   ⏭️  Skipping file: ${relativePath} (matches ignore pattern)`
            );
            continue;
          }
          files.push(fullPath);
        }
      }

      // Step 4: Return sorted list of files
      return files.sort();
    } catch (error) {
      console.error(`Error reading directory ${dir}:`, error);
      return [];
    }
  }

  /**
   * Analyzes a directory by scanning files, processing their content, and gathering statistics.
   *
   * @returns A promise resolving to an object containing:
   *   - `files`: Array of processed file information.
   *   - `stats`: Aggregated directory statistics.
   *   - `tokenCounts`: Token count information from all file content.
   *
   * @description
   * - Scans the given directory recursively for files.
   * - Ignores files based on `.gitignore` patterns and other rules.
   * - Processes text files within the size limit and collects their content.
   * - Calculates aggregate statistics, including total files, total size, and token counts.
   */
  async analyze(): Promise<{
    files: FileInfo[];
    stats: DirectoryStats;
    tokenCounts: TokenCount;
  }> {
    console.log("\n📂 Starting directory analysis...");
    console.log(`📁 Base directory: ${this.directory}`);

    const stats: DirectoryStats = {
      totalFiles: 0,
      totalSize: 0,
    };

    const files: FileInfo[] = [];
    const maxFileSize = this.options.maxFileSize || FILE_LIMITS.MAX_FILE_SIZE;

    console.log(`\n⚙️  Settings:`);
    console.log(
      `   Max file size: ${(maxFileSize / 1024 / 1024).toFixed(2)} MB`
    );
    console.log(`   Max total files: ${FILE_LIMITS.MAX_FILES}`);
    console.log(
      `   Max total size: ${(FILE_LIMITS.MAX_TOTAL_SIZE / 1024 / 1024).toFixed(2)} MB`
    );


     // Step 1: Retrieve all files
    console.log("\n🔍 Scanning for files...");
    const allFiles = await this.getAllFiles(this.directory);
    console.log(`✨ Found ${allFiles.length} files total`);
    
    
    // Step 2: Process files
    console.log("\n📄 Processing files:");
    for (const filePath of allFiles) {
      const relativePath = path
        .relative(this.directory, filePath)
        .replace(/\\/g, "/");
      const fileSize = (await fs.stat(filePath)).size;

      const isText = await FileUtils.isTextFile(filePath);
      let content: string | null = null;

      if (isText && fileSize <= maxFileSize) {
        try {
          content = await FileUtils.readFileContent(filePath);
          console.log(`   ✅ Reading: ${relativePath}`);
        } catch (error) {
          console.warn(
            `   ❌ Failed to read: ${relativePath} - Error: ${error}`
          );
          continue;
        }
      } else {
        const skipReason = [];
        if (!isText) skipReason.push("binary file");
        if (fileSize > maxFileSize) skipReason.push("file too large");
        console.log(
          `   ⏭️  Skipping content for: ${relativePath} (${skipReason.join(", ")})`
        );
      }
      // Add file info to the list
      files.push({
        path: relativePath,
        content,
        size: fileSize,
      });
      // Update statistics
      stats.totalFiles += 1;
      stats.totalSize += fileSize;
      // Enforce file and size limits
      if (stats.totalFiles > FILE_LIMITS.MAX_FILES) {
        console.log("\n⚠️  Reached maximum file limit");
        break;
      }
      if (stats.totalSize > FILE_LIMITS.MAX_TOTAL_SIZE) {
        console.log("\n⚠️  Reached maximum total size limit");
        break;
      }
    }

    // Calculate tokens
    const allContent = files
      .map((file) => file.content)
      .filter((content): content is string => content !== null)
      .join("\n");

    const tokenCounts = await TokenCounter.countTokens(allContent);
  
    // Return analysis results
    return {
      files: files.sort((a, b) => a.path.localeCompare(b.path)),
      stats,
      tokenCounts,
    };
  }
}


/**
 * Analyzes a directory, processes files, and generates a structured output.
 *
 * @param directory - The base directory to analyze.
 * @param options - Optional settings for analysis, including output file path.
 * @returns A promise resolving to an analysis result object containing:
 *   - `files`: List of processed files with their metadata.
 *   - `stats`: Aggregate statistics for the analysis.
 *   - `tokenCounts`: Token count data from all processed file content.
 *   - `summary`: A summary report string.
 *   - `tree`: A tree representation of the directory structure.
 *
 * @description
 * - Creates an instance of `DirectoryAnalyzer` for directory analysis.
 * - Formats results into summary, tree, and content views using `OutputFormatter`.
 * - Writes analysis results to a file if an `output` path is provided in options.
 */
export async function analyze(
  directory: string,
  options: AnalyzeOptions = {}
): Promise<AnalyzeResult> {


  // Step 1: Initialize analyzer and run analysis
  const analyzer = new DirectoryAnalyzer(directory, options);
  const { files, stats, tokenCounts } = await analyzer.analyze();
  // Step 2: Format results
  const summary = OutputFormatter.createSummary(directory, stats, tokenCounts);
  const tree = OutputFormatter.createTree(files);
  const content = OutputFormatter.createContent(files);
  // Step 3: Write to output file if specified
  if (options.output) {
    const outputContent = `${summary}\n\n${tree}\n\n${content}`;
    await fs.ensureDir(path.dirname(options.output));
    await fs.writeFile(options.output, outputContent, "utf-8");
  }
  // Step 4: Return the analysis results
  return {
    files,
    stats,
    tokenCounts,
    summary,
    tree,
  };
}
