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
  const { checkSessionError } = useUser();
  const hasInitialized = React.useRef(false);
  const { t } = useTranslation();

  let { user } = useUser();
  const displayError = React.useRef(false);

  if (user === null) {
    displayError.current = true;
    user = {
      id: '',
      sideNavVisibility: new Map<string, boolean>(),
    };
  }

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

  const getCtrlChar = (char: string): string => {
    const code = char.toUpperCase().charCodeAt(0);
    return String.fromCharCode(code - 64);
  };

  const actions = [
    {
      icon: <SelectAll />, name: t('SELECT ALL'), action: () => {
        if (!termRef.current) {
          return;
        }

        termRef.current.selectAll();
      }
    },
    {
      icon: isCtrlPressed ? <CtrlIcon style={{ color: 'red' }} /> : <CtrlIcon />, name: 'CTRL', action: () => {
        ctrl.current = !ctrl.current;
        setIsCtrlPressed(ctrl.current);
      }
    },
    {
      icon: isAltPressed ? <KeyboardOptionKeyIcon style={{ color: 'red' }} /> : <KeyboardOptionKeyIcon />, name: 'ALT', action: () => {
        alt.current = !alt.current;
        setIsAltPressed(alt.current);
      }
    },
    {
      icon: <TabIcon />, name: 'TAB', action: () => {
        if (!sockRef.current) {
          return;
        }

        sockRef.current.send('\t');
      }
    },
    {
      icon: <TransitEnterexitIcon />, name: 'ESC', action: () => {
        if (!sockRef.current) {
          return;
        }

        sockRef.current.send('\x1b');
      },
    }

  ];

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

    if (displayError.current) {
      return;
    }

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
        sockRef.current.send('\x1b');
        alt.current = false;
        setIsAltPressed(false);
      }

      sockRef.current.send(sendData);
    });

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    let refreshWin = false;

    if (user.xtermSocket) {
      const socket = user.xtermSocket as WebSocket;
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        sockRef.current = user.xtermSocket as WebSocket;
        refreshWin = true;
        resumeTerm();
      } else {
        socket.close();
        user.xtermSocket = null;
        term.write("Resume session failed...\r\n");
      }
    }

    if (!sockRef.current) {
      term.write(t('Connecting to xterm server...\r\n'));
      const socket = new WebSocket(`${protocol}://${window.location.host}/api/tool/term`);
      sockRef.current = socket;
      user.xtermSocket = sockRef.current;
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
          checkSessionError(data.error).catch((_err: unknown) => {
            //NOOP
          });
          router.refresh();
        }
      }).catch((_err: unknown) => {
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

      terminalRef.current?.addEventListener('touchend', (eventEnd: TouchEvent) => {
        eventEnd.preventDefault();
        eventEnd.stopPropagation();


        terminalRef.current?.removeEventListener('touchstart', () => {
          // Noop
        });
        terminalRef.current?.removeEventListener('touchmove', () => {
          // Noop
        });
        terminalRef.current?.removeEventListener('touchend', () => {
          // Noop
        });

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

      if (user.xtermBuff) {
        term.write(user.xtermBuff as Uint8Array);
      }
    }

    const socketSetBackgroupd = (): void => {
      if (!sockRef.current) {
        return;
      }

      if (sockRef.current.readyState !== WebSocket.OPEN && sockRef.current.readyState !== WebSocket.CONNECTING) {
        sockRef.current.close();
        user.xtermSocket = null;
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
        if (user.xtermBuff) {
          user.xtermBuff = null;
        }
      };
      sockRef.current.onerror = () => {
        // NOOP
      };
      sockRef.current.onclose = () => {
        sockRef.current = null;
        user.xtermSocket = null;
      };
    }

    return () => {
      socketSetBackgroupd();
      const strXterm = addonserialize.serialize();
      if (strXterm) {
        user.xtermBuff = strXterm;
      }
      sockRef.current = null;
      hasInitialized.current = false;
      term.dispose();
    }
  }, [t, checkSessionError, router, user]);

  const handleSpeedDialClick = (event: React.MouseEvent<HTMLDivElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    setOpen((prevOpen) => !prevOpen);
    if (termRef.current) {
      termRef.current.focus();
    }
  };

  const handleSpeedDialActionClick = (action: () => void) => (event: React.MouseEvent<HTMLDivElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    action();
    if (termRef.current) {
      termRef.current.focus();
    }
  };

  if (displayError.current) {
    if (user.xtermSocket) {
      const socket = user.xtermSocket as WebSocket;
      socket.close();
      user.xtermSocket = null;
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
            onClick={handleSpeedDialActionClick(action.action)}
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
