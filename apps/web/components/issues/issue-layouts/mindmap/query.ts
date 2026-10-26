/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TIssueParams } from "@plane/types";

export const MINDMAP_QUERY_PARAM = "mindmap";

export function getMindmapParams(params: Partial<Record<TIssueParams, string | boolean>>) {
  const result = { ...params };
  delete result.group_by;
  delete result.sub_group_by;
  // A hierarchy needs children even when the previous layout hid sub-work items.
  result.sub_issue = true;
  return result;
}
