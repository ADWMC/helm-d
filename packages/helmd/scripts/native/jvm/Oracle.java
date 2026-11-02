import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.FileReader;
import java.io.FileWriter;
import java.lang.reflect.Method;

/** Oracle -- replay each site's selector sequence against the original
 *  string-decryptor class inside a headless JVM (no game/runtime env needed;
 *  precondition: decryptor class has zero environment dependencies -- verify
 *  with javap first: no Random/nanoTime/System.getenv in <clinit>).
 *
 *  Usage:
 *    java Oracle <in> <out> [bootClass] [bootMethod] [selectMethod]
 *  in : flatten_sites.py output, lines "id|seedA|seedB|sel1,sel2,..."
 *  out: "id|ret1,ret2,..."   (selectMethod(sel_i) return values, in order)
 *
 *  Defaults match the HeyPixelMod reference case:
 *    bootClass=com.heypixel.m  bootMethod=a  selectMethod=a
 *  Compile: javac Oracle.java   Run with the target jar on classpath:
 *    java -cp .:<target>.jar Oracle oracle_in.txt oracle_out.txt com.example.m
 */
public class Oracle {
    public static void main(String[] args) throws Exception {
        String inPath = args[0], outPath = args[1];
        String bootCls = args.length > 2 ? args[2] : "com.heypixel.m";
        String bootM   = args.length > 3 ? args[3] : "a";
        String selM    = args.length > 4 ? args[4] : "a";
        Class<?> m = Class.forName(bootCls);
        Method boot = m.getMethod(bootM, long.class, long.class, Object.class);
        Method xa = m.getMethod(selM, long.class);          // boot return implements selector

        BufferedWriter w = new BufferedWriter(new FileWriter(outPath));
        BufferedReader r = new BufferedReader(new FileReader(inPath));
        String line;
        int units = 0, fails = 0;
        while ((line = r.readLine()) != null) {
            if (line.isBlank()) continue;
            String[] p = line.split("\\|", -1);
            String id = p[0];
            long seedA = Long.parseLong(p[1]);
            long seedB = Long.parseLong(p[2]);
            try {
                Object x = boot.invoke(null, seedA, seedB, null);   // 3rd arg null OK if bytecode does ifnull
                StringBuilder sb = new StringBuilder(id).append('|');
                boolean first = true;
                for (String s : p[3].split(",")) {
                    if (s.isEmpty()) continue;
                    long sel = Long.parseLong(s);
                    long ret = (Long) xa.invoke(x, sel);
                    if (!first) sb.append(',');
                    sb.append(ret);
                    first = false;
                }
                w.write(sb.toString());
                w.newLine();
                units++;
            } catch (Exception e) {
                w.write(id + "|FAIL " + e.getClass().getSimpleName() + ": " + String.valueOf(e.getCause()));
                w.newLine();
                fails++;
            }
        }
        r.close(); w.close();
        System.out.println("[+] units ok=" + units + " fail=" + fails);
    }
}
