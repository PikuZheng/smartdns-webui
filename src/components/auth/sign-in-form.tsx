'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import OutlinedInput from '@mui/material/OutlinedInput';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { z as zod } from 'zod';

import { authClient } from '@/lib/auth/client';
import { useUser } from '@/hooks/use-user';
import { Logo } from '../core/logo';
import { type Settings, smartdnsServer } from '@/lib/backend/server';
import { VisibilityOutlined, VisibilityOffOutlined } from '@mui/icons-material';

const schema = zod.object({
  username: zod.string().min(1, { message: 'Username is required.' }),
  password: zod.string().min(1, { message: 'Password is required.' }),
});

type Values = zod.infer<typeof schema>;

const defaultValues = { username: '', password: '' } satisfies Values;

async function setupUserSettings(settings: Settings): Promise<void> {
  const user = await authClient.getUser();
  if (user.data && settings) {
    if (settings?.enable_terminal !== 'true') {
      user.data.sideNavVisibility.set('term', false);
    }

    authClient.saveUserSettings();
  }
}

export function SignInForm(): React.JSX.Element {
  const { t } = useTranslation();
  const router = useRouter();
  const { checkSession } = useUser();
  const [showPassword, setShowPassword] = React.useState<boolean>();
  const [isPending, setIsPending] = React.useState<boolean>(false);
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({ defaultValues, resolver: zodResolver(schema) });

  const onSubmit = React.useCallback(
    async (values: Values): Promise<void> => {
      setIsPending(true);

      const { error } = await authClient.signInWithPassword(values);

      if (error) {
        setError('root', { type: 'server', message: t(smartdnsServer.getErrorMessage(error)) });
        setIsPending(false);
        return;
      }

      await smartdnsServer.GetSettings().then(async (settings) => {
        if (settings.data) {
          await setupUserSettings(settings.data);
        }
      }).catch((_err: unknown) => {
        // NOOP
      });

      // Refresh the auth state
      await checkSession?.();

      // UserProvider, for this case, will not refresh the router
      // After refresh, GuestGuard will handle the redirect
      router.refresh();
    },
    [t, checkSession, router, setError]
  );

  return (
    <Stack spacing={4}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Logo color="light" height={80} width={80} />
        <Stack spacing={1}>
          <Typography variant="h4">{t('Sign in')}</Typography>
          <Typography color="text.secondary" variant="body2">
            {t('Sign in smartdns dashboard.')}
          </Typography>
        </Stack>
      </Stack>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Stack spacing={2}>
          <Controller
            control={control}
            name="username"
            render={({ field }) => (
              <FormControl error={Boolean(errors.username)}>
                <InputLabel>{t('Username')}</InputLabel>
                <OutlinedInput {...field} label="Username" type="username" />
                {errors.username ? <FormHelperText>{t(errors.username.message ?? '')}</FormHelperText> : null}
              </FormControl>
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <FormControl error={Boolean(errors.password)}>
                <InputLabel>{t('Password')}</InputLabel>
                <OutlinedInput
                  {...field}
                  endAdornment={
                    showPassword ? (
                      <VisibilityOutlined
                        cursor="pointer"
                        onClick={(): void => {
                          setShowPassword(false);
                        }}
                      />
                    ) : (
                      <VisibilityOffOutlined
                        cursor="pointer"
                        onClick={(): void => {
                          setShowPassword(true);
                        }}
                      />
                    )
                  }
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                />
                {errors.password ? <FormHelperText>{t(errors.password.message ?? '')}</FormHelperText> : null}
              </FormControl>
            )}
          />
          {errors.root ? <Alert severity="error">{t(errors.root.message ?? '')}</Alert> : null}
          <Button disabled={isPending} type="submit" variant="contained">
            {t('Sign in')}
          </Button>
        </Stack>
      </form>
    </Stack>
  );
}
