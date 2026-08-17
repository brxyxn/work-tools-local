import type { DiffRowType, DiffStats } from "./diff";

export interface DiffFixture {
  name: string;
  original: string;
  changed: string;
  types: DiffRowType[];
  stats: DiffStats;
}

export const diffFixtures: readonly DiffFixture[] = [
  { name: "empty", original: "", changed: "", types: [], stats: { additions: 0, deletions: 0 } },
  { name: "identical", original: "same\ntext", changed: "same\ntext", types: ["unchanged", "unchanged"], stats: { additions: 0, deletions: 0 } },
  { name: "added", original: "", changed: "new line", types: ["added"], stats: { additions: 1, deletions: 0 } },
  { name: "removed", original: "old line", changed: "", types: ["removed"], stats: { additions: 0, deletions: 1 } },
  { name: "modified", original: "hello old", changed: "hello new", types: ["modified"], stats: { additions: 1, deletions: 1 } },
  { name: "trailing newline", original: "line\n", changed: "line\nnext\n", types: ["unchanged", "added"], stats: { additions: 1, deletions: 0 } },
  { name: "whitespace only", original: "a b", changed: "a  b", types: ["modified"], stats: { additions: 1, deletions: 1 } },
  { name: "Unicode", original: "Héllo 👋", changed: "Héllo 🌍", types: ["modified"], stats: { additions: 1, deletions: 1 } },
  { name: "unequal blocks", original: "one\ntwo\nthree", changed: "one\nTWO", types: ["unchanged", "modified", "removed"], stats: { additions: 1, deletions: 2 } },
];
