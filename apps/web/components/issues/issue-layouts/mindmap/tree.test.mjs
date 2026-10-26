/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMindmapTree, NODE_HEIGHT, NODE_WIDTH, PROJECT_ROOT_ID } from "./tree.ts";
import { getMindmapParams } from "./query.ts";
import { clampZoom, fitZoom, zoomScroll } from "./viewport.ts";

const issue = (id, parent_id = null) => ({ id, parent_id });

test("module membership is exact, with shared occurrences and cross-module parent references", () => {
  const input = [
    { ...issue("a"), module_ids: ["one"] },
    { ...issue("child", "a"), module_ids: ["other"] },
    { ...issue("multi"), module_ids: ["one", "other"] },
    issue("unassigned"),
    { ...issue("duplicate-module"), module_ids: ["one", "one"] },
  ];
  const tree = buildMindmapTree(input, new Set(), { groupByModule: true });
  const occurrences = (id) => tree.nodes.filter((node) => node.issueId === id);
  assert.equal(occurrences("child")[0].parentId, "mindmap:module:other");
  assert.equal(occurrences("child")[0].linkedParentId, "a");
  assert.equal(occurrences("child")[0].detached, false);
  assert.equal(occurrences("a")[0].parentId, "mindmap:module:one");
  assert.deepEqual(
    occurrences("multi").map((node) => node.parentId),
    ["mindmap:module:one", "mindmap:module:other"]
  );
  assert.equal(occurrences("unassigned")[0].parentId, "mindmap:module:none");
  assert.equal(occurrences("duplicate-module").length, 1);
  assert.equal(tree.nodes.filter((node) => node.issueId).length, input.length + 1);
  assert.equal(input[1].parent_id, "a");
  assert.equal(buildMindmapTree(input).nodes.length, input.length + 1);
});

test("grouped broken chains and cycles remain reachable and identified", () => {
  const tree = buildMindmapTree([issue("a", "b"), issue("b", "a"), issue("missing", "absent")], new Set(), {
    groupByModule: true,
  });
  assert.equal(tree.detachedCount, 2);
  assert.equal(tree.nodes.filter((node) => node.issueId).length, 3);
  assert.ok(tree.nodes.every((node) => Number.isFinite(node.y)));
});

test("overview starts with modules only; deeper tasks and late arrivals expand progressively", () => {
  const input = [
    { ...issue("parent"), module_ids: ["one"] },
    { ...issue("child", "parent"), module_ids: ["one"] },
    { ...issue("grandchild", "child"), module_ids: ["one"] },
  ];
  const expanded = new Set([PROJECT_ROOT_ID]);
  const options = { groupByModule: true, moduleIds: ["one", "empty"], expanded };
  const overview = buildMindmapTree(input, new Set(), options);
  assert.deepEqual(
    overview.nodes.map((node) => node.id),
    [PROJECT_ROOT_ID, "mindmap:module:one", "mindmap:module:empty"]
  );
  assert.equal(overview.nodes[2].progress.total, 0);
  expanded.add("mindmap:module:one");
  const firstLevel = buildMindmapTree(input, new Set(), options);
  assert.deepEqual(
    firstLevel.nodes.filter((node) => node.issueId).map((node) => node.issueId),
    ["parent"]
  );
  expanded.add("mindmap:module:one:issue:parent");
  const nextLevel = buildMindmapTree(input, new Set(), options);
  assert.deepEqual(
    nextLevel.nodes.filter((node) => node.issueId).map((node) => node.issueId),
    ["parent", "child"]
  );
  const late = buildMindmapTree([...input, { ...issue("late"), module_ids: ["new"] }], new Set(), options);
  assert.ok(late.nodes.some((node) => node.groupKey === "new"));
  assert.ok(!late.nodes.some((node) => node.issueId === "late"));
});

test("progress uses unique module memberships and actual state groups, regardless of collapse", () => {
  const input = [
    { ...issue("done"), module_ids: ["one", "two", "one"], stateGroup: "completed" },
    { ...issue("cancelled"), module_ids: ["one"], stateGroup: "cancelled" },
    { ...issue("open"), module_ids: ["one"], stateGroup: "started" },
    { ...issue("unknown"), module_ids: ["one"] },
    { ...issue("done"), module_ids: ["one", "two", "one"], stateGroup: "completed" },
  ];
  const tree = buildMindmapTree(input, new Set(), { groupByModule: true, expanded: new Set([PROJECT_ROOT_ID]) });
  const expected = { total: 4, done: 1, remaining: 1, cancelled: 1, unknown: 1 };
  assert.deepEqual(tree.nodes[0].progress, expected);
  assert.deepEqual(tree.nodes.find((node) => node.groupKey === "one").progress, expected);
  assert.deepEqual(tree.nodes.find((node) => node.groupKey === "two").progress, {
    total: 1,
    done: 1,
    remaining: 0,
    cancelled: 0,
    unknown: 0,
  });

  assert.deepEqual(buildMindmapTree(input).nodes[0].progress, expected);
  const updated = [...input];
  updated[2] = { ...input[2], stateGroup: "completed" };
  assert.equal(buildMindmapTree(updated).nodes[0].progress.done, 2);
});

test("twelve collapsed modules form a readable three-column overview instead of a long list", () => {
  const tree = buildMindmapTree([], new Set(), {
    groupByModule: true,
    moduleIds: Array.from({ length: 12 }, (_, index) => `module-${index}`),
    expanded: new Set([PROJECT_ROOT_ID]),
  });
  const groups = tree.nodes.filter((node) => node.groupKey);
  assert.equal(groups.length, 12);
  assert.equal(new Set(groups.map((node) => node.x)).size, 3);
  assert.equal(new Set(groups.map((node) => node.y)).size, 4);
  assert.ok(tree.height < 800);
  const zoom = fitZoom(tree.width, tree.height, 1180, 810);
  assert.ok(zoom >= 0.85, "Desktop overview must not shrink cards to an unreadable scale");
  for (let index = 0; index < groups.length; index++) {
    for (let other = index + 1; other < groups.length; other++) {
      assert.ok(
        Math.abs(groups[index].x - groups[other].x) >= NODE_WIDTH ||
          Math.abs(groups[index].y - groups[other].y) >= NODE_HEIGHT
      );
    }
  }
});

test("zoom bounds, fit dimensions and center preservation are measurable", () => {
  assert.equal(clampZoom(0.001), 0.05);
  assert.equal(clampZoom(3), 2);
  const fit = fitZoom(2000, 3000, 1000, 800);
  assert.ok(2000 * fit <= 968 && 3000 * fit <= 768);
  assert.equal(fitZoom(100, 100, 1000, 800), 1);
  assert.equal(zoomScroll(200, 300, 1, 0.5), -50);
});

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
