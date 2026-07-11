import type { WsMessage } from './types';

import {
	BASE_RECONNECT_DELAY,
	MAX_RECONNECT_ATTEMPTS,
	MAX_RECONNECT_DELAY,
	PING_INTERVAL,
	PONG_TIMEOUT,
} from './constants';
import { dispatchToHandlers } from './dispatcher';
import { getBackendHealthUrl, getWsUrl } from './utils';

type ConnectionState = 'connected' | 'connecting' | 'disconnected';

const BACKEND_HEALTH_TIMEOUT_MS = 1500;
const BACKEND_LIVENESS_RETRY_DELAY_MS = 30_000;
const STRICT_MODE_DISCONNECT_DELAY_MS = 250;

class WebSocketManager {
	private static instance: null | WebSocketManager = null;
	private ws: null | WebSocket = null;
	private disconnectTimeout: null | ReturnType<typeof setTimeout> = null;
	private pingInterval: null | ReturnType<typeof setInterval> = null;
	private pongTimeout: null | ReturnType<typeof setTimeout> = null;
	private livenessProbeTimeout: null | ReturnType<typeof setTimeout> = null;
	private reconnectTimeout: null | ReturnType<typeof setTimeout> = null;
	private reconnectAttempts = 0;
	private intentionalClose = false;
	private setConnectionState: ((state: ConnectionState) => void) | null = null;
	private subscribers = 0;

	private retrySignalHandler: (() => void) | null = null;

	private constructor() {}

	public static getInstance(): WebSocketManager {
		if (!WebSocketManager.instance) {
			WebSocketManager.instance = new WebSocketManager();
		}
		return WebSocketManager.instance;
	}

	/**
	 * Register the single connection-state callback and increment the mount counter.
	 * Only one callback is retained (latest wins). The subscriber counter tracks
	 * React StrictMode mount/unmount pairs to determine when to disconnect.
	 */
	public subscribe(setConnectionState: (state: ConnectionState) => void): void {
		this.subscribers++;
		this.setConnectionState = setConnectionState;
		this.clearDisconnectTimer();

		if (this.ws?.readyState === WebSocket.OPEN) {
			setConnectionState('connected');
		} else if (this.ws?.readyState === WebSocket.CONNECTING) {
			setConnectionState('connecting');
		}

		this.startRetrySignalListeners();
	}

	public unsubscribe(): void {
		if (this.subscribers <= 0) {
			if (import.meta.env.DEV) {
				console.warn('[WS] unsubscribe called when subscriber count is already zero');
			}
			return;
		}
		this.subscribers = Math.max(0, this.subscribers - 1);
		if (this.subscribers <= 0) {
			this.scheduleDisconnect();
		}
	}

	public connect(): void {
		this.reconnectAttempts = 0;
		void this.doConnect();
	}

	private async doConnect(): Promise<void> {
		if (this.hasActiveSocket()) return;
		if (this.subscribers <= 0) return;

		this.intentionalClose = false;
		this.setConnectionState?.('connecting');

		const backendReachable = await this.checkBackendReachable();
		if (!backendReachable || this.intentionalClose || this.subscribers <= 0) {
			this.setConnectionState?.('disconnected');
			this.handleUnavailableBackend();
			return;
		}
		if (this.hasActiveSocket()) return;

		this.ws = new WebSocket(getWsUrl());
		this.ws.onopen = () => this.handleOpen();
		this.ws.onmessage = (event) => this.handleMessage(event);
		this.ws.onclose = () => this.handleClose();
		this.ws.onerror = () => {
			// Error will trigger onclose, which handles reconnection
		};
	}

	private handleOpen(): void {
		this.reconnectAttempts = 0;
		this.setConnectionState?.('connected');
		this.startHeartbeat();
	}

	private hasActiveSocket(): boolean {
		return (
			this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING
		);
	}

	private async checkBackendReachable(): Promise<boolean> {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), BACKEND_HEALTH_TIMEOUT_MS);

		try {
			const res = await fetch(getBackendHealthUrl(), {
				cache: 'no-store',
				signal: controller.signal,
			});
			return res.ok;
		} catch {
			return false;
		} finally {
			clearTimeout(timeout);
		}
	}

	private handleMessage(event: MessageEvent): void {
		let msg: WsMessage;
		try {
			msg = JSON.parse(event.data as string) as WsMessage;
		} catch {
			if (import.meta.env.DEV) console.warn('[WS] Failed to parse message');
			return;
		}

		if (msg.type === 'pong') {
			if (this.pongTimeout) {
				clearTimeout(this.pongTimeout);
				this.pongTimeout = null;
			}
			return;
		}

		dispatchToHandlers(msg);
	}

	private handleClose(): void {
		this.ws = null;
		this.clearTimers();
		this.setConnectionState?.('disconnected');

		if (this.intentionalClose || this.subscribers <= 0) {
			return;
		}

		this.scheduleReconnectAttempt();
	}

	private handleUnavailableBackend(): void {
		this.clearTimers();
		this.setConnectionState?.('disconnected');

		if (this.intentionalClose || this.subscribers <= 0) {
			return;
		}

		this.scheduleReconnectAttempt();
	}

	private scheduleReconnectAttempt(): void {
		if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
			this.startBackendLivenessProbe();
			return;
		}

		const delay = Math.min(
			BASE_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts),
			MAX_RECONNECT_DELAY
		);
		this.reconnectAttempts++;

		this.reconnectTimeout = setTimeout(() => {
			void this.doConnect();
		}, delay);
	}

	private startBackendLivenessProbe(): void {
		if (this.livenessProbeTimeout) return;

		this.livenessProbeTimeout = setTimeout(() => {
			this.livenessProbeTimeout = null;
			void this.probeBackendAndReconnect();
		}, BACKEND_LIVENESS_RETRY_DELAY_MS);
	}

	private async probeBackendAndReconnect(): Promise<void> {
		if (this.intentionalClose || this.subscribers <= 0 || this.hasActiveSocket()) return;

		const backendReachable = await this.checkBackendReachable();
		if (!backendReachable) {
			this.startBackendLivenessProbe();
			return;
		}

		this.reconnectAttempts = 0;
		void this.doConnect();
	}

	public disconnect(): void {
		this.intentionalClose = true;
		this.clearDisconnectTimer();
		this.clearTimers();
		this.stopRetrySignalListeners();
		this.reconnectAttempts = 0;

		if (this.ws) {
			// Detach handlers before closing to prevent stale onclose from
			// destroying a new connection created during React StrictMode remount
			this.ws.onopen = null;
			this.ws.onmessage = null;
			this.ws.onclose = null;
			this.ws.onerror = null;
			this.ws.close();
			this.ws = null;
		}

		if (this.setConnectionState) {
			this.setConnectionState('disconnected');
		}
	}

	private scheduleDisconnect(): void {
		this.clearDisconnectTimer();
		this.disconnectTimeout = setTimeout(() => {
			if (this.subscribers <= 0) {
				this.disconnect();
			}
		}, STRICT_MODE_DISCONNECT_DELAY_MS);
	}

	private startHeartbeat(): void {
		this.clearTimers();

		this.pingInterval = setInterval(() => {
			this.sendHeartbeatPing();
		}, PING_INTERVAL);
	}

	private sendHeartbeatPing(): void {
		if (this.ws?.readyState !== WebSocket.OPEN) return;
		if (this.pongTimeout) return;

		try {
			this.ws.send(JSON.stringify({ type: 'ping' }));
		} catch {
			this.ws.close();
			return;
		}

		this.pongTimeout = setTimeout(() => {
			this.ws?.close();
		}, PONG_TIMEOUT);
	}

	private startRetrySignalListeners(): void {
		if (this.retrySignalHandler) return;

		this.retrySignalHandler = (event?: Event) => {
			const isVisibleSignal =
				event?.type === 'visibilitychange' && document.visibilityState === 'visible';
			const isOnlineSignal = event?.type === 'online';

			if (!isVisibleSignal && !isOnlineSignal) return;
			if (this.intentionalClose) return;
			if (this.ws?.readyState === WebSocket.OPEN) {
				this.sendHeartbeatPing();
				return;
			}
			if (this.ws?.readyState === WebSocket.CONNECTING) return;

			void this.probeBackendAndReconnect();
		};

		document.addEventListener('visibilitychange', this.retrySignalHandler);
		window.addEventListener('online', this.retrySignalHandler);
	}

	private stopRetrySignalListeners(): void {
		if (this.retrySignalHandler) {
			document.removeEventListener('visibilitychange', this.retrySignalHandler);
			window.removeEventListener('online', this.retrySignalHandler);
			this.retrySignalHandler = null;
		}
	}

	private clearTimers(): void {
		if (this.pingInterval) {
			clearInterval(this.pingInterval);
			this.pingInterval = null;
		}
		if (this.pongTimeout) {
			clearTimeout(this.pongTimeout);
			this.pongTimeout = null;
		}
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}
		if (this.livenessProbeTimeout) {
			clearTimeout(this.livenessProbeTimeout);
			this.livenessProbeTimeout = null;
		}
	}

	private clearDisconnectTimer(): void {
		if (this.disconnectTimeout) {
			clearTimeout(this.disconnectTimeout);
			this.disconnectTimeout = null;
		}
	}
}

export { WebSocketManager };
