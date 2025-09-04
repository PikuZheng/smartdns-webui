"use client";

import { Alert, Box, Button, Card, MenuItem, Select, type SelectChangeEvent, useTheme, useMediaQuery } from '@mui/material';
import * as React from 'react';
import { LazyLog } from "@melloware/react-logviewer";
import { authClient } from '@/lib/auth/client';
import { useRouter } from 'next/navigation';
import { useUser } from '@/hooks/use-user';
import { Stack } from '@mui/system';
import { smartdnsServer } from '@/lib/backend/server';
import { useTranslation } from 'react-i18next';

export interface LogLevelProps {
  onLogLevelChange?: (level: string) => void;
}

export function LogLevel({ onLogLevelChange }: LogLevelProps): React.JSX.Element {

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
    setServerLogLevel(event.target.value).catch((_error: unknown) => {
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
  const controlLogRef = React.useRef<((event: number, data: string) => void) | null>(null);
  const [logType, setLogType] = React.useState('runlog');
  const [isPaused, setIsPaused] = React.useState(false);
  const maxLines = 2000;
  const [logText, setLogText] = React.useState('');
  const [autoFollow, setAutoFollow] = React.useState(true);
  const { checkSessionError } = useUser();
  const router = useRouter();
  const socketRef = React.useRef<WebSocket | null>(null);
  const { t } = useTranslation();
  const theme = useTheme();
  const isLargeScreen = useMediaQuery(theme.breakpoints.up('md')); 

  React.useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    let api_url = `${protocol}://${window.location.host}/api/log/stream`;
    let log_type_message = t('Run Log');
    if (logType === "auditlog") {
      api_url = `${protocol}://${window.location.host}/api/log/audit/stream`;
      log_type_message = t('Audit Log');
    }

    const socket = new WebSocket(api_url);
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
      let messageOffset = 1;
      if (dataview.byteLength < 2) {
        return;
      }
      const type = dataview.getUint8(0);
      if (logType === "runlog") {
        const _logLevel = dataview.getUint8(1);
        messageOffset = 2;
      }
      switch (type) {
        case 0: {
          const msgStr = new TextDecoder().decode(data.slice(messageOffset));
          for (const line of msgStr.split('\n')) {
            if (line.length <= 0) {
              continue;
            }

            appendLog(`${line}\n`);
          }
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
          for (const [i, element] of level.entries()) {
            dataview.setUint8(2 + i, element);
          }
          socket.send(buffer);
          break;
        }
      }
    }
    controlLogRef.current = controlLog;

    appendLog(t('Connecting to {{logtype}} stream....\n', { logtype: log_type_message }));

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
      appendLog(t('Connected to {{logtype}} stream.\n', { logtype: log_type_message }));
    };

    socket.onerror = () => {
      authClient.checkLogin().then((data) => {
        if (data.error && checkSessionError) {
          checkSessionError(data.error).catch((_error: unknown) => {
            //NOOP
          });
          router.refresh();
        }
      }).catch((_error: unknown) => {
        //NOOP
      });
      appendLog(t('unexpected socket close\n'));
    }

    socket.onclose = () => {
      appendLog(t('Disconnected from {{logtype}} stream.\n', { logtype: log_type_message }));
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    }
  }, [t, logType, checkSessionError, router]);

  const handleClearLog = (): void => {
    if (logRef.current) {
      logRef.current.clear();
    }
    setLogText('');
  };

  const handleCopyLog = async (): Promise<void> => {
    try {
      if (logText) {
        await navigator.clipboard.writeText(logText);
      }
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = logText;
      document.body.append(textArea);
      textArea.select();
      document.execCommand('copy');
      textArea.remove();
    }
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
        marginRight: '20px',
      }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Select
            value={logType}
            size="small"
            onChange={(event: SelectChangeEvent) => {
              setLogType(event.target.value);
            }}
          >
            <MenuItem value="runlog">{t('Run Log')}</MenuItem>
            <MenuItem value="auditlog">{t('Audit Log')}</MenuItem>
          </Select>
          <Button variant="contained"
            size="small"
            onClick={() => { handleButtonClick(); }}
            color={isPaused ? 'secondary' : 'primary'}
          >{isPaused ? t('Resume') : t('Pause')}</Button>
          <Button variant="contained"
            size="small"
            onClick={() => { handleClearLog(); }}
          >{t('Clear')}</Button>
          <Button variant="contained"
            size="small"
            onClick={() => { handleCopyLog(); }}
            disabled={!logText.trim()}
          >{t('Copy')}</Button>
          {logType === "runlog" && (<LogLevel onLogLevelChange={
            (level: string) => {
              if (controlLogRef.current) {
                controlLogRef.current(3, level);
              }
            }
          } />
          )}
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
        <LazyLog
          ref={logRef}
          enableSearch={isLargeScreen}
          text={logText}
          follow={autoFollow}
          enableLineNumbers={isLargeScreen}
          onScroll={(scrollInfo) => {
            const { scrollTop, scrollHeight, clientHeight } = scrollInfo;
            const isAtBottom = scrollHeight - scrollTop - clientHeight < 10;

            if (isAtBottom) {
              setAutoFollow(true);
            } else {
              setAutoFollow(false);
            }
          }}
          style={{
            height: '100%',
            width: '100%',
            fontFamily: 'monospace',
            fontSize: '13px'
          }}
        />
      </Box>
    </Card>
  );
}