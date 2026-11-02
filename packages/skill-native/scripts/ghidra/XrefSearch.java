// XrefSearch.java - Search for XREFs to a string or address
// Usage: analyzeHeadless project target -postScript XrefSearch.java "search_term"
// @category analysis

import ghidra.app.script.GhidraScript;
import ghidra.program.model.listing.*;
import ghidra.program.model.symbol.*;
import ghidra.program.model.address.*;
import ghidra.program.model.mem.*;
import java.io.*;
import java.util.*;

public class XrefSearch extends GhidraScript {
    @Override
    public void run() throws Exception {
        String outFile = "C:/tmp/ghidra_xrefs.txt";
        String search = "password";
        if (getScriptArgs().length > 0) search = getScriptArgs()[0];

        PrintWriter pw = new PrintWriter(new FileWriter(outFile));
        pw.println("XREF Search: " + search);
        pw.println("=".repeat(60));

        // Search strings
        int count = 0;
        Listing listing = currentProgram.getListing();
        Memory memory = currentProgram.getMemory();

        // Find string references
        for (Data data : listing.getDefinedData(true)) {
            if (data.hasStringValue()) {
                String val = data.getDefaultValueRepresentation();
                if (val.contains(search)) {
                    Address addr = data.getAddress();
                    pw.printf("%nString at 0x%x: %s%n", addr.getOffset(), val);
                    for (Reference ref : getReferencesTo(addr)) {
                        Address from = ref.getFromString();
                        Function f = getFunctionContaining(ref.getFrom());
                        String fname = f != null ? f.getName() : "unknown";
                        pw.printf("  <- 0x%x (%s)%n", ref.getFrom().getOffset(), fname);
                        count++;
                    }
                }
            }
        }
        pw.close();
        println("Found " + count + " XREFs for '" + search + "' -> " + outFile);
    }
}
