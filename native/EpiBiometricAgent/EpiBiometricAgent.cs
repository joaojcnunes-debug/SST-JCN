// EpiBiometricAgent — companion local de biometria para o módulo EPI (SST-JCN).
//
// Servidor HTTP mínimo em http://127.0.0.1:52182 (TcpListener → sem admin),
// usando o DPUruNet (RTE DigitalPersona que o SGG já instala). Expõe:
//   GET  /status     -> { ok, count }                      (há leitor?)
//   POST /capturar   -> { ok, template(b64 XML), quality, device }   (ENROLL)
//   POST /verificar  body { template: b64 } -> { ok, match, score, quality }
//
// A captura é EXCLUSIVA (o DpHost do SGG segura o leitor em cooperativo).
// CORS + Private Network Access liberados para o site https chamar o localhost.
// LGPD: o template do colaborador vem do banco (cifrado) só para a comparação;
// o agente não persiste nada em disco.
//
// Compilar (csc do .NET Framework):
//   csc /target:exe /platform:anycpu ^
//     /reference:"C:\Program Files\DigitalPersona\U.are.U RTE\Windows\Lib\DotNET\DPUruNet.dll" ^
//     /out:EpiBiometricAgent.exe EpiBiometricAgent.cs

using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Sockets;
using System.Text;
using DPUruNet;

internal static class EpiBiometricAgent
{
    private const int Port = 52182;
    private const int AttemptMs = 10000;
    private const int OverallSeconds = 30;
    private const long ProbabilityOne = 0x7fffffff;
    // Limiar para FAR ~1:100000 (score <= limiar => match). Configurável por env.
    private static int _threshold = (int)(ProbabilityOne / 100000);

    private static readonly object ReaderLock = new object();

    private static int Main(string[] args)
    {
        try
        {
            string env = Environment.GetEnvironmentVariable("EPI_FAR");
            int far;
            if (!string.IsNullOrEmpty(env) && int.TryParse(env, out far) && far > 0)
                _threshold = (int)(ProbabilityOne / far);
        }
        catch { }

        TcpListener listener = new TcpListener(IPAddress.Loopback, Port);
        try { listener.Start(); }
        catch (Exception e)
        {
            Console.WriteLine("Falha ao abrir a porta " + Port + ": " + e.Message);
            return 1;
        }
        Console.WriteLine("EpiBiometricAgent ouvindo em http://127.0.0.1:" + Port + " (limiar=" + _threshold + ")");

        while (true)
        {
            TcpClient client = null;
            try
            {
                client = listener.AcceptTcpClient();
                Handle(client);
            }
            catch { /* mantém o loop vivo */ }
            finally { if (client != null) try { client.Close(); } catch { } }
        }
    }

    // ── HTTP mínimo ────────────────────────────────────────────────────────────
    private static void Handle(TcpClient client)
    {
        NetworkStream s = client.GetStream();
        s.ReadTimeout = 35000;

        string method, path;
        Dictionary<string, string> headers;
        string body;
        if (!ReadRequest(s, out method, out path, out headers, out body)) return;

        string origin = headers.ContainsKey("origin") ? headers["origin"] : "*";

        if (method == "OPTIONS") { WritePreflight(s, origin); return; }

        try
        {
            if (method == "GET" && path == "/status") { WriteJson(s, origin, Status()); return; }
            if (method == "POST" && path == "/capturar") { WriteJson(s, origin, Capturar()); return; }
            if (method == "POST" && path == "/verificar") { WriteJson(s, origin, Verificar(body)); return; }
            WriteJson(s, origin, "{\"ok\":false,\"error\":\"rota desconhecida\"}");
        }
        catch (Exception e)
        {
            WriteJson(s, origin, "{\"ok\":false,\"error\":" + JStr(e.Message) + "}");
        }
    }

    private static bool ReadRequest(NetworkStream s, out string method, out string path,
        out Dictionary<string, string> headers, out string body)
    {
        method = ""; path = ""; headers = new Dictionary<string, string>(); body = "";
        // lê até \r\n\r\n
        List<byte> buf = new List<byte>(2048);
        int b;
        int cl = 0;
        while (true)
        {
            b = s.ReadByte();
            if (b < 0) break;
            buf.Add((byte)b);
            int n = buf.Count;
            if (n >= 4 && buf[n - 4] == 13 && buf[n - 3] == 10 && buf[n - 2] == 13 && buf[n - 1] == 10)
                break;
            if (n > 65536) break;
        }
        string head = Encoding.ASCII.GetString(buf.ToArray());
        string[] lines = head.Split(new[] { "\r\n" }, StringSplitOptions.None);
        if (lines.Length == 0) return false;
        string[] rl = lines[0].Split(' ');
        if (rl.Length < 2) return false;
        method = rl[0].ToUpperInvariant();
        path = rl[1];
        for (int i = 1; i < lines.Length; i++)
        {
            int c = lines[i].IndexOf(':');
            if (c > 0)
            {
                string k = lines[i].Substring(0, c).Trim().ToLowerInvariant();
                string v = lines[i].Substring(c + 1).Trim();
                headers[k] = v;
                if (k == "content-length") int.TryParse(v, out cl);
            }
        }
        if (cl > 0)
        {
            byte[] bodyBuf = new byte[cl];
            int read = 0;
            while (read < cl)
            {
                int r = s.Read(bodyBuf, read, cl - read);
                if (r <= 0) break;
                read += r;
            }
            body = Encoding.UTF8.GetString(bodyBuf, 0, read);
        }
        return true;
    }

    private static void WritePreflight(NetworkStream s, string origin)
    {
        StringBuilder h = new StringBuilder();
        h.Append("HTTP/1.1 204 No Content\r\n");
        AppendCors(h, origin);
        h.Append("Access-Control-Max-Age: 86400\r\n");
        h.Append("Content-Length: 0\r\n");
        h.Append("Connection: close\r\n\r\n");
        byte[] bytes = Encoding.ASCII.GetBytes(h.ToString());
        s.Write(bytes, 0, bytes.Length);
    }

    private static void WriteJson(NetworkStream s, string origin, string json)
    {
        byte[] payload = Encoding.UTF8.GetBytes(json);
        StringBuilder h = new StringBuilder();
        h.Append("HTTP/1.1 200 OK\r\n");
        AppendCors(h, origin);
        h.Append("Content-Type: application/json; charset=utf-8\r\n");
        h.Append("Content-Length: " + payload.Length + "\r\n");
        h.Append("Connection: close\r\n\r\n");
        byte[] head = Encoding.ASCII.GetBytes(h.ToString());
        s.Write(head, 0, head.Length);
        s.Write(payload, 0, payload.Length);
    }

    private static void AppendCors(StringBuilder h, string origin)
    {
        // Reflete a origem (o site https na Vercel + previews). Sem credenciais.
        h.Append("Access-Control-Allow-Origin: " + (string.IsNullOrEmpty(origin) ? "*" : origin) + "\r\n");
        h.Append("Vary: Origin\r\n");
        h.Append("Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n");
        h.Append("Access-Control-Allow-Headers: Content-Type\r\n");
        h.Append("Access-Control-Allow-Private-Network: true\r\n");
    }

    // ── Biometria (DPUruNet) ────────────────────────────────────────────────────
    private static string Status()
    {
        lock (ReaderLock)
        {
            try
            {
                ReaderCollection readers = ReaderCollection.GetReaders();
                return "{\"ok\":true,\"count\":" + readers.Count + "}";
            }
            catch (Exception e) { return "{\"ok\":false,\"count\":0,\"error\":" + JStr(e.Message) + "}"; }
        }
    }

    private static Fmd CapturarFmd(out string quality, out string device)
    {
        quality = null; device = "U.are.U";
        ReaderCollection readers = ReaderCollection.GetReaders();
        if (readers.Count == 0) throw new Exception("Nenhum leitor detectado.");
        Reader reader = readers[0];
        try
        {
            if (reader.Open(Constants.CapturePriority.DP_PRIORITY_EXCLUSIVE) != Constants.ResultCode.DP_SUCCESS)
                throw new Exception("Falha ao abrir o leitor.");
            if (reader.Description != null && reader.Description.Name != null) device = reader.Description.Name;
            int res = 500;
            if (reader.Capabilities != null && reader.Capabilities.Resolutions != null
                && reader.Capabilities.Resolutions.Length > 0)
                res = reader.Capabilities.Resolutions[0];

            DateTime deadline = DateTime.UtcNow.AddSeconds(OverallSeconds);
            do
            {
                CaptureResult cap = reader.Capture(
                    Constants.Formats.Fid.ANSI,
                    Constants.CaptureProcessing.DP_IMG_PROC_DEFAULT, AttemptMs, res);
                if (cap != null)
                {
                    quality = cap.Quality.ToString();
                    if (cap.ResultCode == Constants.ResultCode.DP_SUCCESS
                        && cap.Quality == Constants.CaptureQuality.DP_QUALITY_GOOD && cap.Data != null)
                    {
                        DataResult<Fmd> f = FeatureExtraction.CreateFmdFromFid(cap.Data, Constants.Formats.Fmd.ANSI);
                        if (f != null && f.ResultCode == Constants.ResultCode.DP_SUCCESS && f.Data != null)
                            return f.Data;
                    }
                }
            } while (DateTime.UtcNow < deadline);
            throw new Exception("Leitura não concluída — encoste o dedo firmemente.");
        }
        finally { try { reader.Dispose(); } catch { } }
    }

    private static string Capturar()
    {
        lock (ReaderLock)
        {
            string quality, device;
            Fmd fmd = CapturarFmd(out quality, out device);
            string xml = Fmd.SerializeXml(fmd);
            string b64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(xml));
            return "{\"ok\":true,\"template\":" + JStr(b64)
                + ",\"quality\":" + JStr(quality) + ",\"device\":" + JStr(device) + "}";
        }
    }

    private static string Verificar(string body)
    {
        string b64 = ExtractJson(body, "template");
        if (string.IsNullOrEmpty(b64)) return "{\"ok\":false,\"error\":\"template ausente\"}";
        Fmd enrolled;
        try
        {
            string xml = Encoding.UTF8.GetString(Convert.FromBase64String(b64));
            enrolled = Fmd.DeserializeXml(xml);
        }
        catch { return "{\"ok\":false,\"error\":\"template inválido\"}"; }

        lock (ReaderLock)
        {
            string quality, device;
            Fmd fresh = CapturarFmd(out quality, out device);
            CompareResult cmp = Comparison.Compare(enrolled, 0, fresh, 0);
            bool match = cmp.ResultCode == Constants.ResultCode.DP_SUCCESS
                         && cmp.Score >= 0 && cmp.Score <= _threshold;
            string fingerHash = fresh.Bytes != null ? Sha256Hex(fresh.Bytes) : null;
            return "{\"ok\":true,\"match\":" + (match ? "true" : "false")
                + ",\"score\":" + cmp.Score + ",\"threshold\":" + _threshold
                + ",\"finger_hash\":" + JStr(fingerHash)
                + ",\"quality\":" + JStr(quality) + ",\"device\":" + JStr(device) + "}";
        }
    }

    // ── util ─────────────────────────────────────────────────────────────────────
    // Extrai o valor string de uma chave JSON simples (valor sem aspas internas — base64).
    private static string ExtractJson(string json, string key)
    {
        if (string.IsNullOrEmpty(json)) return null;
        string needle = "\"" + key + "\"";
        int i = json.IndexOf(needle, StringComparison.Ordinal);
        if (i < 0) return null;
        i = json.IndexOf(':', i + needle.Length);
        if (i < 0) return null;
        int q1 = json.IndexOf('"', i + 1);
        if (q1 < 0) return null;
        int q2 = json.IndexOf('"', q1 + 1);
        if (q2 < 0) return null;
        return json.Substring(q1 + 1, q2 - q1 - 1);
    }

    private static string Sha256Hex(byte[] data)
    {
        using (System.Security.Cryptography.SHA256 sha = System.Security.Cryptography.SHA256.Create())
        {
            byte[] h = sha.ComputeHash(data);
            StringBuilder sb = new StringBuilder(h.Length * 2);
            foreach (byte b in h) sb.Append(b.ToString("x2"));
            return sb.ToString();
        }
    }

    private static string JStr(string s)
    {
        if (s == null) return "null";
        StringBuilder sb = new StringBuilder(s.Length + 2);
        sb.Append('"');
        foreach (char c in s)
        {
            if (c == '"' || c == '\\') { sb.Append('\\'); sb.Append(c); }
            else if (c == '\n') sb.Append(" ");
            else if (c == '\r') sb.Append(" ");
            else sb.Append(c);
        }
        sb.Append('"');
        return sb.ToString();
    }
}
