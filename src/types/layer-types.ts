// src/types/layer-types.ts
import { AST_NODE_TYPES, TSESTree } from "@typescript-eslint/typescript-estree";
import { AnalyzeOptions } from "./types";

// API Definition types
export interface APIParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

export interface APIEndpoint {
  name: string;
  path: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  parameters: APIParameter[];
  returnType: string;
  description: string;
}

export interface APIDefinition {
  name: string;
  version: string;
  endpoints: APIEndpoint[];
  types: APITypeDefinition[];
}

export interface APITypeDefinition {
  name: string;
  type: "interface" | "type" | "class" | "enum";
  properties?: Record<string, string>;
  methods?: APIEndpoint[];
  description: string;
}

// Layer analysis types
export interface LayerOptions extends AnalyzeOptions {
  depth: "top" | "middle" | "detail";
  focusPath?: string; // For detailed analysis of specific components
  includeTests?: boolean; // Whether to include test files in analysis
  maxDepth?: number; // Maximum depth for dependency analysis
}

export interface ComponentRelation {
  source: string;
  target: string;
  type: "imports" | "extends" | "implements" | "uses";
  weight: number; // Strength of relationship (0-1)
  description?: string; // Optional description of the relationship
}

export interface LayeredAnalysis {
  layer: "top" | "middle" | "detail";
  components: Component[];
  relations: ComponentRelation[];
  metrics: ComponentMetrics;
  timestamp: number; // When the analysis was performed
  version: string; // Version of the analyzer
}

export interface Component {
  path: string;
  type: "file" | "directory" | "module";
  name: string;
  description: string;
  complexity: number; // Cyclomatic complexity or similar metric
  dependencies: string[];
  apis?: APIDefinition[]; // Only for detail layer
  coverage?: number; // Test coverage percentage if available
  loc?: number; // Lines of code
  maintainability?: number; // Maintainability index (0-100)
  changeFrequency?: number; // How often this component changes
  lastModified?: number; // Timestamp of last modification
}

export interface ComponentMetrics {
  totalComponents: number;
  averageComplexity: number;
  dependencyDepth: number;
  cohesion: number; // 0-1, how related the component's responsibilities are
  coupling: number; // 0-1, how dependent the component is on others
  testCoverage?: number; // Overall test coverage percentage
  duplicateCode?: number; // Percentage of duplicate code
  techDebt?: {
    score: number; // 0-100
    issues: Array<{
      type: string;
      severity: "low" | "medium" | "high";
      description: string;
    }>;
  };
}

// Cache types for the intelligent caching system
export interface CacheEntry {
  data: LayeredAnalysis;
  timestamp: number;
  hash: string;
}

export interface CacheOptions {
  maxAge: number; // Maximum age in milliseconds
  invalidateOnChange: boolean; // Whether to invalidate cache when files change
  compression?: boolean; // Whether to compress cached data
}

// Analysis result types
export interface AnalysisResult extends LayeredAnalysis {
  cacheInfo?: {
    hit: boolean;
    age: number;
    source: "memory" | "disk" | "fresh";
  };
  performance: {
    duration: number;
    memoryUsage: number;
    filesProcessed: number;
  };
}

// Define types for AST traversal
// Define types for AST traversal
export type ASTNode = TSESTree.Node & {
  type: AST_NODE_TYPES;
};

export type ClassNode = ASTNode & {
  type: AST_NODE_TYPES.ClassDeclaration;
  id: TSESTree.Identifier;
};

export type MethodNode = ASTNode & {
  type: AST_NODE_TYPES.MethodDefinition;
  key: TSESTree.Identifier;
};

// Type guard functions
export function isDetailAnalysis(
  analysis: LayeredAnalysis
): analysis is LayeredAnalysis & { layer: "detail" } {
  return analysis.layer === "detail";
}

export function hasAPIDefinitions(
  component: Component
): component is Component & { apis: APIDefinition[] } {
  return component.type === "module" && !!component.apis;
}
