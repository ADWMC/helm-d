# JVM Mod 常量加密 — Oracle 重放解密工作流

> 适用：Minecraft Forge/Java mod、桌面 Java 应用里"常量池内嵌 DES 解密器 + 类拷贝模板"型混淆。
> 核心思路：不逆向表驱动 PRNG，让原版代码在 headless JVM 里替你算 key。
> 案例基准：HeyPixelMod（Forge 1.20.1，81MB，1128 类）—— long 密文家族 100% 打穿，
> 数字全部保留在文末作为验证基准。脚本在 `scripts/native/jvm/`。

---

## 1. 特征速查（何时走这条流程）

| 特征 | 阈值/模式 | 含义 |
|---|---|---|
| zip 条目大小写冲突对 | ≥1 | i/I 混淆，Windows 直接解压必炸 → 全程 zip 流式、不落地 |
| 类名纯 `[Ii]+` 且长≥40 | count | i/I 混淆类 |
| 类名含码点>0x7F emoji | count | emoji 混淆类（modified UTF-8 surrogate pairs） |
| 常量池含 `DESKeySpec`+`IvParameterSpec`+`DES/CBC/NoPadding` | 同类共现 | 内嵌解密器模板；候选多=模板被复制进 N 个类 |
| `ldc2_w; ldc2_w; MethodHandles.lookup...invokestatic <m>.a(JJObject)x` | 字节码模式 | BOOT 引导 |
| 最近 `ldc2_w` 后接 `invokeinterface x.a:(J)J` | 字节码模式 | SELECTOR |
| manifest `MixinConfigs` + mods.toml forge 47 | 静态 | Forge 1.20.1 mod 身份 |

Stage-1 用 `scripts/native/jvm/scan_jar.py` 一把出：分类 + 冲突对 + crypto 指纹。

## 2. 流程骨架

> 侦察（zip 流式，防大小写冲突）→ 指纹定位解密器类 → javap 解剖出
> BOOT/SELECT/XOR/CIPHER 四元组模板 → 探测零环境依赖（Random/nanoTime/getenv 缺席）
> → headless JVM 直调原版解密器求 key（probe 单点验证）→ 纯 Python 常量提取 +
> 字节码模式匹配批量出站点 → oracle 重放配对 → DES 本地解密 → probe 对拍验证
> → 惰性家族按边界收手。

## 3. 四元组模板（javap -c -p 解剖产物）

每个混淆类的 `<clinit>` 持有一份拷贝：

```text
1. BOOT   : ldc2_w A; ldc2_w B; MethodHandles.lookup().lookupClass();
            invokestatic <boot>.a(JJ,Object) -> x     ← 造解密上下文
2. SELECT : ldc2_w S; invokeinterface x.a(J)J        ← 取 key 材料
            内部: ret = core(state,8,55,e[],k[]); state ^= S ^ d
3. XOR    : ldc2_w X; lxor                           ← desKey = ret ^ X
4. CIPHER : ldc2_w C; 拆大端 8B;
            Cipher("DES/CBC/NoPadding", 零IV).doFinal
            → 明文 long：低32=业务值(int)，高32=混淆头/校验
```

**关键判定**：
- `<boot>` 零环境依赖（无 Random/nanoTime/System/getenv）→ headless JVM 直调可行。
  这是整条流程的前提，先用 javap 确认再动手。
- mixin 家族走直接 new（状态独立），不走共享表 → 单进程批处理安全，类间无状态污染。
- root 家族若见 `ldc "ISO-8859-1 二进制串"` + `substring+getBytes` + **indy bootstrap**
  （`(Lookup, MutableCallSite, String, Object[])` 签名）→ 惰性 3-stage 解密，静态不可解，
  见 §6 边界判定。

## 4. 批量管线

| 步 | 脚本 (`scripts/native/jvm/`) | 输入 → 输出 |
|---|---|---|
| ① 常量提取 | `extract_sites.py` | jar → sites.json（boot 对 / selector 链 / 字符串密文） |
| ② 拍平 | `flatten_sites.py` | sites.json → oracle_in.txt（行格式 `id\|A\|B\|sel,...`） |
| ③ 求钥 | `Oracle.java` | oracle_in → oracle_out.txt（headless JVM 直调） |
| ④ 解密 | `decrypt_sites.py` | oracle_out + sites → plain_sites.txt |

单点验证先行：`KeyProbe.java` 用最小混淆类的已知常量实测一遍，对上反编译里的明文
（如某 float 字段的 ldc 值）再跑批量。

### 调用链（helmd runSeam）

```
scan_jar    : python scripts/native/jvm/scan_jar.py <jar> <out_dir>
extract     : python scripts/native/jvm/extract_sites.py <jar> sites.json [boot_desc] [sel_name]
flatten     : python scripts/native/jvm/flatten_sites.py sites.json oracle_in.txt
compile/run : javac Oracle.java && java -cp .:<target>.jar Oracle in.txt out.txt <bootClass>
decrypt     : python scripts/native/jvm/decrypt_sites.py sites.json oracle_out.txt plain.txt   # pip install pycryptodome
```

`extract_sites.py` 的 boot_desc/sel_name 可传参适配其他目标族；
`Oracle.java` 的 bootClass/bootMethod/selectMethod 也是 CLI 参数，默认值为案例基准。

### 实现坑位（写批处理必抄）

- 纯 Python class 解析：常量池后 **fields 表必须先于 methods 表消费**
  （漏掉 → 方法表错位 → 0 命中静默失败）
- 只识别这些 opcode 即可覆盖模板扫描：ldc(0x12)/ldc_w(0x13)/ldc2_w(0x14)/
  invokestatic(0xb8)/invokevirtual(0xb6)/invokeinterface(0xb9)/lxor(**0x83**)
  —— lxor≠0x85，那是 lcmp！一字节之差曾造成 17/803 配对率的假象
- tableswitch(0xaa)/lookupswitch(0xab)：操作数 4 字节对齐 `base=(i+4)&~3`，
  必须防 lo>hi 负跳转死循环（i 倒退）
- wide(0xc4)：仅 iinc(0x84) 是 6 字节，其余 4 字节
- per-method try 容错，单方法坏不丢整类
- decrypt 配对：chain 按 offset 排序 ↔ oracle rets 同序配对；
  key = ret ^ xor 大端 8B；密文 long 大端 8B；DES-CBC-NoPadding 零 IV

## 5. Oracle 直调要点

- `boot(JJ,Object)` 第三参传 null 通常可行——字节码里是 `ifnull` 跳过 Vector.add。
  若 FAIL NullPointerException 占比高，回 javap 看第三参真实用途。
- 少量单元失败是常态（案例 83/90），先看整体覆盖率，别卡单个异常。
- JVM 启动一次批量处理所有单元，不要每站点起进程。

## 6. 边界判定（工程边界，不是失败）

字符串家族尝试直接解 → 乱码时，判定链条：

1. root 类 `<clinit>` 只把密文注册进全局表（如 `Uq(String[])`），
   真正解密发生在 indy bootstrap 的大方法里，惰性触发；
2. key 推导是 3-stage（形如 `n2 = n ^ (int)(finalKey & 0x7FFF) ^ K`），参数/状态敏感；
3. 结论：不硬刚，保留运行时原解密器。long 密文家族已打穿即可交付，
   字符串家族占比小且不影响运行分析时尤其如此。

判定素材用 `decrypt_str.py`：输出乱码本身就是边界证据。

## 7. 工具搭配

| 阶段 | 工具 | 说明 |
|------|------|------|
| 侦察 | `triage_artifact` / `hash_artifact` / `scan_strings` | 常规分诊先行 |
| Stage-1 | `scripts/native/jvm/scan_jar.py` | 分类+指纹一把出 |
| Stage-2 | `javap -c -p`（JDK 自带） | 解剖四元组，无第三方依赖 |
| Stage-3/4 | `KeyProbe.java` / `Oracle.java` | headless JVM 直调 |
| 反编译交叉印证 | garlic / jadx | 快速反编译对照明文常量 |
| 报告 | `create_case` / `evidence_reference` | 存证与报告模板 |

## 8. 案例基准（验证数字，供对拍）

| 项 | 值 |
|---|---|
| 目标 | HeyPixelMod 1.0-SNAPSHOT，Forge 1.20.1（loaderVersion [47,)） |
| 体量 | 81MB jar，10,858 条目；主包 906 类；mixin 90 类 |
| 类名分布 | 782 emoji / 198 i-I confusable / 148 正常；195 对大小写冲突 |
| DES 指纹 | 570 类同时含 Cipher+DESKeySpec+IvParameterSpec（模板复制） |
| probe | seeds (-1352399126748892848, 7813954270369813780)；sel 35249446173427 → ret 24947447517583；xor 82633600304226 → desKey 102903756609005；cipher 7340021740601920469 → 明文 low32=2048 ↔ 反编译 ldc 2048.0f ✓ |
| 批量 | 684 类 / 90 boot 对 / 803 selector 链 / 1008 字符串密文，提取 0 错误 |
| oracle | 83/90 成功（0.15s），7 个待查占 7.8% |
| 解密 | 81 块 long 密文全解，干净值样本：5/8/9/187/256/342/1000/131077/2048/20000000 |
