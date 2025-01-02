# Project Architecture

├── .venv/
│   └── Ltes/
├── codesnap/
├── src/
│   ├── cli.ts
│   │       - function: handleSnapshot {
        try {
    const projectDir = path.resolve(directory);
    let projectName = path.basename(projectDir);

    try {
      const packageJsonPath = path.join(projectDir
        "package.json");
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath
        "utf-8")
        );
        projectName = packageJson.name || projectName;
      }
    } catch {
      projectName = path.basename(projectDir);
    }

    projectName = projectName.replace(/[^a-zA-Z0-9-_]/g
        "_");

    if (!options.output) {
      const outputDir = path.join(projectDir
        "codesnap");
      await fs.ensureDir(outputDir);
      options.output = path.join(outputDir
        `${projectName}.txt`);
    }

    console.log("📸 Starting CodeSnap analysis...");
    console.log(`📁 Project: ${projectName}`);
    console.log(`📂 Directory: ${projectDir}`);
    console.log(`📝 Output will be saved to: ${options.output}`);

    const result = await analyze(projectDir
        {
      output: options.output
        exclude: options.exclude
        include: options.include
        });

    console.log("\n✅ Analysis completed successfully!");
    console.log("📊 Summary:");
    console.log(result.summary);
  } catch (error) {
    console.error(`\n❌ Error: ${(error as Error).message}`);
    process.exit(1);
  }
│   │         }
│   │       - function: main {
        const program = new Command();

  program
    .name("codesnap")
    .description("Create comprehensive snapshots of your codebase")
    .version("1.0.0");

  // Default command (backward compatibility)
  program
    .argument("[directory]"
        "Directory to analyze"
        ".")
    .option("-o
        --output <path>"
        "Output file path")
    .option("-e
        --exclude <patterns...>"
        "Additional patterns to exclude")
    .option("-i
        --include <patterns...>"
        "Patterns to include")
    .action((directory: string
        options: AnalyzeOptions) => {
      handleSnapshot(directory
        options);
    });

  // Explicit snapshot command
  program
    .command("snapshot")
    .description("Create a snapshot of your codebase with token counting")
    .argument("[directory]"
        "Directory to analyze"
        ".")
    .option("-o
        --output <path>"
        "Output file path")
    .option("-e
        --exclude <patterns...>"
        "Additional patterns to exclude")
    .option("-i
        --include <patterns...>"
        "Patterns to include")
    .action((directory: string
        options: AnalyzeOptions) => {
      handleSnapshot(directory
        options);
    });

  // Architecture analysis command
  program
    .command("analyze")
    .description("Generate a detailed analysis of the project architecture")
    .argument("[directory]"
        "Directory to analyze"
        ".")
    .option("-o
        --output <path>"
        "Output file path"
        "project-analysis.md")
    .option("-f
        --format <format>"
        "Output format (md or json)"
        "md")
    .action(
      async (
        directory: string
        cmdOptions: { output?: string; format?: "md" | "json" }
      ) => {
        try {
          console.log("📊 Starting project architecture analysis...");
          console.log(`📁 Analyzing directory: ${path.resolve(directory)}`);

          const result = await generateAnalysis({
            directory: path.resolve(directory)
        output: cmdOptions.output
        format: cmdOptions.format as "md" | "json"
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
    .argument("[directory]"
        "Directory to analyze"
        ".")
    .option("-o
        --output <path>"
        "Output file path"
        "architecture.md")
    .action(async (directory: string
        options: { output: string }) => {
      try {
        const projectDir = path.resolve(directory);
        console.log("📝 Generating architecture documentation...");
        console.log(`📁 Analyzing directory: ${projectDir}`);

        await generateFormattedArchitecture(projectDir
        options.output);

        console.log("✅ Architecture documentation generated successfully!");
        console.log(`📄 Output saved to: ${options.output}`);
      } catch (error) {
        console.error("❌ Error generating architecture:"
        error);
        process.exit(1);
      }
    });
  // Parse command line arguments
  program.parse();
│   │         }
│   ├── constants/
│   │   ├── analyze.ts
│   │   │       - constant: FILE_LIMITS {
        MAX_FILE_SIZE: 10 * 1024 * 1024
        // 10 MB
  MAX_FILES: 10_000
        MAX_TOTAL_SIZE: 500 * 1024 * 1024
        // 500 MB
│   │   │         }
│   │   ├── patterns.ts
│   │   └── pricing.ts
│   │           - constant: PRICING {
        gpt35: 0.0015
        // GPT-3.5 per 1K tokens
  gpt4: 0.03
        // GPT-4 per 1K tokens
  claude: 0.015
        // Claude per 1K tokens (approximation)
  llama2: 0.002
        // LLaMA 2 per 1K tokens (approximation)
│   │             }
│   ├── core/
│   │   └── analyzer.ts
│   │           - class: DirectoryAnalyzer
│   │           - function: analyze {
        const analyzer = new DirectoryAnalyzer(directory
        options);
  const { files
        stats
        tokenCounts } = await analyzer.analyze();

  const summary = OutputFormatter.createSummary(directory
        stats
        tokenCounts);
  const tree = OutputFormatter.createTree(files);
  const content = OutputFormatter.createContent(files);

  if (options.output) {
    const outputContent = `${summary}\n\n${tree}\n\n${content}`;
    await fs.ensureDir(path.dirname(options.output));
    await fs.writeFile(options.output
        outputContent
        "utf-8");
  }

  return {
    files
        stats
        tokenCounts
        summary
        tree
        };
│   │             }
│   ├── index.ts
│   │       - function: analyze {
        return CodeSnap.analyze(directory
        options);
│   │         }
│   ├── services/
│   │   ├── architecture-formatter.ts
│   │   │       - class: ArchitectureFormatter
│   │   │           - constructor(basePath: string, outputPath: string)
│   │   │       - interface: ComponentInfo
│   │   │           type: 'class' | 'function' | 'interface' | 'constant' | 'type';
│   │   │           name: string;
│   │   │           methods?: string[];
│   │   │           properties?: string[];
│   │   │           content?: string;
│   │   │       - function: generateFormattedArchitecture {
        const formatter = new ArchitectureFormatter(basePath
        outputPath);
    await formatter.generateArchitectureFile();
│   │   │         }
│   │   ├── codesnap.ts
│   │   │       - class: CodeSnap
│   │   ├── formatter.ts
│   │   │       - class: OutputFormatter
│   │   │           - static createSummary(
    directory: string,
    stats: DirectoryStats,
    tokenCounts: TokenCount,
  ): string
│   │   │           - formatTokenCounts(tokenCounts)
│   │   │           - basename(directory)
│   │   │       - interface: TreeNode
│   │   │           name: string;
│   │   │           type: "file" | "directory";
│   │   │           children: TreeNode[];
│   │   │           path: string;
│   │   └── project-analyzer.ts
│   │           - class: ProjectAnalyzer
│   │               - constructor(basePath: string, outputPath: string)
│   │               - resolve(basePath)
│   │           - interface: MethodInfo
│   │               name: string;
│   │               parameters: string[];
│   │               returnType?: string;
│   │               visibility?: 'public' | 'private' | 'protected';
│   │               isStatic?: boolean;
│   │               isAsync?: boolean;
│   │               content: string;
│   │           - interface: PropertyInfo
│   │               name: string;
│   │               type: string;
│   │               visibility?: 'public' | 'private' | 'protected';
│   │               isOptional?: boolean;
│   │               defaultValue?: string;
│   │           - interface: CodeComponent
│   │               type: 'class' | 'function' | 'interface' | 'constant' | 'type';
│   │               name: string;
│   │               methods?: MethodInfo[];
│   │               properties?: PropertyInfo[];
│   │               content?: string;
│   │               extends?: string;
│   │               implements?: string[];
│   │           - interface: AnalysisOptions
│   │               directory: string;
│   │               output?: string;
│   │               format?: 'md' | 'json';
│   │           - interface: AnalysisResult
│   │               success: boolean;
│   │               outputPath?: string;
│   │               error?: string;
│   │           - function: generateAnalysis {
        try {
        const analyzer = new ProjectAnalyzer(options.directory
        options.output || 'project-analysis.md');
        await analyzer.analyze();
        return {
            success: true
        outputPath: options.output
        };
    } catch (error) {
        return {
            success: false
        error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
│   │             }
│   ├── types/
│   │   └── types.ts
│   │           - interface: AnalyzeOptions
│   │               maxFileSize?: number;
│   │               include?: string[];
│   │               exclude?: string[];
│   │               output?: string | null;
│   │           - interface: AnalyzeResult
│   │               files: FileInfo[];
│   │               stats: DirectoryStats;
│   │               tokenCounts: TokenCount;
│   │               summary: string;
│   │               tree: string;
│   │           - interface: FileInfo
│   │               path: string;
│   │               content: string | null;
│   │               size: number;
│   │           - interface: DirectoryStats
│   │               totalFiles: number;
│   │               totalSize: number;
│   │           - interface: TokenCount
│   │               gpt35: number;
│   │               gpt4: number;
│   │               claude: number;
│   │               llama2: number;
│   │           - interface: PackageJson
│   │               name: string;
│   │               version: string;
│   │               dependencies?: Record<string, string>;
│   │               devDependencies?: Record<string, string>;
│   │               [key: string]: unknown; // For other possible fields
│   │           - interface: ComponentInfo
│   │               name: string;
│   │               type: 'class' | 'function' | 'interface' | 'constant' | 'type';
│   │               description?: string;
│   │               methods?: string[];
│   │           - interface: FileAnalysis
│   │               path: string;
│   │               description?: string;
│   │               components: ComponentInfo[];
│   ├── utils/
│   │   ├── file.ts
│   │   │       - class: FileUtils
│   │   │           - static async isTextFile(filePath: string): Promise<boolean>
│   │   │           - readFile(filePath)
│   │   │           - slice(0, 1024)
│   │   │           - for (const byte of sample)
│   │   │           - if (byte === 0 || (byte < 32 && ![9, 10, 13].includes(byte)
│   │   └── token-counter.ts
│   │           - class: TokenCounter
│   │               - private static async getTokenizer(model: TiktokenModel)
│   │               - encoding_for_model(model)
│   └── __tests__/
│       └── cli.test.ts
