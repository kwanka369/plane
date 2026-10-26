# Project mind map preview

The experimental mind map is a read-only view of existing Plane work items,
available from the project work-item header on desktop and mobile. It does not
run the MindSpark server, use SQLite, or require a separate login or API token.

## Using the preview

In a development build containing this feature, open a project's work items and
select **Mind map (preview)**. Alternatively, append `?mindmap=1` to its work-item
list URL. The selection is held in the URL, not submitted as a new backend layout
value. Toggle the button again or select an existing layout to leave the preview.
Other URL parameters are preserved.

- The project and modules are virtual overview cards. Work-item cards refer to
  existing Plane work items.
- Parent-child links come from `parent_id`. Work items without a parent appear
  under the project root.
- Cards show the identifier, title, state, modules, and labels from Plane stores.
  Each metadata row shows up to two chips and an overflow count; its tooltip
  includes all names. Selecting a card uses the existing work-item peek/detail
  navigation. Metadata not yet available in stores displays its ID rather than
  hiding the assignment.
- The `+` / `-` buttons collapse or expand branches locally. They never change
  `parent_id`, sorting, or any work-item data. Tab and Enter can navigate and
  activate the buttons; the canvas scrolls to accommodate wider hierarchies.
- Toolbar `+` / `-` buttons zoom between 5% and 200%, preserving the viewport
  center where scroll bounds allow. The percentage button resets to 100%.
  **Fit all** fits the visible tree, within those bounds. Very large trees can
  still require scrolling at the minimum zoom. Drag the background with a mouse
  or pen to pan; card clicks remain unchanged. Touch uses native scrolling.
- **Group by → Module** is the default. The initial view shows only collapsed
  module cards, including available active modules with no selected work items.
  The overview uses up to three columns and automatically fits the viewport.
  Opening a module reveals only its first work-item level; deeper branches are
  expanded individually. Opening a branch focuses it without automatically
  shrinking the newly opened work items.
- Membership is exact: a module contains only work items assigned to it.
  Parent-child edges remain inside a module only when both items belong there.
  Otherwise the child has a clickable **Parent in another module** reference
  when that parent is in the loaded selection. Unavailable parents still retain
  the detached warning. Items with no module appear under **No module**.
- A work item assigned to several modules has one visual occurrence in each,
  all opening the same Plane work item. Each module counts an item once; the
  project summary counts unique items once across all modules. Grouping never
  writes parent or module assignments.
- Project/module cards show completed / total work items and a progress bar.
  `completed` is done; `cancelled` is separate, not done or remaining;
  backlog/unstarted/started are remaining. An unavailable state is counted as
  unknown, never silently assumed to be remaining. Total includes cancelled and
  unknown items. Counts include every loaded selected item regardless of collapse,
  not just visible branches, and are derived from the shared Plane state store.
  **Loaded selection only** makes filter scope explicit; an asterisk and the
  existing partial-tree notice identify unfinished pagination or request errors.
- Grouping, zoom and collapse are local to the mounted preview, not saved view
  settings. Switching grouping resets to a fitted, progressively expanded
  overview; choosing **None** restores the plain hierarchy with deeper branches
  initially collapsed.
- Existing work-item filters and ordering apply, but grouping is removed and
  sub-work items are included so that the hierarchy can be built.
- Results are paginated. A notice and **Load more** button identify a partial
  tree. A parent missing from the current selection is not assumed to be deleted.
- Unavailable parents and cycles are handled by attaching a branch to the
  virtual project root with a dashed edge and explanatory notice.
- **Refresh** revalidates the loaded pages. A failed request displays an explicit
  error and **Retry** action; a partial tree is not silently presented as complete.

## Boundaries

This is a hierarchy POC, not completion of INFRA-1's dependency-graph acceptance.
Dependency/cross-branch edges are **not yet rendered**. The preview explicitly
states this limitation.

Creation from branches, reparenting, moving individual cards, persisted view
settings, saved mind-map views, workspace-wide views, and AI are not implemented.
The existing Plane work-item editor remains the way to edit work items.
There is no new cross-browser real-time synchronization mechanism.

The tree uses an adapted, iterative version of MindSpark's subtree-extent and
forward-placement algorithm. Its MIT attribution is retained in
[MINDSPARK-LICENSE](../apps/web/components/issues/issue-layouts/mindmap/MINDSPARK-LICENSE).
No MindSpark authentication, persistence, service worker, or entire `app.js`
bundle is imported.

## Validation

From the repository root, after installing the repository's declared dependencies
and building the web app's workspace dependencies:

```sh
node --test apps/web/components/issues/issue-layouts/mindmap/tree.test.mjs
pnpm --filter web check:types
pnpm --filter web build
pnpm --filter @plane/i18n sync:check
```

The tests use Node's built-in runner and TypeScript stripping (Node 22.22+);
no additional test-runner dependency is needed. They exercise the tree adapter,
cycle handling, collapse, deep hierarchies, read-query construction, module
exact module membership, cross-module parent references, multi-module
occurrences, unique progress counts, progressive expansion (including new pages),
compact overview dimensions/non-overlap, and zoom/fit calculations.

The initial browser check used the real preview components with synthetic
project/API responses in an isolated local harness. It exercised pagination,
collapse/expand, peek navigation, query preservation, narrow viewport scrolling,
keyboard activation, error/retry, empty state, and GET-only work-item requests.
It is not a production-backend compatibility or live-deployment test.

A subsequent isolated Docker environment restored the verified production backup
into separate PostgreSQL and upload volumes, using the v1.4.2 backend. Its API
has only an internal Docker network, no workers, and a dummy email backend.
Browser checks against the copied w2h project verified all 51 tasks, module/label
metadata, zoom/reset, measured fit without overflow, module-first navigation,
empty module cards, progressive expand/collapse, exact membership, cross-module
parent navigation, restoration of the ungrouped hierarchy, background dragging,
mobile controls, and GET-only work-item requests. Progress was compared to copied
database totals (project 10/51 completed, a completed module 1/1). An intercepted
partial response verified explicit incomplete counts; no source data was changed.
The initial React hydration error 418 also occurs in the normal layout; this
remains a known baseline problem, not a production-readiness sign-off.

React Doctor's latest version could not install because its registry dependency
`@sentry/node@^10.54.0` was unavailable. The repository version's diff comparison
also failed to detect React in its temporary baseline checkout. A local-only full
web scan (`pnpm exec react-doctor apps/web --verbose --diff false --no-score
--no-dead-code`) found no diagnostics in the new mind-map directory, but exited
nonzero with 15 errors in unchanged files. A numeric baseline score comparison
was therefore not available.

New translations are machine-translated and require native-speaker review.
All supported locales have the same new keys.

## Deployment

This code is on `feat/infra-1-mindmap-view`. The existing server's official Plane
images have not been replaced. A local production build does not deploy it.
Backend compatibility, real project verification, and deployment approval are
required before replacing any running frontend. No database migration is needed
for this read-only preview.
