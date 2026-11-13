// Remote control WebSocket client
// Syncs state with mobile remotes via relay server
import QRCode from 'qrcode';
import { collectRemoteSchema, pickSchemaValues, defaultRemoteLayout } from './colorSystem';
import { presetNames } from './modeControls';

export interface RemoteState {
  connected: boolean;
  remoteUrl: string;
  qrCode: string;
}

export class RemoteSync {
  private ws: WebSocket | null = null;
  private reconnectTimer: any = null;
  private params: any;
  private onAction?: (action: string) => void;
  private onPreset?: (name: string) => void;
  private onQRReady?: () => void;
  private onParamChange?: (param: string, value: any) => void;
  private syncTimer: any = null;
  
  public state: RemoteState = {
    connected: false,
    remoteUrl: '',
    qrCode: ''
  };

  constructor(
    params: any, 
    onAction?: (action: string) => void, 
    onPreset?: (name: string) => void, 
    onQRReady?: () => void,
    onParamChange?: (param: string, value: any) => void
  ) {
    this.params = params;
    this.onAction = onAction;
    this.onPreset = onPreset;
    this.onQRReady = onQRReady;
    this.onParamChange = onParamChange;
    
    // Fetch LAN IP from server endpoint
    this.fetchLANIP();
  }

  private async fetchLANIP() {
    try {
      const response = await fetch('/api/lan-ip');
      const { ip, port } = await response.json();
      this.state.remoteUrl = `http://${ip}:${port}/remote.html`;
      await this.generateQRCode();
      
      // Notify UI that QR is ready
      if (this.onQRReady) {
        this.onQRReady();
      }
    } catch (err) {
      console.error('Failed to fetch LAN IP:', err);
      // Fallback to location.hostname
      const host = location.hostname;
      const port = location.port ? `:${location.port}` : '';
      this.state.remoteUrl = `http://${host}${port}/remote.html`;
      await this.generateQRCode();
      if (this.onQRReady) {
        this.onQRReady();
      }
    }
  }

  private async generateQRCode() {
    try {
      this.state.qrCode = await QRCode.toDataURL(this.state.remoteUrl, {
        width: 200,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
    } catch (err) {
      console.error('Failed to generate QR code:', err);
      this.state.qrCode = '';
    }
  }

  connect() {
    const wsUrl = `ws://${location.hostname}:3001`;
    
    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('Remote sync: connected to relay');
        this.state.connected = true;
        
        // Register as display
        this.send({ type: 'register', role: 'display' });
        
        // Send initial state
        this.syncState();
      };
      
      this.ws.onclose = () => {
        console.log('Remote sync: disconnected from relay');
        this.state.connected = false;
        this.reconnectTimer = setTimeout(() => this.connect(), 2000);
      };
      
      this.ws.onerror = (err) => {
        console.error('Remote sync: WebSocket error:', err);
      };
      
      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch (e) {
          console.error('Remote sync: failed to parse message:', e);
        }
      };
    } catch (err) {
      console.error('Remote sync: failed to connect:', err);
      this.reconnectTimer = setTimeout(() => this.connect(), 2000);
    }
  }

  private send(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private handleMessage(msg: any) {
    if (msg.type === 'param') {
      let modeChanged = false;
      for (const [key, value] of Object.entries(msg.data)) {
        if (key === 'mode' && value !== this.params.mode) modeChanged = true;
        this.params[key] = value;
        if (this.onParamChange) {
          this.onParamChange(key, value);
        }
      }
      if (modeChanged) this.syncState();
      else this.scheduleSync();
    } else if (msg.type === 'hello') {
      this.syncState();
    } else if (msg.type === 'layout') {
      const mode = msg.data?.mode || this.params.mode;
      const keys = Array.isArray(msg.data?.keys) ? msg.data.keys : [];
      this.saveLayout(mode, keys);
    } else if (msg.type === 'preset' && this.onPreset) {
      // Remote selected a preset
      this.onPreset(msg.data.name);
    } else if (msg.type === 'action' && this.onAction) {
      // Remote triggered an action
      this.onAction(msg.data.action);
    }
  }

  private layoutFor(mode: string): string[] {
    try {
      const raw = localStorage.getItem('flow-remote-layout-v1');
      const all = raw ? JSON.parse(raw) : {};
      if (Array.isArray(all[mode]) && all[mode].length) return all[mode];
    } catch {}
    return defaultRemoteLayout(mode);
  }
  saveLayout(mode: string, keys: string[]) {
    try {
      const raw = localStorage.getItem('flow-remote-layout-v1');
      const all = raw ? JSON.parse(raw) : {};
      all[mode] = keys;
      localStorage.setItem('flow-remote-layout-v1', JSON.stringify(all));
    } catch {}
    this.syncState();
  }
  private scheduleSync() {
    if (this.syncTimer) return;
    this.syncTimer = setTimeout(() => { this.syncTimer = null; this.syncState(); }, 80);
  }
  syncState() {
    const mode = this.params.mode;
    this.send({
      type: 'state',
      data: {
        ...pickSchemaValues(this.params, mode),
        mode,
        bloom: this.params.bloom,
        exposure: this.params.exposure,
        speed: this.params.speed || this.params.trippySpeed || this.params.phSpeed || 1.0,
        paused: this.params.paused,
        schema: collectRemoteSchema(mode),
        layout: this.layoutFor(mode),
        presets: presetNames(mode).map((name) => ({ name, mode })),
      }
    });
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
