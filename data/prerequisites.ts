export interface PrerequisiteRelation {
  concept: string;
  requires: string[];
}

export const PREREQUISITES: PrerequisiteRelation[] = [
  { concept: "Prefix Sum", requires: ["Arrays"] },
  { concept: "Difference Array", requires: ["Arrays", "Prefix Sum"] },
  { concept: "Kadane's Algorithm", requires: ["Arrays"] },
  { concept: "Two Pointers", requires: ["Arrays"] },
  { concept: "Sliding Window", requires: ["Arrays", "Two Pointers"] },
  { concept: "Subarray Techniques", requires: ["Arrays", "Prefix Sum"] },

  { concept: "Lower Bound / Upper Bound", requires: ["Binary Search"] },
  { concept: "Binary Search on Answer", requires: ["Binary Search"] },

  { concept: "Monotonic Stack", requires: ["Deque"] },
  { concept: "Monotonic Queue", requires: ["Deque"] },

  { concept: "BST", requires: ["Tree Traversal"] },
  { concept: "Tree DP", requires: ["Tree Traversal", "1D DP"] },
  { concept: "Diameter", requires: ["Tree Traversal", "BFS", "DFS"] },
  { concept: "LCA", requires: ["Tree Traversal", "BFS"] },
  { concept: "Binary Lifting", requires: ["LCA", "Binary Search"] },

  { concept: "Connected Components", requires: ["BFS", "DFS"] },
  { concept: "Topological Sort", requires: ["DFS", "BFS"] },
  { concept: "Dijkstra", requires: ["BFS", "Priority Queue"] },
  { concept: "0-1 BFS", requires: ["BFS", "Deque"] },
  { concept: "Bellman-Ford", requires: ["DFS"] },
  { concept: "Floyd-Warshall", requires: ["2D DP"] },
  { concept: "DSU", requires: ["Connected Components"] },
  { concept: "MST", requires: ["Priority Queue", "DSU"] },
  { concept: "SCC", requires: ["DFS", "Topological Sort"] },
  { concept: "Bipartite Graph", requires: ["BFS", "DFS"] },

  { concept: "2D DP", requires: ["1D DP"] },
  { concept: "Knapsack", requires: ["1D DP"] },
  { concept: "LIS", requires: ["Binary Search", "1D DP"] },
  { concept: "Grid DP", requires: ["2D DP"] },
  { concept: "Interval DP", requires: ["2D DP"] },
  { concept: "Bitmask DP", requires: ["Basic Bit Operations", "Knapsack"] },
  { concept: "Digit DP", requires: ["1D DP"] },

  { concept: "Interval Greedy", requires: ["Basic Greedy"] },
  { concept: "Scheduling", requires: ["Basic Greedy", "Priority Queue"] },

  { concept: "K-th Element", requires: ["Priority Queue"] },
  { concept: "Two Heap Technique", requires: ["Priority Queue"] },

  { concept: "Basic Trie", requires: ["Basic Bit Operations"] },
  { concept: "Bitwise Trie", requires: ["Basic Trie"] },

  { concept: "Fenwick Tree", requires: ["Binary Search"] },
  { concept: "Segment Tree", requires: ["Binary Search", "Fenwick Tree"] },
  { concept: "Lazy Propagation", requires: ["Segment Tree"] },

  { concept: "Bitmasking", requires: ["Basic Bit Operations"] },
  { concept: "XOR", requires: ["Basic Bit Operations"] },
];

export function getPrerequisites(concept: string): string[] {
  const relation = PREREQUISITES.find((r) => r.concept === concept);
  return relation ? relation.requires : [];
}

export function getDependents(concept: string): string[] {
  return PREREQUISITES.filter((r) => r.requires.includes(concept)).map((r) => r.concept);
}

export function arePrerequisitesMet(
  concept: string,
  solvedConcepts: Set<string>
): boolean {
  const prereqs = getPrerequisites(concept);
  if (prereqs.length === 0) return true;
  return prereqs.every((p) => solvedConcepts.has(p));
}
