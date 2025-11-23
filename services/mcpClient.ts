import { DebateTopic } from '../types';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: any;
  error?: { code: number; message: string };
}

export class MCPClient {
  private baseUrl: string;
  private eventSource: EventSource | null = null;
  private sessionEndpoint: string | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>();

  constructor(url: string = 'http://localhost:8000') {
    this.baseUrl = url;
  }

  public async getDebateTopic(): Promise<Omit<DebateTopic, 'id'>> {
    return new Promise((resolve, reject) => {
      this.connect((err) => {
          if (err) return reject(err);
          
          this.callTool('get_debate_topic', {})
            .then(result => {
                const contentItem = result.content.find((c: any) => c.type === 'text');
                if (!contentItem) throw new Error("No content in tool response");
                const topicData = JSON.parse(contentItem.text);
                this.cleanup();
                resolve(topicData);
            })
            .catch((e) => {
                this.cleanup();
                reject(e);
            });
      });
    });
  }

  public async listTools(): Promise<any[]> {
    return new Promise((resolve, reject) => {
        this.connect((err) => {
            if (err) return reject(err);

            this.sendRequest('tools/list', {})
                .then((result) => {
                    this.cleanup();
                    resolve(result.tools || []);
                })
                .catch((e) => {
                    this.cleanup();
                    reject(e);
                });
        });
    });
  }

  private connect(callback: (err?: Error) => void) {
      try {
        this.eventSource = new EventSource(`${this.baseUrl}/sse`);
      } catch (e) {
        return callback(new Error("Failed to create EventSource. Is the server running?"));
      }

      this.eventSource.onerror = () => {
        // Only trigger error if session hasn't been established yet or during handshake
        if (!this.sessionEndpoint) {
             this.cleanup();
             callback(new Error("Connection to MCP Server failed. Make sure 'fastmcp run mcp_server.py' is running on port 8000."));
        }
      };

      this.eventSource.addEventListener('endpoint', async (event) => {
        const sessionUrl = new URL(event.data, this.baseUrl).toString();
        this.sessionEndpoint = sessionUrl;
        
        try {
          await this.initializeSession();
          callback();
        } catch (error: any) {
          this.cleanup();
          callback(error);
        }
      });

      this.eventSource.onmessage = (event) => {
        const data: JsonRpcResponse = JSON.parse(event.data);
        if (data.id !== undefined && this.pendingRequests.has(data.id)) {
            const { resolve, reject } = this.pendingRequests.get(data.id)!;
            if (data.error) {
                reject(new Error(data.error.message));
            } else {
                resolve(data.result);
            }
            this.pendingRequests.delete(data.id);
        }
      };
  }

  private async initializeSession() {
    await this.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'debate-web-client', version: '1.0' }
    });
    await this.sendRequest('notifications/initialized', {});
  }

  private async callTool(name: string, args: any) {
      return this.sendRequest('tools/call', {
          name,
          arguments: args
      });
  }

  private async sendRequest(method: string, params: any): Promise<any> {
      if (!this.sessionEndpoint) throw new Error("Session not established");

      const id = this.requestId++;
      const request: JsonRpcRequest = {
          jsonrpc: '2.0',
          id,
          method,
          params
      };

      // Store promise resolvers
      const promise = new Promise((resolve, reject) => {
          this.pendingRequests.set(id, { resolve, reject });
      });

      // Send POST
      await fetch(this.sessionEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request)
      });

      return promise;
  }

  private cleanup() {
      if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
      }
      this.pendingRequests.clear();
      this.sessionEndpoint = null;
  }
}