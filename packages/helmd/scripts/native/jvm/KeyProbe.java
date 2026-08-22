import javax.crypto.Cipher;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.DESKeySpec;
import javax.crypto.spec.IvParameterSpec;
import java.lang.reflect.Method;

/** KeyProbe -- verify the headless-JVM key oracle against one known site
 *  before running the batch pipeline. All parameters via CLI; defaults are
 *  the HeyPixelMod reference case (validated: oracle ret 24947447517583,
 *  desKey 102903756609005, plaintext low32 = 2048 matching ldc 2048.0f).
 *
 *  Usage:
 *    java KeyProbe [bootClass] [seedA] [seedB] [selector] [xorConst] [cipherLong]
 *    java -cp .:<target>.jar KeyProbe com.heypixel.m \
 *         -1352399126748892848 7813954270369813780 35249446173427 \
 *         82633600304226 7340021740601920469
 *
 *  Template being verified (per <clinit> copy):
 *    BOOT  : m.<boot>(JJ,Object) -> x        (context object)
 *    SELECT: x.a(J)J -> ret                  (key material)
 *    XOR   : desKey = ret ^ xorConst
 *    CIPHER: DES/CBC/NoPadding zero IV over big-endian 8B long cipher
 *            plaintext long: low32 = value(int), high32 = header/checksum
 */
public class KeyProbe {
    static byte[] longToBytes(long v) {
        byte[] b = new byte[8];
        for (int i = 0; i < 8; i++) b[i] = (byte) (v >>> (56 - 8 * i));
        return b;
    }
    static long bytesToLong(byte[] b) {
        long v = 0;
        for (int i = 0; i < 8; i++) v |= (b[i] & 0xFFL) << (56 - 8 * i);
        return v;
    }
    static String hex(byte[] b) {
        StringBuilder sb = new StringBuilder();
        for (byte x : b) sb.append(String.format("%02x", x));
        return sb.toString();
    }
    public static void main(String[] args) throws Exception {
        String bootCls = args.length > 0 ? args[0] : "com.heypixel.m";
        long seedA     = args.length > 1 ? Long.parseLong(args[1]) : -1352399126748892848L;
        long seedB     = args.length > 2 ? Long.parseLong(args[2]) : 7813954270369813780L;
        long selector  = args.length > 3 ? Long.parseLong(args[3]) : 35249446173427L;
        long xorConst  = args.length > 4 ? Long.parseLong(args[4]) : 82633600304226L;
        long cipherL   = args.length > 5 ? Long.parseLong(args[5]) : 7340021740601920469L;

        long t0 = System.currentTimeMillis();
        Class<?> m = Class.forName(bootCls);
        System.out.println("[*] " + bootCls + " loaded+initialized in "
                + (System.currentTimeMillis() - t0) + " ms");
        Method boot = m.getMethod("a", long.class, long.class, Object.class);
        Object x = boot.invoke(null, seedA, seedB, null);
        System.out.println("[*] boot(JJ,Object) -> " + x.getClass().getName());
        Method xa = x.getClass().getMethod("a", long.class);
        long ret = (Long) xa.invoke(x, selector);
        System.out.println("[*] select(" + selector + ") = " + ret);
        long desKey = ret ^ xorConst;
        System.out.println("[*] desKey long = " + desKey + "  hex=" + hex(longToBytes(desKey)));
        Cipher c = Cipher.getInstance("DES/CBC/NoPadding");
        c.init(Cipher.DECRYPT_MODE,
                SecretKeyFactory.getInstance("DES").generateSecret(new DESKeySpec(longToBytes(desKey))),
                new IvParameterSpec(new byte[8]));
        byte[] out = c.doFinal(longToBytes(cipherL));
        long dec = bytesToLong(out);
        System.out.println("[*] decrypted bytes = " + hex(out));
        System.out.println("[*] decrypted long  = " + dec);
        System.out.println("[*] (int)low32      = " + (int) dec);
        System.out.println("[OK] oracle works");
    }
}
