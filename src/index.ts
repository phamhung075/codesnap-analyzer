export { CodeSnap } from "./services/codesnap";
export type {
  AnalyzeOptions,
  AnalyzeResult,
  FileInfo,
  DirectoryStats,
} from "./types/types";

// Export a convenience function
import { CodeSnap } from "./services/codesnap";
import type { AnalyzeOptions, AnalyzeResult } from "./types/types";

export async function analyze(
  directory: string,
  options: AnalyzeOptions = {},
): Promise<AnalyzeResult> {
  return CodeSnap.analyze(directory, options);
}
