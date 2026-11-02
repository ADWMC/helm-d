#!/usr/bin/env python3
"""Protocol State Machine - Infer state transitions from message log.

Usage:
    python protocol_state_machine.py messages.txt [output.dot]
"""
import sys
from collections import defaultdict

def infer_state_machine(messages):
    transitions = defaultdict(lambda: defaultdict(int))
    for i in range(len(messages) - 1):
        transitions[messages[i]][messages[i+1]] += 1
    return dict(transitions)

def generate_dot(transitions, output):
    with open(output, "w") as f:
        f.write("digraph ProtocolStateMachine {\n  rankdir=LR;\n  node [shape=circle];\n")
        for src, dsts in transitions.items():
            for dst, count in dsts.items():
                f.write(f'  "{src}" -> "{dst}" [label="{count}"];\n')
        f.write("}\n")
    print(f"DOT graph saved to {output}")

def main():
    if len(sys.argv) < 2:
        print("Usage: python protocol_state_machine.py messages.txt [output.dot]")
        sys.exit(1)
    messages = [line.strip() for line in open(sys.argv[1]) if line.strip()]
    transitions = infer_state_machine(messages)
    out = sys.argv[2] if len(sys.argv) > 2 else "state_machine.dot"
    generate_dot(transitions, out)
    for src, dsts in transitions.items():
        for dst, count in dsts.items():
            print(f"  {src} -> {dst} ({count}x)")

if __name__ == "__main__":
    main()
