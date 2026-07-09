// EpiFingerprint — helper de captura de digital para o módulo EPI (SST-JCN).
//
// Usa o SDK .NET DPUruNet (DigitalPersona U.are.U) que JÁ está instalado com o
// RTE (o mesmo runtime que o sistema SGG usa). Captura UMA digital, extrai o
// FMD (feature set), calcula o SHA-256 e imprime como JSON no stdout — a
// BIOMETRIA É DESCARTADA (nada é salvo em disco). LGPD: só o hash sai, como
// token de integridade do ato de assinatura.
//
// Uso:
//   EpiFingerprint.exe --check    -> {"ok":true,"count":N}   (só enumera)
//   EpiFingerprint.exe            -> aguarda o dedo e imprime o hash
//
// Compilar (csc do .NET Framework):
//   csc /target:exe /platform:anycpu ^
//     /reference:"C:\Program Files\DigitalPersona\U.are.U RTE\Windows\Lib\DotNET\DPUruNet.dll" ^
//     /out:EpiFingerprint.exe EpiFingerprint.cs
// O DPUruNet.dll deve ficar ao lado do .exe em runtime; os DLLs nativos
// (dpfpdd.dll/dpfj.dll) vêm do System32 do RTE.

using System;
using System.Security.Cryptography;
using System.Text;
using DPUruNet;

internal static class EpiFingerprint
{
    // Cada tentativa espera um dedo por AttemptMs; repetimos até OverallSeconds.
    private const int AttemptMs = 10000;
    private const int OverallSeconds = 60;

    private static int Main(string[] args)
    {
        bool check = args.Length > 0 && args[0] == "--check";
        Reader reader = null;
        try
        {
            ReaderCollection readers = ReaderCollection.GetReaders();
            if (check)
            {
                int n = readers.Count;
                Out(true, null, null, null, null, n);
                return n > 0 ? 0 : 2;
            }

            if (readers.Count == 0)
            {
                Out(false, null, null, null, "Nenhum leitor de digital detectado.", 0);
                return 2;
            }

            reader = readers[0];
            // EXCLUSIVO por padrão: em máquinas com o DpHost (SGG) rodando, o modo
            // cooperativo não recebe o toque — o exclusivo toma o leitor durante a
            // captura e o devolve ao dar Dispose. --cooperative força o outro modo.
            Constants.CapturePriority prio = Array.IndexOf(args, "--cooperative") >= 0
                ? Constants.CapturePriority.DP_PRIORITY_COOPERATIVE
                : Constants.CapturePriority.DP_PRIORITY_EXCLUSIVE;
            Constants.ResultCode open = reader.Open(prio);
            if (open != Constants.ResultCode.DP_SUCCESS)
            {
                Out(false, null, null, null, "Falha ao abrir o leitor em " + prio + " (" + open + ").", 0);
                return 3;
            }

            int resolution = 500;
            if (reader.Capabilities != null && reader.Capabilities.Resolutions != null
                && reader.Capabilities.Resolutions.Length > 0)
            {
                resolution = reader.Capabilities.Resolutions[0];
            }

            // Captura em laço: cada tentativa (ordem confirmada por reflexão:
            // format, processing, timeout, resolution) espera um dedo; repete até
            // o prazo total, aceitando só leitura de BOA qualidade.
            CaptureResult cap = null;
            string ultimaQualidade = null;
            DateTime deadline = DateTime.UtcNow.AddSeconds(OverallSeconds);
            do
            {
                CaptureResult attempt = reader.Capture(
                    Constants.Formats.Fid.ANSI,
                    Constants.CaptureProcessing.DP_IMG_PROC_DEFAULT,
                    AttemptMs,
                    resolution);
                if (attempt != null)
                {
                    ultimaQualidade = attempt.Quality.ToString();
                    if (attempt.ResultCode == Constants.ResultCode.DP_SUCCESS
                        && attempt.Quality == Constants.CaptureQuality.DP_QUALITY_GOOD
                        && attempt.Data != null)
                    {
                        cap = attempt;
                        break;
                    }
                }
            } while (DateTime.UtcNow < deadline);

            if (cap == null)
            {
                Out(false, null, null, ultimaQualidade,
                    "Nenhuma leitura válida no tempo — encoste o dedo firmemente no leitor.", 0);
                return 4;
            }
            string qualidade = cap.Quality.ToString();

            DataResult<Fmd> fmd = FeatureExtraction.CreateFmdFromFid(cap.Data, Constants.Formats.Fmd.ANSI);
            if (fmd == null || fmd.ResultCode != Constants.ResultCode.DP_SUCCESS
                || fmd.Data == null || fmd.Data.Bytes == null)
            {
                Out(false, null, null, qualidade, "Falha ao extrair as características da digital.", 0);
                return 5;
            }

            string hash = Sha256Hex(fmd.Data.Bytes);
            string device = reader.Description != null && reader.Description.Name != null
                ? reader.Description.Name : "U.are.U";

            // A partir daqui a biometria (cap.Data / fmd.Data) é abandonada; nada é persistido.
            Out(true, hash, device, qualidade, null, 1);
            return 0;
        }
        catch (Exception e)
        {
            Out(false, null, null, null, e.Message, 0);
            return 1;
        }
        finally
        {
            if (reader != null)
            {
                try { reader.Dispose(); } catch { }
            }
        }
    }

    private static string Sha256Hex(byte[] data)
    {
        using (SHA256 sha = SHA256.Create())
        {
            byte[] h = sha.ComputeHash(data);
            StringBuilder sb = new StringBuilder(h.Length * 2);
            foreach (byte b in h) sb.Append(b.ToString("x2"));
            return sb.ToString();
        }
    }

    private static string Esc(string s)
    {
        if (s == null) return null;
        return s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", " ").Replace("\n", " ");
    }

    private static string J(string s)
    {
        return s == null ? "null" : "\"" + Esc(s) + "\"";
    }

    private static void Out(bool ok, string hash, string device, string quality, string error, int count)
    {
        Console.WriteLine(
            "{\"ok\":" + (ok ? "true" : "false")
            + ",\"fingerHash\":" + J(hash)
            + ",\"device\":" + J(device)
            + ",\"quality\":" + J(quality)
            + ",\"error\":" + J(error)
            + ",\"count\":" + count
            + "}");
    }
}
