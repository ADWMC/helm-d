// DecompileAll.java - Decompile all functions and save to file
// Usage: analyzeHeadless project target -postScript DecompileAll.java [output.txt]
// @category analysis

import ghidra.app.script.GhidraScript;
import ghidra.program.model.listing.*;
import ghidra.program.decompile.*;
import ghidra.app.decompiler.*;
import java.io.*;

public class DecompileAll extends GhidraScript {
    @Override
    public void run() throws Exception {
        String outFile = "C:/tmp/ghidra_decompiled.txt";
        if (getScriptArgs().length > 0) outFile = getScriptArgs()[0];

        PrintWriter pw = new PrintWriter(new FileWriter(outFile));
        FunctionManager fm = currentProgram.getFunctionManager();
        DecompInterface decomp = new DecompInterface();
        decomp.openProgram(currentProgram);

        int total = 0, success = 0;
        for (Function f : fm.getFunctions(true)) {
            if (monitor.isCancelled()) break;
            total++;
            try {
                DecompiledResults res = decomp.decompileFunction(f, 10, monitor);
                if (res != null && res.decompileCompleted()) {
                    pw.println("// " + f.getName() + " @ 0x" + f.getEntryPoint());
                    pw.println(res.getDecompiledFunction().getC());
                    pw.println();
                    success++;
                }
            } catch (Exception e) {
                pw.println("// FAILED: " + f.getName() + " - " + e.getMessage());
            }
        }
        decomp.dispose();
        pw.close();
        println("Decompiled " + success + "/" + total + " functions to " + outFile);
    }
}
