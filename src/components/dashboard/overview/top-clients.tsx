"use client";

import * as React from 'react';
import Box from '@mui/material/Box';
import type { SxProps } from '@mui/material/styles';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { smartdnsServer } from '@/lib/backend/server';
import type { TopClients } from '@/lib/backend/server';
import { useUser } from '@/hooks/use-user';
import { CardLoading } from './card-loading';
import { paths } from '@/paths';
import { Link } from '@mui/material';
import { useTranslation } from 'react-i18next';

export interface TopClientsProps {
  clients: TopClients[];
  sx?: SxProps;
}

function TopClientsTable({ clients}: TopClientsProps): React.JSX.Element {

  const { t } = useTranslation();

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table sx={{ minWidth: 100 }} size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('Client')}</TableCell>
            <TableCell>{t('Count')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {clients.map((client) => {
            const encodedClient = encodeURIComponent(client.client_ip);
            let url = `${paths.dashboard.queryLog}?client=${encodedClient}&total_count=${client.query_count}`;
            
            if (client.timestamp_start !== undefined && client.timestamp_start !== null) {
              url += `&timestamp_after=${client.timestamp_start}`;
            }

            if (client.timestamp_end !== undefined && client.timestamp_end !== null) {
              url += `&timestamp_before=${client.timestamp_end}`;
            }
            return (
              <TableRow key={client.client_ip}>
                <TableCell><Link href={url} >{client.client_ip}</Link></TableCell>
                <TableCell>{client.query_count}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}

export function TopClientsCard(sx: SxProps): React.JSX.Element {
  const { checkSessionError } = useUser();
  const [clients, setClients] = React.useState<TopClients[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const { t } = useTranslation();

  React.useEffect(() => {
    const fetchData = async (): Promise<void> => {
      const data = await smartdnsServer.GetTopClients();
      if (data.error) {
        await checkSessionError?.(data.error);
        setErrorMsg(smartdnsServer.getErrorMessage(data.error));
        return;
      }

      if (data.data === null || data.data === undefined) {
        return;
      }

      setClients(data.data);
      setLoading(false);
    };

    void fetchData();
  }, [checkSessionError]);

  return (
    <CardLoading title={t("Top Clients")} isLoading={loading} errorMsg={errorMsg}>
      <TopClientsTable clients={clients} sx={sx} />
    </CardLoading>
  );
}
