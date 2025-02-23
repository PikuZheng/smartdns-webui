
"use client"

import * as React from 'react';
import { useMemo, useState } from 'react';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnFilterFnsState as MRTColumnFilterFnsState,
  type MRT_ColumnDef as MRTColumnDef,
  type MRT_ColumnFiltersState as MRTColumnFiltersState,
  type MRT_PaginationState as MRTPaginationState,
  type MRT_SortingState as MRTSortingState,
  MRT_ActionMenuItem as MRTActionMenuItem,
  type MRT_Row as MRTRow,
  type MRT_Cell as MRTCell,
  type MRT_TableInstance as MRTTableInstance,
} from 'material-react-table';
import { Card, IconButton, Tooltip, useTheme } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  QueryClient,
  QueryClientProvider,
  keepPreviousData,
  useQuery,
} from '@tanstack/react-query';

import { type ClientList, type QueryClientsParams, smartdnsServer } from '@/lib/backend/server';
import { useUser } from '@/hooks/use-user';
import { useTranslation } from 'react-i18next';
import { MRT_Localization_EN } from 'material-react-table/locales/en';
import { MRT_Localization_ZH_HANS } from 'material-react-table/locales/zh-Hans';
import i18n from '@/components/core/i18n';
import { Delete, Domain } from '@mui/icons-material';
import { type SnackbarOrigin, SnackbarProvider, useSnackbar } from 'notistack';


interface UserApiResponse {
  data: ClientList[];
  meta: {
    totalRowCount: number;
  };
};

function TableClients(): React.JSX.Element {
  const { t } = useTranslation();

  const columns = useMemo<MRTColumnDef<ClientList>[]>(
    () => [
      {
        accessorKey: 'id',
        header: t('ID'),
        size: 110,
        enableColumnActions: false,
        columnFilterModeOptions: ['equals'],
      },
      {
        accessorKey: 'client_ip',
        header: t('Client IP'),
        size: 360,
        enableColumnActions: false,
        columnFilterModeOptions: ['contains', 'equals'],
      },
      {
        accessorKey: 'mac',
        header: t('Mac Address'),
        size: 240,
        enableColumnActions: false,
        columnFilterModeOptions: ['equals'],
      },
      {
        accessorKey: 'hostname',
        header: t('Host Name'),
        size: 250,
        enableColumnActions: false,
        columnFilterModeOptions: ['equals'],
      },
      {
        accessorKey: 'last_query_timestamp',
        header: t('Last Query Time'),
        // eslint-disable-next-line react/no-unstable-nested-components -- ignore
        Cell: ({ cell }) => {
          const timestamp = cell.getValue<string>();
          const localTime = new Date(timestamp).toLocaleString();
          return <span>{localTime}</span>;
        },
        columnFilterModeOptions: ['equals'],
        enableColumnActions: false,
        size: 120,
      },
    ],
    [t],
  );

  const { checkSessionError } = useUser();
  const [columnFilters, setColumnFilters] = useState<MRTColumnFiltersState>(
    [],
  );
  const [columnFilterFns, setColumnFilterFns] =
    useState<MRTColumnFilterFnsState>(
      () => Object.fromEntries(
        columns.map(({ accessorKey }) => {
          return [accessorKey, 'equals'];
        })
      ) as MRTColumnFilterFnsState
    );
  const [shouldFetchData, setShouldFetchData] = useState(false);
  const [globalFilter, setGlobalFilter] = useState('');
  const [errorMsg, setErrorMsg] = useState("Error loading data");
  const [sorting, setSorting] = useState<MRTSortingState>([]);
  const [pagination, setPagination] = useState<MRTPaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [tableLocales, setTableLocales] = useState(MRT_Localization_EN);
  const { enqueueSnackbar } = useSnackbar();
  const isActionAlignRight = React.useRef(false);

  if (window.innerWidth >= 1200) {
    isActionAlignRight.current = true;
  }

  React.useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const filters: MRTColumnFiltersState = [];

    searchParams.forEach((value, key) => {
      if (columns.findIndex((column) => column.accessorKey === key) === -1) {
        return;
      }

      filters.push({ id: key, value });
    });

    setColumnFilters(filters);
    if (!shouldFetchData) {
      setShouldFetchData(true);
    }
  }, [shouldFetchData, columns]);

  const {
    data: { data = [], meta } = {},
    isError,
    isRefetching,
    isLoading,
    refetch,
  } = useQuery<UserApiResponse>({
    enabled: shouldFetchData,
    queryKey: [
      'table-data',
      columnFilterFns,
      columnFilters,
      globalFilter,
      pagination.pageIndex,
      pagination.pageSize,
      sorting,
    ],
    queryFn: async () => {
      const currentPageNumber = pagination.pageIndex + 1;
      const queryParam: QueryClientsParams = {
        'page_num': currentPageNumber,
        'page_size': pagination.pageSize,
      };

      columnFilters.forEach(filter => {
        if (filter.id === null || filter.id === undefined || filter.value === null || filter.value === undefined) {
          return;
        }

        const filterId = filter.id as keyof QueryClientsParams;
        queryParam[filterId] = filter.value as string;
      });

      const data = await smartdnsServer.GetClients(queryParam);
      if (data.error) {
        await checkSessionError?.(data.error);
        setErrorMsg(smartdnsServer.getErrorMessage(data.error));
        throw new Error(errorMsg);
      }

      if (data.data === null || data.data === undefined) {
        setErrorMsg('Error loading data');
        throw new Error(errorMsg);
      }

      const resp: UserApiResponse = {
        data: data.data.client_list,
        meta: {
          totalRowCount: data.data.total_count,
        },
      };

      return resp;
    },
    placeholderData: keepPreviousData,
  });

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

  const handleRowClientMacVendor = React.useCallback(async (_row: MRTRow<ClientList>) => {
    const msg = t('Not implemented yet.');

    enqueueSnackbar(msg, { style: { whiteSpace: 'pre-line' } });
  }, [t, enqueueSnackbar]);

  const handleRowDelete = React.useCallback(async (row: MRTRow<ClientList>) => {
    const id = row.original.id;
    const clientIP = row.original.client_ip;
    const ret = await smartdnsServer.DeleteClientById(id);
    if (ret.error) {
      enqueueSnackbar(`${t('Error')}: ${t(smartdnsServer.getErrorMessage(ret.error))}, id: ${id}`, { variant: 'error' });
      return;
    }

    enqueueSnackbar(t('Delete client {{id}} {{client_ip}} successfully.', { id, clientIP }), { variant: 'success' });
  }, [t, enqueueSnackbar]);

  const renderRowMenuItem = (closeMenu: () => void, row: MRTRow<ClientList>, table: MRTTableInstance<ClientList>): React.ReactNode[] => (
    [
      <MRTActionMenuItem
        icon={<Domain />}
        key="mac_vendor"
        label="Mac Vendor"
        onClick={async (e) => { e.preventDefault(); closeMenu(); await handleRowClientMacVendor(row); }}
        table={table}
      />,
      <MRTActionMenuItem
        icon={<Delete />}
        key="delete"
        label="Delete"
        onClick={async (e) => { e.preventDefault(); closeMenu(); await handleRowDelete(row); }}
        table={table}
      />,
    ]
  );

  const renderCellMenuItem = (closeMenu: () => void, _cell: MRTCell<ClientList>, row: MRTRow<ClientList>, table: MRTTableInstance<ClientList>): React.ReactNode[] => (
    [
      renderRowMenuItem(closeMenu, row, table),
    ]
  );

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
    enableSorting: false,
    enableColumnOrdering: true,
    enableRowActions: true,
    enableCellActions: true,
    enableClickToCopy: window.isSecureContext,
    enableGlobalFilter: false,
    columnFilterDisplayMode: 'popover',
    enableColumnFilterModes: true,
    enableColumnPinning: true,
    enableColumnDragging: false,
    enableKeyboardShortcuts: false,
    manualFiltering: true,
    manualPagination: true,
    manualSorting: true,
    muiFilterDateTimePickerProps: {
      ampm: false,
    },
    muiPaginationProps: {
      disabled: isRefetching,
    },
    muiToolbarAlertBannerProps: isError
      ? {
        color: 'error',
        children: errorMsg,
      }
      : undefined,
    onColumnFilterFnsChange: setColumnFilterFns,
    onColumnFiltersChange: (filters) => {
      setColumnFilters(filters);
    },
    onGlobalFilterChange: (filters: React.SetStateAction<string>) => {
      setGlobalFilter(filters);
    },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    renderTopToolbarCustomActions: () => (
      <Tooltip arrow title={t("Refresh Data")}>
        <span>
          <IconButton
            disabled={isRefetching}
            onClick={() => {
              refetch().catch((_e: unknown) => {
                // NOOP
              });
            }
            }>
            <RefreshIcon />
          </IconButton>
        </span>
      </Tooltip>
    ),
    renderRowActionMenuItems: ({ closeMenu, row, table }) => {
      return [
        renderRowMenuItem(closeMenu, row, table),
      ]
    },
    renderCellActionMenuItems: ({ closeMenu, cell, row, table, internalMenuItems }) => {
      return [
        renderCellMenuItem(closeMenu, cell, row, table),
        ...internalMenuItems,
      ];
    },
    muiLinearProgressProps: {
      color: 'primary',
      variant: 'determinate',
      value: isRefetching ? 50 : 100,
    },
    rowCount: meta?.totalRowCount ?? 0,
    initialState: {
      columnPinning: {
        right: isActionAlignRight?.current ? ['mrt-row-actions'] : [],
      },
    },
    state: {
      columnFilters,
      columnFilterFns,
      globalFilter,
      isLoading,
      pagination,
      showAlertBanner: isError,
      showProgressBars: isRefetching,
      showSkeletons: isLoading,
      sorting,
    },
    mrtTheme: (_theme) => ({
      baseBackgroundColor,
    }),
  });

  return (<MaterialReactTable table={table} />);
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      gcTime: 0,
      retry: false,
    },
  },
});


export function ClientsTable(): React.JSX.Element {

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
    <QueryClientProvider client={queryClient}>
      <SnackbarProvider
        anchorOrigin={state}
        maxSnack={5} autoHideDuration={6000}>
        <Card>
          <TableClients />
        </Card>
      </SnackbarProvider>
    </QueryClientProvider>
  );
}
