import { createHash } from "crypto";
import { CacheEntry, LayeredAnalysis } from "../types/layer-types";

/**
 * La classe IntelligentCache gère un système de cache intelligent pour stocker et récupérer
 * des résultats d'analyse en couches. Elle utilise un mécanisme de hachage pour l'invalidation
 * du cache et un délai d'expiration pour garantir que les données ne sont pas obsolètes.
 */
export class IntelligentCache {
    private cache: Map<string, CacheEntry>;
    private readonly maxAge: number;
  
    /**
     * Crée une instance de IntelligentCache.
     * @param maxAge - La durée maximale (en millisecondes) pendant laquelle une entrée de cache est considérée comme valide. Par défaut, 1 heure.
     */
    constructor(maxAge: number = 3600000) { // Par défaut 1 heure
      this.cache = new Map();
      this.maxAge = maxAge;
    }
  
    /**
     * Récupère une entrée de cache par sa clé.
     * @param key - La clé de l'entrée de cache à récupérer.
     * @returns Les données de l'analyse en couches si elles sont présentes et valides, sinon undefined.
     */
    async get(key: string): Promise<LayeredAnalysis | undefined> {
      const entry = this.cache.get(key);
      
      if (!entry) return undefined;
      
      if (this.isStale(entry)) {
        this.cache.delete(key);
        return undefined;
      }
      
      return entry.data;
    }
  
    /**
     * Ajoute ou met à jour une entrée dans le cache.
     * @param key - La clé de l'entrée de cache.
     * @param data - Les données de l'analyse en couches à stocker.
     */
    set(key: string, data: LayeredAnalysis): void {
      this.cache.set(key, {
        data,
        timestamp: Date.now(),
        hash: this.computeHash(data)
      });
    }
  
    /**
     * Vérifie si une entrée de cache est obsolète.
     * @param entry - L'entrée de cache à vérifier.
     * @returns true si l'entrée est obsolète, sinon false.
     */
    private isStale(entry: CacheEntry): boolean {
      const age = Date.now() - entry.timestamp;
      return age > this.maxAge;
    }
  
    /**
     * Calcule le hachage des données pour l'invalidation du cache.
     * @param data - Les données de l'analyse en couches à hacher.
     * @returns Le hachage SHA-256 des données.
     */
    private computeHash(data: LayeredAnalysis): string {
      return createHash('sha256')
        .update(JSON.stringify(data))
        .digest('hex');
    }
  }