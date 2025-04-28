"use client";

import { Alert, Box, Button, Card, MenuItem, Select, type SelectChangeEvent } from '@mui/material';
import * as React from 'react';
import { LazyLog, ScrollFollow } from "@melloware/react-logviewer";
import { authClient } from '@/lib/auth/client';
import { useRouter } from 'next/navigation';
import { useUser } from '@/hooks/use-user';
import { Stack } from '@mui/system';
import { smartdnsServer } from '@/lib/backend/server';
import { useTranslation } from 'react-i18next';

export interface LogLevelProps {
  onLogLevelChange?: (level: string) => void;
}

export function LogLevel( {onLogLevelChange} : LogLevelProps): React.JSX.Element {

  const { t } = useTranslation();

  const [logLevel, setLogLevel] = React.useState('');
  const { checkSessionError } = useUser();
  const [errorMsg, setErrorMsg] = React.useState('');

  const setServerLogLevel = React.useCallback(
    async (level: string): Promise<void> => {
      onLogLevelChange?.(level);
      setLogLevel(level);
    },
    [onLogLevelChange]
  );

  const getServerLogLevel = React.useCallback(
    async (): Promise<void> => {
      const data = await smartdnsServer.GetLogLevel();
      if (data.error) {
        await checkSessionError?.(data.error);
        setErrorMsg(smartdnsServer.getErrorMessage(data.error));
        return;
      }

      if (data.data === null || data.data === undefined) {
        return;
      }

      setLogLevel(data.data.log_level);
    },
    [checkSessionError]
  );

  const handleSelect = (event: SelectChangeEvent): void => {
    setServerLogLevel(event.target.value).catch((_err: unknown) => {
      //NOOP
    });
  }

  React.useEffect(() => {
    void getServerLogLevel();
  }, [getServerLogLevel]);

  if (errorMsg.length > 0) {
    return (
      <Alert severity="error">
        {errorMsg}
      </Alert>
    );
  }

  return (
    <Select onChange={handleSelect} size="small" value={logLevel}>
      <MenuItem value="debug">{t('Debug')}</MenuItem>
      <MenuItem value="info">{t('Info')}</MenuItem>
      <MenuItem value="notice">{t('Notice')}</MenuItem>
      <MenuItem value="warn">{t('Warn')}</MenuItem>
      <MenuItem value="error">{t('Error')}</MenuItem>
      <MenuItem value="fatal">{t('Fatal')}</MenuItem>
    </Select>
  );
}


export function Log(): React.JSX.Element {
  const logRef = React.useRef<LazyLog>(null);
  const textRef = React.useRef<HTMLDivElement>(null);
  const logEndRef = React.useRef<HTMLDivElement>(null);
  const controlLogRef = React.useRef<((event: number, data: string) => void) | null>(null);
  const [isPaused, setIsPaused] = React.useState(false);
  const [maxLines, setMaxLines] = React.useState(1000);
  const [logText, setLogText] = React.useState('');
  const { checkSessionError } = useUser();
  const router = useRouter();
  const socketRef = React.useRef<WebSocket | null>(null);
  const { t } = useTranslation();

  React.useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${protocol}://${window.location.host}/api/log/stream`);
    socketRef.current = socket;

    const appendLog = (log: string): void => {
      setLogText((prev) => {
        const lines = prev.split('\n');
        if (lines.length > maxLines) {
          lines.splice(0, lines.length - maxLines);
        }
        return lines.join('\n') + log;
      });
    }

    const processMessage = (data: ArrayBuffer): void => {
      const dataview = new DataView(data);
      if (dataview.byteLength < 2) {
        return;
      }
      const type = dataview.getUint8(0);
      const _logLevel = dataview.getUint8(1);
      switch (type) {
        case 0: {
          const msgStr = new TextDecoder().decode(data.slice(2));
          msgStr.split('\n').forEach((line: string) => {
            if (line.length <= 0) {
              return;
            }

            appendLog(`${line}\n`);
          });
          break;
        }
      }
    }

    const controlLog = (event: number, data: string): void => {
      switch (event) {
        case 1: {
          /* pause */
          socket.send(new Uint8Array([1, 1]).buffer);
          break;
        }
        case 2: {
          /* resume */
          socket.send(new Uint8Array([1, 2]).buffer);
          break;
        }
        case 3: {
          /* log level */
          const level = new TextEncoder().encode(data);
          const buffer = new ArrayBuffer(2 + level.length);
          const dataview = new DataView(buffer);
          dataview.setUint8(0, 1);
          dataview.setUint8(1, 3);
          for (let i = 0; i < level.length; i++) {
            dataview.setUint8(2 + i, level[i]);
          }
          socket.send(buffer);
          break;
        }
      }
    }
    controlLogRef.current = controlLog;

    appendLog(t('Connecting to log stream....\n'));

    socket.onmessage = (event: MessageEvent) => {
      let data: ArrayBuffer;
      if (event.data instanceof ArrayBuffer) {
        data = event.data;
        processMessage(data);
      } else if (event.data instanceof Blob) {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          if (result instanceof ArrayBuffer) {
            processMessage(result);
          } else {
            appendLog("Invalid data type received.\r\n");
            if (socket) {
              socket.close();
            }
          }
        };
        reader.readAsArrayBuffer(event.data);
      } else {
        appendLog("Invalid data type received.\r\n");
        socket.close();
      }
    };

    socket.onopen = () => {
      appendLog(t('Connected to log stream.\n'));
      setMaxLines(1000);
    };

    socket.onerror = () => {
      authClient.checkLogin().then((data) => {
        if (data.error && checkSessionError) {
          checkSessionError(data.error).catch((_err: unknown) => {
            //NOOP
          });
          router.refresh();
        }
      }).catch((_err: unknown) => {
        //NOOP
      });
      appendLog(t('unexpected socket close\n'));
    }

    socket.onclose = () => {
      appendLog(t('Disconnected from log stream.\n'));
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    }
  }, [t, maxLines, checkSessionError, router]);

  React.useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.ctrlKey && event.key === 'a') {
        event.preventDefault();
        if (textRef.current) {
          const range = document.createRange();
          range.selectNodeContents(textRef.current);
          const selection = window.getSelection();
          if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleClearLog = () : void => {
    if (logRef.current) {
      logRef.current.clear();
    }
    setLogText('');
  };

  const handleButtonClick = (): void => {
    if (controlLogRef.current) {
      setIsPaused(!isPaused);
      if (isPaused) {
        controlLogRef.current(2, '');
      } else {
        controlLogRef.current(1, '');
      }
    }
  };

  return (
    <Card>
      <Box sx={{
        marginTop: '10px',
        marginLeft: '20px',
      }}>
        <Stack direction="row" spacing={2}>
          <Button variant="contained"
            onClick={() => { handleButtonClick(); }}
            color={isPaused ? 'secondary' : 'primary'}
          >{isPaused ? t('Resume') : t('Pause')}</Button>
          <Button variant="contained"
            onClick={() => { handleClearLog(); }}
          >{t('Clear')}</Button>
          <LogLevel onLogLevelChange={ 
            (level: string) => {
              if (controlLogRef.current) {
                controlLogRef.current(3, level);
              }
            }
          }/>
        </Stack>
      </Box>
      <Box ref={textRef}
        sx={{
          width: '100%',
          height: {
            lg: 'calc(100vh - var(--MainNav-height) - var(--Footer-height) - 110px)',
            xs: 'calc(100vh - var(--MainNav-height) - var(--Footer-height-mobile) - 110px)',
          },
          padding: '1rem',
        }}
      >
        <ScrollFollow
          startFollowing
          render={({ follow, onScroll }) => (
            <LazyLog
              ref={logRef}
              enableSearch
              enableHotKeys
              text={logText} follow={follow} onScroll={onScroll} />
          )}
        />
      </Box>
    </Card>
  );
}