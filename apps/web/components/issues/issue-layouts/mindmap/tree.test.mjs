/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMindmapTree, NODE_HEIGHT, NODE_WIDTH } from "./tree.ts";
import { getMindmapParams } from "./query.ts";

const issue = (id, parent_id = null) => ({ id, parent_id });

test("an empty project still has one virtual root", () => {
  const tree = buildMindmapTree([]);
  assert.equal(tree.nodes.length, 1);
  assert.equal(tree.nodes[0].issueId, null);
  assert.ok(tree.width > NODE_WIDTH);
  assert.ok(tree.height > NODE_HEIGHT);
});

test("builds stable parent/child positions without mutating input", () => {
  const input = Object.freeze([
    Object.freeze(issue("child", "parent")),
    Object.freeze(issue("parent")),
    Object.freeze(issue("sibling")),
  ]);
  const tree = buildMindmapTree(input);
  assert.deepEqual(tree, buildMindmapTree(input));
  const [root, parent, child, sibling] = tree.nodes;
  assert.equal(child.parentId, parent.id);
  assert.equal(parent.parentId, root.id);
  assert.equal(sibling.parentId, root.id);
  assert.ok(child.x > parent.x);
  assert.ok(sibling.y >= parent.y + NODE_HEIGHT);
  assert.equal(tree.detachedCount, 0);
});

test("retains missing parents, self-parents and cycle members exactly once", () => {
  const tree = buildMindmapTree([
    issue("orphan", "not-loaded"),
    issue("self", "self"),
    issue("a", "b"),
    issue("b", "c"),
    issue("c", "a"),
    issue("leaf", "a"),
    issue("leaf", "a"),
  ]);
  assert.equal(tree.nodes.length, 7);
  assert.equal(new Set(tree.nodes.map((node) => node.id)).size, 7);
  assert.equal(tree.detachedCount, 3);
  assert.ok(tree.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y)));
});

test("collapse hides descendants without changing the hierarchy", () => {
  const input = [issue("a"), issue("b", "a"), issue("c", "b")];
  const tree = buildMindmapTree(input, new Set(["a"]));
  assert.deepEqual(
    tree.nodes.map((node) => node.issueId),
    [null, "a"]
  );
  assert.deepEqual(tree.nodes[1].childIds, ["b"]);
  assert.equal(buildMindmapTree(input).nodes.length, 4);
});

test("deep hierarchies do not overflow the call stack", () => {
  const input = Array.from({ length: 15000 }, (_, i) => issue(String(i), i ? String(i - 1) : null));
  const tree = buildMindmapTree(input);
  assert.equal(tree.nodes.length, input.length + 1);
  assert.ok(Number.isFinite(tree.width));
});

test("mind map preserves filters and ordering but requests an ungrouped hierarchy", () => {
  const input = Object.freeze({ group_by: "state", sub_group_by: "priority", filters: "{}", order_by: "sort_order" });
  assert.deepEqual(getMindmapParams(input), {
    filters: "{}",
    order_by: "sort_order",
    sub_issue: true,
  });
  assert.equal(input.group_by, "state");
});

test("a later page reattaches a child to its loaded parent", () => {
  const firstPage = [issue("child", "parent")];
  assert.equal(buildMindmapTree(firstPage).detachedCount, 1);
  const complete = buildMindmapTree([...firstPage, issue("parent")]);
  assert.equal(complete.detachedCount, 0);
  assert.equal(complete.nodes.find((node) => node.id === "child").parentId, "parent");
});

test("mixed parent graphs keep every work item reachable and avoid overlapping siblings", () => {
  let seed = 31;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed;
  };
  const input = Array.from({ length: 2000 }, (_, i) => issue(String(i), random() % 3 ? String(random() % 2200) : null));
  const tree = buildMindmapTree(input);
  const byId = new Map(tree.nodes.map((node) => [node.id, node]));
  assert.equal(tree.nodes.length, input.length + 1);
  for (const node of tree.nodes) {
    assert.ok(node.x >= 0 && node.y >= 0);
    if (node.parentId) assert.ok(byId.has(node.parentId));
    const children = node.childIds.map((id) => byId.get(id));
    for (let i = 1; i < children.length; i++) {
      assert.ok(children[i].y >= children[i - 1].y + NODE_HEIGHT);
    }
  }
});
