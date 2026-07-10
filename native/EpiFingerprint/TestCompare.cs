// Teste de comparação DPUruNet — captura DUAS digitais e compara.
// PROBABILITY_ONE = 0x7fffffff; limiar p/ FAR 1:100000 ≈ 21474 (score <= limiar => match).
using System;
using System.Text;
using DPUruNet;

internal static class TestCompare
{
    private const int OverallSeconds = 30;
    private const long ProbabilityOne = 0x7fffffff;
    private static readonly int Threshold = (int)(ProbabilityOne / 100000); // FAR 1:100000

    private static Fmd Capturar(Reader reader, int resolution, string rotulo)
    {
        Console.WriteLine("== " + rotulo + ": encoste o dedo ==");
        DateTime deadline = DateTime.UtcNow.AddSeconds(OverallSeconds);
        do
        {
            CaptureResult cap = reader.Capture(
                Constants.Formats.Fid.ANSI,
                Constants.CaptureProcessing.DP_IMG_PROC_DEFAULT,
                10000, resolution);
            if (cap != null && cap.ResultCode == Constants.ResultCode.DP_SUCCESS
                && cap.Quality == Constants.CaptureQuality.DP_QUALITY_GOOD && cap.Data != null)
            {
                DataResult<Fmd> f = FeatureExtraction.CreateFmdFromFid(cap.Data, Constants.Formats.Fmd.ANSI);
                if (f != null && f.ResultCode == Constants.ResultCode.DP_SUCCESS && f.Data != null)
                {
                    Console.WriteLine("   " + rotulo + " OK");
                    return f.Data;
                }
            }
        } while (DateTime.UtcNow < deadline);
        Console.WriteLine("   " + rotulo + " FALHOU (timeout)");
        return null;
    }

    private static int Main()
    {
        Reader reader = null;
        try
        {
            ReaderCollection readers = ReaderCollection.GetReaders();
            if (readers.Count == 0) { Console.WriteLine("Sem leitor"); return 2; }
            reader = readers[0];
            if (reader.Open(Constants.CapturePriority.DP_PRIORITY_EXCLUSIVE) != Constants.ResultCode.DP_SUCCESS)
            { Console.WriteLine("Falha ao abrir"); return 3; }
            int res = 500;
            if (reader.Capabilities != null && reader.Capabilities.Resolutions != null
                && reader.Capabilities.Resolutions.Length > 0)
                res = reader.Capabilities.Resolutions[0];

            Fmd a = Capturar(reader, res, "CAPTURA 1");
            if (a == null) return 4;
            System.Threading.Thread.Sleep(1500);
            Fmd b = Capturar(reader, res, "CAPTURA 2 (mesmo dedo)");
            if (b == null) return 4;

            Console.WriteLine("Limiar (match se score <=): " + Threshold);
            CompareResult self = Comparison.Compare(a, 0, a, 0);
            Console.WriteLine("Self-compare (esperado 0): score=" + self.Score + " rc=" + self.ResultCode);

            // round-trip serialização (o que será armazenado no banco)
            string xml = Fmd.SerializeXml(a);
            Fmd a2 = Fmd.DeserializeXml(xml);
            CompareResult rt = Comparison.Compare(a2, 0, b, 0);
            Console.WriteLine("XML size=" + xml.Length + " | round-trip vs captura2: score=" + rt.Score
                + " => " + (rt.Score >= 0 && rt.Score <= Threshold ? "MATCH" : "NAO"));

            CompareResult cmp = Comparison.Compare(a, 0, b, 0);
            Console.WriteLine("Compare captura1 x captura2 (mesmo dedo): score=" + cmp.Score
                + " => " + (cmp.Score >= 0 && cmp.Score <= Threshold ? "MATCH" : "NAO"));
            return 0;
        }
        catch (Exception e) { Console.WriteLine("ERRO: " + e); return 1; }
        finally { if (reader != null) try { reader.Dispose(); } catch { } }
    }
}
