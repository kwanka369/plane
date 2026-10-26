/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type MindmapIssue = {
  id: string;
  parent_id: string | null;
  module_ids?: readonly string[] | null;
  stateGroup?: "backlog" | "unstarted" | "started" | "completed" | "cancelled";
};

export type MindmapProgress = {
  total: number;
  done: number;
  remaining: number;
  cancelled: number;
  unknown: number;
};

export type MindmapNode = {
  id: string;
  issueId: string | null;
  parentId: string | null;
  childIds: string[];
  detached: boolean;
  x: number;
  y: number;
  groupKey?: string;
  linkedParentId?: string;
  progress?: MindmapProgress;
};

export const PROJECT_ROOT_ID = "mindmap:project";
export const NODE_WIDTH = 264;
export const NODE_HEIGHT = 160;
const GAP_MAIN = 64;
const GAP_CROSS = 24;
const PADDING = 24;

function emptyProgress(): MindmapProgress {
  return { total: 0, done: 0, remaining: 0, cancelled: 0, unknown: 0 };
}

function addProgress(progress: MindmapProgress, issue: MindmapIssue) {
  progress.total++;
  if (issue.stateGroup === "completed") progress.done++;
  else if (issue.stateGroup === "cancelled") progress.cancelled++;
  else if (issue.stateGroup) progress.remaining++;
  else progress.unknown++;
}

export function buildMindmapTree(
  issues: readonly MindmapIssue[],
  collapsed: ReadonlySet<string> = new Set(),
  options: {
    groupByModule?: boolean;
    moduleIds?: readonly string[];
    expanded?: ReadonlySet<string>;
  } = {}
) {
  const rootId = PROJECT_ROOT_ID;
  const nodes = new Map<string, MindmapNode>();
  const uniqueIssues = new Map<string, MindmapIssue>();
  for (const issue of issues) {
    if (!uniqueIssues.has(issue.id)) uniqueIssues.set(issue.id, issue);
  }
  const membership = new Map<string, Set<string>>();
  for (const issue of uniqueIssues.values()) membership.set(issue.id, new Set(issue.module_ids ?? []));
  nodes.set(rootId, {
    id: rootId,
    issueId: null,
    parentId: null,
    childIds: [],
    detached: false,
    x: PADDING,
    y: PADDING,
    progress: emptyProgress(),
  });
  function ensureGroup(groupKey: string) {
    const groupId = `mindmap:module:${groupKey}`;
    if (!nodes.has(groupId)) {
      nodes.set(groupId, {
        id: groupId,
        issueId: null,
        parentId: rootId,
        childIds: [],
        detached: false,
        x: 0,
        y: 0,
        groupKey,
        progress: emptyProgress(),
      });
    }
    return groupId;
  }
  if (options.groupByModule) {
    for (const moduleId of options.moduleIds ?? []) ensureGroup(moduleId);
  }
  for (const issue of uniqueIssues.values()) {
    addProgress(nodes.get(rootId)!.progress!, issue);
    const moduleIds = [...membership.get(issue.id)!];
    const groups = options.groupByModule ? (moduleIds.length ? moduleIds : ["none"]) : [null];
    for (const groupKey of groups) {
      const groupId = groupKey === null ? rootId : ensureGroup(groupKey);
      const id = groupKey === null ? issue.id : `${groupId}:issue:${issue.id}`;
      const parent = issue.parent_id ? uniqueIssues.get(issue.parent_id) : undefined;
      const sameGroup =
        groupKey === null ||
        (groupKey === "none" ? !parent?.module_ids?.length : !!parent && membership.get(parent.id)!.has(groupKey));
      const linkedParentId = options.groupByModule && parent && !sameGroup ? parent.id : undefined;
      nodes.set(id, {
        id,
        issueId: issue.id,
        parentId:
          issue.parent_id && sameGroup
            ? groupKey === null
              ? issue.parent_id
              : `${groupId}:issue:${issue.parent_id}`
            : groupId,
        childIds: [],
        detached: !!issue.parent_id && !parent,
        linkedParentId,
        x: 0,
        y: 0,
      });
      if (groupKey !== null) addProgress(nodes.get(groupId)!.progress!, issue);
    }
  }

  // Resolve each parent chain once; break a cycle without dropping any of its work items.
  const resolved = new Set<string>();
  for (const node of nodes.values()) {
    if (!node.issueId) resolved.add(node.id);
  }
  for (const start of nodes.values()) {
    const chain = new Set<string>();
    let node: MindmapNode | undefined = start;
    while (node && !resolved.has(node.id)) {
      chain.add(node.id);
      if (!node.parentId || !nodes.has(node.parentId) || chain.has(node.parentId)) {
        node.detached = node.detached || node.parentId !== null;
        const groupEnd = options.groupByModule ? node.id.lastIndexOf(":issue:") : -1;
        node.parentId = groupEnd >= 0 ? node.id.slice(0, groupEnd) : rootId;
        break;
      }
      node = nodes.get(node.parentId);
    }
    for (const id of chain) resolved.add(id);
  }
  for (const node of nodes.values()) {
    if (node.parentId) nodes.get(node.parentId)?.childIds.push(node.id);
  }

  const isCollapsed = (id: string) => (options.expanded ? !options.expanded.has(id) : collapsed.has(id));

  const visible: MindmapNode[] = [];
  const pending = [nodes.get(rootId)!];
  while (pending.length) {
    const node = pending.pop()!;
    visible.push(node);
    if (!isCollapsed(node.id)) {
      for (let i = node.childIds.length - 1; i >= 0; i--) pending.push(nodes.get(node.childIds[i])!);
    }
  }

  // Adapted from MindSpark layoutTree's subtree extents and forward placement.
  // Iterative passes also support deep Plane hierarchies without recursive stack overflow.
  const extents = new Map<string, number>();
  for (let i = visible.length - 1; i >= 0; i--) {
    const node = visible[i];
    const children = isCollapsed(node.id) ? [] : node.childIds;
    const extent = children.reduce((sum, id) => sum + extents.get(id)! + GAP_CROSS, -GAP_CROSS);
    extents.set(node.id, Math.max(NODE_HEIGHT, extent));
  }
  const tops = new Map([[rootId, PADDING]]);
  for (const node of visible) {
    const top = tops.get(node.id)!;
    node.y = top + (extents.get(node.id)! - NODE_HEIGHT) / 2;
    let childTop = top;
    if (isCollapsed(node.id)) continue;
    for (const id of node.childIds) {
      const child = nodes.get(id)!;
      child.x = node.x + NODE_WIDTH + GAP_MAIN;
      tops.set(id, childTop);
      childTop += extents.get(id)! + GAP_CROSS;
    }
  }

  // A compact module overview uses the available horizontal space instead of one tall column.
  if (options.groupByModule && visible.length > 1 && visible.every((node) => !node.issueId)) {
    const groups = visible.slice(1);
    const columns = Math.min(3, groups.length);
    const rows = Math.ceil(groups.length / columns);
    nodes.get(rootId)!.y = PADDING + (rows * (NODE_HEIGHT + GAP_CROSS) - GAP_CROSS - NODE_HEIGHT) / 2;
    for (let index = 0; index < groups.length; index++) {
      groups[index].x = PADDING + (1 + (index % columns)) * (NODE_WIDTH + GAP_MAIN);
      groups[index].y = PADDING + Math.floor(index / columns) * (NODE_HEIGHT + GAP_CROSS);
    }
  }

  return {
    nodes: visible,
    detachedCount: [...nodes.values()].filter((node) => node.detached).length,
    width: visible.reduce((width, node) => Math.max(width, node.x + NODE_WIDTH), 0) + PADDING,
    height: visible.reduce((height, node) => Math.max(height, node.y + NODE_HEIGHT), 0) + PADDING,
  };
}
