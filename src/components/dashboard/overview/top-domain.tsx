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
import type { ServerError, TopDomains } from '@/lib/backend/server';
import { useUser } from '@/hooks/use-user';
import { CardLoading } from './card-loading';
import { paths } from '@/paths';
import { Link } from '@mui/material';
import { useTranslation } from 'react-i18next';

export interface TopDomainsProps {
  domains: TopDomains[];
  sx?: SxProps;
}

function TopDomainsTable({ domains }: TopDomainsProps): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table sx={{ minWidth: 100 }} size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('Domain')}</TableCell>
            <TableCell>{t('Count')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {domains.map((domain) => {
            const encodedDomain = encodeURIComponent(domain.domain);
            let url = `${paths.dashboard.queryLog}?domain=${encodedDomain}&total_count=${domain.query_count}`;
            
            if (domain.timestamp_start !== undefined && domain.timestamp_start !== null) {
              url += `&timestamp_after=${domain.timestamp_start}`;
            }

            if (domain.timestamp_end !== undefined && domain.timestamp_end !== null) {
              url += `&timestamp_before=${domain.timestamp_end}`;
            }

            return (
              <TableRow key={domain.domain}>
                <TableCell>
                  <Link href={url} >{domain.domain}</Link>
                </TableCell>
                <TableCell>{domain.query_count}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}

export function TopDomainsCard(sx: SxProps): React.JSX.Element {
  const { checkSessionError } = useUser();
  const [domains, setDomains] = React.useState<TopDomains[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const { t } = useTranslation();

  React.useEffect(() => {
    const fetchData = async (): Promise<void> => {
      const data = await smartdnsServer.GetTopDomains();
      if (data.error) {
        await checkSessionError?.(data.error);
        setErrorMsg(smartdnsServer.getErrorMessage(data.error));
        return;
      }

      if (data.data === null) {
        return;
      }

      setDomains(data.data || []);
      setLoading(false);
    };

    fetchData().catch(async (err: unknown) => {
      await checkSessionError?.(err as ServerError);
    });
  }, [checkSessionError]);

  return (
    <Box>
      <CardLoading title={t("Top Domains")} isLoading={loading} errorMsg={errorMsg}>
        <TopDomainsTable domains={domains} sx={sx} />
      </CardLoading>
    </Box>
  )
}
