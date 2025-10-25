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
  setUserKey?: (key: string, value: unknown) => void;
  // Convenience setters to avoid magic strings at call sites
  setXtermSocket?: (value: WebSocket | null) => void;
  setXtermBuff?: (value: unknown) => void;
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

  const setUserKey = React.useCallback((key: string, value: unknown): void => {
    setState((prev) => {
      if (!prev.user) {
        return prev;
      }

      return {
        ...prev,
        user: {
          ...prev.user,
          [key]: value,
        },
      };
    });
  }, []);

  // Typed convenience wrappers
  const setXtermSocket = React.useCallback((value: WebSocket | null): void => {
    setUserKey('xtermSocket', value);
  }, [setUserKey]);

  const setXtermBuff = React.useCallback((value: unknown): void => {
    // Keep generic to align with current User index signature
    setUserKey('xtermBuff', value);
  }, [setUserKey]);

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

  return <UserContext.Provider value={{ ...state, checkSession, checkSessionError, setUserKey, setXtermSocket, setXtermBuff }}>{children}</UserContext.Provider>;
}

export const UserConsumer = UserContext.Consumer;
