# Standing research: trust and transparency developments (principle, Bob 6 Nov 2026)

Principle (Bob, 6 Nov 2026): "CivicSmith tracks trust and transparency developments, starting with the EU AI Act, and adopts them voluntarily where they serve readers." CivicSmith is not bound by EU rules. This is the first entry, written by a read-only research worker for the `publication` design lane.

- **Date read:** 2026-11-06. Every source below was read on 2026-11-06 unless the entry says otherwise.
- **Status of this entry:** research only. Every "adopt / watch / not applicable" below is a suggestion. Each adoption is BOB's decision.
- **Not legal advice.** Nothing here says whether any law applies to Civicsmith. One scope point is flagged in section 1.6 for BOB.

## Summary table

| # | Development | Jurisdiction / body | Status and date (as of 2026-11-06) | What it asks | Relevance to Civicsmith | Suggestion |
|---|---|---|---|---|---|---|
| 1 | EU AI Act Art 50 (Reg. (EU) 2024/1689) | EU | In force. Art 50 applies from **2 Aug 2026** (Art 113). | (1) tell people they are talking to an AI; (2) providers mark synthetic output machine-readably and make it detectable; (3) emotion/biometric notice; (4) deployers disclose deep fakes, and disclose AI text published "to inform the public on matters of public interest" unless it was human-reviewed or under editorial control **and** someone holds editorial responsibility; (5) shown clearly, at the latest at first exposure. | Civicsmith cases are the kind of text 50(4) names. Its model (human review, then ratify, sign and publish) is the same as the 50(4) exception. | **Adopt voluntarily** the 50(4) exception's conditions as a published standard, plus a first-exposure disclosure (50(5)). |
| 2 | Digital Omnibus on AI (Reg. (EU) 2026/1744) | EU | **Adopted** 8 Jul 2026, published OJ 24 Jul 2026, in force 27 Jul 2026. | Leaves Art 50 dates alone except a 4-month transition: providers with systems on the market before 2 Aug 2026 have until **2 Dec 2026** for 50(2) marking. Rewrites 50(7) (codes assessed as adequate rather than approved by implementing act). Delays high-risk rules to Dec 2027 / Aug 2028. | Upstream model providers' text watermarking becomes due 2 Dec 2026, and may then show up in AI text Civicsmith's tools produce. | **Watch** (2 Dec 2026). |
| 3 | Code of Practice on Transparency of AI-Generated Content | European Commission / AI Office (independent chairs) | **Final**, published 10 Jun 2026 (drafts 17 Dec 2025, 3 Mar 2026). Commission and AI Board found it "an adequate voluntary tool". About 190 signatories by end of July 2026. | Providers: at least two marking layers (signed metadata plus imperceptible watermark); for free-form text, a watermark alone suffices; optional logging; free detection. Deployers: an "AI" icon or equivalent label at first exposure; for text, at the top, by the headline or in the colophon, or on the AI part only. **Commitment 4:** a written human-review/editorial policy, a named editorially responsible person with published contact details, and optionally a record of "the nature of the review or the type of involvement of the AI system". | Commitment 4 is close to a ready-made public policy for Civicsmith's ratification step. The EU icon is free to use. | **Adopt** Commitment 4's elements as a voluntary public policy. **Watch** the icons' planned interactive second layer (provenance data). |
| 4 | Commission Guidelines on Art 50 (C(2026) 7702 final) | European Commission | Published 20 Jul 2026. Formal Communication dated **5 Nov 2026**, page updated 5 Nov 2026. Non-binding. | Defines "public interest" (includes "public administration and services", "the administration of justice") and human review ("deliberate examination of the substance… Fact-checking… is a minimum requirement"). Says superficial checks, "automated review processes or cursory editorial approval" do not qualify. Substantive AI changes after sign-off void the exception. The responsible person's identity and contact details should be easy to find. | The clearest public test of whether Civicsmith's human review is real. The "AI changes after sign-off" rule fits signing: a signature fixes the text that was reviewed. | **Adopt** as the bar for the ratification step and for the disclosure wording. |
| 5 | C2PA Content Credentials 2.x (spec 2.5, Oct 2026) | C2PA (industry standards body) | 2.5 published Oct 2026. 2.4 (Apr 2026) added HTML and structured-text embedding and `c2pa.ai-disclosure`. 2.5 added `c2pa.reviewed`. ISO track: ISO/DIS 22144 (draft, stage not verified). | Signed manifests with `c2pa.actions` (`c2pa.created`/`c2pa.edited`/`c2pa.reviewed`…) carrying an IPTC `digitalSourceType`. Text-range "regions of interest". `c2pa.ai-disclosure` with `humanOversightLevel` (`fully_autonomous` / `prompt_guided` / `human_validated`). Embedding for HTML, Markdown and unstructured text (Unicode variation selectors, "under review"). | Gives a standard machine-readable way to say per passage "AI-drafted, human-validated", inside a signed record that peer groups can verify. | **Adopt** the vocabulary (actions, digitalSourceType, text regions) as a mapping target for per-passage provenance. **Watch** full C2PA embedding and trust-list signing. |
| 6 | IPTC Digital Source Type vocabulary | IPTC (news standards body) | Live controlled vocabulary, released 2024-10-23. | URIs for `trainedAlgorithmicMedia`, `compositeWithTrainedAlgorithmicMedia`, `algorithmicallyEnhanced`, `humanEdits`, `digitalCreation`, `compositeSynthetic` and others. | The common term set used by C2PA, Google and others. It does not cover "human-reviewed AI text" by itself. | **Adopt** URIs as tags on passages, alongside Civicsmith's own review states. |
| 7 | W3C PROV-O | W3C | Recommendation, 30 Apr 2013 (stable). | Entity/Activity/Agent model: `wasGeneratedBy`, `wasAttributedTo`, `wasDerivedFrom`, `actedOnBehalfOf`, `SoftwareAgent`, `wasRevisionOf`. | Fits an internal or exported audit chain ("passage P generated by tool T acting on behalf of member M, revised by M, approved by group G"). Little reader-facing value. | **Watch / optional** (export format for peer verifiers). |
| 8 | California AI Transparency Act (SB 942, amended by AB 853, Ch. 674, Stats. 2025) | California, US | Operative **2 Aug 2026** (covered providers). Large online platforms and GenAI hosting platforms from **1 Jan 2027**; capture devices from **1 Jan 2028**. | Covered GenAI providers (>1,000,000 monthly users): free detection tool, plus latent and optional manifest disclosures in **image, video, audio**. Platforms surface provenance data. | Text is outside the core duties. Civicsmith is not a covered provider at its scale. Relevant to images or audio in case evidence (camera provenance from 2028). | **Not applicable** to text; **watch** for evidence media provenance (2027/2028). |
| 9 | China: Measures for Labelling AI-Generated Synthetic Content + GB 45438-2025 | CAC with MIIT, MPS, NRTA | Issued 14 Mar 2025; in force **1 Sep 2025**. | Explicit labels (text: at the beginning, middle or end; kept in saved files) and implicit labels (metadata: provider name, content ID). Platforms sort content into confirmed, possible or suspected AI. Ban on removing labels. | A model of explicit plus implicit labels. The "possible/suspected" grading is a cautionary example for readers. Not otherwise applicable. | **Not applicable** (reference only). |
| 10 | AP generative-AI standards | Associated Press | Original Aug 2023; reported update Jul 2026 (secondary sources only). | Reported: AI may draft headlines, summarise, transcribe and translate; humans keep reporting, sourcing and verification; **disclosure when gen AI "plays a material role"**; no gen-AI news photos. | The US newsroom norm Civicsmith readers are most likely to know. Civicsmith's disclosure should not fall below it. | **Adopt** the "material role → disclose" threshold (verify the primary text first). |
| 11 | Reuters | Reuters / Thomson Reuters | Trust Principles (1941); AI newsroom guidance via secondary reports only. | Reported: transparency about how content is made; treat AI-supplied facts as unverified tips; no gen-AI news imagery. | The "AI output = unverified tip" framing fits evidence handling. | **Watch** (primary source not reached). |
| 12 | Partnership on AI, Responsible Practices for Synthetic Media | PAI | Framework 27 Feb 2023 (a "living" document), plus case studies and glossary. | "Direct" (reader-facing label) and "indirect" (provenance, metadata, watermark) disclosure, used together. | Supports a two-layer design: a short reader label plus signed per-passage provenance. | **Adopt** as design vocabulary. |
| 13 | Paris Charter on AI and Journalism | RSF + 16 partners | Published 10 Nov 2023. | 10 principles. Includes #2 human agency, #4 "always accountable for the content they publish", #5 transparency in use of AI, #6 "content origin and traceability", #7 clear line between authentic and synthetic content. | Matches the "human-reviewed and ratified, AI as a tool" framing and per-passage traceability. | **Adopt** as cited principles. |
| 14 | JournalismAI (LSE Polis) | Polis / LSE | Not verified this pass. | A resource and training network, not a standard (from prior knowledge, unverified). | Low. | **Watch** (verify). |
| 15 | NIST AI 100-4, Reducing Risks Posed by Synthetic Content | NIST (US) | Final, Nov 2024. | An overview of provenance, watermarking, metadata and detection, including text. | A neutral US reference on techniques. Not an obligation. | **Watch** (reference). |
| 16 | CAWG identity assertions / C2PA "Human and Organizational Identity Recommendation" | Creator Assertions WG (DIF) / C2PA | C2PA 2.4 recommends CAWG specs. CAWG identity assertion v1.1 (1.2 not found). | Binds a named person or organisation to a C2PA manifest (Organizational Identity Profile). | Could let a member group's signature be expressed as a C2PA identity, readable by peer verifiers. | **Watch**. |

## 1. EU AI Act Article 50 (Regulation (EU) 2024/1689)

Source: EUR-Lex, OJ L 2024/1689, https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202401689 (read 2026-11-06; text extracted from the official HTML).

### 1.1 Text, verbatim (key parts)

- **50(1)** "Providers shall ensure that AI systems intended to interact directly with natural persons are designed and developed in such a way that the natural persons concerned are informed that they are interacting with an AI system, unless this is obvious from the point of view of a natural person who is reasonably well-informed, observant and circumspect…"
- **50(2)** "Providers of AI systems, including general-purpose AI systems, generating synthetic audio, image, video or text content, shall ensure that the outputs of the AI system are marked in a machine-readable format and detectable as artificially generated or manipulated. Providers shall ensure their technical solutions are effective, interoperable, robust and reliable as far as this is technically feasible, taking into account the specificities and limitations of various types of content, the costs of implementation and the generally acknowledged state of the art, as may be reflected in relevant technical standards. This obligation shall not apply to the extent the AI systems perform an assistive function for standard editing or do not substantially alter the input data provided by the deployer or the semantics thereof, or where authorised by law to detect, prevent, investigate or prosecute criminal offences."
- **50(3)** "Deployers of an emotion recognition system or a biometric categorisation system shall inform the natural persons exposed thereto of the operation of the system…"
- **50(4), first subparagraph (deep fakes)** "Deployers of an AI system that generates or manipulates image, audio or video content constituting a deep fake, shall disclose that the content has been artificially generated or manipulated." (Limited disclosure for evidently artistic, creative, satirical or fictional work.)
- **50(4), second subparagraph (text)** "Deployers of an AI system that generates or manipulates text which is published with the purpose of informing the public on matters of public interest shall disclose that the text has been artificially generated or manipulated. This obligation shall not apply where the use is authorised by law to detect, prevent, investigate or prosecute criminal offences or where the AI-generated content has undergone a process of human review or editorial control and where a natural or legal person holds editorial responsibility for the publication of the content."
- **50(5)** "The information referred to in paragraphs 1 to 4 shall be provided to the natural persons concerned in a clear and distinguishable manner at the latest at the time of the first interaction or exposure. The information shall conform to the applicable accessibility requirements."
- **50(6)** keeps Chapter III and other Union or national transparency law unaffected. **50(7)** concerns codes of practice; the omnibus has since replaced it (see 1.4).
- **Recital 133** names the techniques: "watermarks, metadata identifications, cryptographic methods for proving provenance and authenticity of content, logging methods, fingerprints or other techniques".
- **Recital 134** repeats the text exception and asks that deep fakes be labelled "clearly and distinguishably".

### 1.2 Application date

Art 113: "It shall apply from 2 August 2026", subject to listed exceptions. None of those exceptions concerns Art 50, so Art 50 applies from **2 August 2026** (same source).

### 1.3 Digital omnibus: outcome as of today (adopted)

Source: Regulation (EU) 2026/1744 of 8 July 2026, OJ L 2026/1744, 24.7.2026, https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202601744 (read 2026-11-06, official text).

- **Status:** adopted and in force. Art 4 of 2026/1744: it enters into force "on the third day following that of its publication", which is **27 July 2026**. Several commentaries put political agreement on 7 May 2026, the EP vote on 16 Jun 2026 and Council adoption on 29 Jun 2026. These are secondary sources only (e.g. https://fpf.org/blog/the-ai-act-implementation-timeline-what-changes-under-the-ai-omnibus/, https://www.joneswalker.com/en/insights/blogs/ai-law-blog/yes-august-2-still-matters-the-eu-approved-a-high-risk-ai-delay-but-most-trans.html) and are not verified against the procedure file.
- **The Art 50 change is narrow.** A new Art 111(4) reads: "Providers of AI systems, including general-purpose AI systems, generating synthetic audio, image, video or text content, that have been placed on the market before 2 August 2026 shall take the necessary steps in order to comply with Article 50(2) by 2 December 2026." Recital 38 calls this "a transitional period of four months". Art 50(1), (3), (4) and (5) are not delayed.
- **Art 50(7) is replaced.** The Commission now encourages codes "regarding the detection, marking and labelling of artificially generated or manipulated content" and "shall assess whether adherence to those codes of practice is adequate to ensure compliance with the obligations laid down in paragraphs 2 and 4". The implementing-act approval route is dropped (recital 41: such codes "do not grant a presumption of conformity").
- **Other changes (context only):** high-risk Chapter III now applies from 2 Dec 2027 (Annex III) and 2 Aug 2028 (Annex I) under the amended Art 113(c). New Art 5 prohibitions (points (ba), (bb)) apply from 2 Dec 2026.
- The Commission's Art 50 guidelines (para 153) confirm the reading: the transition covers marking under Art 50(2) only, and interaction disclosure is due from 2 Aug 2026.

### 1.4 Things in the guidelines that bear on Civicsmith (see section 2.2)

- Para 154: text "published before 2 August 2026" need not be labelled retroactively, but older AI text published on or after that date must be.

### 1.5 What would serve Civicsmith readers (voluntary)

- **Serves readers:** taking the 50(4) exception's two conditions as Civicsmith's own published standard, namely (i) substantive human review or editorial control and (ii) a named person or body that holds editorial responsibility. The ratifying group, or Civicsmith itself, would be named, with contact details findable. This is what Civicsmith already intends ("human-reviewed and ratified, AI as a tool"), and it gives readers a known external benchmark.
- **Serves readers:** 50(5)'s "clear and distinguishable… at the latest at the time of the first … exposure", plus accessibility. This directly supports a first-exposure disclosure on every published case.
- **Serves readers:** even where the exception would apply, keep a short honest disclosure. The exception removes a *duty* to label. It does not stop a voluntary label, and readers of civic investigations benefit from knowing AI was used as a tool.
- **Does not serve readers:** treating 50(2) watermarking as Civicsmith's own job. 50(2) is a *provider* duty, and Civicsmith deploys models rather than providing them. Statistical watermarks in reviewed and edited case text add nothing a reader can check, and they degrade on editing. Civicsmith's signed per-passage provenance is the better form of "machine-readable" for its readers.

### 1.6 Flag for BOB (not a conclusion)

Art 2(1)(c) says the Act applies to "providers and deployers of AI systems that have their place of establishment or are located in a third country, where the output produced by the AI system is used in the Union". The lane's premise is that Civicsmith is not bound. Whether EU readers of a published case would change that is a legal question this research does not answer. Adopting the 50(4) conditions voluntarily would in any case match what the rule asks.

## 2. Code of Practice on transparency of AI-generated content, and the Art 50 Guidelines

### 2.1 Code of Practice (final)

Sources (read 2026-11-06):
- Code page: https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content
- Publication news, 10 Jun 2026: https://digital-strategy.ec.europa.eu/en/news/commission-publishes-code-practice-marking-and-labelling-ai-generated-content
- Final code PDF (38 pp.): https://ec.europa.eu/newsroom/dae/redirection/document/129555
- Press release IP/26/1328: https://ec.europa.eu/commission/presscorner/detail/en/ip_26_1328 (not opened)

**Status and timeline.** First draft 17 Dec 2025, second draft 3 Mar 2026, final 10 Jun 2026. The text read here is **final, not a draft**. The code page states the Commission and AI Board confirmed "the code is an adequate voluntary tool" and that about 190 organisations signed by end July 2026 (the signatory list is at https://digital-strategy.ec.europa.eu/en/news/strong-backing-code-practice-transparency-ai-generated-content, not opened). It "does not replace the AI Act or the Commission's guidelines on Article 50 AI Act."

**Section 1, providers (marking and detection):**
- Measure 1.1: "at least two layers of machine-readable marking". Sub-measure 1.1.1 is "Digitally signed metadata": information recorded on whether the content is AI-generated or manipulated, "digitally signed and time-stamped". Sub-measure 1.1.2 is "Imperceptible watermarking".
- For text specifically: "given that free-form text cannot transport metadata, a single-layer of marking as described in Sub-measure 1.1.2 is considered sufficient … for this specific type of content." Text "longer than 200 tokens" must still be watermarked. "Very short text" (under about 200 tokens) is exempt from watermarking. "Containerised text" (inside PDF, Word and similar) can carry metadata.
- Sub-measure 1.1.3 (optional) is fingerprinting or logging: "direct logging may be appropriate for text content".
- Measure 1.3 (optional) covers richer provenance: AI system name, provider name, timestamp, and optionally model identifier and version. For manipulated content it records "the type of operations performed".
- Detection: free detection interfaces. Detection results should say "whether they are based on a metadata marking, a watermark marking, forensic detection or other techniques". Signed downloadable detection results "including at least a hash".

**Section 2, deployers (labelling deep fakes and published text):**
- Commitment 1, Measure 1.1: an EU icon or equivalent label whose main element is "the capitalised acronym 'AI'". An optional second layer says "modified" or "generated". It must be accessible (WCAG 2.1 / EN 301 549 encouraged).
- Measure 1.2.2(f), text placement: "For published text, Signatories will place the icon or equivalent label, for example above or at the top of the text, near the headline of the text, or in the colophon at the beginning of the text… Where appropriate, Signatories may label only that part of the text which is AI-generated or manipulated."
- Measure 2.3: channels for third parties (fact-checkers, researchers) to flag missing or incorrect labels, and timely remedy.
- **Commitment 4, "Human Review and Editorial Control for Published Text":** non-media signatories "commit to establish, adapt, or maintain appropriate policies for human review or editorial control prior to publication". These include "(a) The identification of the natural or legal person with editorial responsibility (name, role and contact details)" and "(b) An overview of the concrete organisational measures as well as human resources… This does not entail having to document individual instances of human review". Signatories "commit to publish the contact details" of the responsible function or person, and "may record additional information on the nature of the review or the type of involvement of the AI system in the published text."
- Annex 1 sets out the EU icons: "AI + GENERATED" (fully generated), "AI + MODIFIED" (partly modified), and a basic icon for an interactive layer. They are free to use "without the need for attribution". User testing found that variants with a text label performed "significantly better". A task force "will explore the integration of an interactive second layer … with provenance data".

**What would serve Civicsmith readers:**
- **Serves:** Commitment 4 as a published Civicsmith policy: who holds editorial responsibility for each case (the ratifying group, named, with contact), what review consists of, and a per-case record of "the type of involvement of the AI system". Civicsmith can go further than the code by recording review *per passage*, since its signed documents already support that.
- **Serves:** "label only that part of the text which is AI-generated" matches per-passage provenance.
- **Serves:** a flag-a-missing-label channel (Measure 2.3) fits peer-group verification.
- **Possibly serves:** the EU "AI" icon, as a recognisable mark next to the first-exposure disclosure. Note that US readers will not know it. "AI + GENERATED" would *misdescribe* ratified Civicsmith text. If the icon is used at all, the basic icon with Civicsmith's own second layer ("AI-assisted, human-reviewed and ratified") is the honest variant. This is BOB's design call.
- **Does not serve:** provider-side watermarking or detection APIs (not Civicsmith's role); deep-fake placement rules (unless cases carry AI-altered media, which is not expected).

### 2.2 Commission Guidelines on Article 50

Sources (read 2026-11-06):
- Page: https://digital-strategy.ec.europa.eu/en/library/guidelines-transparency-obligations-providers-and-deployers-ai-systems (published 20 Jul 2026, last updated 5 Nov 2026)
- English PDF: https://ec.europa.eu/newsroom/dae/redirection/document/131215. The cover reads "Brussels, 5.11.2026, C(2026) 7702 final, COMMUNICATION FROM THE COMMISSION". These are final, non-binding guidelines. Some secondary sources say formal adoption was awaited "once all language versions are available". The 5 Nov 2026 Communication appears to be that formal adoption (inferred from the cover; not confirmed in a separate notice).

Key passages (verbatim):
- Standard editing (para 90): "Standard editing should be understood as the process of preparing existing content for publication or distribution (e.g., small edits to improve readability and grammar, quality and format) and does not involve generating new content." Examples exempt from 50(2) include "Grammar correction and spellchecking… AI-generated translations of text".
- Public interest (para 131(iii)): "topics on politics and democratic processes, public administration and services, the administration of justice and law enforcement, the protection of fundamental rights, public security, public health, environmental protection, consumer safety…". In-scope examples include an "AI-generated summary of a human-authored article on a newspaper's website discussing a recent decision by a town council."
- Human review (para 134): "Human review refers to the deliberate examination of the substance of the content by one or more natural persons possessing relevant knowledge and professional judgement… Fact-checking the accuracy of the content is a minimum requirement that should be part of that review."
- What does not count (para 135): "Superficial, solely formal or procedural checks (e.g. spell-checking or grammatical correction), the mere existence of an editorial policy, automated review processes or cursory editorial approval without substantive engagement … cannot fulfil the conditions".
- After sign-off (para 136): "Any substantive AI intervention occurring after the human review or editorial control process has taken place will therefore cause the exception to become void."
- Editorial responsibility (para 138): "the identity and contact details of the legal person, the natural person or the function with editorial responsibility should be made publicly available on an easily findable location… Offline, such information can be included in a publication's colophon".
- A non-qualifying example: "AI-generated articles that are reviewed and edited by another AI system and where a human editor performs a mere superficial, grammatical check before publication."

**Fit for Civicsmith:**
- **Serves:** paras 134–136 give a concrete public bar for "human-reviewed". Civicsmith's ratification can state that it meets it: substantive review, fact-checking against cited public records, and no AI change after signing (the signature makes para 136 checkable by anyone).
- **Serves:** para 138's colophon placement, i.e. a named ratifying group and contact on each case.
- **Caution:** AI-on-AI review (an AI critic checking an AI draft) does not count as human review under para 135. Civicsmith's disclosure should not imply it does.

## 3. Technical provenance standards for text in a signed document

### 3.1 C2PA Content Credentials 2.x

Sources (read 2026-11-06):
- C2PA spec 2.5 (Oct 2026): https://spec.c2pa.org/specifications/specifications/2.5/specs/C2PA_Specification.html
- 2.2 (May 2025): https://spec.c2pa.org/specifications/specifications/2.2/specs/C2PA_Specification.html

**Versions** (from the 2.5 version history): 2.2 May 2025, 2.3 Dec 2025, 2.4 Apr 2026, 2.5 Oct 2026.

**AI and machine-learning related actions and fields:**
- Every standard manifest starts with exactly one `c2pa.created` or `c2pa.opened` action. An action may carry `digitalSourceType`, which "shall be one of the terms defined by the IPTC or a C2PA specific value". C2PA adds `http://c2pa.org/digitalsourcetype/empty` and `http://c2pa.org/digitalsourcetype/trainedAlgorithmicData` (for data outputs such as CSV).
- Spec example: an AI-generated asset has `c2pa.created` with `digitalSourceType` = `http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia`, a `softwareAgent`, and ingredients for the inputs (e.g. prompts or source files).
- 2.4 added `digitalSourceType` on ingredients that have no manifest of their own. This suits marking a source record or a model output pulled into a case.
- **2.5 added `c2pa.reviewed`:** "Content was read and assessed without modification. Records that a review occurred at a specific point in provenance." It also added `c2pa.modified` and `c2pa.rendered`, and deprecated `c2pa.removed` in favour of `c2pa.deleted`.
- **2.4 added the AI Disclosure assertion `c2pa.ai-disclosure`:** model type, name and identifier, and a `contentProfile.humanOversightLevel` enum: `"fully_autonomous" / "prompt_guided" / "human_validated"`. The spec maps these: `trainedAlgorithmicMedia` + `fully_autonomous` = "Pure AI generation, no human review"; `trainedAlgorithmicMedia` + `prompt_guided` = "AI generation guided by human prompts"; `compositeWithTrainedAlgorithmicMedia` + `human_validated` = "AI edits applied and reviewed/approved by a human editor prior to release". Several fields are still "pending further specification".
- The "Training & Data Mining" assertion was removed from core C2PA in 2.0 (per the 2.2 history). CAWG maintains a training-and-data-mining assertion repository (not reviewed).

**How it treats text:**
- PDF, Office, EPUB: embedding and "regions of interest for text-based formats" (since 1.4).
- **HTML** embedding (2.4, A.7), and **structured text** (2.4, A.9): "markup (Markdown, AsciiDoc, LaTeX)" through an ASCII-armour delimited block with a data-hash hard binding. 2.5 extends this to RSS, Atom and WebVTT, and adds append-only text (logs, JSON Lines) with chained segment hashes.
- **Unstructured text** (A.8): the manifest is encoded in Unicode variation selectors in a `C2PATextManifestWrapper` (magic "C2PATXT\0"). The spec says it "should only be used with unstructured text assets where no other embedding method is feasible. It remains under review and may be subject to change."
- **Per-passage regions** (16.9.2.2.5 "Textual"): "A text object defines a range using a one or more URL fragment identifiers, as defined by the W3C Web Annotation fragment selector… It may also refine the range using offsets". This lets an assertion apply to one passage.

**Identity:** C2PA's "Human and Organizational Identity Recommendation" (https://spec.c2pa.org/specifications/specifications/2.4/identity/identity.html, read 2026-11-06) "recommends the use of the Creator Assertions Working Group (CAWG) specifications", including the "Organizational Identity Profile for Content Credentials". The DIF progress report mentions CAWG identity assertion v1.1 (https://blog.identity.foundation/progress-report-from-the-creator-assertions-wg/). A version 1.2 was not found.

**ISO:** ISO/DIS 22144 "Authenticity of Information – Content Credentials" is a draft on the fast track. iso.org returned 403 to this reader, so the current stage is **not verified** (secondary: https://www.dinmedia.de/en/draft-standard/iso-dis-22144/388357458).

**Fit:**
- **Serves:** using C2PA's *vocabulary* in Civicsmith's own signed case format. Per passage: an action (`c2pa.created` with `trainedAlgorithmicMedia`, or `c2pa.edited` with `compositeWithTrainedAlgorithmicMedia`, then `c2pa.reviewed`), a text region selector, and an `ai-disclosure` with `humanOversightLevel: human_validated`. Peer groups and outside tools would then read the same terms.
- **Watch:** emitting real C2PA manifests (HTML or structured-text embedding) alongside Civicsmith's signatures. The benefit is that third-party Content Credentials verifiers could check cases. The costs are C2PA trust-list or conformance-program certificates, and the fact that the text embeddings are new (2.4/2.5) and the unstructured method is "under review".
- **Does not serve:** Unicode-variation-selector embedding in case text. It is invisible, fragile in copy, accessibility and search, and the spec marks it as under review.

### 3.2 IPTC Digital Source Type vocabulary

Source: https://cv.iptc.org/newscodes/digitalsourcetype/ (JSON fetched 2026-11-06; scheme `dateReleased` 2024-10-23).

| URI (prefix `http://cv.iptc.org/newscodes/digitalsourcetype/`) | Label | Definition (IPTC) |
|---|---|---|
| `trainedAlgorithmicMedia` | Created using Generative AI | "Digital media created algorithmically using an Artificial Intelligence model trained on captured content" |
| `compositeWithTrainedAlgorithmicMedia` | Edited using Generative AI | "Augmentation, correction or enhancement using a Generative AI model, such as with inpainting or outpainting operations" |
| `compositeSynthetic` | Composite including generative AI elements | "Mix or composite of several elements, at least one of which is Generative AI" |
| `algorithmicallyEnhanced` | Algorithmically-altered media | "Modification or correction by algorithm without changing the main content of the media, initiated or configured by a human, such as sharpening or applying noise reduction" |
| `humanEdits` | Human-edited media | "Augmentation, correction or enhancement by one or more humans using non-generative tools" |
| `digitalCreation` | Digital creation | "Media created by a human using non-generative tools" |
| `algorithmicMedia` | Pure algorithmic media | not based on sampled training data |
| `dataDrivenMedia` | Data-driven media | "Digital media representation of data via human programming or creativity" |
| `composite`, `compositeCapture`, `digitalCapture`, `computationalCapture`, `negativeFilm`, `positiveFilm`, `print`, `screenCapture`, `virtualRecording` | capture and composite types | (see source) |
| retired: `minorHumanEdits`, `softwareImage`, `digitalArt` | — | retired 2022/2024 |

**Fit:**
- The vocabulary is written for media. It applies to text by analogy: `digitalCreation` (human-written), `trainedAlgorithmicMedia` (AI-drafted), `compositeWithTrainedAlgorithmicMedia` (human text edited by AI), `algorithmicallyEnhanced` (spell or grammar fix only), `dataDrivenMedia` (tables rendered from records).
- It has **no term for "human-reviewed"**. Review must be recorded separately, as a C2PA `c2pa.reviewed` action, an `ai-disclosure.humanOversightLevel`, or Civicsmith's own ratification record.
- **Suggestion: adopt** the URIs as per-passage source tags. Do not show them raw to readers.

### 3.3 W3C PROV-O

Source: https://www.w3.org/TR/prov-o/ (W3C Recommendation, 30 April 2013; read 2026-11-06).

The core terms are `prov:wasGeneratedBy`, `prov:wasAttributedTo`, `prov:wasDerivedFrom` (with subproperty `prov:wasRevisionOf`), `prov:actedOnBehalfOf` (delegation: "one agent is accountable to another") and `prov:SoftwareAgent`.

**Fit:** expresses well that an AI tool (SoftwareAgent) acted on behalf of a member, under a group that ratified. It is a reasonable export format for peer verifiers or researchers. Readers see no value in it. **Watch / optional.**

### 3.4 A standard vocabulary for human-written, AI-assisted, AI-drafted, human-reviewed text?

No single standard was found that covers all four states for text. The nearest pieces:
- IPTC digitalSourceType: origin (human vs gen-AI vs AI-edited).
- C2PA 2.4 `ai-disclosure.humanOversightLevel` (`fully_autonomous` / `prompt_guided` / `human_validated`) and the 2.5 `c2pa.reviewed` action: review.
- EU Code Annex 1 "GENERATED" vs "MODIFIED": reader-facing two-way split.
- Code Commitment 4: "the nature of the review or the type of involvement of the AI system" (free form).

Suggested Civicsmith mapping (for BOB to decide):

| Civicsmith state | IPTC | C2PA | Reader label (example) |
|---|---|---|---|
| Human-written | `digitalCreation` | `c2pa.created` | (none) |
| AI-assisted (spelling, format, translation) | `algorithmicallyEnhanced` | `c2pa.edited` | (covered by the case-level disclosure) |
| AI-drafted, human-edited | `compositeWithTrainedAlgorithmicMedia` | `c2pa.edited` + `ai-disclosure` | "AI-drafted, human-reviewed" |
| AI-drafted, unchanged | `trainedAlgorithmicMedia` | `c2pa.created` + `ai-disclosure` | "AI-drafted, human-reviewed" |
| Reviewed and ratified (applies to all of the above) | — | `c2pa.reviewed`, `humanOversightLevel: human_validated` | "Ratified by <group>, <date>" |

## 4. Other developments

### 4.1 California AI Transparency Act (SB 942 as amended by AB 853)

Sources (read 2026-11-06): CalMatters Digital Democracy bill page https://calmatters.digitaldemocracy.org/bills/ca_202520260ab853 (quotes bill digest and text). leginfo.legislature.ca.gov returned 403, so the official text was **not read directly**.

- AB 853 was chaptered 13 Oct 2025 as Chapter 674, Statutes of 2025. Digest: "This bill would delay the operation of the California AI Transparency Act until August 2, 2026." Text: "This chapter shall become operative on August 2, 2026."
- **2 Aug 2026:** covered providers (GenAI systems with over 1,000,000 monthly visitors or users, publicly accessible in California) must offer a free AI detection tool and include latent disclosures (plus an option for manifest disclosures) in AI-generated "image, video, or audio content".
- **1 Jan 2027:** large online platforms (over 2,000,000 unique monthly users) must surface provenance data. GenAI hosting platforms may not knowingly make available non-compliant systems.
- **1 Jan 2028:** capture-device manufacturers must offer a latent disclosure option (in devices "first produced for sale in the state on or after January 1, 2028", per the digest headline; the wording varies between versions).
- **Text:** not covered by the core duties.
- **Fit:** not applicable to Civicsmith's text. *Watch* for evidence media: from 2028 phones may carry capture provenance that Civicsmith could show for photos in a case.

### 4.2 China: Labelling Measures (in force 1 Sep 2025)

Sources (read 2026-11-06). The official CAC page was **not reachable** (connection reset).
- Xinhua, 14 Mar 2025: https://www.news.cn/politics/20250314/b7a24028f2924b7681e6ed1bfbd8fade/c.html. Definitions: explicit labels "以文字、声音、图形等方式呈现并可以被用户明显感知到的标识"; implicit labels "在生成合成内容文件数据中添加的，不易被用户明显感知到的标识"; "自2025年9月1日起施行".
- Covington Inside Privacy summary: https://www.insideprivacy.com/international/china/china-releases-new-labeling-requirements-for-ai-generated-content/. Text labels go "at an appropriate location" (beginning, middle or end) and are kept in saved files. Implicit metadata holds the provider name and a content ID. Platforms grade content as confirmed, possible or suspected. GB 45438-2025 is the companion mandatory standard. CAC, MIIT, MPS and NRTA are the issuers.
- **Fit:** not applicable. A useful contrast: grading labels by confidence helps platforms, but Civicsmith knows its own provenance exactly and should state it, not estimate it.

### 4.3 News-industry practice

- **AP:** primary pages could not be fetched (ap.org blocked to this tool). Secondary sources report a July 2026 update: AI allowed for headline drafts, summaries, transcription and translation; "AI does not replace reporting, sourcing, editorial judgment or verification"; disclosure "whenever generative AI plays a material role in published content"; continued ban on gen-AI news photos (https://wnanews.com/2026/07/26/ap-updates-ai-newsroom-standards/, https://www.editorandpublisher.com/stories/ap-updates-newsroom-standards-for-artificial-intelligence,262741). The original guidance is from Aug 2023. **Not verified at source.**
- **Reuters:** reutersagency.com could not be fetched. Secondary (https://talkingbiznews.com/media-news/what-reuters-is-telling-its-journalists-about-using-artificial-intelligence/): Reuters "strives for transparency about how we create content", and AI-supplied facts are treated like "unverified, unattributed facts". **Not verified at source.**
- **Partnership on AI, Responsible Practices for Synthetic Media** (27 Feb 2023, living document): https://partnershiponai.org/wp-content/uploads/2023/02/PAI_synthetic_media_framework.pdf and https://syntheticmedia.partnershiponai.org/. "Direct disclosure" (viewer-facing labels) works together with "indirect disclosure" (provenance, metadata, watermark). The glossary (https://partnershiponai.org/glossary-for-synthetic-media-transparency-methods-part-1-indirect-disclosure/) defines indirect disclosure. Read via search summaries; the PDF was not opened.
- **Paris Charter on AI and Journalism** (RSF + 16 partners, 10 Nov 2023): https://rsf.org/en/paris-charter-ai-and-journalism. Principles include "2. MEDIA OUTLETS PRIORITIZE HUMAN AGENCY", "4. MEDIA OUTLETS ARE ALWAYS ACCOUNTABLE FOR THE CONTENT THEY PUBLISH", "5. MEDIA OUTLETS MAINTAIN TRANSPARENCY IN THEIR USE OF AI SYSTEMS", "6. MEDIA OUTLETS ENSURE CONTENT ORIGIN AND TRACEABILITY" ("…use state-of-the-art tools that guarantee the authenticity and provenance…"), and "7. JOURNALISM DRAWS A CLEAR LINE BETWEEN AUTHENTIC AND SYNTHETIC CONTENT".
- **JournalismAI (LSE Polis):** not researched in this pass.

**Fit:** the Paris Charter's #4–#6 and AP's "material role" threshold give Civicsmith recognisable, citable norms: accountability (the ratifying group), transparency (first-exposure disclosure) and traceability (signed per-passage provenance). PAI's direct/indirect split is the design pattern: a short reader label backed by signed machine-readable provenance.

### 4.4 Other material items

- **NIST AI 100-4, "Reducing Risks Posed by Synthetic Content"** (Nov 2024, final): https://doi.org/10.6028/NIST.AI.100-4 (title page read 2026-11-06). A US technical overview of provenance, watermarking, metadata and detection. Reference only.
- **EMFA "editorial responsibility"** (Reg. (EU) 2024/1083 Art 2(8)), cited by the guidelines para 140 as the interpretive anchor for 50(4). Relevant if BOB wants Civicsmith's definition of editorial responsibility to match the EU media meaning: "effective control both over the selection … and over their organisation".
- **Not checked this pass:** the Council of Europe Framework Convention on AI; US state laws on political deep fakes (relevant if cases include election material); the Trust Project indicators; UK or other national guidance.

## 5. Synthesis: what would serve Civicsmith readers

These are suggestions only.

1. **First-exposure disclosure.** On every published case, at the top or in the colophon (Art 50(5); Code Measure 1.2.2(f); guidelines para 138). The framing: "Researched and written by <group> using AI tools; every passage was reviewed by members and the case was ratified and signed on <date>. <Responsible contact>." Optionally use the EU basic "AI" icon with Civicsmith's own second layer. Avoid "AI-GENERATED", which would misdescribe ratified text.
2. **A public review standard** modelled on Code Commitment 4 and guidelines paras 134–138: substantive review, fact-checking against cited records as a minimum, a named responsible group with contact, no AI change after signing, and AI critique not counted as human review.
3. **Per-passage provenance inside the signed document.** Each passage records its origin (IPTC URI), the actions and tools, the reviewer(s) and the ratification (C2PA `c2pa.reviewed` / `humanOversightLevel` terms), and a text selector. Readers can expand "how this passage was made". Peer groups verify the signature and the provenance together.
4. **A peer-verifier channel** (Code Measure 2.3): a way for peer groups and readers to flag a missing or incorrect provenance or label, with a published remedy.
5. **Not adopted:** watermarking Civicsmith's own text, Unicode-embedded manifests, and confidence-graded "suspected AI" labels.

## Next review

| What | When | Why |
|---|---|---|
| Art 50(2) provider transition ends | **After 2 Dec 2026** (review mid-Dec 2026) | Model providers' text watermarking (Code 1.1.2) becomes due; check whether AI text in Civicsmith's pipeline now carries watermarks or metadata, and whether a disclosure needs to mention it. |
| Code of Practice signatory list and EU icon "interactive second layer" / audio icon | Quarterly; next **Feb 2027** | The task force may define a provenance-linked icon layer Civicsmith could reuse. |
| Commission Art 50 guidelines (C(2026) 7702) | Feb 2027, and on any review (para 155) | Final adoption on 5 Nov 2026 is inferred from the cover; confirm. Watch for revisions. |
| C2PA 2.6 / ISO 22144 | Next C2PA release (about Apr 2027, following the 6-month pattern) | Status of the text embedding methods (A.8 "under review"); the `ai-disclosure` pending fields; ISO publication. |
| CAWG identity assertion | Feb 2027 | Whether a group signature can be expressed as a CAWG organisational identity. |
| California SB 942/AB 853 | Before **1 Jan 2027** and **1 Jan 2028** | Platform and device dates; any 2026 amendments (not checked). |
| AP / Reuters primary texts | Next pass | Verify the secondary-source claims. |
| AI Act scope question (Art 2(1)(c)) | When BOB chooses | Legal advice only if BOB wants it. |

## Not verified

- **AP July 2026 update and Reuters AI guidance:** secondary sources only. ap.org and reutersagency.com were unreachable from this tool.
- **California dates of 1 Jan 2027 and 1 Jan 2028, and the thresholds:** taken from CalMatters' reproduction of the digest and text, not leginfo (403). Any later 2026 amendment was not checked.
- **China Measures:** the CAC original was not reachable. The text-label placement rule, the platform three-tier grading, the GB 45438-2025 details and the 14 Mar 2025 issue date come from Xinhua and Covington.
- **Omnibus procedural dates** (7 May, 16 Jun, 29 Jun 2026): secondary sources only. The OJ date (24 Jul 2026), the signing date (8 Jul 2026) and entry into force (3rd day, i.e. 27 Jul 2026) are from the official text.
- **The Art 50 guidelines' formal adoption on 5 Nov 2026:** inferred from the PDF cover "C(2026) 7702 final" and the page's 5 Nov update.
- **The Code's adequacy finding and ~190 signatories:** taken from the Commission code page. The signatory list was not opened.
- **ISO/DIS 22144 current stage:** iso.org returned 403.
- **CAWG identity assertion version** beyond 1.1, and the CAWG training-mining assertion: not checked.
- **PAI framework:** read via search summaries; the PDF was not opened.
- **JournalismAI:** not researched.
- **Applicability of the AI Act to Civicsmith (Art 2(1)(c)):** deliberately not assessed.
