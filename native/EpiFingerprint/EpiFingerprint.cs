// EpiFingerprint — helper nativo de biometria (DigitalPersona U.are.U) para o app desktop.
//
// ⚠️ REFERÊNCIA: precisa referenciar o DPUruNet.dll do RTE da DigitalPersona e ser
// compilado/testado NUMA MÁQUINA COM O LEITOR. A API abaixo segue o SDK DPUruNet;
// confira as assinaturas contra a versão do seu SDK e ajuste o THRESHOLD por testes.
//
// Contrato (stdout = JSON, uma linha):
//   EpiFingerprint.exe check                     -> {"ok":true,"disponivel":true|false}
//   EpiFingerprint.exe enroll                    -> {"ok":true,"template":"<base64>","qualidade":N}
//   EpiFingerprint.exe verify   (template base64 via STDIN) -> {"ok":true,"match":true|false,"score":N}
//
// GOTCHA (do SST-JCN): capturar em DP_PRIORITY_EXCLUSIVE — no modo cooperativo o DpHost
// do SGG segura o leitor e dá DP_QUALITY_TIMED_OUT.

using System;
using System.IO;
using DPUruNet;

class EpiFingerprint
{
    // Threshold de dissimilaridade: score MENOR = mais parecido. Ajuste por testes.
    // FAR-alvo ~1e-5 → threshold ≈ 0x7fffffff * 1e-5. Comece aqui e calibre.
    const int MATCH_THRESHOLD = (int)(0x7fffffff * 0.00001);
    const int CAPTURE_TIMEOUT_MS = 15000;

    static int Main(string[] args)
    {
        try
        {
            string mode = args.Length > 0 ? args[0].ToLowerInvariant() : "";
            switch (mode)
            {
                case "check":  return Check();
                case "enroll": return Enroll();
                case "verify": return Verify();
                default:
                    Out("{\"ok\":false,\"erro\":\"modo inválido (use check|enroll|verify)\"}");
                    return 1;
            }
        }
        catch (Exception e)
        {
            Out("{\"ok\":false,\"erro\":" + JsonStr(e.Message) + "}");
            return 1;
        }
    }

    static int Check()
    {
        var readers = ReaderCollection.GetReaders();
        bool disponivel = readers != null && readers.Count > 0;
        Out("{\"ok\":true,\"disponivel\":" + (disponivel ? "true" : "false") + "}");
        return 0;
    }

    static Reader OpenReader()
    {
        var readers = ReaderCollection.GetReaders();
        if (readers == null || readers.Count == 0) throw new Exception("Nenhum leitor de digital conectado.");
        var reader = readers[0];
        var r = reader.Open(Constants.CapturePriority.DP_PRIORITY_EXCLUSIVE);
        if (r != Constants.ResultCode.DP_SUCCESS) throw new Exception("Falha ao abrir o leitor (" + r + ").");
        return reader;
    }

    static Fmd CaptureFmd(Reader reader)
    {
        var cap = reader.Capture(Constants.Formats.Fid.ANSI, Constants.CaptureProcessing.DP_IMG_PROC_DEFAULT,
                                 CAPTURE_TIMEOUT_MS, reader.Capabilities.Resolutions[0]);
        if (cap == null || cap.ResultCode != Constants.ResultCode.DP_SUCCESS)
            throw new Exception("Captura falhou (" + (cap == null ? "null" : cap.ResultCode.ToString()) + ").");
        if (cap.Quality != Constants.CaptureQuality.DP_QUALITY_GOOD)
            throw new Exception("Qualidade insuficiente da digital (" + cap.Quality + ").");
        var dr = FeatureExtraction.CreateFmdFromFid(cap.Data, Constants.Formats.Fmd.ANSI);
        if (dr.ResultCode != Constants.ResultCode.DP_SUCCESS || dr.Data == null)
            throw new Exception("Extração da minúcia falhou (" + dr.ResultCode + ").");
        return dr.Data;
    }

    static int Enroll()
    {
        var reader = OpenReader();
        try
        {
            var fmd = CaptureFmd(reader);
            string b64 = Convert.ToBase64String(fmd.Bytes);
            Out("{\"ok\":true,\"template\":" + JsonStr(b64) + ",\"qualidade\":100}");
            return 0;
        }
        finally { try { reader.Dispose(); } catch { } }
    }

    static int Verify()
    {
        string templateB64 = (Console.In.ReadToEnd() ?? "").Trim();
        if (templateB64.Length == 0) { Out("{\"ok\":false,\"erro\":\"template não informado (stdin)\"}"); return 1; }
        byte[] enrolledBytes = Convert.FromBase64String(templateB64);
        Fmd enrolled = Importer.ImportFmd(enrolledBytes, Constants.Formats.Fmd.ANSI, Constants.Formats.Fmd.ANSI);

        var reader = OpenReader();
        try
        {
            var captured = CaptureFmd(reader);
            var cmp = Comparison.Compare(enrolled, 0, captured, 0);
            if (cmp.ResultCode != Constants.ResultCode.DP_SUCCESS)
                throw new Exception("Comparação falhou (" + cmp.ResultCode + ").");
            bool match = cmp.Score < MATCH_THRESHOLD;
            Out("{\"ok\":true,\"match\":" + (match ? "true" : "false") + ",\"score\":" + cmp.Score + "}");
            return 0;
        }
        finally { try { reader.Dispose(); } catch { } }
    }

    static void Out(string json) { Console.Out.Write(json); Console.Out.Flush(); }

    static string JsonStr(string s)
    {
        if (s == null) return "\"\"";
        var sb = new System.Text.StringBuilder("\"");
        foreach (char c in s)
        {
            switch (c)
            {
                case '"': sb.Append("\\\""); break;
                case '\\': sb.Append("\\\\"); break;
                case '\n': sb.Append("\\n"); break;
                case '\r': sb.Append("\\r"); break;
                case '\t': sb.Append("\\t"); break;
                default: sb.Append(c); break;
            }
        }
        return sb.Append('"').ToString();
    }
}
