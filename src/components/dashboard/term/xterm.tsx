"use client";

/* eslint-disable import/named -- The named imports from '@xterm/*' are correct but ESLint is unable to resolve them */

import * as React from 'react';

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SerializeAddon } from "@xterm/addon-serialize";
import { Alert, Box, SpeedDialAction, SpeedDialIcon } from '@mui/material';
import SpeedDial from '@mui/material/SpeedDial';

import "@xterm/xterm/css/xterm.css";
import KeyboardOptionKeyIcon from '@mui/icons-material/KeyboardOptionKey';
import TransitEnterexitIcon from '@mui/icons-material/TransitEnterexit';

// Move getCtrlChar to outer scope for unicorn/consistent-function-scoping
const getCtrlChar = (char: string): string => {
  const code = char.toUpperCase().codePointAt(0) ?? 0;
  return String.fromCodePoint(code - 64);
};

import {
  KeyboardControlKey as CtrlIcon,
  SelectAll,
  KeyboardTab as TabIcon,
} from '@mui/icons-material';
import { useUser } from '@/hooks/use-user';
import { authClient } from '@/lib/auth/client';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

type RefreshWinSizeType = () => void;

export function TerminalTable(): React.JSX.Element {

  const router = useRouter();
  const terminalRef = React.useRef<HTMLDivElement>(null);
  const termRef = React.useRef<Terminal | null>(null);
  const sockRef = React.useRef<WebSocket | null>(null);
  const refreshWinSizeRef = React.useRef<RefreshWinSizeType | null>(null);
  const speedDialRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const ctrl = React.useRef(false);
  const alt = React.useRef(false);
  const [isCtrlPressed, setIsCtrlPressed] = React.useState(false);
  const [isAltPressed, setIsAltPressed] = React.useState(false);
  const { checkSessionError, setXtermSocket, setXtermBuff } = useUser();
  const hasInitialized = React.useRef(false);
  const { t } = useTranslation();

  const { user } = useUser();
  const isDisplayError = React.useMemo(() => user === null, [user]);

  React.useEffect(() => {
    const handleResize = (): void => {
      if (window.visualViewport) {
        const keyboardHeight = window.innerHeight - window.visualViewport.height;
        if (keyboardHeight > 20) {
          if (terminalRef.current) {
            terminalRef.current.style.height = `calc(${keyboardHeight}px + var(--Footer-height-mobile) + 24px)`;
          }

          if (speedDialRef.current) {
            speedDialRef.current.style.bottom = `calc(${keyboardHeight}px - var(--Footer-height-mobile) + 8px)`;
          }
        } else {
          if (terminalRef.current) {
            terminalRef.current.style.height = "100%";
          }
          if (speedDialRef.current) {
            speedDialRef.current.style.bottom = '16px';
          }
        }

        if (refreshWinSizeRef.current) {
          refreshWinSizeRef.current();
        }
      }
    };

    window.visualViewport?.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
    };
  }, []);

  type ActionId = 'SELECT_ALL' | 'CTRL' | 'ALT' | 'TAB' | 'ESC';

  const actions = React.useMemo(() => [
    { icon: <SelectAll />, name: t('SELECT ALL'), id: 'SELECT_ALL' as const },
    { icon: isCtrlPressed ? <CtrlIcon style={{ color: 'red' }} /> : <CtrlIcon />, name: 'CTRL', id: 'CTRL' as const },
    { icon: isAltPressed ? <KeyboardOptionKeyIcon style={{ color: 'red' }} /> : <KeyboardOptionKeyIcon />, name: 'ALT', id: 'ALT' as const },
    { icon: <TabIcon />, name: 'TAB', id: 'TAB' as const },
    { icon: <TransitEnterexitIcon />, name: 'ESC', id: 'ESC' as const },
  ], [isAltPressed, isCtrlPressed, t]);

  const pauseTerm = (): void => {
    const buffer = new ArrayBuffer(1);
    const dataview = new DataView(buffer);
    if (!sockRef.current) {
      return;
    }

    if (sockRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    dataview.setUint8(0, 3);
    sockRef.current.send(buffer);
  }

  const resumeTerm = (): void => {
    const buffer = new ArrayBuffer(1);
    const dataview = new DataView(buffer);
    if (!sockRef.current) {
      return;
    }

    if (sockRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    dataview.setUint8(0, 4);
    sockRef.current.send(buffer);
  }

  const setWinSize = (cols: number, rows: number): void => {
    const buffer = new ArrayBuffer(5);
    const dataview = new DataView(buffer);
    if (!sockRef.current) {
      return;
    }

    if (sockRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    dataview.setUint8(0, 2);
    dataview.setUint16(1, cols);
    dataview.setUint16(3, rows);
    sockRef.current.send(buffer);
  }

  React.useEffect(() => {
    if (hasInitialized.current) {
      return;
    }

    hasInitialized.current = true;

    const term = new Terminal(
      {
        smoothScrollDuration: 200,
        scrollSensitivity: 5,
        scrollback: 3500,
      }
    );
    termRef.current = term;

    const addonfit = new FitAddon();
    const addonserialize = new SerializeAddon();
    term.loadAddon(addonfit);
    term.loadAddon(new WebLinksAddon());
    term.loadAddon(addonserialize);

    if (terminalRef) {
      term.open(terminalRef.current!);
      addonfit.fit();
    }

    term.onData((data) => {
      if (!sockRef.current) {
        return;
      }

      if (sockRef.current.readyState !== WebSocket.OPEN) {
        return;
      }

      let sendData = data;

      if (ctrl.current) {
        sendData = getCtrlChar(sendData);
        ctrl.current = false;
        setIsCtrlPressed(false);
      }

      if (alt.current) {
        sockRef.current.send('\u001B');
        alt.current = false;
        setIsAltPressed(false);
      }

      sockRef.current.send(sendData);
    });

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    let refreshWin = false;

    if (user?.xtermSocket) {
      const socket = user?.xtermSocket as WebSocket;
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        sockRef.current = user.xtermSocket as WebSocket;
        refreshWin = true;
        resumeTerm();
      } else {
  socket.close();
  setXtermSocket?.(null);
        term.write("Resume session failed...\r\n");
      }
    }

    if (!sockRef.current) {
      term.write(t('Connecting to xterm server...\r\n'));
      const socket = new WebSocket(`${protocol}://${window.location.host}/api/tool/term`);
      sockRef.current = socket;
  setXtermSocket?.(sockRef.current);
    }

    sockRef.current.onmessage = (event: MessageEvent) => {
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
            term.write("Invalid data type received.\r\n");
            if (sockRef.current) {
              sockRef.current.close();
              sockRef.current = null;
            }
          }
        };
        reader.readAsArrayBuffer(event.data);
      } else {
        term.write("Invalid data type received.\r\n");
  sockRef.current?.close();
  sockRef.current = null;
      }
    };

    sockRef.current.onerror = () => {
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
    }

    sockRef.current.onopen = () => {
      term.clear();
      term.reset();
      term.focus();
      addonfit.fit();
      setWinSize(term.cols, term.rows);
    };

    sockRef.current.onclose = () => {
      term.write(t("Connection closed.\r\n"));
      sockRef.current = null;
    }

    window.addEventListener('resize', () => {
      addonfit.fit();
      setWinSize(term.cols, term.rows);
    })

    window.addEventListener('beforeunload', () => {
      sockRef.current?.close();
      sockRef.current = null;
    })

    terminalRef.current?.addEventListener('touchstart', (eventStart: TouchEvent) => {
      const touch = eventStart.touches[0];
      const startY = touch.clientY;
      let isScrolling = false;

      if (!terminalRef.current) {
        return;
      }

      if (!termRef.current) {
        return;
      }

      eventStart.preventDefault();
      eventStart.stopPropagation();

      terminalRef.current?.addEventListener('touchmove', (eventMove: TouchEvent) => {
        eventMove.preventDefault();
        eventMove.stopPropagation();
        const touchMove = eventMove.touches[0];
        const endY = touchMove.clientY;
        const diffY = startY - endY;
        if (!terminalRef.current) {
          return;
        }

        if (!termRef.current) {
          return;
        }

        if (diffY === 0) {
          return;
        }

        if (diffY > 0) {
          termRef.current.scrollLines(-Math.ceil(diffY / 30));
        } else if (diffY < 0) {
          termRef.current.scrollLines(Math.ceil(-diffY / 30));
        }

        isScrolling = true;
      });

      const handleTerminalTouchStart = (_eventEnd: TouchEvent): void => {
        // NOOP
      }

      const handleTerminalTouchMove = (_eventEnd: TouchEvent): void => {
        // NOOP
      }

      const handleTerminalTouchEnd = (_eventEnd: TouchEvent): void => {
        // NOOP
      }

      terminalRef.current?.addEventListener('touchend', (eventEnd: TouchEvent) => {
        eventEnd.preventDefault();
        eventEnd.stopPropagation();
        terminalRef.current?.removeEventListener('touchstart', handleTerminalTouchStart);
        terminalRef.current?.removeEventListener('touchmove', handleTerminalTouchMove);
        terminalRef.current?.removeEventListener('touchend', handleTerminalTouchEnd);

        if (!termRef.current) {
          return;
        }

        if (isScrolling) {
          return;
        }
        termRef.current.focus();
      });
    })

    const refreshWinSize = (): void => {
      if (!termRef.current) {
        return;
      }
      addonfit.fit();
      setWinSize(termRef.current.cols, termRef.current.rows);
    }
    refreshWinSizeRef.current = refreshWinSize;

    const processMessage = (data: ArrayBuffer): void => {
      const dataview = new DataView(data);
      const type = dataview.getUint8(0);
      switch (type) {
        case 0: {
          const msgStr = new TextDecoder().decode(data.slice(1));
          term.write(msgStr);
          break;
        }
        case 1: {
          const errStr = new TextDecoder().decode(data.slice(1));
          term.write(errStr);
          break;
        }
        case 2: {
          const cols = dataview.getUint16(1);
          const rows = dataview.getUint16(3);
          term.resize(cols, rows);
          break;
        }
      }
    }

    if (refreshWin) {
      if (refreshWinSizeRef.current) {
        setWinSize(term.cols, term.rows + 10);
        addonfit.fit();
        refreshWinSizeRef.current();
      }

      if (user?.xtermBuff) {
        term.write(user.xtermBuff as Uint8Array);
      }
    }

    const socketSetBackgroupd = (): void => {
      if (!sockRef.current) {
        return;
      }

      if (sockRef.current.readyState !== WebSocket.OPEN && sockRef.current.readyState !== WebSocket.CONNECTING) {
        sockRef.current.close();
  setXtermSocket?.(null);
        return;
      }

      if (sockRef.current.readyState === WebSocket.OPEN) {
        pauseTerm();
      }

      sockRef.current.onopen = () => {
        // NOOP
      };
      sockRef.current.onmessage = () => {
        // NOOP
        if (user?.xtermBuff) {
          setXtermBuff?.(null);
        }
      };
      sockRef.current.onerror = () => {
        // NOOP
      };
      sockRef.current.onclose = () => {
  sockRef.current = null;
  setXtermSocket?.(null);
      };
    }

    return () => {
      socketSetBackgroupd();
      const strXterm = addonserialize.serialize();
      if (strXterm) {
        setXtermBuff?.(strXterm);
      }
      sockRef.current = null;
      hasInitialized.current = false;
      term.dispose();
    }
  }, [t, checkSessionError, router, user, setXtermSocket, setXtermBuff]);

  const handleSpeedDialClick = (event: React.MouseEvent<HTMLDivElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    setOpen((prevOpen) => !prevOpen);
    if (termRef.current) {
      termRef.current.focus();
    }
  };

  const handleSpeedDialActionClick = (id: ActionId) => (event: React.MouseEvent<HTMLDivElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    switch (id) {
      case 'SELECT_ALL': {
        if (termRef.current) {
          termRef.current.selectAll();
        }
        break;
      }
      case 'CTRL': {
        ctrl.current = !ctrl.current;
        setIsCtrlPressed(ctrl.current);
        break;
      }
      case 'ALT': {
        alt.current = !alt.current;
        setIsAltPressed(alt.current);
        break;
      }
      case 'TAB': {
        if (sockRef.current) {
          sockRef.current.send('\t');
        }
        break;
      }
      case 'ESC': {
        if (sockRef.current) {
          sockRef.current.send('\u001B');
        }
        break;
      }
    }

    if (termRef.current) {
      termRef.current.focus();
    }
  };

  if (isDisplayError) {
    if (user?.xtermSocket) {
      const socket = user.xtermSocket as WebSocket;
      socket.close();
      setXtermSocket?.(null);
    }
    return <Alert severity="info">Please Refresh Page.</Alert>;
  }

  return (
    <Box sx={{ position: 'relative', height: '100%', width: '100%' }}>
      <SpeedDial
        ref={speedDialRef}
        ariaLabel="Xterm ToolBar"
        sx={{
          position: 'absolute', bottom: 16, right: 16,
        }}

        icon={<SpeedDialIcon />}
        onClick={handleSpeedDialClick}
        open={open}
        direction="up"
      >
        {actions.map((action) => (
          <SpeedDialAction
            key={action.name}
            tooltipTitle={action.name}
            icon={action.icon}
            onClick={handleSpeedDialActionClick(action.id)}
          />
        ))}
      </SpeedDial>
      <Box
        ref={terminalRef}
        sx={{
          height: '100%',
          width: '100%',
        }}
      />
    </Box>
  );
}
