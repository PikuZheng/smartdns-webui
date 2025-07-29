"use client";

import * as React from 'react';
import Box from '@mui/material/Box';
import { useTheme, type SxProps } from '@mui/material/styles';
import { smartdnsServer } from '@/lib/backend/server';
import type { HourlyQueryCountResponse } from '@/lib/backend/server';
import { useUser } from '@/hooks/use-user';
import { CardLoading } from './card-loading';
import { type ActiveElement, Chart, type ChartEvent, registerables } from 'chart.js';
import { useTranslation } from 'react-i18next';
import { FindInPageOutlined } from '@mui/icons-material';
import { IconButton } from '@mui/material';
import { Line } from 'react-chartjs-2';
import annotationPlugin from 'chartjs-plugin-annotation';
import { paths } from '@/paths';
import { useRouter } from 'next/navigation';

Chart.register(...registerables);
Chart.register(annotationPlugin);

export interface HourlyQueryCountProps {
  queryCount: HourlyQueryCountResponse;
  setTitle: (title: string) => void;
  setTitleAction: (action: React.ReactNode) => void;
  sx?: SxProps;
}

function HourlyQueryCountTable({ queryCount, setTitle, setTitleAction }: HourlyQueryCountProps): React.JSX.Element {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const myChartRef = React.useRef<Chart<'line'> | null>(null);
  const [isRangeReady, setIsRangeReady] = React.useState(false);
  const [selectedRange, setSelectedRange] = React.useState<{ start: number, end: number } | null>(null);

  React.useEffect(() => {
    setTitle("Hourly Query Count");
    setTitleAction(
      <IconButton
        onClick={(): void => {
          const queryCountList = queryCount.hourly_query_count;
          const queryTimestamp = queryCount.query_timestamp;

          let start = selectedRange?.start ?? -1;
          let end = selectedRange?.end ?? -1;

          let includeNextRange = false;
          if (start > end) {
            [start, end] = [end, start];
          }


          if (start === -1) {
            start = 0;
          }

          if (end === -1) {
            end = queryCountList.length - 1;
            includeNextRange = true;
          }

          if (queryCountList.length === 0) {
            return;
          }
          
          const endDate = queryCountList[start].hour;
          const startDate = queryCountList[end].hour;

          const startTimestamp = new Date(startDate).getTime();
          let endTimestamp = new Date(endDate).getTime();

          let totalCount = 0;
          for (let i = end; i > start; i--) {
            totalCount += queryCountList[i].query_count;
          }

          if (startTimestamp === endTimestamp || includeNextRange) {
            totalCount += queryCountList[start].query_count;
            includeNextRange = true;
          }

          if (includeNextRange) {
            endTimestamp += 3600000;
          }

          if (endTimestamp > queryTimestamp) {
            endTimestamp = queryTimestamp;
          }

          const url = `${paths.dashboard.queryLog}?timestamp_before=${endTimestamp}&timestamp_after=${startTimestamp}&total_count=${totalCount}`;
          router.push(url);
        }}
      >
        <FindInPageOutlined />
      </IconButton>
    );
  }, [setTitle, setTitleAction, selectedRange, router, queryCount]);

  const handleClick = (event: ChartEvent, _elements: ActiveElement[], chart: Chart): void => {
    const xScale = chart.scales['x'];
    const x = xScale.getValueForPixel(event.x ?? 0) ?? 0;

    if (isRangeReady) {
      setSelectedRange(null);
      setIsRangeReady(false);
      return;
    }

    if (selectedRange === null) {
      setSelectedRange({ start: x, end: x });
      return;
    }

    setSelectedRange({ start: selectedRange.start, end: x });
    setIsRangeReady(true);
  };

  return (<Box
    sx={{
      height: '200px',
    }}>
    <Line
      ref={myChartRef}
      data={{
        labels: queryCount.hourly_query_count.map((data) => {
          const date = new Date(data.hour);
          const hours = date.getHours().toString().padStart(2, '0');
          const minutes = date.getMinutes().toString().padStart(2, '0');
          return `${hours}:${minutes}`;
        }),
        datasets: [
          {
            label: t("Query Count"),
            data: queryCount.hourly_query_count.map((data) => data.query_count),
            fill: false,
            borderColor: theme.palette.primary.main,
            tension: 0.1,
          }
        ],
      }}
      options={{
        animation: {
          duration: 400,
        },
        scales: {
          x: {
            reverse: true,
            ticks: {},
          }
        },
        layout: {
          padding: {
            right: 15,
          },
        },
        interaction: {
          intersect: false,
          mode: 'index',
        },
        plugins: {
          legend: {
            display: false
          },
          annotation: {
            annotations: {
              box1: {
                type: 'box',
                display: selectedRange !== null,
                xMin: selectedRange?.start ?? 0,
                xMax: selectedRange?.end ?? 0,
                backgroundColor: 'rgba(30, 30, 30, 0.25)'
              }
            },
          },
          tooltip: {
            displayColors: false,
          },
        },
        maintainAspectRatio: false,
        onClick: handleClick,
      }}
    />
  </Box>);
}

export function HourlyQueryCountCard(sx: SxProps): React.JSX.Element {
  const { checkSessionError } = useUser();
  const [queryCount, setQueryCount] = React.useState<HourlyQueryCountResponse | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const { t } = useTranslation();
  const [title, setTitle] = React.useState<string>("");
  const [titleAction, setTitleAction] = React.useState<React.ReactNode | null>(null);
  const isMounted = React.useRef(true);

  React.useEffect(() => {
    const fetchData = async (): Promise<void> => {
      if (!isMounted.current) {
        return;
      }

      const data = await smartdnsServer.GetHourlyQueryCount();
      if (data.error) {
        await checkSessionError?.(data.error);
        setErrorMsg(smartdnsServer.getErrorMessage(data.error));
        setTimeout(fetchData, 3000);
        return;
      }

      if (data.data === null || data.data === undefined) {
        return;
      }

      setQueryCount(data.data);
      setLoading(false);
      setErrorMsg(null);
    };

    void fetchData();
    const fetchTimer = setInterval(fetchData, 60000);

    return (): void => {
      clearInterval(fetchTimer);
      isMounted.current = false;
    };
  }, [checkSessionError]);

  return (<Box>
    <CardLoading title={t(title)}
      titleAction={titleAction}
      isLoading={loading}
      errorMsg={errorMsg}>
      {queryCount ? <HourlyQueryCountTable queryCount={queryCount} sx={sx} setTitle={setTitle} setTitleAction={setTitleAction} /> : null}
    </CardLoading>
  </Box>);
}
