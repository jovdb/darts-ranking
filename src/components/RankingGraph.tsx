import { For, Show, createMemo, createSignal, createEffect } from "solid-js";

import {
  DEFAULT_ELO_RATING,
  formatScore,
  type RankedPlayer,
  type RankingTimelineSnapshot,
} from "~/services/ranking";

import "./RankingGraph.css";

type RankingGraphProps = {
  rankings: RankedPlayer[];
  timeline: RankingTimelineSnapshot[];
};

type GraphPoint = {
  color: string;
  datePlayedGmt: string;
  matchIndex: number;
  playerName: string;
  rank: number;
  score: number;
  x: number;
  y: number;
};

const CHART_WIDTH = 920;
const CHART_HEIGHT = 360;
const CHART_PADDING = {
  bottom: 42,
  left: 54,
  right: 18,
  top: 20,
};
const GRAPH_COLORS = [
  "#b45a22",
  "#0f766e",
  "#2563eb",
  "#be185d",
  "#7c3aed",
  "#15803d",
  "#b91c1c",
  "#c2410c",
  "#1d4ed8",
  "#4338ca",
];

const formatTooltipTime = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const createLinePath = (points: GraphPoint[]) => {
  if (points.length < 2) return "";

  let path = `M${points[0].x} ${points[0].y}`;

  // For smooth Bézier curves connecting multiple points
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    // Calculate smooth Bézier control points
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;

    // Control points for ultra-smooth Bézier curves
    const cp1x = prev.x + dx * 0.5;
    const cp1y = prev.y + dy * 0.0;
    const cp2x = curr.x - dx * 0.5;
    const cp2y = curr.y - dy * 0.00;

    path += ` C${cp1x} ${cp1y} ${cp2x} ${cp2y} ${curr.x} ${curr.y}`;
  }

  return path;
};;

const getStepX = (stepIndex: number, stepCount: number, plotWidth: number) => {
  return (
    CHART_PADDING.left +
    (stepCount > 1 ? (stepIndex / (stepCount - 1)) * plotWidth : plotWidth / 2)
  );
};

export function RankingGraph(props: RankingGraphProps) {
  const [activePoint, setActivePoint] = createSignal<GraphPoint | null>(null);
  const [activeMatchIndex, setActiveMatchIndex] = createSignal<number | null>(null);
  const [hoveredPlayerName, setHoveredPlayerName] = createSignal<string | null>(
    null,
  );

  const plotWidth =
    CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
  const plotHeight =
    CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;
  const graphStepCount = () => props.timeline.length + 1;

  const scoreRange = createMemo(() => {
    const allScores = [
      DEFAULT_ELO_RATING,
      ...props.rankings.map((ranking) => ranking.score),
      ...props.timeline.flatMap((snapshot) => {
        return snapshot.rankings.map((ranking) => ranking.score);
      }),
    ];
    const minScore = Math.min(...allScores);
    const maxScore = Math.max(...allScores);

    return {
      max: maxScore === minScore ? maxScore + 1 : maxScore,
      min: minScore,
    };
  });

  const orderedPlayers = createMemo(() => {
    return props.rankings.map((player, index) => ({
      color: GRAPH_COLORS[index % GRAPH_COLORS.length],
      ...player,
    }));
  });

  const graphSeries = createMemo(() => {
    const stepCount = graphStepCount();
    const xStep = stepCount > 1 ? plotWidth / (stepCount - 1) : 0;

    return orderedPlayers().map((player) => {
      const startingRank =
        props.rankings.findIndex((entry) => entry.name === player.name) + 1;
      const points: GraphPoint[] = [
        {
          color: player.color,
          datePlayedGmt: "",
          matchIndex: -1,
          playerName: player.name,
          rank: startingRank,
          score: DEFAULT_ELO_RATING,
          x: CHART_PADDING.left,
          y:
            CHART_PADDING.top +
            plotHeight -
            ((DEFAULT_ELO_RATING - scoreRange().min) /
              (scoreRange().max - scoreRange().min || 1)) *
              plotHeight,
        },
      ];

      points.push(...props.timeline.map((snapshot, index) => {
        const ranking = snapshot.rankings.find(
          (rankedPlayer) => rankedPlayer.name === player.name,
        ) ?? {
          isInPlacement: true,
          kFactor: 60,
          losses: 0,
          matchCount: 0,
          name: player.name,
          rank: startingRank,
          score: player.score,
          wins: 0,
        };
        const normalizedScore =
          (ranking.score - scoreRange().min) /
          (scoreRange().max - scoreRange().min || 1);

        return {
          color: player.color,
          datePlayedGmt: snapshot.datePlayedGmt,
          matchIndex: snapshot.matchIndex,
          playerName: player.name,
          rank: ranking.rank,
          score: ranking.score,
          x:
            CHART_PADDING.left +
            ((index + 1) * xStep),
          y: CHART_PADDING.top + plotHeight - normalizedScore * plotHeight,
        } satisfies GraphPoint;
      }));

      return {
        color: player.color,
        latest: points.at(-1) ?? null,
        name: player.name,
        points,
      };
    });
  });

  const yTicks = createMemo(() => {
    const currentScoreRange = scoreRange();
    const minScore = Math.floor(currentScoreRange.min);
    const maxScore = Math.ceil(currentScoreRange.max);
    const tickStep = Math.max(1, Math.ceil((maxScore - minScore) / 4));
    const tickValues = new Set<number>([minScore, maxScore]);

    for (let value = minScore; value <= maxScore; value += tickStep) {
      tickValues.add(value);
    }

    return [...tickValues].sort((left, right) => left - right).map((value) => {
      const normalizedValue =
        (value - currentScoreRange.min) /
        (currentScoreRange.max - currentScoreRange.min || 1);

      return {
        label: String(value),
        value,
        y: CHART_PADDING.top + plotHeight - normalizedValue * plotHeight,
      };
    });
  });

  const xTicks = createMemo(() => {
    const stepCount = graphStepCount();

    if (stepCount === 0) {
      return [];
    }

    const step = Math.max(1, Math.ceil((stepCount - 1) / 6));
    const indexes = new Set<number>([0, stepCount - 1]);

    for (let index = 0; index < stepCount; index += step) {
      indexes.add(index);
    }

    return [...indexes]
      .sort((left, right) => left - right)
      .map((index) => {
        return {
          label: `M${index}`,
          x: getStepX(index, stepCount, plotWidth),
        };
      });
  });

  const matchColumns = createMemo(() => {
    const matchCount = props.timeline.length;
    const stepCount = graphStepCount();

    if (matchCount === 0) {
      return [];
    }

    return props.timeline.map((snapshot, index) => {
      const stepIndex = index + 1;
      const previousX = getStepX(stepIndex - 1, stepCount, plotWidth);
      const currentX = getStepX(stepIndex, stepCount, plotWidth);
      const width = Math.max(currentX - previousX, 1);

      return {
        centerX: previousX + width / 2,
        datePlayedGmt: snapshot.datePlayedGmt,
        matchIndex: snapshot.matchIndex,
        summary: `${snapshot.winningPlayer} beats ${snapshot.losingPlayers.join(", ")}: +${formatScore(snapshot.earnedPoints)} rating`,
        width,
        x: currentX,
        xStart: previousX,
      };
    });
  });

  const activePlayerName = () => hoveredPlayerName() ?? activePoint()?.playerName;

  const activeMatchColumn = createMemo(() => {
    const matchIndex = activeMatchIndex();

    if (matchIndex === null) {
      return null;
    }

    return (
      matchColumns().find((column) => column.matchIndex === matchIndex) ?? null
    );
  });

  return (
    <section class="card card-wide ranking-graph-card">
      <div class="card-header">
        <div>
          <h2>Ranking timeline</h2>
          <p class="card-copy">
            Elo rating progression by match step. The x-axis only advances when a
            match was played.
          </p>
        </div>
      </div>

      <Show
        when={props.rankings.length > 0 && props.timeline.length > 0}
        fallback={
          <p class="helper-text">
            No matches available yet.
          </p>
        }
      >
        <div
          class="ranking-graph-surface"
          onMouseLeave={() => {
            setActivePoint(null);
            setActiveMatchIndex(null);
            setHoveredPlayerName(null);
          }}
        >
          <div class="ranking-graph-scroll">
            <svg
              aria-labelledby="ranking-graph-title"
              class="ranking-graph-svg"
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            >
              <title id="ranking-graph-title">Ranking score progression</title>

              <line
                class="ranking-graph-axis"
                x1={CHART_PADDING.left}
                x2={CHART_PADDING.left}
                y1={CHART_PADDING.top}
                y2={CHART_PADDING.top + plotHeight}
              />
              <line
                class="ranking-graph-axis"
                x1={CHART_PADDING.left}
                x2={CHART_PADDING.left + plotWidth}
                y1={CHART_PADDING.top + plotHeight}
                y2={CHART_PADDING.top + plotHeight}
              />

              <For each={yTicks()}>
                {(tick) => (
                  <g>
                    <line
                      class="ranking-graph-gridline"
                      x1={CHART_PADDING.left}
                      x2={CHART_PADDING.left + plotWidth}
                      y1={tick.y}
                      y2={tick.y}
                    />
                    <text
                      class="ranking-graph-tick-label"
                      text-anchor="end"
                      x={CHART_PADDING.left - 10}
                      y={tick.y + 4}
                    >
                      {tick.label}
                    </text>
                  </g>
                )}
              </For>

              <For each={xTicks()}>
                {(tick) => (
                  <g>
                    <line
                      class="ranking-graph-gridline ranking-graph-gridline-vertical"
                      x1={tick.x}
                      x2={tick.x}
                      y1={CHART_PADDING.top}
                      y2={CHART_PADDING.top + plotHeight}
                    />
                    <text
                      class="ranking-graph-tick-label"
                      text-anchor="middle"
                      x={tick.x}
                      y={CHART_PADDING.top + plotHeight + 20}
                    >
                      {tick.label}
                    </text>
                  </g>
                )}
              </For>

              <text
                class="ranking-graph-axis-title"
                text-anchor="middle"
                transform={`translate(18 ${CHART_PADDING.top + plotHeight / 2}) rotate(-90)`}
              >
                Rating
              </text>
              <text
                class="ranking-graph-axis-title"
                text-anchor="middle"
                x={CHART_PADDING.left + plotWidth / 2}
                y={CHART_HEIGHT - 6}
              >
                Matches played
              </text>

              <Show when={activeMatchColumn() !== null}>
                <rect
                  class="ranking-graph-hover-column"
                  height={plotHeight}
                  width={activeMatchColumn()?.width ?? 0}
                  x={activeMatchColumn()?.xStart ?? 0}
                  y={CHART_PADDING.top}
                />
              </Show>

              <For each={matchColumns()}>
                {(column) => (
                  <rect
                    fill="transparent"
                    height={plotHeight}
                    width={column.width}
                    x={column.xStart}
                    y={CHART_PADDING.top}
                    onMouseEnter={() => {
                      setActivePoint(null);
                      setActiveMatchIndex(column.matchIndex);
                      setHoveredPlayerName(null);
                    }}
                  />
                )}
              </For>

              <For each={graphSeries()}>
                {(series) => {
                  let pathRef: SVGPathElement | undefined;

                  createEffect(() => {
                    // Animation is now only triggered by legend/point clicks, not hover
                    const active = activePlayerName();

                    if (active === series.name && pathRef) {
                      // Reset animation first
                      pathRef.style.animation = 'none';
                      pathRef.getBoundingClientRect(); // Force reflow

                      const length = pathRef.getTotalLength();
                      if (length > 0) {
                        pathRef.style.strokeDasharray = `${length}`;
                        pathRef.style.strokeDashoffset = `${length}`;
                        pathRef.style.animation = `draw-line 0.8s ease-in-out forwards`;
                      }
                    }
                  });

                  return (
                    <g>
                      <path
                        ref={pathRef}
                        class="ranking-graph-line"
                        classList={{
                          "ranking-graph-line-animated": activePlayerName() === series.name
                        }}
                        d={createLinePath(series.points)}
                        opacity={
                          !activePlayerName() || activePlayerName() === series.name
                            ? 1
                            : 0.22
                        }
                        stroke={series.color}
                        style={{
                          "stroke-width": activePlayerName() === series.name ? "5px" : "3px"
                        }}
                      />
                      <For each={series.points}>
                        {(point) => (
                          <circle
                            class="ranking-graph-point"
                            cx={point.x}
                            cy={point.y}
                            fill={point.color}
                            opacity={
                              !activePlayerName() || activePlayerName() === series.name
                                ? 1
                                : 0.3
                            }
                            r={activePoint() === point ? 5.5 : 4}
                            onMouseEnter={() => {
                              setActiveMatchIndex(point.matchIndex);
                              setHoveredPlayerName(series.name);
                              setActivePoint(point);
                            }}
                          />
                        )}
                      </For>
                    </g>
                  );
                }}
              </For>
            </svg>
          </div>

          <Show when={activeMatchColumn() !== null}>
            <div
              class="ranking-graph-tooltip"
              style={{
                left: `${Math.min((activeMatchColumn()?.centerX ?? 0) + 12, CHART_WIDTH - 210)}px`,
                top: `${Math.max(CHART_PADDING.top + 8, 8)}px`,
              }}
            >
              <span class="ranking-graph-tooltip-line">{activeMatchColumn()?.summary}</span>
              <span>{formatTooltipTime(activeMatchColumn()?.datePlayedGmt ?? "")}</span>
            </div>
          </Show>
        </div>

        <ul class="ranking-graph-legend">
          <For each={graphSeries()}>
            {(series) => (
              <li
                class="ranking-graph-legend-item"
                data-active={activePlayerName() === series.name}
                data-dimmed={Boolean(activePlayerName()) && activePlayerName() !== series.name}
                onMouseEnter={() => setHoveredPlayerName(series.name)}
                onMouseLeave={() => {
                  setHoveredPlayerName(null);
                }}
              >
                <span
                  class="ranking-graph-legend-swatch"
                  style={{ "background-color": series.color }}
                />
                <span class="ranking-graph-legend-name">{series.name}</span>
                <span class="ranking-graph-legend-meta">
                  #{series.latest?.rank ?? "-"} · {formatScore(series.latest?.score ?? 0)} rating
                </span>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </section>
  );
}