# Disclaimer and Terms of Use

> Last updated: 2026-11-02
> Applies to: the helm-d plugin and every artifact it ships (source, npm package, GitHub releases, references, prompts and build outputs).
> This document is not legal advice. Consult a qualified lawyer for formal advice.

> [!WARNING]
> This software contains offensive-security techniques, automation, prompts and AI-assisted content. **Use it only against assets you own or have explicit written authorization to test.** You bear full responsibility for what you do with it.

## 0. One line

Own assets, or authorized engagements within a written scope — that is the whole permitted surface.

## 1. Definitions

| Term | Meaning |
|---|---|
| Software | the helm-d plugin, its source, scripts, references, prompts, packages and generated artifacts |
| Authors | the maintainers and contributors of the project |
| You | any person or entity that installs, runs, copies, modifies or distributes the Software |
| Output | text, code, commands, reports, evidence and other artifacts produced by the Software or its runtime |

## 2. Your representations

By using the Software you represent and warrant that:

1. you have full legal capacity and understand the nature and risks of the Software;
2. you use it only against assets you own or have clear written authorization to test;
3. you have verified that your conduct complies with applicable law, industry rules and contractual obligations, and have obtained any required approvals;
4. you are not subject to applicable sanctions and are not located in an export-restricted jurisdiction;
5. you accept sole responsibility for every output, action and consequence of your use.

## 3. Permitted uses (examples)

- Authorized testing and analysis of your own systems, samples, firmware, APKs, binaries and protocols
- Authorized penetration testing, reverse engineering, malware analysis, incident response and forensics
- CTFs, lab ranges, teaching and internal training
- Security-product, detection-rule and hardening research
- Academic research that complies with your institution's rules

## 4. Prohibited uses

> [!CAUTION]
> None of the following is authorized, however it is framed — "research", "compliance", "teaching" or otherwise:

| Category | Conduct |
|---|---|
| Unauthorized access | intruding on, controlling or damaging third-party systems or data; bypassing access controls |
| Mass abuse | unauthorized scanning, denial of service, extortion, supply-chain poisoning |
| Malware | creating, distributing or commercializing malware; evading security products |
| Commercial infringement | circumventing licensing or billing to profit |
| Privacy harm | stalking, harassment, doxxing, unlawful collection of personal data |
| Serious crime | child sexual exploitation material; manufacture of weapons of mass destruction |
| Regulated conduct | violating export controls, sanctions, anti-money-laundering or other mandatory law |
| Downstream abuse | reselling, hosting or brokering the Software or its output for any of the above |

## 5. No warranty

The Software is provided "AS IS" and "AS AVAILABLE", without any express or implied warranty, including merchantability, fitness for a particular purpose, title, non-infringement, freedom from viruses, uninterrupted operation or accuracy of results. The Authors do not warrant that the Software is free of defects or vulnerabilities, or that it works with any particular host version, platform or model.

## 6. Limitation of liability

To the maximum extent permitted by law, the Authors are not liable for any direct, indirect, incidental, special, punitive or consequential damages, including loss or corruption of data, damage to systems or devices, business interruption, lost profits, reputational harm, third-party claims, administrative penalties or criminal liability — even if advised of the possibility of such damages.

Where liability cannot be excluded entirely, the Authors' aggregate liability for all claims is limited to the amount you actually paid for the Software, which is zero because it is distributed free of charge.

## 7. Indemnification

You agree to defend, indemnify and hold the Authors harmless from any claim, action, loss, liability, fine and expense (including reasonable legal fees) arising from:

1. your breach of any term in this document;
2. your violation of applicable law or third-party rights;
3. any harm caused by your use of the Software or its output.

## 8. Not official; trademarks

This is an independent third-party project. It is not affiliated with, sponsored, certified or endorsed by DeepSeek, DeepSeek Harness (dsh) or their maintainers. The names and marks of DeepSeek, GitHub and others belong to their respective owners and are used here only descriptively. Host upgrades may break the plugin or change its behaviour; the Authors are under no obligation to follow.

## 9. Output and AI-assisted content

- Output may be wrong, stale, incomplete or unsuitable for your environment; it is not legal, medical, financial, security or other professional advice.
- Some prompts, documents and code in the repository were produced with AI assistance and have not been reviewed line by line.
- You must independently verify correctness, safety and legality before acting — especially for commands, patches, exploit code and configuration changes.
- The evidence chain and `repro_cmd` guarantee reproducibility, not correctness.

## 10. Third-party components and licensing

- The project is released under `AGPL-3.0-or-later`; see [LICENSE](LICENSE).
- The `presets/boost.txt` tail block comes from [dsh-purge-community](https://github.com/kingcharleslzy-ai/dsh-purge) (MIT, © 2026 Jueze-2019) and remains MIT.
- Third-party articles, tools and snippets referenced under `references/` remain under their authors' licences; citation is not a sublicence.
- If you believe something infringes your rights, open an issue and we will verify, remove or correct it.

## 11. Data, files and network behaviour

The Software runs locally on your machine and its behaviour is auditable:

| Aspect | Detail |
|---|---|
| Writes | case directories (default `./helmd-cases/<date>-<name>/`), `$DSH_HOME/storages/helmd/` (active profile, case binding, team state, star state) and `$DSH_HOME/helmd-stream-intercept.log` (interception audit) |
| Reads | samples, logs and captures you provide, plus documents under `references/` |
| Network | two outbound purposes only: (1) update check against `api.github.com` and `registry.npmjs.org`; (2) star verification through GitHub's device flow, with the token discarded afterwards. The plugin itself never uploads case data, samples or evidence |

> [!NOTE]
> The host (dsh) sends conversation content to the model provider you configured — that is the host's existing behaviour, unrelated to this plugin. In regulated environments, assess that path yourself.

## 12. Security risks and operating advice

- The Software invokes a shell, runs commands and scripts you supply, may start child agents, and processes untrusted samples.
- Untrusted samples may escape, corrupt data or attack the host.
- Recommended: process samples in an isolated VM or container; back up first; keep a rollback point; avoid bulk write operations on production systems.

## 13. Export control and sanctions

The Software contains cryptographic code and security-testing techniques that may be subject to export-control and sanctions laws. You may not provide it or its derivatives to sanctioned countries, regions, entities or persons, nor use it for controlled purposes. Determining compliance and obtaining any licence is your responsibility.

## 14. Changes, severability, no waiver

- The Authors may update this document at any time; changes take effect when committed, and material changes are recorded in CHANGELOG.
- If any provision is held invalid or unenforceable, the remaining provisions stay in force.
- Failure to enforce a right is not a waiver of that right.

## 15. Key jurisdictions (EU / China / US)

> [!IMPORTANT]
> What follows is a **summary** of common legal exposure, not legal advice and not exhaustive. Whether conduct is unlawful depends on what you do, against what, with whose data, and where. Consult a local lawyer before use.

### 15.1 European Union / EEA

| Law | Relevance here |
|---|---|
| Directive 2013/40/EU on attacks against information systems | Member states criminalise illegal access, illegal system and data interference, and illegal interception; unauthorized scanning or intrusion can be an offence |
| GDPR (EU 2016/679) | Processing personal data needs a lawful basis; logs, accounts and chat records inside samples are in scope; cross-border transfers are restricted |
| NIS2 Directive (EU 2022/2555) | Essential and important entities must manage risk and report incidents; introducing security tooling into their networks must fit that governance |
| Cyber Resilience Act (EU 2024/2847) | In force 10 Dec 2024; vulnerability and incident reporting applies from 11 Sep 2026; full application from 11 Dec 2027. Embedding the Software in a product you place on the market may trigger its secure-design and vulnerability-handling duties |
| Product Liability Directive (EU 2024/2853) | Software counts as a "product"; defects causing damage may trigger strict liability; member states must transpose by 9 Dec 2026 |
| Dual-Use Regulation (EU 2021/821 | Encryption and network-surveillance technology may be dual-use; assess licensing before supplying to third countries |
| Consumer protection (93/13/EEC and others) | B2C disclaimers and liability caps face unfair-terms review and cannot exclude statutory rights |

### 15.2 China

| Law | Relevance here |
|---|---|
| Criminal Law art. 285(1)–(2) | Illegal intrusion into protected systems; illegally obtaining computer-system data; illegally controlling systems |
| Criminal Law art. 285(3) | **Providing** programs or tools specially designed for intruding into or illegally controlling computer information systems, or knowingly providing them to someone committing such an offence, is criminal when serious (see §18) |
| Criminal Law art. 286 | Damaging computer-system functions, data or applications; serious consequences are criminal |
| Criminal Law art. 287-2 | Knowingly providing technical support or assistance to cybercrime can constitute aiding information-network criminal activity |
| Cybersecurity Law (2025 amendment, effective 1 Jan 2026) | Operator security duties, log retention, vulnerability and incident reporting; harmful cybersecurity conduct is prohibited |
| Data Security Law | Data classification and grading; security assessment for outbound transfers of important data |
| Personal Information Protection Law | Minimal necessity, notice and consent, cross-border provision rules |
| Cryptography Law | The Software contains cryptographic implementations; commercial cryptography use, import/export and certification are regulated |
| Export Control Law | Supplying controlled cybersecurity technology abroad may require a licence |
| Counter-Espionage Law (2023 revision) | Activity touching state secrets or intelligence carries severe risk |
| Interim Measures for Generative AI Services | Using output in a public generative-AI service brings filing and content-safety duties |

### 15.3 United States

| Law | Relevance here |
|---|---|
| CFAA, 18 U.S.C. §1030 | Unauthorized access to a protected computer can be a federal crime; "authorization" is often defined by contracts and terms of service. DOJ's 2022 policy guidance favours good-faith security research but grants no immunity |
| DMCA §1201, 17 U.S.C. §1201 | Circumventing technological protection measures (including licence checks) is generally prohibited; the triennial exemptions include a narrow security-research carve-out and do not cover commercial circumvention |
| Export Administration Regulations, 15 CFR 730–774 | Encryption and network items may be controlled; publicly available open source usually benefits from an exception, but end use and destination still matter |
| OFAC sanctions, 31 CFR | Do not supply the Software to, or let it benefit, sanctioned persons, entities or regions |
| UCC §2-316 and state law | Warranty disclaimers must be conspicuous; some states disallow excluding consequential damages or limiting consumer rights |
| FTC Act §5 and state consumer-protection law | No deceptive statements; consumer-facing disclaimers face fairness review |

### 15.4 What the three have in common

- Unauthorized access, damage or data theft can be a **crime** in all three; "research" or "teaching" is not an automatic exemption.
- Exploit tooling, licence circumvention and evasion stack extra limits: DMCA §1201 in the US, the Cryptography Law and Export Control Law in China, the Dual-Use Regulation and CRA in the EU.
- Personal data may trigger GDPR, PIPL and US state privacy laws **at the same time**.
- Nothing in this document overrides mandatory law; where they conflict, the law prevails.

## 16. Governing law and disputes

Nothing here excludes mandatory law in your jurisdiction. Apart from the mandatory rules summarised in §15, disputes arising from or relating to the Software are governed by the laws of the People's Republic of China and submitted to the competent court at the Authors' location, unless mandatory rules where you reside require otherwise.

## 17. Contact

| Matter | Channel |
|---|---|
| Security issues / vulnerability reports | see [SECURITY.md](SECURITY.md) |
| Infringement or content concerns | [GitHub Issue](https://github.com/ADWMC/helm-d/issues) |
| Project home | <https://github.com/ADWMC/helm-d> |

## 18. Regional restriction (mainland China)

This project is **not distributed to, or promoted in, mainland China**.

- The Authors do not operate, promote or advertise in mainland China, and offer no mirror, community or commercial support channel there;
- Users in mainland China should not install, use or redistribute this project;
- Under Article 285(3) of the PRC Criminal Law, providing programs or tools **specially designed** for intruding into or illegally controlling computer information systems — or knowingly providing them to someone engaged in such an offence — is criminal where the circumstances are serious. The judicial interpretation tests whether the tool can bypass or break security measures to obtain data or exercise control without authorization, and sets thresholds such as twenty person-times, RMB 5,000 of proceeds or RMB 10,000 of loss;
- Article 27 of the PRC Cybersecurity Law separately prohibits providing programs or tools specially designed for activities that endanger cybersecurity;
- This statement does **not** withdraw any right granted by [LICENSE](LICENSE) — AGPL-3.0-or-later is not changed by a regional notice — but the Authors expressly do not distribute to or support that region and accept no liability for use there.

---

**Again**: this software is for authorized security work. Unauthorized use may be a crime, and you are responsible for your own conduct.
