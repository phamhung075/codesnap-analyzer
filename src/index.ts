// src/index.ts
export { CodeSnap } from "./services/codesnap";
export { ProjectAnalyzer, generateAnalysis } from "./services/project-analyzer";
export type {
    AnalyzeOptions,
    AnalyzeResult,
    FileInfo,
    DirectoryStats,
} from "./types/types";

// Export convenience functions
import { CodeSnap } from "./services/codesnap";
import type { AnalyzeOptions, AnalyzeResult } from "./types/types";

export async function analyze(
    directory: string,
    options: AnalyzeOptions = {},
): Promise<AnalyzeResult> {
    return CodeSnap.analyze(directory, options);
}