/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type MindmapIssue = {
  id: string;
  parent_id: string | null;
};

export type MindmapNode = {
  id: string;
  issueId: string | null;
  parentId: string | null;
  childIds: string[];
  detached: boolean;
  x: number;
  y: number;
};

export const NODE_WIDTH = 264;
export const NODE_HEIGHT = 96;
const GAP_MAIN = 64;
const GAP_CROSS = 24;
const PADDING = 24;

export function buildMindmapTree(issues: readonly MindmapIssue[], collapsed: ReadonlySet<string> = new Set()) {
  const rootId = "mindmap:project";
  const nodes = new Map<string, MindmapNode>();
  nodes.set(rootId, {
    id: rootId,
    issueId: null,
    parentId: null,
    childIds: [],
    detached: false,
    x: PADDING,
    y: PADDING,
  });
  for (const issue of issues) {
    if (nodes.has(issue.id)) continue;
    nodes.set(issue.id, {
      id: issue.id,
      issueId: issue.id,
      parentId: issue.parent_id,
      childIds: [],
      detached: false,
      x: 0,
      y: 0,
    });
  }

  // Resolve each parent chain once; break a cycle without dropping any of its work items.
  const resolved = new Set([rootId]);
  for (const start of nodes.values()) {
    const chain = new Set<string>();
    let node: MindmapNode | undefined = start;
    while (node && !resolved.has(node.id)) {
      chain.add(node.id);
      if (!node.parentId || !nodes.has(node.parentId) || chain.has(node.parentId)) {
        node.detached = node.parentId !== null;
        node.parentId = rootId;
        break;
      }
      node = nodes.get(node.parentId);
    }
    for (const id of chain) resolved.add(id);
  }
  for (const node of nodes.values()) {
    if (node.parentId) nodes.get(node.parentId)?.childIds.push(node.id);
  }

  const visible: MindmapNode[] = [];
  const pending = [nodes.get(rootId)!];
  while (pending.length) {
    const node = pending.pop()!;
    visible.push(node);
    if (!collapsed.has(node.id)) {
      for (let i = node.childIds.length - 1; i >= 0; i--) pending.push(nodes.get(node.childIds[i])!);
    }
  }

  // Adapted from MindSpark layoutTree's subtree extents and forward placement.
  // Iterative passes also support deep Plane hierarchies without recursive stack overflow.
  const extents = new Map<string, number>();
  for (let i = visible.length - 1; i >= 0; i--) {
    const node = visible[i];
    const children = collapsed.has(node.id) ? [] : node.childIds;
    const extent = children.reduce((sum, id) => sum + extents.get(id)! + GAP_CROSS, -GAP_CROSS);
    extents.set(node.id, Math.max(NODE_HEIGHT, extent));
  }
  const tops = new Map([[rootId, PADDING]]);
  for (const node of visible) {
    const top = tops.get(node.id)!;
    node.y = top + (extents.get(node.id)! - NODE_HEIGHT) / 2;
    let childTop = top;
    if (collapsed.has(node.id)) continue;
    for (const id of node.childIds) {
      const child = nodes.get(id)!;
      child.x = node.x + NODE_WIDTH + GAP_MAIN;
      tops.set(id, childTop);
      childTop += extents.get(id)! + GAP_CROSS;
    }
  }

  return {
    nodes: visible,
    detachedCount: [...nodes.values()].filter((node) => node.detached).length,
    width: visible.reduce((width, node) => Math.max(width, node.x + NODE_WIDTH), 0) + PADDING,
    height: extents.get(rootId)! + PADDING * 2,
  };
}
