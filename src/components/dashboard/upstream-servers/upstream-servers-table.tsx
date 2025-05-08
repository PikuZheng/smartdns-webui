"use client"

import * as React from 'react';
import { useMemo, useState } from 'react';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef as MRTColumnDef,
} from 'material-react-table';
import { Card, IconButton, Tooltip, useTheme } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { type UpStreamServers, smartdnsServer } from '@/lib/backend/server';
import { useUser } from '@/hooks/use-user';
import { useTranslation } from 'react-i18next';
import { MRT_Localization_EN } from 'material-react-table/locales/en';
import { MRT_Localization_ZH_HANS } from 'material-react-table/locales/zh-Hans';
import i18n from '@/components/core/i18n';
import { type SnackbarOrigin, SnackbarProvider } from 'notistack';

function TableUpstreamServers(): React.JSX.Element {
  const { t } = useTranslation();
  const [data, setData] = useState<UpStreamServers[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const columns = useMemo<MRTColumnDef<UpStreamServers>[]>(
    () => [
      {
        accessorKey: 'host',
        header: t('Host'),
        size: 250,
        enableSorting: false,
      },
      {
        accessorKey: 'ip',
        header: t('IP'),
        enableSorting: false,
        size: 330,
      },
      {
        accessorKey: 'port',
        header: t('Port'),
        size: 80,
        enableSorting: false,
      },
      {
        accessorKey: 'server_type',
        header: t('Type'),
        size: 80,
        enableSorting: false,
      },
      {
        accessorKey: 'status',
        header: t('Status'),
        size: 110,
      },
      {
        accessorKey: 'query_success_rate',
        header: t('Success Rate'),
        enableSorting: true,
        size: 160,
        // eslint-disable-next-line react/no-unstable-nested-components -- ignore
        Cell: ({ cell }) => {
          const rate = cell.getValue<number>();
          return <span>{rate} %</span>;
        },
      },
      {
        accessorKey: 'avg_time',
        header: t('Avg Time'),
        enableSorting: true,
        size: 140,
        // eslint-disable-next-line react/no-unstable-nested-components -- ignore
        Cell: ({ cell }) => {
          const avgTime = cell.getValue<number>();
          if (avgTime < 0) {
            return <span>N/A</span>;
          }
          return <span>{avgTime} ms</span>;
        },
      },
      {
        accessorKey: 'total_query_count',
        header: t('Total Query Count'),
        enableSorting: true,
        size: 200,
      },
      {
        accessorKey: 'total_query_success',
        header: t('Total Success Number'),
        enableSorting: true,
        size: 220,
      },
    ],
    [t],
  );

  const { checkSessionError } = useUser();
  const [errorMsg, setErrorMsg] = useState("");
  const [tableLocales, setTableLocales] = useState(MRT_Localization_EN);
  const isActionAlignRight = React.useRef(false);

  if (window.innerWidth >= 1200) {
    isActionAlignRight.current = true;
  }

  const fetchData = React.useCallback(async (): Promise<void> => {
    setIsLoading(true);
    const ret = await smartdnsServer.GetUpstreamServers();
    if (ret.error) {
      await checkSessionError?.(ret.error);
      setErrorMsg(smartdnsServer.getErrorMessage(ret.error));
      setIsError(true);
      setIsLoading(false);
      return;
    }

    if (ret.data === null || ret.data === undefined) {
      setIsError(true);
      setErrorMsg(t('No data returned.'));
      setIsLoading(false);
      return;
    }

    const translatedData = ret.data.map((item: UpStreamServers) => ({
      ...item,
      status: t(item.status),
    }));

    setData(translatedData);
    setIsError(false);
    setIsLoading(false);
  }, [checkSessionError, t]);

  React.useEffect(() => {
    fetchData().catch((_err: unknown) => {
      // NOOP
    });
  }, [fetchData]);

  React.useEffect(() => {
    if (i18n.language === null || i18n.language === undefined) {
      return;
    }

    if (i18n.language === 'zh-CN') {
      setTableLocales(MRT_Localization_ZH_HANS);
    } else {
      setTableLocales(MRT_Localization_EN);
    }
  }, []);


  const theme = useTheme();
  const root = getComputedStyle(document.documentElement);
  const cssVarRegex = /--[^)]+/;
  const cssVarMatch = cssVarRegex.exec(theme.palette?.background?.paper ?? '');
  const cssVarName = cssVarMatch ? cssVarMatch[0] : '';
  const baseBackgroundColor = root.getPropertyValue(cssVarName ?? '').trim();

  const table = useMaterialReactTable({
    columns,
    data,
    localization: tableLocales,
    enableColumnResizing: true,
    enableColumnOrdering: false,
    enableColumnActions: false,
    enableColumnFilters: false,
    enableSorting: true,
    enableClickToCopy: window.isSecureContext,
    enableGlobalFilter: true,
    enableColumnFilterModes: false,
    enableColumnPinning: true,
    enableColumnDragging: false,
    enableKeyboardShortcuts: false,
    enablePagination: false,
    enableGlobalFilterRankedResults: false,
    muiToolbarAlertBannerProps: errorMsg.length > 0
      ? {
        color: 'error',
        children: errorMsg,
      }
      : undefined,
    renderTopToolbarCustomActions: () => (
      <Tooltip arrow title={t("Refresh Data")}>
        <IconButton onClick={async () => fetchData()}>
          <RefreshIcon />
        </IconButton>
      </Tooltip>
    ),
    initialState: {
      showGlobalFilter: true,
      density: 'compact',
    },
    state: {
      showAlertBanner: isError,
      showProgressBars: isLoading,
      showSkeletons: isLoading,
    },
    mrtTheme: (_theme) => ({
      baseBackgroundColor,
    }),
  });

  return (<MaterialReactTable table={table} />);
};

export function UpstreamServersTable(): React.JSX.Element {

  const [state, setState] = React.useState<SnackbarOrigin>({
    vertical: 'top',
    horizontal: 'left',
  });

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 600px)');
    const handleMediaQueryChange = (event: MediaQueryListEvent): void => {
      if (event.matches) {
        setState({ vertical: 'top', horizontal: 'left' });
      } else {
        setState({ vertical: 'bottom', horizontal: 'left' });
      }
    };

    if (mediaQuery.matches) {
      setState({ vertical: 'top', horizontal: 'left' });
    } else {
      setState({ vertical: 'bottom', horizontal: 'left' });
    }

    mediaQuery.addEventListener('change', handleMediaQueryChange);

    return () => {
      mediaQuery.removeEventListener('change', handleMediaQueryChange);
    };
  }, [setState]);

  return (
    <SnackbarProvider
      anchorOrigin={state}
      maxSnack={5} autoHideDuration={6000}>
      <Card>
        <TableUpstreamServers />
      </Card>
    </SnackbarProvider>
  );
}
