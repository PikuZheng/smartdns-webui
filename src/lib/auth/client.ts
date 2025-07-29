'use client';

import type { User } from '@/types/user';
import { logger } from '@/lib/default-logger';
import { AuthorError, smartdnsServer } from '../backend/server';
import type { ServerError } from '../backend/server';

interface TokenData {
  token: string;
  expiresAt: number;
}

function generateToken(expirationSeconds: number): string {
  const arr = new Uint8Array(12);
  window.crypto.getRandomValues(arr);
  const tokenData: TokenData = {
    token: Array.from(arr, (v) => v.toString(16).padStart(2, '0')).join(''),
    expiresAt: Date.now() + expirationSeconds * 1000,
  };

  return JSON.stringify(tokenData);
}

function getTokenData(token: string): { token?: string, error?: string } {
  try {
    const tokenData = JSON.parse(token) as TokenData;
    const currentTime = Date.now();
    const expiresAt = Number(tokenData.expiresAt);

    if (currentTime > expiresAt) {
      return { error: "Token expired" };
    }
    return { token: tokenData.token };
  } catch {
    return { error: "Token invalid" };
  }
}

export interface SignUpParams {
  firstName: string;
  lastName: string;
  username: string;
  password: string;
}

export interface SignInWithPasswordParams {
  username: string;
  password: string;
}

export interface ResetPasswordParams {
  username: string;
}

class AuthClient {
  private refreshTokenIntervalId: NodeJS.Timeout | null = null;
  private refreshTokenInterval: number = 1000 * 60;
  private user: User = { id: "", sideNavVisibility: new Map<string, boolean>() };
  private isLogin = false;

  constructor() {
    smartdnsServer.setSignOut(this.signOut.bind(this));
  }

  destroy(): void {
    this.stopRefreshTokenInterval();
  }

  private startRefreshTokenInterval(): void {
    if (this.refreshTokenIntervalId) {
      return;
    }

    this.isLogin = true;
    this.loadUserSettings();
    logger.debug('[AuthClient]: start refresh token.');
    this.refreshTokenIntervalId = setInterval(() => {
      this.refreshTokens().catch(async (_error: unknown) => {
        logger.debug('[AuthClient]: start refresh token failed.');
      });
    }, this.refreshTokenInterval);
  }

  private stopRefreshTokenInterval(): void {
    if (this.refreshTokenIntervalId) {
      clearInterval(this.refreshTokenIntervalId);
      this.refreshTokenIntervalId = null;
    }
  }

  private checkStartRefreshTokenInterval(): void {
    if (localStorage.getItem('custom-auth-token')) {
      this.startRefreshTokenInterval();
    }
  }

  async refreshTokens(): Promise<{ error?: ServerError }> {
    const { data, error } = await smartdnsServer.RefreshToken();
    if (error) {
      return { error };
    }

    let expirationSeconds = Number(data?.expires_in ?? 60 * 10);
    if (expirationSeconds < 60) {
      expirationSeconds = 60;
    }

    const token = generateToken(expirationSeconds);
    localStorage.setItem('custom-auth-token', token);

    return {};
  }

  async signInWithPassword(params: SignInWithPasswordParams): Promise<{ error?: ServerError }> {
    const { username, password } = params;

    const { data, error } = await smartdnsServer.Login(username, password);
    if (error) {
      return { error };
    }

    let expirationSeconds = Number(data?.expires_in ?? 60 * 10);
    if (expirationSeconds < 60) {
      expirationSeconds = 60;
    }

    const token = generateToken(expirationSeconds);
    localStorage.setItem('custom-auth-token', token);
    this.user.username = username;

    this.checkStartRefreshTokenInterval();
    this.isLogin = true;
    logger.debug('[AuthClient]: sigIn');

    return {};
  }

  async resetPassword(_: ResetPasswordParams): Promise<{ error?: string }> {
    return { error: 'Password reset not implemented' };
  }

  async updatePassword(_: ResetPasswordParams): Promise<{ error?: string }> {
    return { error: 'Update reset not implemented' };
  }

  saveUserSettings(): void {
    localStorage.setItem('side-nav-visibility', JSON.stringify([...this.user.sideNavVisibility.entries()]));
  }

  loadUserSettings(): void {
    const sideNavVisibility = localStorage.getItem('side-nav-visibility');
    if (sideNavVisibility) {
      try {
        const parsedVisibility: unknown = JSON.parse(sideNavVisibility);
        if (Array.isArray(parsedVisibility)) {
          this.user.sideNavVisibility = new Map<string, boolean>(parsedVisibility);
        }
      } catch {
        // NOOP
      }
    }
  }

  async getUser(): Promise<{ data?: User | null; error?: string }> {
    const token = localStorage.getItem('custom-auth-token');

    if (!token) {
      return { data: null };
    }

    const { error } = getTokenData(token);
    if (error) {
      if (error === "Token expired") {
        await this.signOut();
        return { data: null };
      }
      return { data: null };
    }

    this.startRefreshTokenInterval();
    return { data: this.user };
  }

  async signOut(): Promise<{ error?: string }> {
    localStorage.removeItem('custom-auth-token');
    if (this.isLogin) {
      const _result = await smartdnsServer.Logout();
      logger.debug('[AuthClient]: signOut');
    }
    localStorage.removeItem('side-nav-visibility');
    this.stopRefreshTokenInterval();
    this.user.id = "";
    this.user.username = "";
    this.isLogin = false;
    this.user.sideNavVisibility = new Map<string, boolean>();
    return {};
  }

  async checkLogin(): Promise<{ error?: ServerError }> {
    const err = await smartdnsServer.CheckLoginStatus();
    if (err.error) {
      if (err.error instanceof AuthorError) {
        return { error: err.error };
      }
    }

    const user = await this.getUser();
    if (user.error) {
      return { error: user.error };
    }

    return {};
  }
}

export const authClient = new AuthClient();
