using DocumentFormat.OpenXml.Spreadsheet;
using System.Net.WebSockets;
using System.Text;
using Istanta.SocketsManager;

namespace Istanta.Handlers
{
    public class WebSocketMessageHandler : SocketHandler
    {
        public WebSocketMessageHandler(ConnectionManager connections) : base(connections)
        {

        }

        public override async Task OnConnected(WebSocket socket)
        {
            await base.OnConnected(socket);
            var socketId = Connections.GetId(socket);
            await SendMessageToAll($"{socketId}");
        }


        public override async Task Receive(WebSocket socket, WebSocketReceiveResult result, byte[] buffer)
        {
            var socketId = Connections.GetId(socket);
            var message = $"{Encoding.UTF8.GetString(buffer, 0, result.Count)}";
            await SendMessageToAll(message);
        }
    }
}
