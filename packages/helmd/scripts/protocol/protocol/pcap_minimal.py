#!/usr/bin/env python3
"""Minimal PCAP Parser - Parse pcap, extract TCP/UDP streams.

Usage:
    python pcap_minimal.py capture.pcap
"""
import sys, struct, socket

PCAP_MAGIC = 0xa1b2c3d4
PCAP_MAGIC_SWAPPED = 0xd4c3b2a1

def parse_pcap(filepath):
    with open(filepath, "rb") as f:
        magic = struct.unpack("<I", f.read(4))[0]
        swapped = magic in (PCAP_MAGIC_SWAPPED,)
        endian = "<" if not swapped else ">"
        f.read(20)  # skip rest of global header
        packets = []
        while True:
            hdr = f.read(16)
            if len(hdr) < 16: break
            ts_sec, ts_usec, incl_len, orig_len = struct.unpack(endian + "IIII", hdr)
            data = f.read(incl_len)
            if len(data) < incl_len: break
            packets.append({"ts": ts_sec + ts_usec/1e6, "data": data, "len": orig_len})
    return packets

def parse_ethernet(data):
    if len(data) < 14: return None, None, data
    ethtype = struct.unpack("!H", data[12:14])[0]
    if ethtype == 0x0800:  # IPv4
        return "IPv4", ethtype, data[14:]
    elif ethtype == 0x0806:  # ARP
        return "ARP", ethtype, data[14:]
    return f"0x{ethtype:04x}", ethtype, data[14:]

def parse_ipv4(data):
    if len(data) < 20: return None, None, None, None
    ver_ihl = data[0]
    ihl = (ver_ihl & 0xf) * 4
    protocol = data[9]
    src = socket.inet_ntoa(data[12:16])
    dst = socket.inet_ntoa(data[16:20])
    return src, dst, protocol, data[ihl:]

def parse_tcp(data):
    if len(data) < 20: return None, None, None
    src_port, dst_port = struct.unpack("!HH", data[0:4])
    seq = struct.unpack("!I", data[4:8])[0]
    doff = ((data[12] >> 4) & 0xf) * 4
    payload = data[doff:]
    return src_port, dst_port, payload

def parse_udp(data):
    if len(data) < 8: return None, None, None
    src_port, dst_port, length = struct.unpack("!HHH", data[0:6])
    return src_port, dst_port, data[8:length]

def main():
    if len(sys.argv) < 2:
        print("Usage: python pcap_minimal.py capture.pcap")
        sys.exit(1)
    packets = parse_pcap(sys.argv[1])
    print(f"Packets: {len(packets)}")
    streams = {}
    for pkt in packets:
        proto, _, payload = parse_ethernet(pkt["data"])
        if proto != "IPv4": continue
        src, dst, protocol, ip_payload = parse_ipv4(payload)
        if protocol == 6:  # TCP
            sp, dp, tcp_payload = parse_tcp(ip_payload)
            key = (src, sp, dst, dp)
            if key not in streams: streams[key] = b""
            streams[key] += tcp_payload
        elif protocol == 17:  # UDP
            sp, dp, udp_payload = parse_udp(ip_payload)
            key = (src, sp, dst, dp)
            if key not in streams: streams[key] = b""
            streams[key] += udp_payload
    print(f"\nStreams: {len(streams)}")
    for (src, sp, dst, dp), data in streams.items():
        proto = "TCP" if len(data) > 0 else "UDP"
        preview = data[:60].hex() if data else "(empty)"
        print(f"  {src}:{sp} -> {dst}:{dp}  {len(data)} bytes  {preview}")

if __name__ == "__main__":
    main()
