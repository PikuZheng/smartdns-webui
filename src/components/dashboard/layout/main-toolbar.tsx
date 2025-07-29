import * as React from 'react';
import { useRouter } from 'next/navigation';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';

import { authClient } from '@/lib/auth/client';
import { logger } from '@/lib/default-logger';
import { useUser } from '@/hooks/use-user';
import { DarkModeSwitch } from '@/components/common/darkmode-switch';
import { LogoutOutlined } from '@mui/icons-material';


export function MainToolBar(): React.JSX.Element {
  const { checkSession } = useUser();
  const router = useRouter();

  const handleSignOut = React.useCallback(async (): Promise<void> => {
    try {
      const { error } = await authClient.signOut();

      if (error) {
        logger.error('Sign out error', error);
        return;
      }

      await checkSession?.();

      router.refresh();
    } catch (error) {
      logger.error('Sign out error', error);
    }
  }, [checkSession, router]);

  return (
    <Stack direction='row' spacing={2} >
      <DarkModeSwitch />
      <IconButton
        onClick={async (): Promise<void> => {
          await handleSignOut();
        }}
      >
        <LogoutOutlined />
      </IconButton>
    </Stack>
  );
}
