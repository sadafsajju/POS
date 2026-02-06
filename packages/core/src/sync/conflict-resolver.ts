// Conflict resolution strategies for offline sync

export type ConflictStrategy = 'server_wins' | 'client_wins' | 'last_write_wins' | 'manual';

export interface ConflictRecord<T> {
  localData: T;
  serverData: T;
  localTimestamp: Date;
  serverTimestamp: Date;
  entity: string;
  entityId: string;
}

export interface ResolvedConflict<T> {
  resolved: T;
  strategy: ConflictStrategy;
  requiresManualReview: boolean;
}

export class ConflictResolver {
  private defaultStrategy: ConflictStrategy = 'last_write_wins';

  constructor(strategy?: ConflictStrategy) {
    if (strategy) {
      this.defaultStrategy = strategy;
    }
  }

  resolve<T extends Record<string, unknown>>(
    conflict: ConflictRecord<T>,
    strategy: ConflictStrategy = this.defaultStrategy
  ): ResolvedConflict<T> {
    switch (strategy) {
      case 'server_wins':
        return {
          resolved: conflict.serverData,
          strategy,
          requiresManualReview: false,
        };

      case 'client_wins':
        return {
          resolved: conflict.localData,
          strategy,
          requiresManualReview: false,
        };

      case 'last_write_wins':
        const isLocalNewer = conflict.localTimestamp > conflict.serverTimestamp;
        return {
          resolved: isLocalNewer ? conflict.localData : conflict.serverData,
          strategy,
          requiresManualReview: false,
        };

      case 'manual':
        // For manual resolution, return server data but flag for review
        return {
          resolved: conflict.serverData,
          strategy,
          requiresManualReview: true,
        };

      default:
        return {
          resolved: conflict.serverData,
          strategy: 'server_wins',
          requiresManualReview: false,
        };
    }
  }

  // Merge non-conflicting fields
  mergeRecords<T extends Record<string, unknown>>(
    local: T,
    server: T,
    conflictingFields: string[]
  ): T {
    const merged = { ...server };

    for (const key of Object.keys(local)) {
      if (!conflictingFields.includes(key)) {
        merged[key as keyof T] = local[key as keyof T];
      }
    }

    return merged;
  }

  // Detect which fields have conflicts
  detectConflicts<T extends Record<string, unknown>>(local: T, server: T): string[] {
    const conflicts: string[] = [];

    for (const key of Object.keys(local)) {
      if (JSON.stringify(local[key]) !== JSON.stringify(server[key as keyof T])) {
        conflicts.push(key);
      }
    }

    return conflicts;
  }
}

export const conflictResolver = new ConflictResolver();
