// Remote control WebSocket client
// Syncs state with mobile remotes via relay server
import QRCode from 'qrcode';

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
  
  public state: RemoteState = {
    connected: false,
    remoteUrl: '',
    qrCode: ''
  };

  constructor(params: any, onAction?: (action: string) => void, onPreset?: (name: string) => void) {
    this.params = params;
    this.onAction = onAction;
    this.onPreset = onPreset;
    
    // Generate remote URL (use actual hostname, not localhost)
    const host = location.hostname === 'localhost' || location.hostname === '127.0.0.1' 
      ? this.getLocalNetworkIP() 
      : location.hostname;
    const port = location.port ? `:${location.port}` : '';
    this.state.remoteUrl = `http://${host}${port}/remote.html`;
    
    // Generate QR code locally (no external API call)
    this.generateQRCode();
  }

  private getLocalNetworkIP(): string {
    // Try to get local network IP via RTCPeerConnection
    try {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('');
      pc.createOffer().then(offer => pc.setLocalDescription(offer));
      
      pc.onicecandidate = (ice) => {
        if (!ice || !ice.candidate || !ice.candidate.candidate) return;
        const candidate = ice.candidate.candidate;
        const ipRegex = /([0-9]{1,3}\.){3}[0-9]{1,3}/;
        const match = ipRegex.exec(candidate);
        if (match) {
          const ip = match[0];
          if (!ip.startsWith('127.') && !ip.startsWith('0.')) {
            // Update URL and regenerate QR code with actual IP
            const port = location.port ? `:${location.port}` : '';
            this.state.remoteUrl = `http://${ip}${port}/remote.html`;
            this.generateQRCode();
          }
        }
        pc.onicecandidate = null;
        pc.close();
      };
    } catch (e) {
      console.warn('Could not determine local IP:', e);
    }
    return location.hostname;
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
      // Remote changed a parameter
      Object.assign(this.params, msg.data);
    } else if (msg.type === 'preset' && this.onPreset) {
      // Remote selected a preset
      this.onPreset(msg.data.name);
    } else if (msg.type === 'action' && this.onAction) {
      // Remote triggered an action
      this.onAction(msg.data.action);
    }
  }

  syncState() {
    // Send current state to remotes
    this.send({
      type: 'state',
      data: {
        mode: this.params.mode,
        bloom: this.params.bloom,
        exposure: this.params.exposure,
        speed: this.params.speed || this.params.trippySpeed || 1.0,
        paused: this.params.paused
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
