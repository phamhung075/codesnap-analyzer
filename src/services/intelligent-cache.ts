import { createHash } from "crypto";
import { CacheEntry, LayeredAnalysis } from "../types/layer-types";

export class IntelligentCache {
    private cache: Map<string, CacheEntry>;
    private readonly maxAge: number;
  
    constructor(maxAge: number = 3600000) { // Default 1 hour
      this.cache = new Map();
      this.maxAge = maxAge;
    }
  
    async get(key: string): Promise<LayeredAnalysis | undefined> {
      const entry = this.cache.get(key);
      
      if (!entry) return undefined;
      
      if (this.isStale(entry)) {
        this.cache.delete(key);
        return undefined;
      }
      
      return entry.data;
    }
  
    set(key: string, data: LayeredAnalysis): void {
      this.cache.set(key, {
        data,
        timestamp: Date.now(),
        hash: this.computeHash(data)
      });
    }
  
    private isStale(entry: CacheEntry): boolean {
      const age = Date.now() - entry.timestamp;
      return age > this.maxAge;
    }
  
    private computeHash(data: LayeredAnalysis): string {
      // Implement hashing logic for cache invalidation
      return createHash('sha256')
        .update(JSON.stringify(data))
        .digest('hex');
    }
  }