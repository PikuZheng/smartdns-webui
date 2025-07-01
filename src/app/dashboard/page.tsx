"use client";

import * as React from 'react';
import Grid from '@mui/material/Grid2';

import { config } from '@/config';
import { TopClientsCard } from '@/components/dashboard/overview/top-clients';
import { TopDomainsCard } from '@/components/dashboard/overview/top-domain';
import { HourlyQueryCountCard } from '@/components/dashboard/overview/hourly-query-count';
import { useTranslation } from 'react-i18next';
import { DailyQueryCountCard } from '@/components/dashboard/overview/daily-query-count';
import { MetricsCards } from '@/components/dashboard/overview/metrics-cards';
import { type SnackbarOrigin, SnackbarProvider } from 'notistack';

export default function Page(): React.JSX.Element {

  const { t } = useTranslation();

  React.useEffect(() => {
    document.title = `${t('Overview')} | ${t('Dashboard')} | ${config.site.name}`;
  }, [t]);


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
      <Grid container spacing={3}>
        <Grid size={{ lg: 12, xs: 12 }}>
          <MetricsCards />
        </Grid>
        <Grid size={{ lg: 12, xs: 12 }}>
          <HourlyQueryCountCard sx={{ height: '100%', width: '100%' }} />
        </Grid>
        <Grid size={{ lg: 12, xs: 12 }}>
          <DailyQueryCountCard sx={{ height: '100%', width: '100%' }} />
        </Grid>
        {/* <Grid size={{lg:6, md:12, xs:12}}>
        <OverViewCard sx={{ height: '100%', width: '100%' }} />
      </Grid> */}
        <Grid size={{ lg: 6, md: 12, xs: 12 }}>
          <TopClientsCard sx={{ height: '100%', width: '100%' }} />
        </Grid>
        <Grid size={{ lg: 6, md: 12, xs: 12 }}>
          <TopDomainsCard sx={{ height: '100%', width: '100%' }} />
        </Grid>
      </Grid>
    </SnackbarProvider>
  );
}
