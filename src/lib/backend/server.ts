
export type ServerError = string | AuthorError | Error | null;
export interface FetchResponse<T> {
    error?: ServerError;
    data?: T | null;
}

export type Settings = Record<string, unknown>;

export class AuthorError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "AuthorError";
    }
}

interface ErrorResponse {
    error: string;
}

class DataServer {

    private signOut = async (): Promise<{ error?: string }> => { return {}; };

    setSignOut(signOut: () => Promise<{ error?: string }>): void {
        this.signOut = signOut;
    }

    getErrorMessage(error: string | ErrorResponse | Error): string {
        try {
            if (typeof error === 'string') {
                return error;
            }

            if (error instanceof Error) {
                return error.message;
            }

            return error.error;
        } catch (_e) {
            return 'Something went wrong';
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any  -- Expected
    async fetch<T>(path: string, method: string, headers: HeadersInit, bodyData: any, noSignOut = false): Promise<FetchResponse<T>> {
        try {
            let response;
            if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {

                response = await fetch(path, {
                    method,
                    headers: {
                        'Content-Type': 'application/json',
                        ...headers,
                    },
                    credentials: 'include',
                });
            } else {
                response = await fetch(path, {
                    method,
                    headers: {
                        'Content-Type': 'application/json',
                        ...headers,
                    },
                    body: JSON.stringify(bodyData),
                    credentials: 'include',
                });
            }

            if (!response.ok) {
                const contentType = response.headers.get('Content-Type');
                let error: string | ErrorResponse | Error;
                if (contentType?.includes('application/json')) {
                    error = await response.json() as string | ErrorResponse | Error;
                } else {
                    error = await response.text();
                }

                if (response.status === 401 && !noSignOut) {
                    await this.signOut();
                    return { error: new AuthorError(this.getErrorMessage(error)) };
                }
                return { error: this.getErrorMessage(error) };
            }

            if (response.status === 204) {
                return {};
            }

            return { data: await response.json() as T };
        } catch (error) {
            return { error: error as ServerError };
        }
    }
}

export interface TopDomainsResponse {
    domain_top_list: TopDomains[];
}

export interface TopClientsResponse {
    client_top_list: TopClients[];
}

export interface Mertrics {
    cache_hit_rate: number
    cache_number: number,
    avg_query_time: number,
    block_query_count: number,
    total_query_count: number,
    cache_memory_size: number,
    is_metrics_suspended: boolean,
    [key: string]: number | string | boolean,
}

export interface OverViewStats {
    server_name: string,
    db_size: number,
    startup_timestamp: number,
    [key: string]: number | string,
}

export interface TopClients {
    client_ip: string,
    query_count: number,
    timestamp_start: number,
    timestamp_end: number,
}

export interface TopDomains {
    domain: string,
    query_count: number,
    timestamp_start: number,
    timestamp_end: number,
}

export interface LoginToken {
    token: string,
    token_type: string,
    expires_in: string,
}

export interface ServerVersion {
    smartdns: string,
    smartdns_ui: string,
}

export interface DomainList {
    id: number,
    client: string,
    domain: string,
    domain_group: string,
    domain_type: number,
    is_blocked: boolean,
    ping_time: false,
    query_time: number,
    reply_code: number,
    timestamp: number,
}

export interface ClientList {
    id: number,
    client_ip: string,
    mac: string,
    hostname: string,
    last_query_timestamp: number,
}

export interface ClientListResponse {
    client_list: ClientList[];
    total_count: number;
}

export interface CacheNumber {
    cache_number: number;
}

export interface QueryLogs {
    domain_list: DomainList[];
    total_page: number;
    total_count: number;
}

export interface QueryLogsParams {
    id?: number;
    order?: string;
    page_num?: number;
    page_size?: number;
    domain?: string;
    domain_filter_mode?: string;
    domain_type?: number;
    client?: string;
    domain_group?: string;
    reply_code?: number;
    timestamp_before?: number;
    timestamp_after?: number;
    is_blocked?: boolean;
    is_cached?: boolean;
    cursor?: number;
    cursor_direction?: string;
    total_count?: number;
    [key: string]: unknown;
}

export interface QueryClientsParams {
    id?: number;
    order?: string;
    page_num?: number;
    page_size?: number;
    client_ip?: string;
    mac?: string;
    hostname?: string;
    timestamp_before?: number;
    timestamp_after?: number;
    cursor?: number;
    cursor_direction?: string;
    total_count?: number;
    [key: string]: unknown;
}

export interface HourlyQueryCount {
    hour: string;
    query_count: number;
}

export interface HourlyQueryCountResponse {
    hourly_query_count: HourlyQueryCount[];
    query_timestamp: number;
}

export interface DailyQueryCount {
    day: string;
    query_count: number;
}

export interface DailyQueryCountResponse {
    daily_query_count: DailyQueryCount[];
    query_timestamp: number;
}

export interface LogLevel {
    log_level: string;
}

export interface WhoIS {
    domain: string;
    city: string;
    address: string;
    country: string;
    organization: string;
    registrar: string;
}

export interface UpStreamServers {
    host: string;
    ip: string;
    port: number;
    query_success_rate: number;
    server_type: string;
    avg_time: number;
    status: string;
    total_query_count: number;
    total_query_recv_count: number;
    total_query_success: number;
}

export interface UpStreamServersResponse {
    upstream_server_list: UpStreamServers[];
}

class SmartDNSAPI {
    private server: DataServer;

    constructor() {
        this.server = new DataServer();
    }

    setSignOut(signOut: () => Promise<{ error?: string }>): void {
        this.server.setSignOut(signOut);
    }

    getErrorMessage(error: string | ErrorResponse | Error): string {
        return this.server.getErrorMessage(error);
    }

    async UpdatePassword(oldPassword: string, password: string): Promise<{ error?: ServerError }> {
        if (oldPassword === password) {
            return { error: 'New password must be different from old password' };
        }

        const data = await this.server.fetch<null>('/api/auth/password', 'PUT', {}, { "old_password": oldPassword, password });
        return data;
    }

    async Login(username: string, password: string): Promise<{ error?: ServerError, data?: LoginToken | null }> {
        const data = await this.server.fetch<LoginToken>('/api/auth/login', 'POST', {}, { username, password });
        return data;
    }

    async Logout(): Promise<{ error?: ServerError }> {
        return this.server.fetch<null>('/api/auth/logout', 'POST', {}, {}, true);
    }

    async RefreshToken(): Promise<{ error?: ServerError, data?: LoginToken | null }> {
        return this.server.fetch<LoginToken>('/api/auth/refresh', 'POST', {}, {});
    }

    async GetVersion(): Promise<{ error?: ServerError, data?: ServerVersion | null }> {
        const data = await this.server.fetch<ServerVersion>('/api/server/version', 'GET', {}, {});
        return data;
    }

    async GetLogLevel(): Promise<{ error?: ServerError, data?: LogLevel | null }> {
        const data = await this.server.fetch<LogLevel>('/api/log/level', 'GET', {}, {});
        return data;
    }

    async SetLogLevel(level: string): Promise<{ error?: ServerError }> {
        return this.server.fetch<null>('/api/log/level', 'PUT', {}, { "log_level": level });
    }

    async DeleteClientById(id: number): Promise<{ error?: ServerError }> {
        return this.server.fetch<null>(`/api/client/${id}`, 'DELETE', {}, {});
    }

    async DeleteQueryLogById(id: number): Promise<{ error?: ServerError }> {
        return this.server.fetch<null>(`/api/domain/${id}`, 'DELETE', {}, {});
    }

    async FlushCache(): Promise<{ error?: ServerError }> {
        return this.server.fetch<null>('/api/cache/flush', 'PUT', {}, {});
    }

    async GetClients(param: QueryClientsParams): Promise<{ error?: ServerError, data?: ClientListResponse | null }> {
        let getParam = "";

        if (param.id) {
            getParam = getParam.concat(`id=${param.id}&`);
        }

        if (param.order) {
            getParam = getParam.concat(`order=${param.order}&`);
        }

        if (param.page_num) {
            getParam = getParam.concat(`page_num=${param.page_num}&`);
        }

        if (param.page_size) {
            getParam = getParam.concat(`page_size=${param.page_size}&`);
        }

        if (param.client_ip) {
            getParam = getParam.concat(`client_ip=${param.client_ip}&`);
        }

        if (param.mac) {
            getParam = getParam.concat(`mac=${param.mac}&`);
        }

        if (param.hostname) {
            getParam = getParam.concat(`hostname=${param.hostname}&`);
        }

        if (param.timestamp_before) {
            getParam = getParam.concat(`timestamp_before=${param.timestamp_before}&`);
        }

        if (param.timestamp_after) {
            getParam = getParam.concat(`timestamp_after=${param.timestamp_after}&`);
        }

        if (param.cursor) {
            getParam = getParam.concat(`cursor=${param.cursor}&`);
        }

        if (param.cursor_direction) {
            getParam = getParam.concat(`cursor_direction=${param.cursor_direction}&`);
        }

        if (param.total_count) {
            getParam = getParam.concat(`total_count=${param.total_count}&`);
        }

        if (getParam.endsWith('&')) {
            getParam = getParam.slice(0, -1);
        }

        const ret = await this.server.fetch<ClientListResponse>(`/api/client?${getParam}`, 'GET', {}, {});
        return ret;
    }

    async GetQueryLogs(param: QueryLogsParams): Promise<{ error?: ServerError, data?: QueryLogs | null }> {

        let getParam = "";

        if (param.id) {
            getParam = getParam.concat(`id=${param.id}&`);
        }

        if (param.order) {
            getParam = getParam.concat(`order=${param.order}&`);
        }

        if (param.page_num) {
            getParam = getParam.concat(`page_num=${param.page_num}&`);
        }

        if (param.page_size) {
            getParam = getParam.concat(`page_size=${param.page_size}&`);
        }

        if (param.domain) {
            getParam = getParam.concat(`domain=${param.domain}&`);
        }

        if (param.domain_filter_mode) {
            getParam = getParam.concat(`domain_filter_mode=${param.domain_filter_mode}&`);
        }

        if (param.domain_type) {
            getParam = getParam.concat(`domain_type=${param.domain_type}&`);
        }

        if (param.client) {
            getParam = getParam.concat(`client=${param.client}&`);
        }

        if (param.domain_group) {
            getParam = getParam.concat(`domain_group=${param.domain_group}&`);
        }

        if (param.reply_code) {
            getParam = getParam.concat(`reply_code=${param.reply_code}&`);
        }

        if (param.timestamp_before) {
            getParam = getParam.concat(`timestamp_before=${param.timestamp_before}&`);
        }

        if (param.timestamp_after) {
            getParam = getParam.concat(`timestamp_after=${param.timestamp_after}&`);
        }

        if (param.is_blocked) {
            getParam = getParam.concat(`is_blocked=${param.is_blocked}&`);
        }

        if (param.is_cached) {
            getParam = getParam.concat(`is_cached=${param.is_cached}&`);
        }

        if (param.cursor) {
            getParam = getParam.concat(`cursor=${param.cursor}&`);
        }

        if (param.cursor_direction) {
            getParam = getParam.concat(`cursor_direction=${param.cursor_direction}&`);
        }

        if (param.total_count) {
            getParam = getParam.concat(`total_count=${param.total_count}&`);
        }

        if (getParam.endsWith('&')) {
            getParam = getParam.slice(0, -1);
        }

        const ret = await this.server.fetch<QueryLogs>(`/api/domain?${getParam}`, 'GET', {}, {});
        return ret;
    }

    async GetUpstreamServers(): Promise<{ error?: ServerError, data?: UpStreamServers[] | null }> {
        const ret = await this.server.fetch<UpStreamServersResponse>('/api/upstream-server', 'GET', {}, {});
        if (ret.error) {
            return { error: ret.error };
        }

        if (!ret.data) {
            return { error: 'No data' };
        }

        return { data: ret.data.upstream_server_list };
    }

    async GetTopClients(): Promise<{ error?: ServerError, data?: TopClients[] | null }> {
        const ret = await this.server.fetch<TopClientsResponse>('/api/stats/top/client', 'GET', {}, {});
        if (ret.error) {
            return { error: ret.error };
        }

        if (!ret.data) {
            return { error: 'No data' };
        }

        return { data: ret.data.client_top_list };
    }

    async GetTopDomains(): Promise<{ error?: ServerError, data?: TopDomains[] }> {
        const ret = await this.server.fetch<TopDomainsResponse>('/api/stats/top/domain', 'GET', {}, {});
        if (ret.error) {
            return { error: ret.error };
        }

        if (!ret.data) {
            return { error: 'No data' };
        }

        return { data: ret.data.domain_top_list };
    }

    async GetSettings(): Promise<{ error?: ServerError, data?: Settings | null }> {
        const ret = await this.server.fetch<Settings>('/api/config/settings', 'GET', {}, {});

        if (ret.error) {
            return { error: ret.error };
        }

        if (!ret.data) {
            return { error: 'No data' };
        }

        return { data: ret.data };
    }

    async RestartServer(): Promise<{ error?: ServerError }> {
        return await this.server.fetch<null>('/api/service/restart', 'PUT', {}, {});
    }

    async CacheFlush(): Promise<{ error?: ServerError }> {
        return await this.server.fetch<null>('/api/cache/flush', 'PUT', {}, {});
    }

    async CacheCount(): Promise<{ error?: ServerError, data?: CacheNumber | null }> {
        const ret = await this.server.fetch<CacheNumber>('/api/cache/count', 'GET', {}, {});
        return ret;
    }

    async UpdateSettings(settings: Map<string, string>): Promise<{ error?: ServerError }> {
        return this.server.fetch<null>('/api/config/settings', 'PUT', {}, { settings });
    }

    async GetOverView(): Promise<{ error?: ServerError, data?: OverViewStats | null }> {
        const ret = await this.server.fetch<OverViewStats>('/api/stats/overview', 'GET', {}, {});
        return ret;
    }

    async GetHourlyQueryCount(): Promise<{ error?: ServerError, data?: HourlyQueryCountResponse | null }> {
        const ret = await this.server.fetch<HourlyQueryCountResponse>('/api/stats/hourly-query-count', 'GET', {}, {});
        if (ret.error) {
            return { error: ret.error };
        }

        if (!ret.data) {
            return { error: 'No data' };
        }

        return { data: ret.data };
    }

    async GetDailyQueryCount(): Promise<{ error?: ServerError, data?: DailyQueryCountResponse | null }> {
        const ret = await this.server.fetch<DailyQueryCountResponse>('/api/stats/daily-query-count', 'GET', {}, {});
        if (ret.error) {
            return { error: ret.error };
        }

        if (!ret.data) {
            return { error: 'No data' };
        }

        return { data: ret.data };
    }

    async GetWhois(domain: string): Promise<{ error?: ServerError, data?: WhoIS | null }> {
        const ret = await this.server.fetch<WhoIS>(`/api/whois?domain=${domain}`, 'GET', {}, {});
        return ret;
    }

    async CheckLoginStatus(): Promise<{ error?: ServerError }> {
        return this.server.fetch<null>('/api/auth/check', 'GET', {}, {});
    }
}

export const smartdnsServer = new SmartDNSAPI();
