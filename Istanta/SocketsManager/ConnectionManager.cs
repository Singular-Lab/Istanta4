using System.Collections.Concurrent;
using System.Net.WebSockets;

namespace Istanta.SocketsManager
{
    public class ConnectionManager
    {
        private ConcurrentDictionary<string, WebSocket> _connections = new ConcurrentDictionary<string, WebSocket>();

        public WebSocket GetSocketById(string Id)
        {
            return _connections.FirstOrDefault(k => k.Key == Id).Value;

        }

        public ConcurrentDictionary<string, WebSocket> GetAllConnections()
        {
            return _connections;
        }

        public string GetId(WebSocket socket)
        {
            return _connections.FirstOrDefault(k => k.Value == socket).Key;
        }

        public async Task RemoveSocketAsync(string Id)
        {
            _connections.TryRemove(Id, out var socket);
            await socket!.CloseAsync(WebSocketCloseStatus.NormalClosure, "Socket connection closed", CancellationToken.None);
        }

        public void AddSocket(WebSocket socket)
        {
            _connections.TryAdd(GetConnectionId(), socket);
        }

        public string GetConnectionId()
        {
            return Guid.NewGuid().ToString("N");

        }
    }
}
