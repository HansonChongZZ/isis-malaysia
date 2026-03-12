import type { GraphEdge } from './types';

class UnionFind {
  private parent: Map<string, string>;
  private rank: Map<string, number>;

  constructor() {
    this.parent = new Map();
    this.rank = new Map();
  }

  find(x: string): string {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
    let root = x;
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root)!;
    }
    // Path compression
    let curr = x;
    while (curr !== root) {
      const next = this.parent.get(curr)!;
      this.parent.set(curr, root);
      curr = next;
    }
    return root;
  }

  union(a: string, b: string): boolean {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA === rootB) return false;
    const rankA = this.rank.get(rootA)!;
    const rankB = this.rank.get(rootB)!;
    if (rankA < rankB) {
      this.parent.set(rootA, rootB);
    } else if (rankA > rankB) {
      this.parent.set(rootB, rootA);
    } else {
      this.parent.set(rootB, rootA);
      this.rank.set(rootA, rankA + 1);
    }
    return true;
  }
}

/**
 * Compute the maximum spanning forest of the given edges using Kruskal's algorithm.
 * Returns a subset of edges that form a spanning tree per connected component,
 * preferring edges with the highest weight.
 */
export function computeMaxSpanningTree(edges: GraphEdge[]): GraphEdge[] {
  const sorted = [...edges].sort((a, b) => b.weight - a.weight);
  const uf = new UnionFind();
  const result: GraphEdge[] = [];
  for (const edge of sorted) {
    const src = typeof edge.source === 'string' ? edge.source : (edge.source as any).id;
    const tgt = typeof edge.target === 'string' ? edge.target : (edge.target as any).id;
    if (uf.union(src, tgt)) {
      result.push(edge);
    }
  }
  return result;
}
