import { smartdnsServer } from '@/lib/backend/server';
import { Typography, Link, Box, Stack } from '@mui/material';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

function CopyRight(): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <Typography variant="body2" color="textSecondary" align="center">
      {t('Copyright')} © {new Date().getFullYear()} {t('Nick Peng. All rights reserved.')}
    </Typography>
  );
}

function Version(): React.JSX.Element {
  const [serverVersion, setServerVersion] = React.useState<string | null>(null);
  const [uiVersion, setUiVersion] = React.useState<string | null>(null);
  const { t } = useTranslation();

  React.useEffect(() => {
    smartdnsServer.GetVersion().then((version) => {
      if (version.error) {
        return;
      }

      const smartdnsVersion = version.data?.smartdns ?? null;
      const smartdnsUIVersion = version.data?.smartdns_ui ?? null;
      setServerVersion(smartdnsVersion);
      setUiVersion(smartdnsUIVersion);

    }).catch((_error: unknown) => {
      // NOOP
    }
    );
  }, [uiVersion, serverVersion]);


  return (
    <Typography
      variant="body2"
      color="textSecondary"
      align="center"
      sx={{
        fontSize: '0.70rem', 
        '@media (min-width: 600px)': {
          textAlign: 'right',
        },
      }}
    >
      {t('UI Version')}: {uiVersion}<br />
      {t('Server Version')}: {serverVersion}
    </Typography>
  );
}

function Navs(): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <Stack direction="row" spacing={4}>
      <Link href="https://pymumu.github.io/smartdns" color="inherit">
        {t('Official Site')}
      </Link>
      <Link href="https://github.com/pymumu/smartdns" color="inherit">
        {t('Source')}
      </Link>
      <Link href="https://github.com/pymumu/smartdns/issues" color="inherit">
        {t('Issues')}
      </Link>
    </Stack>
  );
}

export default function Footer(): React.JSX.Element {
  return (
    <Box
      component="header"
      sx={{
        borderBottom: '1px solid var(--mui-palette-divider)',
        position: 'sticky',
        top: 0,
        zIndex: 'var(--mui-zIndex-appBar)',
        mt: 'auto',
      }}
    >
      <Stack
        direction="column"
        spacing={2}
        sx={{
          alignItems: 'center', justifyContent: 'space-between', minHeight: '20px', px: 4, '@media (min-width: 600px)': {
            flexDirection: 'row', pb: 0,
          },
        }}
      >
        <Stack>
          <CopyRight />
        </Stack>
        <Stack>
          <Navs />
        </Stack>
      </Stack>
      <Stack sx={{ px: 4 }}>
        <Version />
      </Stack>
    </Box>
  );
}