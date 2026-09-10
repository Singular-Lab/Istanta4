// custom.d.ts
declare module '*?raw' {
  const content: string;
  export default content;
}

declare namespace SocketIOClient {
  interface ConnectOpts {
    withCredentials?: boolean;
  }
}
