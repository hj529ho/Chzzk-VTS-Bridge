declare module "socket.io-client" {
  interface Socket {
    connected: boolean;
    on(event: string, cb: (...args: any[]) => void): void;
    disconnect(): void;
  }

  interface ConnectOpts {
    reconnection?: boolean;
    "force new connection"?: boolean;
    timeout?: number;
    transports?: string[];
    [key: string]: unknown;
  }

  function io(url: string, opts?: ConnectOpts): Socket;
  export default io;
}
