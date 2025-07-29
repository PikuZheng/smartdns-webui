'use client';

import * as React from 'react';

import type { User } from '@/types/user';
import { authClient } from '@/lib/auth/client';
import { logger } from '@/lib/default-logger';
import { AuthorError } from '@/lib/backend/server';
import type { ServerError } from '@/lib/backend/server';

export interface UserContextValue {
  user: User | null;
  error: string | null;
  isLoading: boolean;
  checkSession?: () => Promise<void>;
  checkSessionError?: (error: ServerError) => Promise<void>;
}

export const UserContext = React.createContext<UserContextValue | undefined>(undefined);

export interface UserProviderProps {
  children: React.ReactNode;
}

export function UserProvider({ children }: UserProviderProps): React.JSX.Element {
  const [state, setState] = React.useState<{ user: User | null; error: string | null; isLoading: boolean }>({
    user: null,
    error: null,
    isLoading: true,
  });

  const checkSession = React.useCallback(async (): Promise<void> => {
    try {
      const { data, error } = await authClient.getUser();

      if (error) {
        logger.error(error);
        setState((prev) => ({ ...prev, user: null, error: 'Something went wrong', isLoading: false }));
        return;
      }

      setState((prev) => ({ ...prev, user: data ?? null, error: null, isLoading: false }));
    } catch (error) {
      logger.error(error);
      setState((prev) => ({ ...prev, user: null, error: 'Something went wrong', isLoading: false }));
    }
  }, []);

  React.useEffect(() => {
    checkSession().catch((error: unknown) => {
      logger.error(error);
      // noop
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Expected
  }, []);

  const checkSessionError = React.useCallback(async (e : ServerError): Promise<void> => {
    if (e instanceof AuthorError) {
      await checkSession?.();
      return;
    }

    if (typeof e === 'string') {
      return;
    }
  
    if (e instanceof Error) {
      setState((prev) => ({ ...prev, user: null, error: e.message, isLoading: false }));
    }
    
  }, [checkSession]);

  return <UserContext.Provider value={{ ...state, checkSession, checkSessionError }}>{children}</UserContext.Provider>;
}

export const UserConsumer = UserContext.Consumer;
