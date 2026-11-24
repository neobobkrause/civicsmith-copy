/* The catalogue (R20) and engine families (R31). Every offered descriptor passes R19 (a test pins it); its `handling`
 * is the study's statement (`build/plan/study-security-tools-N710.md`, `study-scanner-N705.md`), read on the date it
 * states. Each descriptor's `config` names the settings its adapter reads (R19, N777). A generic transport is a
 * template: the administrator's statement (`spec.config.engine_family`, `spec.config.handling`) and the spec's `host`
 * complete it, and R19 validates the result (`resolveDescriptor`). */
import { validateDescriptor, normaliseFamily } from './descriptor.mjs';
import { hostPart } from './net.mjs';
import { localize } from '../../../bio-plane/src/setup-words/index.mjs';

const READ_ON = '2026-10-07';
const NEVER = Object.freeze(['file_name', 'member_identity', 'ip_address']);
const ADMIN = localize('file-scanner.catalogue.stated_by_the_administrator', 'stated by the administrator');
// An engine family is a name R31 compares, not a sentence a member reads: the same words as data, never by locale.
const ADMIN_FAMILY = 'stated by the administrator';
const NO_FILE = localize('file-scanner.catalogue.no_file_is_sent', 'no file is sent');
const WHERE_IT_RUNS = localize('file-scanner.catalogue.where_it_runs', 'where it runs');
const ORG_LICENCE = localize('file-scanner.catalogue.the_organizations_own_licence', 'the organization\'s own licence');

const descriptor = (d) => Object.freeze({
  mode_required: null, mode_check: null, credentials: [], read_on: READ_ON, ...d,
  config: Object.freeze((d.config || []).map((f) => Object.freeze(f === REGION
    ? { ...f, label: localize('file-scanner.catalogue.region_one_of_keys', 'Region: one of {keys}', { keys: String(Object.keys(d.hosts).join(', ')) }) } : { ...f }))),
  handling: Object.freeze({ never_sends: NEVER, sub_processors: [], ...d.handling }),
});

// R19 (N777): the settings each adapter reads from the spec's `config`, by name, so a settings page asks each one; a
// value that is not one text says its shape (`structured`, T38), so the page asks it field by field.
const field = (name, label, required, structured) => ({ name, label, required, ...(structured ? { structured } : {}) });
// R19 (T38; N791, K2239): the address an adapter needs that `hosts` does not give, and the region `hosts` is keyed by.
// Both stand for the spec's own `host` and `region` (R21), which a settings page sends under these names.
const HOST = (label) => field('host', label, true);
// Its label names the regions, filled from the descriptor's own `hosts` (descriptor(), below).
const REGION = Object.freeze({ name: 'region', label: null, required: true });
// A template's own statement (K2175): its engine family and its handling, both required, as the tool's maker states them.
const TEMPLATE_CONFIG = (host) => [
  HOST(host),
  field('engine_family', localize('file-scanner.catalogue.the_engines_the_tool_runs', 'The engines the tool runs, as its maker names them'), true, 'list'),
  field('handling', localize('file-scanner.catalogue.the_tools_statement_of_what', 'The tool\'s statement of what it receives, keeps and shares'), true, 'handling'),
  field('source_urls', localize('file-scanner.catalogue.where_that_statement_is_published', 'Where that statement is published'), false, 'list'),
];
const AZURE_TENANT = field('tenant_id', localize('file-scanner.catalogue.microsoft_entra_tenant_id', 'Microsoft Entra tenant ID'), true);

// MetaDefender reports one result per engine; the engines its tiers run, as OPSWAT names them (N705 §2.2; the list is
// this adapter's assumption, wider than any one tier). An engine it reports outside this list is answered under
// `metadefender-unlisted`, so every verdict's engine stays in its family (R31).
const METADEFENDER_ENGINES = ['ahnlab', 'antiy', 'avira', 'bitdefender', 'bkav', 'clamav', 'comodo', 'crowdstrike',
  'cyren', 'emsisoft', 'eset', 'filseclab', 'fortinet', 'huorong', 'ikarus', 'jiangmin', 'k7', 'mcafee', 'microsoft',
  'nanoav', 'quickheal', 'sophos', 'tachyon', 'trendmicro', 'varist', 'vir.it', 'xvirus', 'zillya', 'metadefender-unlisted'];
const MD_PRIVATE = Object.freeze({
  params: Object.freeze({ samplesharing: '0', privateprocessing: '1' }),
  description: localize('file-scanner.catalogue.private_mode_samplesharing_0', 'private mode: samplesharing 0 and private processing on every call (paid licence only)'),
});
const MD_CHECK = localize('file-scanner.catalogue.metadefender_get_v4_apikey_before_each', 'GET /v4/apikey/ before each send: the key\'s licence is paid and private processing is on');
const MD_URLS = ['https://www.opswat.com/docs/mdcloud/operation/private-scanning-with-metadefender-cloud-apis',
  'https://www.opswat.com/docs/mdcloud/metadefender-cloud-api-v4', 'https://www.opswat.com/legal/terms-of-service'];
const INTELIX = {
  vendor: 'Sophos Ltd', product: 'SophosLabs Intelix', transport: 'https', reach: 'public',
  hosts: { us: ['us.api.labs.sophos.com', 'api.labs.sophos.com'], de: ['de.api.labs.sophos.com', 'api.labs.sophos.com'],
    au: ['au.api.labs.sophos.com', 'api.labs.sophos.com'] },
  engine_family: ['sophos'], credentials: ['client_id', 'client_secret'], config: [REGION],
  handling: { on_own: false, sends: ['file_bytes'], recipient: 'Sophos Ltd', sub_processors: [],
    region: localize('file-scanner.catalogue.intelix_the_region_chosen', 'the region chosen; dynamic analysis traffic may be routed to another region; malicious files to the SophosLabs Hub (UK)'),
    file_retention: localize('file-scanner.catalogue.intelix_clean_files_up_to', 'clean files up to 30 days; malicious files retained indefinitely in the SophosLabs Hub (UK)'),
    result_retention: localize('file-scanner.catalogue.intelix_metadata_up_to_6', 'metadata up to 6 months for research'), sample_sharing: 'vendor_internal_research' },
  licence_note: localize('file-scanner.catalogue.intelix_the_organizations_own', 'the organization\'s own Intelix account (free monthly allowance, then pay as you go)'),
  source_urls: ['https://www.sophos.com/en-us/legal/product-privacy-information/sophoslabs-intelix'],
};

/** R20: the descriptors offered, frozen, keyed by `provider_id` in the catalogue's order. */
export const PROVIDERS = Object.freeze([
  // ── scan
  descriptor({ provider_id: 'scanii', vendor: 'Uva Software, LLC', product: 'Scanii', kinds: ['scan'],
    transport: 'https', reach: 'public', max_bytes: 2_147_483_648,
    hosts: { us1: ['api-us1.scanii.com'], eu1: ['api-eu1.scanii.com'], eu2: ['api-eu2.scanii.com'],
      ap1: ['api-ap1.scanii.com'], ap2: ['api-ap2.scanii.com'], ca1: ['api-ca1.scanii.com'] },
    // Its own engine with Sophos as the second (N705 §2.1); one family with Sophos Intelix (K1946 T7).
    engine_family: ['scanii', 'sophos'], credentials: ['api_key', 'api_secret'], test_probe: { kind: 'eicar' },
    config: [REGION],
    handling: { on_own: false, sends: ['file_bytes'], recipient: 'Uva Software, LLC', sub_processors: ['Amazon Web Services'],
      region: localize('file-scanner.catalogue.scanii_chosen_by_the_team', 'chosen by the team: US1, EU1, EU2, AP1, AP2 or CA1; content never leaves it'),
      file_retention: localize('file-scanner.catalogue.scanii_deleted_on_completion', 'deleted on completion of analysis'), result_retention: localize('file-scanner.catalogue.scanii_up_to_400_days', 'up to 400 days in the processing region'),
      sample_sharing: 'none' },
    licence_note: localize('file-scanner.catalogue.scanii_the_teams_own_key', 'the team\'s own key; terms allow use within its own products made available to its clients'),
    source_urls: ['https://docs.scanii.com/article/142-privacy-policy', 'https://docs.scanii.com/article/143-terms-of-service',
      'https://docs.scanii.com/article/144-version-2-0-resources'] }),
  descriptor({ provider_id: 'metadefender-cloud', vendor: 'OPSWAT, Inc.', product: localize('file-scanner.catalogue.metadefender_cloud_private_mode', 'MetaDefender Cloud (private mode)'),
    kinds: ['scan'], transport: 'https', reach: 'public', hosts: ['api.metadefender.com'], max_bytes: 146_800_640,
    per_engine: true, engine_family: METADEFENDER_ENGINES, credentials: ['api_key'], test_probe: { kind: 'eicar' },
    mode_required: MD_PRIVATE, mode_check: MD_CHECK,
    handling: { on_own: false, sends: ['file_bytes'], recipient: 'OPSWAT, Inc.', sub_processors: 'not stated', region: 'not stated',
      file_retention: localize('file-scanner.catalogue.metadefender_cloud_file_not', 'private mode: not stored or shared; permanently removed from storage'),
      result_retention: localize('file-scanner.catalogue.metadefender_cloud_scan_results', 'scan results remain in the MetaDefender Cloud database, limited to the submitter'),
      sample_sharing: 'none' },
    licence_note: localize('file-scanner.catalogue.metadefender_cloud_the_organizations_own_paid', 'the organization\'s own paid licence; "solely for Your internal use" (OPSWAT\'s written yes needed for product use)'),
    source_urls: MD_URLS }),
  descriptor({ provider_id: 'metadefender-core', vendor: 'OPSWAT, Inc.', product: 'MetaDefender Core', kinds: ['scan'],
    transport: 'https', reach: 'tunnel', hosts: [], host_from_spec: true, per_engine: true,
    engine_family: METADEFENDER_ENGINES, credentials: ['api_key'], test_probe: { kind: 'eicar' },
    config: [HOST(localize('file-scanner.catalogue.metadefender_core_server_address_host', 'MetaDefender Core server address (host, or host:port)'))],
    handling: { on_own: true, sends: ['file_bytes'], recipient: localize('file-scanner.catalogue.metadefender_core_the_organizations_own', 'the organization\'s own MetaDefender Core server'),
      region: localize('file-scanner.catalogue.metadefender_core_the_organizations_own_servers', 'the organization\'s own servers'), file_retention: localize('file-scanner.catalogue.metadefender_core_as_the_organization', 'as the organization configures its server'),
      result_retention: localize('file-scanner.catalogue.metadefender_core_as_the_organization_2', 'as the organization configures its server'), sample_sharing: 'none' },
    licence_note: ORG_LICENCE, source_urls: ['https://www.opswat.com/docs/mdcore/metadefender-core'] }),
  descriptor({ provider_id: 'icap', vendor: ADMIN, product: localize('file-scanner.catalogue.any_icap_server_rfc_3507', 'any ICAP server (RFC 3507)'), kinds: ['scan'],
    transport: 'icap', reach: 'public', hosts: [], template: true, engine_family: [ADMIN_FAMILY], test_probe: { kind: 'eicar' },
    config: [...TEMPLATE_CONFIG(localize('file-scanner.catalogue.icap_server_address_host_or_host', 'ICAP server address (host, or host:port; port 1344, or 11344 over TLS, unless named)')),
      field('service', localize('file-scanner.catalogue.icap_service_name_default_avscan', 'ICAP service name (default avscan)'), false),
      field('tls', localize('file-scanner.catalogue.connect_over_tls_yes_or', 'Connect over TLS: yes or no (default no)'), false)],
    handling: { on_own: false, sends: ['file_bytes'], recipient: ADMIN, region: ADMIN, file_retention: ADMIN, result_retention: ADMIN,
      sample_sharing: 'none' },
    licence_note: localize('file-scanner.catalogue.icap_the_organizations_own_server', 'the organization\'s own server and licence'), source_urls: [] }),
  descriptor({ provider_id: 'defender-storage', vendor: 'Microsoft Corporation', product: localize('file-scanner.catalogue.microsoft_defender_for_storage', 'Microsoft Defender for Storage'),
    kinds: ['scan'], transport: 'azure_blob', reach: 'public', max_bytes: 2_147_483_648,
    hosts: ['*.blob.core.windows.net', 'login.microsoftonline.com'], engine_family: ['microsoft-defender'],
    credentials: ['client_id', 'client_secret'], test_probe: { kind: 'eicar' },
    config: [AZURE_TENANT, field('storage_account', localize('file-scanner.catalogue.azure_storage_account_name', 'Azure storage account name'), true),
      field('container', localize('file-scanner.catalogue.blob_container_the_files_are', 'Blob container the files are scanned in'), true)],
    handling: { on_own: true, sends: ['file_bytes'], recipient: localize('file-scanner.catalogue.microsoft_the_organizations_own_azure', 'Microsoft (the organization\'s own Azure storage account)'),
      region: localize('file-scanner.catalogue.defender_storage_the_storage_accounts', 'the storage account\'s region; content read within it'),
      file_retention: localize('file-scanner.catalogue.defender_storage_the_service_does', 'the service does not retain the scanned content; this adapter deletes the blob after the result'),
      result_retention: localize('file-scanner.catalogue.defender_storage_the_blobs_index', 'the blob\'s index tag, deleted with it; alerts as the organization\'s Defender for Cloud keeps them'),
      sample_sharing: 'none' },
    licence_note: localize('file-scanner.catalogue.defender_storage_the_organizations_own', 'the organization\'s own Azure subscription, billed per GB scanned'),
    source_urls: ['https://learn.microsoft.com/en-us/azure/defender-for-cloud/on-upload-malware-scanning'] }),
  descriptor({ provider_id: 'sophos-intelix', ...INTELIX, kinds: ['scan', 'sandbox'], max_bytes: 33_554_432,
    test_probe: { kind: 'eicar' } }),
  // ── cdr
  descriptor({ provider_id: 'opswat-deep-cdr', vendor: 'OPSWAT, Inc.', product: localize('file-scanner.catalogue.deep_cdr_metadefender_cloud_or', 'Deep CDR (MetaDefender Cloud or Core)'),
    kinds: ['cdr'], transport: 'https', reach: 'public', hosts: { cloud: ['api.metadefender.com'], core: [] },
    max_bytes: 146_800_640, engine_family: ['opswat-deep-cdr'], credentials: ['api_key'],
    // Cloud's address is catalogued; Core's is the organization's own server, so its host is asked only for Core.
    config: [REGION, field('host', localize('file-scanner.catalogue.metadefender_core_server_address_host_2', 'MetaDefender Core server address (host, or host:port; Core only)'), false)],
    test_probe: { kind: 'macro_document' }, mode_required: MD_PRIVATE, mode_check: MD_CHECK,
    handling: { on_own: false, sends: ['file_bytes'], recipient: localize('file-scanner.catalogue.deep_cdr_opswat_inc_cloud_or', 'OPSWAT, Inc. (Cloud), or the organization\'s own Core server'),
      sub_processors: 'not stated', region: localize('file-scanner.catalogue.deep_cdr_not_stated_cloud', 'not stated (Cloud); the organization\'s own servers (Core)'),
      file_retention: localize('file-scanner.catalogue.cloud_not_stored_in_private', 'Cloud: not stored in private mode; the sanitized copy deleted after 24 hours'),
      result_retention: localize('file-scanner.catalogue.cloud_scan_results_remain_limited', 'Cloud: scan results remain, limited to the submitter'), sample_sharing: 'none' },
    licence_note: ORG_LICENCE, source_urls: ['https://www.opswat.com/docs/mdcloud/operation/data-sanitization-on-metadefender-cloud',
      'https://www.opswat.com/docs/mdcore/metadefender-core'] }),
  descriptor({ provider_id: 'glasswall-halo', vendor: 'Glasswall Solutions Ltd', product: 'Glasswall Halo', kinds: ['cdr'],
    transport: 'https', reach: 'public', hosts: [], host_from_spec: true, max_bytes: 1_073_741_824,
    engine_family: ['glasswall'], credentials: ['api_token'], test_probe: { kind: 'macro_document' },
    config: [HOST(localize('file-scanner.catalogue.glasswall_halo_api_address_host', 'Glasswall Halo API address (host, or host:port)'))],
    handling: { on_own: false, sends: ['file_bytes'], recipient: localize('file-scanner.catalogue.glasswall_the_halo_deployment', 'the Glasswall Halo deployment the organization runs or subscribes to'),
      region: localize('file-scanner.catalogue.glasswall_where_that_deployment_runs', 'where that deployment runs'), file_retention: localize('file-scanner.catalogue.glasswall_removed_according_to', 'removed according to the deployment\'s file retention policy'),
      result_retention: localize('file-scanner.catalogue.glasswall_the_analysis_report', 'the analysis report, as the deployment keeps it'), sample_sharing: 'none' },
    licence_note: localize('file-scanner.catalogue.glasswall_an_entitlement_to', 'an entitlement to a number of files or a volume a day'),
    source_urls: ['https://docs.glasswall.com/rest-api/about-glasswall-apis', 'https://docs.glasswall.com/halo/2.18.1/glasswall-halo-faqs'] }),
  // ── sandbox
  descriptor({ provider_id: 'joe-sandbox', vendor: 'Joe Security LLC', product: localize('file-scanner.catalogue.joe_sandbox_cloud_light_and', 'Joe Sandbox Cloud (Light and above)'),
    kinds: ['sandbox'], transport: 'https', reach: 'public', hosts: ['jbxcloud.joesecurity.org'], max_bytes: 104_857_600,
    engine_family: ['joe-sandbox'], credentials: ['api_key'], test_probe: { kind: 'eicar' },
    mode_required: Object.freeze({ params: Object.freeze({ 'accept-tac': '1' }),
      description: localize('file-scanner.catalogue.joe_sandbox_an_edition_of', 'an edition of Light or above, whose analyses and results are private') }),
    mode_check: localize('file-scanner.catalogue.joe_sandbox_post_account_info_before_each', 'POST /api/v2/account/info before each send: the account is not of the Basic edition'),
    handling: { on_own: false, sends: ['file_bytes'], recipient: 'Joe Security LLC', region: 'not stated',
      file_retention: localize('file-scanner.catalogue.joe_sandbox_kept_until_the', 'kept until the customer deletes it; then securely deleted in near real time'),
      result_retention: localize('file-scanner.catalogue.joe_sandbox_kept_until_the_2', 'kept until the customer deletes it'), sample_sharing: 'none' },
    licence_note: localize('file-scanner.catalogue.joe_sandbox_the_organizations_own', 'the organization\'s own Light, Pro or Enterprise subscription'),
    source_urls: ['https://joesecurity.org/joe-sandbox-cloud', 'https://www.joesandbox.com/pdpp'] }),
  descriptor({ provider_id: 'vmray', vendor: 'VMRay GmbH', product: 'VMRay Analyzer (cloud)', kinds: ['sandbox'],
    transport: 'https', reach: 'public', hosts: { us: ['cloud.vmray.com'], de: ['eu.cloud.vmray.com'] },
    max_bytes: 104_857_600, engine_family: ['vmray'], credentials: ['api_key'], test_probe: { kind: 'eicar' },
    config: [REGION],
    handling: { on_own: false, sends: ['file_bytes'], recipient: 'VMRay GmbH', region: localize('file-scanner.catalogue.vmray_us_or_germany_as_the', 'US or Germany, as the account is hosted'),
      file_retention: localize('file-scanner.catalogue.vmray_not_stated_beyond', 'not stated beyond the account'), result_retention: localize('file-scanner.catalogue.vmray_kept_in_the_account', 'kept in the account'), sample_sharing: 'none' },
    licence_note: localize('file-scanner.catalogue.vmray_the_organizations_own_subscription', 'the organization\'s own subscription'), source_urls: ['https://www.vmray.com/?p=3550'] }),
  descriptor({ provider_id: 'falcon-sandbox', vendor: 'CrowdStrike, Inc.', product: localize('file-scanner.catalogue.falcon_sandbox_falcon_intelligence', 'Falcon Sandbox (Falcon Intelligence)'),
    kinds: ['sandbox'], transport: 'https', reach: 'public', max_bytes: 104_857_600,
    hosts: { 'us-1': ['api.crowdstrike.com'], 'us-2': ['api.us-2.crowdstrike.com'], 'eu-1': ['api.eu-1.crowdstrike.com'] },
    engine_family: ['crowdstrike'], credentials: ['client_id', 'client_secret'], test_probe: { kind: 'eicar' },
    config: [REGION,
      field('environment_id', localize('file-scanner.catalogue.sandbox_environment_id_default_160', 'Sandbox environment ID (default 160, Windows 10 64-bit)'), false)],
    mode_required: Object.freeze({ params: Object.freeze({ is_confidential: 'true' }),
      description: localize('file-scanner.catalogue.falcon_sandbox_community_access_off', 'community access off: every upload confidential') }),
    mode_check: localize('file-scanner.catalogue.falcon_sandbox_get_settings_before_each', 'GET /falconx/entities/settings/v1 before each send: community access is off for the API client'),
    handling: { on_own: false, sends: ['file_bytes'], recipient: 'CrowdStrike, Inc.', region: localize('file-scanner.catalogue.falcon_sandbox_the_falcon_cloud_chosen', 'the Falcon cloud chosen'),
      file_retention: localize('file-scanner.catalogue.falcon_sandbox_stored_in_the', 'stored in the Falcon platform; period not stated'), result_retention: localize('file-scanner.catalogue.falcon_sandbox_kept_in_the', 'kept in the Falcon platform'),
      sample_sharing: 'none' },
    licence_note: localize('file-scanner.catalogue.falcon_sandbox_with_the_organizations', 'with the organization\'s Falcon subscription'),
    source_urls: ['https://developer.crowdstrike.com/api-reference/collections/falconx-sandbox/'] }),
  descriptor({ provider_id: 'wildfire', vendor: localize('file-scanner.catalogue.palo_alto_networks_inc', 'Palo Alto Networks, Inc.'), product: 'WildFire (standalone API)',
    kinds: ['sandbox'], transport: 'https', reach: 'public', max_bytes: 104_857_600,
    hosts: { global: ['wildfire.paloaltonetworks.com'], eu: ['eu.wildfire.paloaltonetworks.com'],
      jp: ['jp.wildfire.paloaltonetworks.com'], sg: ['sg.wildfire.paloaltonetworks.com'],
      uk: ['uk.wildfire.paloaltonetworks.com'], ca: ['ca.wildfire.paloaltonetworks.com'],
      au: ['au.wildfire.paloaltonetworks.com'] },
    engine_family: ['wildfire'], credentials: ['api_key'], test_probe: { kind: 'eicar' },
    config: [REGION],
    handling: { on_own: false, sends: ['file_bytes'], recipient: localize('file-scanner.catalogue.palo_alto_networks_inc_2', 'Palo Alto Networks, Inc.'),
      region: localize('file-scanner.catalogue.wildfire_the_regional_cloud', 'the regional cloud chosen; some metadata shared across regional clouds'),
      file_retention: localize('file-scanner.catalogue.wildfire_benign_14_days_malicious', 'benign 14 days; malicious 10 years'), result_retention: localize('file-scanner.catalogue.wildfire_signatures_and_reports', 'signatures and reports kept indefinitely'),
      sample_sharing: 'vendor_internal_research' },
    licence_note: localize('file-scanner.catalogue.wildfire_the_organizations_own_wildfire_api', 'the organization\'s own WildFire API subscription (150 submissions a day base)'),
    source_urls: ['https://docs.paloaltonetworks.com/wildfire/u-v/wildfire-whats-new/latest-wildfire-cloud-features/standalone-wildfire-api-subscription',
      'https://docs.paloaltonetworks.com/wildfire/u-v/wildfire-whats-new/latest-wildfire-cloud-features/updated-wildfire-retention-period'] }),
  // ── url_reputation
  descriptor({ provider_id: 'cloudflare-intel', vendor: 'Cloudflare, Inc.', product: 'Cloudflare URL intelligence',
    kinds: ['url_reputation'], transport: 'https', reach: 'public', hosts: ['api.cloudflare.com'],
    engine_family: ['cloudflare-intel'], credentials: ['api_token'],
    config: [field('account_id', localize('file-scanner.catalogue.cloudflare_account_id', 'Cloudflare account ID'), true)],
    test_probe: { kind: 'test_address', address: 'https://malware.testcategory.com/' },
    handling: { on_own: false, sends: ['url'], recipient: localize('file-scanner.catalogue.cloudflare_inc_the_teams_own', 'Cloudflare, Inc. (the team\'s own account)'), region: localize('file-scanner.catalogue.cloudflare_intel_cloudflares_network', 'Cloudflare\'s network'),
      file_retention: NO_FILE, result_retention: 'not stated', sample_sharing: 'none' },
    licence_note: localize('file-scanner.catalogue.cloudflare_intel_the_teams_own', 'the team\'s own Cloudflare account, a token with Intel Read'),
    source_urls: ['https://developers.cloudflare.com/api/resources/intel/subresources/urls/methods/get'] }),
  descriptor({ provider_id: 'google-web-risk', vendor: 'Google LLC', product: localize('file-scanner.catalogue.web_risk_update_api', 'Web Risk (Update API)'),
    kinds: ['url_reputation'], transport: 'https', reach: 'public', hosts: ['webrisk.googleapis.com'],
    engine_family: ['google-web-risk'], credentials: ['api_key'],
    test_probe: { kind: 'test_address', address: 'http://testsafebrowsing.appspot.com/s/malware.html' },
    handling: { on_own: false, sends: ['hash_prefix'], recipient: 'Google LLC', region: 'not stated',
      file_retention: localize('file-scanner.catalogue.google_web_risk_no_file', 'no file is sent; the server sees only a hash prefix on a local match'),
      result_retention: 'not stated', sample_sharing: 'none' },
    licence_note: localize('file-scanner.catalogue.google_web_risk_the_organizations_own', 'the organization\'s own Google Cloud project; results must not be redistributed'),
    source_urls: ['https://docs.cloud.google.com/web-risk/docs/overview', 'https://cloud.google.com/web-risk/pricing'] }),
  // ── log_sink
  descriptor({ provider_id: 'splunk-hec', vendor: 'Splunk LLC', product: localize('file-scanner.catalogue.splunk_http_event_collector', 'Splunk HTTP Event Collector'), kinds: ['log_sink'],
    transport: 'https', reach: 'public', hosts: [], host_from_spec: true, engine_family: ['splunk-hec'],
    credentials: ['hec_token'], test_probe: { kind: 'zero_counts' },
    config: [HOST(localize('file-scanner.catalogue.splunk_http_event_collector_address', 'Splunk HTTP Event Collector address (host:port; the collector listens on 8088 unless changed)'))],
    handling: { on_own: true, sends: ['counts'], recipient: localize('file-scanner.catalogue.splunk_hec_the_organizations_own_splunk', 'the organization\'s own Splunk'), region: WHERE_IT_RUNS,
      file_retention: NO_FILE, result_retention: localize('file-scanner.catalogue.splunk_hec_as_the_organization', 'as the organization keeps its logs'), sample_sharing: 'none' },
    licence_note: localize('file-scanner.catalogue.splunk_hec_the_organizations_own_splunk_2', 'the organization\'s own Splunk'), source_urls: ['https://help.splunk.com/en/splunk-enterprise/get-data-in/collect-http-event-data/use-curl-to-manage-http-event-collector-tokens-events-and-services'] }),
  descriptor({ provider_id: 'sentinel', vendor: 'Microsoft Corporation', product: localize('file-scanner.catalogue.microsoft_sentinel_logs_ingestion_api', 'Microsoft Sentinel (Logs Ingestion API)'),
    kinds: ['log_sink'], transport: 'https', reach: 'public', hosts: ['*.ingest.monitor.azure.com', 'login.microsoftonline.com'],
    engine_family: ['sentinel'], credentials: ['client_id', 'client_secret'], test_probe: { kind: 'zero_counts' },
    config: [AZURE_TENANT, field('endpoint', localize('file-scanner.catalogue.data_collection_endpoint_host', 'Data collection endpoint host'), true),
      field('dcr_id', localize('file-scanner.catalogue.data_collection_rule_immutable_id', 'Data collection rule immutable ID'), true), field('stream', localize('file-scanner.catalogue.stream_name_in_the_rule', 'Stream name in the rule'), true)],
    handling: { on_own: true, sends: ['counts'], recipient: localize('file-scanner.catalogue.microsoft_the_organizations_own_workspace', 'Microsoft (the organization\'s own workspace)'), region: localize('file-scanner.catalogue.sentinel_the_workspaces_region', 'the workspace\'s region'),
      file_retention: NO_FILE, result_retention: localize('file-scanner.catalogue.sentinel_as_the_workspace', 'as the workspace keeps its logs'), sample_sharing: 'none' },
    licence_note: localize('file-scanner.catalogue.sentinel_the_organizations_own', 'the organization\'s own Azure workspace'),
    source_urls: ['https://learn.microsoft.com/en-us/azure/azure-monitor/logs/logs-ingestion-api-overview'] }),
  descriptor({ provider_id: 'google-secops', vendor: 'Google LLC', product: localize('file-scanner.catalogue.google_security_operations_importlogs', 'Google Security Operations (ImportLogs)'),
    kinds: ['log_sink'], transport: 'https', reach: 'public',
    hosts: { us: ['us-chronicle.googleapis.com', 'oauth2.googleapis.com'], europe: ['europe-chronicle.googleapis.com', 'oauth2.googleapis.com'],
      'asia-southeast1': ['asia-southeast1-chronicle.googleapis.com', 'oauth2.googleapis.com'] },
    engine_family: ['google-secops'], credentials: ['service_account_key'], test_probe: { kind: 'zero_counts' },
    config: [REGION,
      field('project', localize('file-scanner.catalogue.google_cloud_project_id', 'Google Cloud project ID'), true), field('location', localize('file-scanner.catalogue.instance_location', 'Instance location'), true),
      field('instance', localize('file-scanner.catalogue.instance_customer_id', 'Instance (customer) ID'), true), field('log_type', localize('file-scanner.catalogue.log_type_the_counts_are', 'Log type the counts are imported as'), true)],
    handling: { on_own: true, sends: ['counts'], recipient: localize('file-scanner.catalogue.google_llc_the_organizations_own', 'Google LLC (the organization\'s own instance)'), region: localize('file-scanner.catalogue.google_secops_the_instances_region', 'the instance\'s region'),
      file_retention: NO_FILE, result_retention: localize('file-scanner.catalogue.google_secops_as_the_instance', 'as the instance keeps its logs'), sample_sharing: 'none' },
    licence_note: localize('file-scanner.catalogue.google_secops_the_organizations_own_instance', 'the organization\'s own instance'), source_urls: ['https://docs.cloud.google.com/chronicle/docs/reference/ingestion-methods'] }),
  descriptor({ provider_id: 'elastic', vendor: 'Elasticsearch B.V.', product: 'Elastic (_bulk API)', kinds: ['log_sink'],
    transport: 'https', reach: 'public', hosts: [], host_from_spec: true, engine_family: ['elastic'],
    credentials: ['api_key'], test_probe: { kind: 'zero_counts' },
    config: [HOST(localize('file-scanner.catalogue.elasticsearch_address_host_or_host', 'Elasticsearch address (host, or host:port)')),
      field('index', localize('file-scanner.catalogue.index_the_counts_are_written', 'Index the counts are written to (default civicsmith-security-counts)'), false)],
    handling: { on_own: true, sends: ['counts'], recipient: localize('file-scanner.catalogue.elastic_the_organizations_own', 'the organization\'s own Elastic deployment'), region: WHERE_IT_RUNS,
      file_retention: NO_FILE, result_retention: localize('file-scanner.catalogue.elastic_as_the_organization', 'as the organization keeps its logs'), sample_sharing: 'none' },
    licence_note: localize('file-scanner.catalogue.elastic_the_organizations_own_deployment', 'the organization\'s own deployment'), source_urls: ['https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-bulk'] }),
  descriptor({ provider_id: 'syslog-tls', vendor: ADMIN, product: localize('file-scanner.catalogue.any_syslog_collector_rfc_5424', 'any syslog collector (RFC 5424 over TLS)'), kinds: ['log_sink'],
    transport: 'syslog_tls', reach: 'public', hosts: [], template: true, engine_family: ['syslog'],
    test_probe: { kind: 'zero_counts' }, config: TEMPLATE_CONFIG(localize('file-scanner.catalogue.syslog_collector_address_host_or', 'Syslog collector address (host, or host:port; port 6514 unless named)')),
    handling: { on_own: false, sends: ['counts'], recipient: ADMIN, region: ADMIN, file_retention: NO_FILE,
      result_retention: ADMIN, sample_sharing: 'none' },
    licence_note: localize('file-scanner.catalogue.syslog_tls_the_organizations_own_collector', 'the organization\'s own collector'), source_urls: [] }),
  descriptor({ provider_id: 'https-webhook', vendor: ADMIN, product: localize('file-scanner.catalogue.any_https_endpoint_taking_a_json', 'any HTTPS endpoint taking a JSON POST'), kinds: ['log_sink'],
    transport: 'https', reach: 'public', hosts: [], template: true, engine_family: ['webhook'], credentials: ['token'],
    test_probe: { kind: 'zero_counts' },
    config: [...TEMPLATE_CONFIG(localize('file-scanner.catalogue.endpoint_address_host_or_host', 'Endpoint address (host, or host:port)')), field('path', localize('file-scanner.catalogue.path_on_the_endpoint_default', 'Path on the endpoint (default /)'), false)],
    handling: { on_own: false, sends: ['counts'], recipient: ADMIN, region: ADMIN, file_retention: NO_FILE,
      result_retention: ADMIN, sample_sharing: 'none' },
    licence_note: localize('file-scanner.catalogue.https_webhook_the_organizations_own_endpoint', 'the organization\'s own endpoint'), source_urls: [] }),
]);

/** R20: refused by name, with R19's code or NOT_OFFERED (DEC-168 S10–S12). */
export const REFUSED_PROVIDERS = Object.freeze([
  ['virustotal-upload', 'PROVIDER_SHARES_SAMPLES'], ['jotti', 'PROVIDER_SHARES_SAMPLES'],
  ['hybrid-analysis', 'PROVIDER_SHARES_SAMPLES'], ['joe-sandbox-basic', 'PROVIDER_SHARES_SAMPLES'],
  ['urlscan-io', 'PROVIDER_SHARES_SAMPLES'], ['any-run', 'NOT_OFFERED'],
  ['virustotal-url-submit', 'ADDRESS_WOULD_LEAVE'], ['google-web-risk-lookup', 'ADDRESS_WOULD_LEAVE'],
  ['sophos-intelix-url', 'ADDRESS_WOULD_LEAVE'], ['metadefender-url', 'ADDRESS_WOULD_LEAVE'],
  ['cloudflare-url-scanner', 'NOT_OFFERED'], ['cloudflare-logpush', 'NOT_OFFERED'],
].map(([provider_id, reason]) => Object.freeze({ provider_id, reason })));

/** R20: held until the vendor states its handling (K1949). */
export const HELD_PROVIDERS = Object.freeze(['trend-vision-one', 'votiro', 'checkpoint-threat-extraction']
  .map((provider_id) => Object.freeze({ provider_id, missing: 'HANDLING_NOT_STATED' })));

export const GENERIC = Object.freeze(PROVIDERS.filter((d) => d.template).map((d) => d.provider_id));
export const CATALOGUE_READ_ON = READ_ON;

const BY_ID = new Map(PROVIDERS.map((d) => [d.provider_id, d]));
export const providerById = (id) => BY_ID.get(id) || null;

/** The descriptor a call works under: a template completed by the administrator's statement and the spec's host,
 *  validated by R19; any other descriptor as catalogued. `{ok:true, descriptor}` or `{ok:false, code, field?}`. */
export function resolveDescriptor(d, spec) {
  if (!d.template) return { ok: true, descriptor: d };
  const config = (spec && spec.config) || {};
  const host = spec && spec.host;
  // A statement that is not a list is left as given, so R19 refuses it by name rather than this throwing.
  const family = (v) => (Array.isArray(v) ? normaliseFamily(v) : v);
  const resolved = { ...d, template: undefined, hosts: host ? [hostPart(host)] : [],
    engine_family: d.kinds.includes('scan') ? family(config.engine_family) : family(config.engine_family || d.engine_family),
    handling: { ...d.handling, ...(config.handling || {}) }, source_urls: config.source_urls || [] };
  delete resolved.template;
  resolved.host_from_spec = true;
  const v = validateDescriptor(resolved);
  return v.ok ? { ok: true, descriptor: Object.freeze(resolved) } : v;
}

/** R31: a provider's engine family; `clamav`'s is `["clamav"]`; null for an id not offered. */
export function engineFamily(providerId) {
  if (providerId === 'clamav') return ['clamav'];
  const d = BY_ID.get(providerId);
  return d ? normaliseFamily(d.engine_family) : null;
}

function verdictFamily(v) {
  if (!v || typeof v !== 'object' || typeof v.engine !== 'string' || !v.engine) return [];
  const d = BY_ID.get(v.tool);
  // A per-engine tool's verdict, and a template's (whose engine is the administrator's statement), are their engine's.
  if (v.tool === 'clamav' || !d || d.template || d.per_engine) return normaliseFamily([v.engine]);
  return normaliseFamily(d.engine_family);
}

/** R31: true exactly when two verdicts' engine families share no name. Pure; never throws. */
export function differentEngine(a, b) {
  try {
    const fa = verdictFamily(a), fb = verdictFamily(b);
    return fa.length > 0 && fb.length > 0 && !fa.some((n) => fb.includes(n));
  } catch { return false; }
}

// Every offered descriptor passes R19 when the module loads; a catalogue that does not is a build fault.
for (const d of PROVIDERS) {
  const v = validateDescriptor(d);
  if (!v.ok) throw new Error(`catalogue: ${d.provider_id} fails R19 (${v.code}${v.field ? ` ${v.field}` : ''})`);
}
