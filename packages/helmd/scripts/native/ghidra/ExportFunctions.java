// ExportFunctions.java - Export all functions to CSV
// Usage: analyzeHeadless project target -postScript ExportFunctions.java [output.csv]
// @category analysis
// @menupath Analysis.Export Functions

import ghidra.app.script.GhidraScript;
import ghidra.program.model.listing.*;
import ghidra.program.model.symbol.*;
import java.io.*;

public class ExportFunctions extends GhidraScript {
    @Override
    public void run() throws Exception {
        String outFile = "C:/tmp/ghidra_functions.csv";
        if (getScriptArgs().length > 0) outFile = getScriptArgs()[0];

        FunctionManager fm = currentProgram.getFunctionManager();
        PrintWriter pw = new PrintWriter(new FileWriter(outFile));
        pw.println("address,name,size,calls,refs,external");

        for (Function f : fm.getFunctions(true)) {
            String name = f.getName();
            long addr = f.getEntryPoint().getOffset();
            int size = (int) f.getBody().getNumAddresses();
            int calls = f.getCallingConvention() != null ? 1 : 0;
            boolean ext = f.isExternal();
            pw.printf("0x%x,%s,%d,%d,%d,%s%n", addr, name, size, calls, 0, ext);
        }
        pw.close();
        println("Exported " + fm.getFunctionCount() + " functions to " + outFile);
    }
}
