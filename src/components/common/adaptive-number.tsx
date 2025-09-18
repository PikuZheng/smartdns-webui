"use client";

import * as React from 'react';
import Box from '@mui/material/Box';

export function AdaptiveNumber({ value }: { value: number | string }): React.JSX.Element | null {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const textRef = React.useRef<HTMLSpanElement>(null);
    const [fontSize, setFontSize] = React.useState<number>(16);

    React.useEffect(() => {
        const container = containerRef.current;
        const text = textRef.current;

        if (!container || !text) return;

        const adjustFontSize = () => {
            const containerWidth = container.clientWidth;
            let size = 32;
            text.style.fontSize = `${size}px`;
            while (text.scrollWidth > containerWidth && size > 8) {
                size -= 1;
                text.style.fontSize = `${size}px`;
            }

            setFontSize(size);
        };

        adjustFontSize();

        const resizeObserver = new ResizeObserver(adjustFontSize);
        resizeObserver.observe(container);

        return () => {
            resizeObserver.disconnect();
        };
    }, [value]);

    return (
        <Box
            ref={containerRef}
            component="div"
            sx={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                height: '100%',
                overflow: 'hidden'
            }}
        >
            <Box
                ref={textRef}
                component="span"
                sx={{
                    fontSize: `${fontSize}px`,
                    fontWeight: 'bold',
                }}
            >
                {value}
            </Box>
        </Box>
    );
}
