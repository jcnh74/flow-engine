// WebSocket relay server for Flow Engine remote control
// Relays messages between main display and mobile remotes

const PORT = 3001;

interface Client {
  role: 'display' | 'remote' | 'unknown';
  socket: any;
}

const clients: Client[] = [];

function broadcast(message: any, exclude?: any) {
  const json = JSON.stringify(message);
  clients.forEach(client => {
    if (client.socket !== exclude && client.socket.readyState === 1) {
      try {
        client.socket.send(json);
      } catch (e) {
        console.error('Failed to send to client:', e);
      }
    }
  });
}

function broadcastToRemotes(message: any) {
  const json = JSON.stringify(message);
  clients.forEach(client => {
    if (client.role === 'remote' && client.socket.readyState === 1) {
      try {
        client.socket.send(json);
      } catch (e) {
        console.error('Failed to send to remote:', e);
      }
    }
  });
}

function broadcastToDisplay(message: any) {
  const json = JSON.stringify(message);
  clients.forEach(client => {
    if (client.role === 'display' && client.socket.readyState === 1) {
      try {
        client.socket.send(json);
      } catch (e) {
        console.error('Failed to send to display:', e);
      }
    }
  });
}

const server = Bun.serve({
  port: PORT,
  fetch(req, server) {
    if (server.upgrade(req)) {
      return; // WebSocket upgrade
    }
    return new Response('WebSocket relay server', { status: 200 });
  },
  websocket: {
    open(ws) {
      console.log('Client connected');
      const client: Client = { role: 'unknown', socket: ws };
      clients.push(client);
      (ws as any).data = client;
    },
    message(ws, message) {
      try {
        const msg = JSON.parse(message as string);
        const client = (ws as any).data as Client;
        
        if (msg.type === 'register') {
          client.role = msg.role || 'unknown';
          console.log(`Client registered as ${client.role}`);
          return;
        }
        
        // Relay messages based on source
        if (client.role === 'display') {
          // Display sends state updates to remotes
          broadcastToRemotes(msg);
        } else if (client.role === 'remote') {
          // Remote sends commands to display
          broadcastToDisplay(msg);
        }
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    },
    close(ws) {
      console.log('Client disconnected');
      const client = (ws as any).data as Client;
      const index = clients.indexOf(client);
      if (index > -1) {
        clients.splice(index, 1);
      }
    }
  }
});

console.log(`WebSocket relay server running on ws://localhost:${PORT}`);
console.log(`Clients: Display connects as 'display', Remotes connect as 'remote'`);
