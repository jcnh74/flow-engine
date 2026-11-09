// Remote control WebSocket client
// Syncs state with mobile remotes via relay server

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
    
    // Generate remote URL (use current host)
    const host = location.hostname || 'localhost';
    const port = location.port ? `:${location.port}` : '';
    this.state.remoteUrl = `http://${host}${port}/remote.html`;
    
    // Generate QR code URL (using a free QR code API)
    this.state.qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(this.state.remoteUrl)}`;
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
