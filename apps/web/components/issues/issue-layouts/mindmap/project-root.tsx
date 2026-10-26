/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { use } from "react";
import { observer } from "mobx-react";
import useSWRInfinite from "swr/infinite";
import { useTranslation } from "@plane/i18n";
import { Button } from "@makeplane/propel/elements/button";
import { Spinner } from "@plane/blocks/spinner";
import { EIssuesStoreType } from "@plane/types";
import type { TIssuesResponse } from "@plane/types";
import { useIssues } from "@/hooks/store/use-issues";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useModule } from "@/hooks/store/use-module";
import { useLabel } from "@/hooks/store/use-label";
import useIssuePeekOverviewRedirection from "@/hooks/use-issue-peek-overview-redirection";
import { usePlatformOS } from "@/hooks/use-platform-os";
import { StoreContext } from "@/lib/store-context";
import { IssueService } from "@/services/issue";
import { MindmapCanvas } from "./canvas";
import { getMindmapParams } from "./query";

const issueService = new IssueService();

export const ProjectMindmapRoot = observer(function ProjectMindmapRoot({
  workspaceSlug,
  projectId,
}: {
  workspaceSlug: string;
  projectId: string;
}) {
  const { t } = useTranslation();
  const context = use(StoreContext);
  if (!context) throw new Error("ProjectMindmapRoot must be used within StoreProvider");
  const issueStore = context.issue.issues;
  const { issuesFilter } = useIssues(EIssuesStoreType.PROJECT);
  const { getProjectById } = useProject();
  const { getStateById } = useProjectState();
  const { getModuleById, getProjectModuleDetails } = useModule();
  const { getLabelById } = useLabel();
  const { handleRedirection } = useIssuePeekOverviewRedirection();
  const { isMobile } = usePlatformOS();
  const project = getProjectById(projectId);
  const params = getMindmapParams(issuesFilter.appliedFilters ?? {});

  const { data, error, isLoading, isValidating, size, setSize, mutate } = useSWRInfinite(
    (_pageIndex, previous: TIssuesResponse | null) => {
      if (previous && !previous.next_page_results) return null;
      return ["PROJECT_MINDMAP", workspaceSlug, projectId, params, previous?.next_cursor ?? "100:0:0"] as const;
    },
    async ([, slug, id, query, cursor]) => {
      const page = await issueService.getIssues(slug, id, { ...query, per_page: "100", cursor });
      if (!Array.isArray(page.results)) throw new Error("Mind map expected an ungrouped work item response");
      issueStore.addIssue(page.results);
      return { ...page, results: page.results };
    },
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      onError: (cause) => console.error("Failed to load project mind map", cause),
    }
  );

  const issueIds = [...new Set(data?.flatMap((page) => page.results.map((issue) => issue.id)) ?? [])];
  const cards = issueIds.flatMap((id) => {
    const issue = issueStore.getIssueById(id);
    if (!issue || issue.project_id !== projectId) return [];
    const state = getStateById(issue.state_id);
    return [
      {
        id: issue.id,
        parent_id: issue.parent_id,
        name: issue.name,
        identifier: `${project?.identifier ?? ""}-${issue.sequence_id}`,
        stateName: state?.name,
        stateColor: state?.color,
        stateGroup: state?.group,
        module_ids: issue.module_ids,
        modules: (issue.module_ids ?? []).map((moduleId) => ({
          id: moduleId,
          name: getModuleById(moduleId)?.name ?? moduleId,
        })),
        labels: (issue.label_ids ?? []).map((labelId) => ({
          id: labelId,
          name: getLabelById(labelId)?.name ?? labelId,
          color: getLabelById(labelId)?.color,
        })),
      },
    ];
  });
  const hasMore = data?.at(-1)?.next_page_results ?? false;

  function refresh() {
    void mutate().catch((cause) => console.error("Failed to refresh project mind map", cause));
  }

  function loadMore() {
    void setSize(size + 1).catch((cause) => console.error("Failed to load more mind map work items", cause));
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-subtle p-3 text-12 text-secondary">
        <p className="min-w-0 flex-1">{t("issue.mindmap.description")}</p>
        <Button variant="secondary" size="sm" stretch="auto" disabled={isValidating} onClick={refresh}>
          {t("refresh")}
        </Button>
      </div>
      {error && (
        <div role="alert" className="flex items-center gap-3 p-3 text-13 text-primary">
          <span>{t("something_went_wrong_please_try_again")}</span>
          <Button variant="secondary" size="sm" stretch="auto" disabled={isValidating} onClick={refresh}>
            {t("common.retry")}
          </Button>
        </div>
      )}
      {isLoading ? (
        <output aria-label={t("loading")} className="grid flex-1 place-items-center">
          <Spinner />
        </output>
      ) : data ? (
        <>
          {hasMore && (
            <p role="status" className="px-3 pt-3 text-12 text-secondary">
              {t("issue.mindmap.partial")}
            </p>
          )}
          {cards.length === 0 && <p className="p-3 text-13 text-secondary">{t("no_matching_results")}</p>}
          <MindmapCanvas
            key={projectId}
            cards={cards}
            modules={(getProjectModuleDetails(projectId) ?? []).map((module) => ({ id: module.id, name: module.name }))}
            isPartial={hasMore || !!error}
            projectName={project?.name ?? ""}
            label={t("issue.mindmap.label")}
            detachedLabel={t("issue.mindmap.detached")}
            onOpen={(id) => handleRedirection(workspaceSlug, issueStore.getIssueById(id), isMobile)}
          />
          {hasMore && (
            <div className="border-t border-subtle p-3">
              <Button variant="secondary" size="sm" stretch="auto" disabled={isValidating} onClick={loadMore}>
                {isValidating ? t("loading") : t("load_more")}
              </Button>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
});
