using System.Net.WebSockets;

namespace Istanta.SocketsManager
{
    public class SocketMiddleware
    {
        private readonly RequestDelegate _next;

        public SocketMiddleware(RequestDelegate next, SocketHandler handler)
        {
            _next = next;
            Handler = handler;
        }

        private SocketHandler Handler { get; set; }

        public async Task InvokeAsync(HttpContext context)
        {
            if (!context.WebSockets.IsWebSocketRequest)
                return;

            var socket = await context.WebSockets.AcceptWebSocketAsync();
            await Handler.OnConnected(socket);

            if (socket == null) return;

            await Receive(socket, async (result, buffer) =>
            {
                if (result.MessageType == WebSocketMessageType.Text)
                {
                    await Handler.Receive(socket, result, buffer);
                }
                else if (result.MessageType == WebSocketMessageType.Close)
                {
                    await Handler.OnDiconnected(socket);
                }
            });
        }

        private async Task Receive(WebSocket socket, Action<WebSocketReceiveResult, byte[]> messageHandler)
        {
            var buffer = new byte[1024 * 4];
            while (socket.State == WebSocketState.Open)
            {
                var result = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
                messageHandler(result, buffer);
            }
        }
    }
}
