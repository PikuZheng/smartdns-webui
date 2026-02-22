"use client";

import { FormControl, MenuItem, Select, type SxProps, type SelectChangeEvent, NoSsr } from '@mui/material';
import * as React from 'react';
import i18n from '@/components/core/i18n';
import { Flag } from '../core/logo';

export interface LanguageSwitchProps {
  sx?: SxProps;
  size?: 'medium' | 'small';
}

export function LanguageSwitch({ sx, size }: LanguageSwitchProps): React.JSX.Element | null {
  const [lang, setLang] = React.useState<string>(() => {
    const currentLang = i18n.language;
    return currentLang.startsWith('en') ? 'en' : currentLang;
  });

  const handleChangeLang = (event: SelectChangeEvent): void => {
    i18n.changeLanguage(event.target.value).then((_data) => {
      setLang(event.target.value);
    }).catch((_error: unknown) => {
      // NOOP
    });
  }

  return (
    <NoSsr>
      <FormControl size={size} sx={{ minWidth: 140 }}>
        <Select onChange={handleChangeLang} value={lang} sx={sx}>
          <MenuItem value="en"><Flag country='gb' height='20px' title='English' /></MenuItem>
          <MenuItem value="zh-CN" ><Flag country='cn' height='20px' title='中文'/></MenuItem>
          <MenuItem value="de-DE"><Flag country='de' height='20px' title='Deutsch' /></MenuItem>
        </Select>
      </FormControl>
    </NoSsr>
  );
}

