export interface ConceptDefinition {
  name: string;
  category: string;
  description: string;
  importance: "basic" | "intermediate" | "advanced";
}

export const CONCEPTS: ConceptDefinition[] = [
  // Arrays
  { name: "Prefix Sum", category: "Arrays", description: "Precomputing cumulative sums for efficient range queries", importance: "basic" },
  { name: "Difference Array", category: "Arrays", description: "Efficient range updates using difference arrays", importance: "intermediate" },
  { name: "Kadane's Algorithm", category: "Arrays", description: "Maximum subarray sum in linear time", importance: "basic" },
  { name: "Two Pointers", category: "Arrays", description: "Using two pointers to traverse arrays efficiently", importance: "basic" },
  { name: "Sliding Window", category: "Arrays", description: "Sliding window technique for subarray/substring problems", importance: "basic" },
  { name: "Subarray Techniques", category: "Arrays", description: "General subarray manipulation techniques", importance: "basic" },

  // Binary Search
  { name: "Binary Search", category: "Binary Search", description: "Standard binary search on sorted arrays", importance: "basic" },
  { name: "Lower Bound / Upper Bound", category: "Binary Search", description: "Finding bounds in sorted sequences", importance: "intermediate" },
  { name: "Binary Search on Answer", category: "Binary Search", description: "Binary searching on the answer space", importance: "intermediate" },

  // Stack / Queue
  { name: "Monotonic Stack", category: "Stack / Queue", description: "Stack maintaining monotonic order", importance: "intermediate" },
  { name: "Monotonic Queue", category: "Stack / Queue", description: "Queue maintaining monotonic order for sliding window min/max", importance: "intermediate" },
  { name: "Deque", category: "Stack / Queue", description: "Double-ended queue operations", importance: "basic" },

  // Trees
  { name: "Tree Traversal", category: "Trees", description: "BFS/DFS traversals on trees", importance: "basic" },
  { name: "BST", category: "Trees", description: "Binary search tree operations", importance: "basic" },
  { name: "Tree DP", category: "Trees", description: "Dynamic programming on tree structures", importance: "advanced" },
  { name: "Diameter", category: "Trees", description: "Tree diameter computation", importance: "intermediate" },
  { name: "LCA", category: "Trees", description: "Lowest Common Ancestor algorithms", importance: "intermediate" },
  { name: "Binary Lifting", category: "Trees", description: "Efficient ancestor queries using binary lifting", importance: "advanced" },

  // Graphs
  { name: "BFS", category: "Graphs", description: "Breadth-first search for traversal and shortest paths", importance: "basic" },
  { name: "DFS", category: "Graphs", description: "Depth-first search for traversal and cycle detection", importance: "basic" },
  { name: "Connected Components", category: "Graphs", description: "Finding connected components in graphs", importance: "basic" },
  { name: "Topological Sort", category: "Graphs", description: "Linear ordering of vertices in DAGs", importance: "intermediate" },
  { name: "Dijkstra", category: "Graphs", description: "Shortest paths in weighted graphs with non-negative edges", importance: "intermediate" },
  { name: "0-1 BFS", category: "Graphs", description: "Shortest paths with 0/1 edge weights using deque", importance: "intermediate" },
  { name: "Bellman-Ford", category: "Graphs", description: "Shortest paths allowing negative edge weights", importance: "intermediate" },
  { name: "Floyd-Warshall", category: "Graphs", description: "All-pairs shortest paths", importance: "intermediate" },
  { name: "DSU", category: "Graphs", description: "Disjoint Set Union for connected components", importance: "intermediate" },
  { name: "MST", category: "Graphs", description: "Minimum Spanning Tree algorithms", importance: "intermediate" },
  { name: "SCC", category: "Graphs", description: "Strongly Connected Components", importance: "advanced" },
  { name: "Bipartite Graph", category: "Graphs", description: "Bipartiteness checking and coloring", importance: "intermediate" },

  // DP
  { name: "1D DP", category: "DP", description: "One-dimensional dynamic programming", importance: "basic" },
  { name: "2D DP", category: "DP", description: "Two-dimensional dynamic programming", importance: "intermediate" },
  { name: "Knapsack", category: "DP", description: "0/1 and unbounded knapsack problems", importance: "intermediate" },
  { name: "LIS", category: "DP", description: "Longest Increasing Subsequence", importance: "intermediate" },
  { name: "Grid DP", category: "DP", description: "Dynamic programming on grids/matrices", importance: "intermediate" },
  { name: "Interval DP", category: "DP", description: "Dynamic programming on intervals", importance: "advanced" },
  { name: "Bitmask DP", category: "DP", description: "DP using bitmasks to represent states", importance: "advanced" },
  { name: "Digit DP", category: "DP", description: "Digit-based dynamic programming", importance: "advanced" },

  // Greedy
  { name: "Basic Greedy", category: "Greedy", description: "Fundamental greedy algorithms", importance: "basic" },
  { name: "Interval Greedy", category: "Greedy", description: "Greedy algorithms for interval problems", importance: "intermediate" },
  { name: "Scheduling", category: "Greedy", description: "Job/task scheduling problems", importance: "intermediate" },

  // Heap
  { name: "Priority Queue", category: "Heap", description: "Priority queue / heap operations", importance: "basic" },
  { name: "K-th Element", category: "Heap", description: "Finding k-th smallest/largest elements", importance: "intermediate" },
  { name: "Two Heap Technique", category: "Heap", description: "Using two heaps for median/maintenance problems", importance: "intermediate" },

  // Trie
  { name: "Basic Trie", category: "Trie", description: "Standard trie data structure", importance: "intermediate" },
  { name: "Bitwise Trie", category: "Trie", description: "Trie for bitwise operations", importance: "advanced" },

  // Advanced Data Structures
  { name: "Fenwick Tree", category: "Advanced DS", description: "Binary Indexed Tree for prefix queries and updates", importance: "advanced" },
  { name: "Segment Tree", category: "Advanced DS", description: "Segment tree for range queries and updates", importance: "advanced" },
  { name: "Lazy Propagation", category: "Advanced DS", description: "Lazy propagation for efficient range updates", importance: "advanced" },

  // Bit Manipulation
  { name: "XOR", category: "Bit Manipulation", description: "XOR-based techniques and properties", importance: "basic" },
  { name: "Bitmasking", category: "Bit Manipulation", description: "Bitmask manipulation techniques", importance: "intermediate" },
  { name: "Basic Bit Operations", category: "Bit Manipulation", description: "Fundamental bitwise operations", importance: "basic" },
];

export const CATEGORIES = [...new Set(CONCEPTS.map((c) => c.category))];

export function getConceptByName(name: string): ConceptDefinition | undefined {
  return CONCEPTS.find((c) => c.name === name);
}

export function getConceptsByCategory(category: string): ConceptDefinition[] {
  return CONCEPTS.filter((c) => c.category === category);
}

export function slugToConcept(slug: string): string {
  return slug.replace(/-/g, " ");
}

export function conceptToSlug(concept: string): string {
  return concept.toLowerCase().replace(/ /g, "-");
}
