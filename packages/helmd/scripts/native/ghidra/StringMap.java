// StringMap.java - Export all strings with their XREFs
// Usage: analyzeHeadless project target -postScript StringMap.java [output.csv]
// @category analysis

import ghidra.app.script.GhidraScript;
import ghidra.program.model.listing.*;
import ghidra.program.model.symbol.*;
import ghidra.program.model.address.*;
import java.io.*;

public class StringMap extends GhidraScript {
    @Override
    public void run() throws Exception {
        String outFile = "C:/tmp/ghidra_strings.csv";
        if (getScriptArgs().length > 0) outFile = getScriptArgs()[0];

        PrintWriter pw = new PrintWriter(new FileWriter(outFile));
        pw.println("address,string,xref_from,xref_func");
        Listing listing = currentProgram.getListing();
        int count = 0;
        for (Data data : listing.getDefinedData(true)) {
            if (data.hasStringValue()) {
                Address addr = data.getAddress();
                String val = data.getDefaultValueRepresentation().replace("\"", "'");
                for (Reference ref : getReferencesTo(addr)) {
                    Function f = getFunctionContaining(ref.getFrom());
                    String fname = f != null ? f.getName() : "";
                    pw.printf("0x%x,\"%s\",0x%x,%s%n",
                        addr.getOffset(), val, ref.getFrom().getOffset(), fname);
                    count++;
                }
            }
        }
        pw.close();
        println("Exported " + count + " string XREFs to " + outFile);
    }
}
