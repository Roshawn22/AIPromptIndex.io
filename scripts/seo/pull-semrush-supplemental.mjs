import path from 'node:path';

import {
  fetchSemrushAnalyticsRows,
  fetchSemrushRows,
  getArtifactEnvelope,
  getSemrushApiUnitsBalance,
  getSeoOutputDir,
  loadCompetitorDomains,
  numberValue,
  optionalEnv,
  parseCliArgs,
  rollupStatuses,
  writeJson,
} from './_shared.mjs';

const args = parseCliArgs();
const outputDir = getSeoOutputDir(args);
const target = optionalEnv('SEMRUSH_TARGET', 'aipromptindex.io');
const targetType = optionalEnv('SEMRUSH_TARGET_TYPE', 'root_domain');
const database = optionalEnv('SEMRUSH_DATABASE', 'us');
const limit = Number(args.limit || 25);
const competitorLimit = Number(args['competitors-limit'] || 5);

function buildSection(name, unitCostEstimate) {
  return {
    name,
    status: 'unknown',
    blockedReason: null,
    warnings: [],
    unitCostEstimate,
  };
}

async function pullSection(section, fn) {
  try {
    const value = await fn();
    section.status = 'ok';
    return value;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    section.status = /API UNITS BALANCE IS ZERO|not enough api units|Api units balance is zero/i.test(message) ? 'blocked' : 'unknown';
    section.blockedReason = section.status === 'blocked' ? 'semrush_api_units_zero' : null;
    section.warnings.push(message);
    return null;
  }
}

async function main() {
  const generatedAt = new Date().toISOString();
  const competitorDomains = loadCompetitorDomains().slice(0, competitorLimit);
  const unitsBalance = await getSemrushApiUnitsBalance();
  const sections = {
    unitsBalance: buildSection('unitsBalance', 0),
    organicKeywords: buildSection('organicKeywords', limit * 10),
    organicPages: buildSection('organicPages', limit * 10),
    backlinksOverview: buildSection('backlinksOverview', 40),
    referringDomains: buildSection('referringDomains', limit * 40),
    referringIps: buildSection('referringIps', limit * 40),
    anchors: buildSection('anchors', limit * 40),
    indexedPages: buildSection('indexedPages', limit * 40),
    backlinkCompetitors: buildSection('backlinkCompetitors', limit * 40),
    batchComparison: buildSection('batchComparison', (competitorDomains.length + 1) * 40),
    authorityScoreProfile: buildSection('authorityScoreProfile', 100),
  };

  sections.unitsBalance.status = unitsBalance.status;
  sections.unitsBalance.blockedReason = unitsBalance.blockedReason || null;
  sections.unitsBalance.warnings = unitsBalance.error ? [unitsBalance.error] : [];

  let organicKeywords = [];
  let organicPages = [];
  let backlinksOverview = null;
  let referringDomains = [];
  let referringIps = [];
  let anchors = [];
  let indexedPages = [];
  let backlinkCompetitors = [];
  let batchComparison = [];
  let authorityScoreProfile = [];

  const semrushBlocked = unitsBalance.status === 'blocked' || (unitsBalance.unitsRemaining !== null && unitsBalance.unitsRemaining <= 0);

  if (semrushBlocked) {
    Object.values(sections)
      .filter((section) => section.name !== 'unitsBalance')
      .forEach((section) => {
        section.status = 'blocked';
        section.blockedReason = 'semrush_api_units_zero';
        section.warnings.push('Skipped because Semrush API units are currently exhausted.');
      });
  } else {
    const organicKeywordsRows = await pullSection(sections.organicKeywords, async () => fetchSemrushRows('domain_organic', {
      domain: target,
      database,
      display_limit: limit,
      display_positions_type: 'all',
      export_columns: 'Ph,Po,Pp,Nq,Cp,Ur,Tr,Tc,Co,Nr,Fk,Fp,In',
    }));
    organicKeywords = (organicKeywordsRows || []).map((row) => ({
      keyword: row.Keyword || row.Ph || '',
      position: numberValue(row.Position || row.Po),
      previousPosition: numberValue(row['Previous Position'] || row.Pp),
      volume: numberValue(row['Search Volume'] || row.Nq),
      cpc: numberValue(row.CPC || row.Cp),
      url: row.Url || row.Ur || '',
      trafficShare: numberValue(row['Traffic (%)'] || row.Tr),
      trafficCostShare: numberValue(row['Traffic Cost (%)'] || row.Tc),
      competition: numberValue(row.Competition || row.Co),
      results: numberValue(row['Number of Results'] || row.Nr),
      serpFeatures: (row['SERP Features by Keyword'] || row.Fk || '').split(',').map((item) => item.trim()).filter(Boolean),
      domainSerpFeatures: (row['SERP Features by Domain'] || row.Fp || '').split(',').map((item) => item.trim()).filter(Boolean),
      intent: row.Intent || row.In || '',
    }));

    const organicPagesRows = await pullSection(sections.organicPages, async () => fetchSemrushRows('domain_organic_unique', {
      domain: target,
      database,
      display_limit: limit,
      export_columns: 'Ur,Pc,Tg,Tr',
    }));
    organicPages = (organicPagesRows || []).map((row) => ({
      url: row.Url || row.Ur || '',
      keywords: numberValue(row['Number of Keywords'] || row.Pc),
      traffic: numberValue(row.Traffic || row.Tg),
      trafficShare: numberValue(row['Traffic (%)'] || row.Tr),
    }));

    const backlinksOverviewRows = await pullSection(sections.backlinksOverview, async () => fetchSemrushAnalyticsRows('backlinks_overview', {
      target,
      target_type: targetType,
      export_columns: 'ascore,total,domains_num,urls_num,ips_num,ipclassc_num,follows_num,nofollows_num,sponsored_num,ugc_num,texts_num,images_num,forms_num,frames_num,trust_score',
    }));
    backlinksOverview = backlinksOverviewRows?.[0] ? {
      ascore: numberValue(backlinksOverviewRows[0].ascore),
      totalBacklinks: numberValue(backlinksOverviewRows[0].total),
      referringDomains: numberValue(backlinksOverviewRows[0].domains_num),
      referringUrls: numberValue(backlinksOverviewRows[0].urls_num),
      ips: numberValue(backlinksOverviewRows[0].ips_num),
      classCIps: numberValue(backlinksOverviewRows[0].ipclassc_num),
      follows: numberValue(backlinksOverviewRows[0].follows_num),
      nofollows: numberValue(backlinksOverviewRows[0].nofollows_num),
      sponsored: numberValue(backlinksOverviewRows[0].sponsored_num),
      ugc: numberValue(backlinksOverviewRows[0].ugc_num),
      texts: numberValue(backlinksOverviewRows[0].texts_num),
      images: numberValue(backlinksOverviewRows[0].images_num),
      forms: numberValue(backlinksOverviewRows[0].forms_num),
      frames: numberValue(backlinksOverviewRows[0].frames_num),
      trustScore: numberValue(backlinksOverviewRows[0].trust_score),
    } : null;

    const referringDomainRows = await pullSection(sections.referringDomains, async () => fetchSemrushAnalyticsRows('backlinks_refdomains', {
      target,
      target_type: targetType,
      display_limit: limit,
      export_columns: 'domain,domain_ascore,backlinks_num,ip,country,first_seen,last_seen',
    }));
    referringDomains = (referringDomainRows || []).map((row) => ({
      domain: row.domain || '',
      ascore: numberValue(row.domain_ascore),
      backlinks: numberValue(row.backlinks_num),
      ip: row.ip || '',
      country: row.country || '',
      firstSeen: row.first_seen || '',
      lastSeen: row.last_seen || '',
    }));

    const referringIpRows = await pullSection(sections.referringIps, async () => fetchSemrushAnalyticsRows('backlinks_refips', {
      target,
      target_type: targetType,
      display_limit: limit,
      export_columns: 'ip,country,domains_num,backlinks_num,first_seen,last_seen',
    }));
    referringIps = (referringIpRows || []).map((row) => ({
      ip: row.ip || '',
      country: row.country || '',
      domains: numberValue(row.domains_num),
      backlinks: numberValue(row.backlinks_num),
      firstSeen: row.first_seen || '',
      lastSeen: row.last_seen || '',
    }));

    const anchorRows = await pullSection(sections.anchors, async () => fetchSemrushAnalyticsRows('backlinks_anchors', {
      target,
      target_type: targetType,
      display_limit: limit,
      export_columns: 'anchor,domains_num,backlinks_num,first_seen,last_seen',
    }));
    anchors = (anchorRows || []).map((row) => ({
      anchor: row.anchor || '',
      refdomains: numberValue(row.domains_num),
      backlinks: numberValue(row.backlinks_num),
      firstSeen: row.first_seen || '',
      lastSeen: row.last_seen || '',
    }));

    const indexedPageRows = await pullSection(sections.indexedPages, async () => fetchSemrushAnalyticsRows('backlinks_pages', {
      target,
      target_type: targetType,
      display_limit: limit,
      export_columns: 'source_url,source_title,response_code,backlinks_num,domains_num,last_seen,external_num,internal_num',
    }));
    indexedPages = (indexedPageRows || []).map((row) => ({
      url: row.source_url || '',
      title: row.source_title || '',
      responseCode: numberValue(row.response_code),
      backlinks: numberValue(row.backlinks_num),
      refdomains: numberValue(row.domains_num),
      lastSeen: row.last_seen || '',
      externalLinks: numberValue(row.external_num),
      internalLinks: numberValue(row.internal_num),
    }));

    const competitorRows = await pullSection(sections.backlinkCompetitors, async () => fetchSemrushAnalyticsRows('backlinks_competitors', {
      target,
      target_type: targetType,
      display_limit: limit,
      export_columns: 'ascore,neighbour,similarity,common_refdomains,domains_num,backlinks_num',
    }));
    backlinkCompetitors = (competitorRows || []).map((row) => ({
      domain: row.neighbour || '',
      ascore: numberValue(row.ascore),
      similarity: numberValue(row.similarity),
      commonRefdomains: numberValue(row.common_refdomains),
      domains: numberValue(row.domains_num),
      backlinks: numberValue(row.backlinks_num),
    }));

    const batchComparisonRows = await pullSection(sections.batchComparison, async () => fetchSemrushAnalyticsRows('backlinks_comparison', {
      'targets[]': [target, ...competitorDomains],
      'target_types[]': [targetType, ...competitorDomains.map(() => targetType)],
      export_columns: 'target,target_type,ascore,backlinks_num,domains_num,ips_num,follows_num,nofollows_num,texts_num,images_num,forms_num,frames_num',
    }));
    batchComparison = (batchComparisonRows || []).map((row) => ({
      target: row.target || '',
      targetType: row.target_type || '',
      ascore: numberValue(row.ascore),
      backlinks: numberValue(row.backlinks_num),
      domains: numberValue(row.domains_num),
      ips: numberValue(row.ips_num),
      follows: numberValue(row.follows_num),
      nofollows: numberValue(row.nofollows_num),
      texts: numberValue(row.texts_num),
      images: numberValue(row.images_num),
      forms: numberValue(row.forms_num),
      frames: numberValue(row.frames_num),
    }));

    const authorityProfileRows = await pullSection(sections.authorityScoreProfile, async () => fetchSemrushAnalyticsRows('backlinks_ascore_profile', {
      target,
      target_type: targetType,
    }));
    authorityScoreProfile = (authorityProfileRows || []).map((row) => ({
      ascore: numberValue(row.ascore),
      domains: numberValue(row.domains_num),
    }));
  }

  const output = getArtifactEnvelope({
    source: 'semrush-api',
    endpoint: 'supplemental',
    generatedAt,
    status: rollupStatuses(Object.values(sections).map((section) => section.status)),
    blockedReason: semrushBlocked ? 'semrush_api_units_zero' : null,
    unitCostEstimate: {
      organicKeywords: sections.organicKeywords.unitCostEstimate,
      organicPages: sections.organicPages.unitCostEstimate,
      backlinksOverview: sections.backlinksOverview.unitCostEstimate,
      referringDomains: sections.referringDomains.unitCostEstimate,
      referringIps: sections.referringIps.unitCostEstimate,
      anchors: sections.anchors.unitCostEstimate,
      indexedPages: sections.indexedPages.unitCostEstimate,
      backlinkCompetitors: sections.backlinkCompetitors.unitCostEstimate,
      batchComparison: sections.batchComparison.unitCostEstimate,
      authorityScoreProfile: sections.authorityScoreProfile.unitCostEstimate,
    },
    target,
    targetType,
    database,
    mcpEquivalentSurfaces: [
      'SEMRUSH_ACCOUNT_UNITS_BALANCE',
      'SEMRUSH_DOMAIN_ORGANIC_SEARCH_KEYWORDS',
      'SEMRUSH_DOMAIN_ORGANIC_PAGES',
      'SEMRUSH_BACKLINKS_OVERVIEW',
      'SEMRUSH_REFERRING_DOMAINS',
      'SEMRUSH_REFERRING_I_PS',
      'SEMRUSH_ANCHORS',
      'SEMRUSH_INDEXED_PAGES',
      'SEMRUSH_BATCH_COMPARISON',
      'SEMRUSH_AUTHORITY_SCORE_PROFILE',
    ],
    unitsBalance,
    sections,
    organicKeywords,
    organicPages,
    backlinksOverview,
    referringDomains,
    referringIps,
    anchors,
    indexedPages,
    backlinkCompetitors,
    batchComparison,
    authorityScoreProfile,
  });

  writeJson(path.join(outputDir, 'semrush-supplemental.json'), output);

  console.log(JSON.stringify({
    ok: true,
    outputDir,
    target,
    status: output.status,
    unitsRemaining: unitsBalance.unitsRemaining ?? null,
    rows: {
      organicKeywords: organicKeywords.length,
      organicPages: organicPages.length,
      referringDomains: referringDomains.length,
      referringIps: referringIps.length,
      anchors: anchors.length,
      indexedPages: indexedPages.length,
      backlinkCompetitors: backlinkCompetitors.length,
      batchComparison: batchComparison.length,
      authorityScoreProfile: authorityScoreProfile.length,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
