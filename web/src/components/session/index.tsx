import { GroupedScoreBadges } from "@/src/components/grouped-score-badge";
import Header from "@/src/components/layouts/header";
import { ErrorPage } from "@/src/components/error-page";
import { PublishSessionSwitch } from "@/src/components/publish-object-switch";
import { StarSessionToggle } from "@/src/components/star-toggle";
import { IOPreview } from "@/src/components/trace/IOPreview";
import { JsonSkeleton } from "@/src/components/ui/CodeJsonViewer";
import { Badge } from "@/src/components/ui/badge";
import { Card } from "@/src/components/ui/card";
import { ManualScoreButton } from "@/src/features/manual-scoring/components/ManualScoreButton";
import { DetailPageNav } from "@/src/features/navigate-detail-pages/DetailPageNav";
import { useDetailPageLists } from "@/src/features/navigate-detail-pages/context";
import { api } from "@/src/utils/api";
import { usdFormatter } from "@/src/utils/numbers";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { type RouterOutput } from "@/src/utils/types";
import {
  DataTableRowHeightSwitch,
  type RowHeight,
  useRowHeightLocalStorage,
} from "@/src/components/table/data-table-row-height-switch";
import { ScrollArea } from "@/src/components/ui/scroll-area";

// do not use the usual table row heights here
const rowHeightMapping: Record<RowHeight, number> = {
  s: 200,
  m: 350,
  l: 700,
};

export const SessionPage: React.FC<{
  sessionId: string;
  projectId: string;
}> = ({ sessionId, projectId }) => {
  const { setDetailPageList } = useDetailPageLists();
  const [rowHeight, setRowHeight] = useRowHeightLocalStorage(
    "single-session",
    "m",
  );
  const session = api.sessions.byId.useQuery(
    {
      sessionId,
      projectId: projectId,
    },
    {
      retry(failureCount, error) {
        if (error.data?.code === "UNAUTHORIZED") return false;
        return failureCount < 3;
      },
    },
  );
  useEffect(() => {
    if (session.isSuccess) {
      setDetailPageList(
        "traces",
        session.data.traces.map((t) => t.id),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.isSuccess, session.data]);

  if (session.error?.data?.code === "UNAUTHORIZED")
    return <ErrorPage message="You do not have access to this session." />;

  return (
    <div className="flex flex-col overflow-hidden xl:container">
      <Header
        title="Session"
        breadcrumb={[
          {
            name: "Sessions",
            href: `/project/${projectId}/sessions`,
          },
          { name: sessionId },
        ]}
        actionButtons={[
          <StarSessionToggle
            key="star"
            projectId={projectId}
            sessionId={sessionId}
            value={session.data?.bookmarked ?? false}
          />,
          <PublishSessionSwitch
            projectId={projectId}
            sessionId={sessionId}
            isPublic={session.data?.public ?? false}
            key="publish"
          />,
          <DetailPageNav
            key="nav"
            currentId={encodeURIComponent(sessionId)}
            path={(id) =>
              `/project/${projectId}/sessions/${encodeURIComponent(id)}`
            }
            listKey="sessions"
          />,
          <DataTableRowHeightSwitch
            rowHeight={rowHeight}
            setRowHeight={setRowHeight}
            key="height"
          />,
        ]}
      />
      <div className="flex flex-wrap gap-2">
        {session.data?.users.filter(Boolean).map((userId) => (
          <Link
            key={userId}
            href={`/project/${projectId}/users/${encodeURIComponent(
              userId ?? "",
            )}`}
          >
            <Badge>User ID: {userId}</Badge>
          </Link>
        ))}
        <Badge variant="outline">Traces: {session.data?.traces.length}</Badge>
        {session.data && (
          <Badge variant="outline">
            Total cost: {usdFormatter(session.data.totalCost, 2, 2)}
          </Badge>
        )}
      </div>
      {session.data && (
        <TraceCardList
          session={session.data}
          projectId={projectId}
          rowHeight={rowHeightMapping[rowHeight]}
        />
      )}
    </div>
  );
};

const TraceCardList = ({
  session,
  projectId,
  rowHeight,
}: {
  session: RouterOutput["sessions"]["byId"];
  projectId: string;
  rowHeight: number;
}) => {
  const listVirtualizationRef = useRef<HTMLDivElement | null>(null);

  const virtualizer = useWindowVirtualizer({
    count: session.traces.length,
    estimateSize: () => rowHeight,
    overscan: 5,
    scrollMargin: listVirtualizationRef.current?.offsetTop ?? 0,
    gap: 10,
  });
  useEffect(() => {
    // re-measure when rowHeight changes to update the virtualizer
    virtualizer.measure();
  }, [rowHeight, virtualizer]);
  return (
    <div className="mt-5 border-t pt-5">
      <div
        ref={listVirtualizationRef}
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: "relative",
        }}
      >
        {virtualizer
          .getVirtualItems()
          .map((virtualItem) => ({
            virtualItem,
            trace: session.traces[virtualItem.index],
          }))
          .map(({ virtualItem, trace }) => (
            <Card
              className="border-border-gray-150 group grid w-full gap-3 overflow-hidden p-2 shadow-none hover:border-gray-300 md:grid-cols-3"
              key={virtualItem.key}
              data-index={virtualItem.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                height: `${rowHeight}px`,
                transform: `translateY(${virtualItem.start - virtualizer.options.scrollMargin}px)`,
              }}
            >
              <ScrollArea className="col-span-2 pr-3">
                <SessionIO traceId={trace.id} />
              </ScrollArea>
              <ScrollArea>
                <div className="-mt-1 overflow-y-auto p-1 opacity-50 transition-opacity group-hover:opacity-100">
                  <Link
                    href={`/project/${projectId}/traces/${trace.id}`}
                    className="text-xs hover:underline"
                  >
                    Trace: {trace.name} ({trace.id})&nbsp;↗
                  </Link>
                  <div className="text-xs text-gray-500">
                    {trace.timestamp.toLocaleString()}
                  </div>
                  <div className="mb-1 mt-2 text-xs text-gray-500">Scores</div>
                  <div className="flex flex-wrap content-start items-start gap-1">
                    <GroupedScoreBadges scores={trace.scores} />
                  </div>
                  <ManualScoreButton
                    projectId={projectId}
                    traceId={trace.id}
                    scores={trace.scores}
                    variant="badge"
                  />
                </div>
              </ScrollArea>
            </Card>
          ))}
      </div>
    </div>
  );
};

const SessionIO = ({ traceId }: { traceId: string }) => {
  const trace = api.traces.byId.useQuery(
    { traceId: traceId },
    {
      enabled: typeof traceId === "string",
      trpc: {
        context: {
          skipBatch: true,
        },
      },
      refetchOnMount: false, // prevents refetching loops
    },
  );

  return (
    <div className="flex flex-col gap-2 overflow-x-hidden overflow-y-scroll p-0">
      {!trace.data ? (
        <JsonSkeleton
          className="h-full w-full overflow-hidden px-2 py-1"
          numRows={4}
        />
      ) : trace.data.input || trace.data.output ? (
        <IOPreview
          key={traceId}
          input={trace.data.input}
          output={trace.data.output}
          hideIfNull
        />
      ) : (
        <div className="p-2 text-xs text-gray-500">
          This trace has no input or output.
        </div>
      )}
    </div>
  );
};
