import { CONCEPTS } from "@/data/concepts";

const TAG_TO_CONCEPT: Record<string, string[]> = {
  // Codeforces tags
  "implementation": ["Basic Bit Operations"],
  "math": [],
  "greedy": ["Basic Greedy"],
  "dp": ["1D DP", "2D DP"],
  "data structures": [],
  "brute force": [],
  "constructive algorithms": [],
  "binary search": ["Binary Search"],
  "sortings": [],
  "graphs": ["BFS", "DFS"],
  "trees": ["Tree Traversal"],
  "strings": [],
  "number theory": [],
  "geometry": [],
  "combinatorics": [],
  "probabilities": [],
  "two pointers": ["Two Pointers"],
  "shortest paths": ["BFS", "Dijkstra"],
  "dfs and similar": ["DFS"],
  "bfs": ["BFS"],
  "union find": ["DSU"],
  "divide and conquer": ["Binary Search"],
  "stack": ["Monotonic Stack"],
  "queue": ["Deque"],
  "heap": ["Priority Queue"],
  "segment tree": ["Segment Tree"],
  "binary indexed tree": ["Fenwick Tree"],
  "bitmasks": ["Bitmasking", "Basic Bit Operations"],
  "bit manipulation": ["Bitmasking", "Basic Bit Operations"],
  "string suffix structures": ["Basic Trie"],
  "hashing": [],
  "matrices": ["2D DP"],
  "flows": [],
  "matching": ["Bipartite Graph"],
  "interactive": [],
  "games": [],
  "schedules": ["Scheduling"],
  "prefix sum": ["Prefix Sum"],
  "sorting": [],
  "backtracking": [],
  "topological sort": ["Topological Sort"],
  "strongly connected": ["SCC"],
  "lowest common ancestor": ["LCA"],
  "centroid": ["Tree Traversal"],
  "2-sat": ["SCC"],
  "kotlin hacks": [],
  "meet-in-the-middle": ["Bitmask DP"],
  "expression parsing": [],
  "recursion": [],
  "diameter": ["Diameter"],
  "euler circuit": ["DFS"],
  "chinese remainder theorem": [],
  "graph matchings": ["Bipartite Graph"],
  "dp optimization": ["Knapsack", "1D DP"],
  "string matching": [],
  "floyd-warshall": ["Floyd-Warshall"],
  "bellman-ford": ["Bellman-Ford"],
  "dijkstra": ["Dijkstra"],
  "mst": ["MST"],
  "bridge": ["DFS"],
  "art point": ["DFS"],
  "tree": ["Tree Traversal"],
  "sparse table": ["Binary Search"],
};

const LC_TOPIC_TO_CONCEPT: Record<string, string[]> = {
  "array": ["Two Pointers", "Sliding Window", "Prefix Sum"],
  "hash-table": [],
  "binary-search": ["Binary Search"],
  "binary-tree": ["Tree Traversal"],
  "bfs": ["BFS"],
  "dfs": ["DFS"],
  "dynamic-programming": ["1D DP"],
  "greedy": ["Basic Greedy"],
  "backtracking": [],
  "stack": ["Monotonic Stack"],
  "queue": ["Deque"],
  "heap": ["Priority Queue"],
  "trie": ["Basic Trie"],
  "linked-list": [],
  "graph": ["BFS", "DFS"],
  "two-pointers": ["Two Pointers"],
  "sliding-window": ["Sliding Window"],
  "prefix-sum": ["Prefix Sum"],
  "bit-manipulation": ["Bitmasking", "Basic Bit Operations"],
  "tree": ["Tree Traversal"],
  "matrix": ["2D DP"],
  "binary-search-tree": ["BST"],
  "monotonic-stack": ["Monotonic Stack"],
  "union-find": ["DSU"],
  "segment-tree": ["Segment Tree"],
  "shortest-path": ["Dijkstra"],
  "topological-sort": ["Topological Sort"],
  "game-theory": [],
  "math": [],
  "string": [],
  "sorting": [],
  "memoization": ["1D DP"],
  "recursion": [],
  "depth-first-search": ["DFS"],
  "breadth-first-search": ["BFS"],
  "divide-and-conquer": ["Binary Search"],
  "monotonic-queue": ["Monotonic Queue"],
  "bucket-sort": [],
  "counting": [],
  "enumeration": [],
  "geometry": [],
  "number-theory": [],
  "combinatorics": [],
  "design": [],
  "simulation": [],
  "interactive": [],
  "database": [],
};

export function mapTagsToConcepts(
  tags: string[],
  platform: "codeforces" | "leetcode"
): string[] {
  const conceptSet = new Set<string>();
  const tagMap =
    platform === "codeforces" ? TAG_TO_CONCEPT : LC_TOPIC_TO_CONCEPT;

  for (const tag of tags) {
    const normalizedTag = tag.toLowerCase().trim();
    const mapped = tagMap[normalizedTag];
    if (mapped) {
      for (const concept of mapped) {
        conceptSet.add(concept);
      }
    }
  }

  if (conceptSet.size === 0 && tags.length > 0) {
    for (const tag of tags) {
      const normalizedTag = tag.toLowerCase().trim();
      for (const concept of CONCEPTS) {
        if (
          concept.name.toLowerCase().includes(normalizedTag) ||
          normalizedTag.includes(concept.name.toLowerCase())
        ) {
          conceptSet.add(concept.name);
        }
      }
    }
  }

  return Array.from(conceptSet);
}

export function conceptToCategory(concept: string): string {
  const found = CONCEPTS.find((c) => c.name === concept);
  return found?.category || "General";
}

export function getConceptImportance(
  concept: string
): "basic" | "intermediate" | "advanced" {
  const found = CONCEPTS.find((c) => c.name === concept);
  return found?.importance || "basic";
}
