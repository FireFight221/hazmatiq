import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe,it,expect } from 'vitest';
const context = { window: { HazMatIQ: {} as { buildIncidentReportModel: (incident: Record<string, unknown>, plume?: unknown) => { brief: string; response: string; outcome: string; chemical: string; preparedBy: string; zones: Array<{name:string;distance:string;threshold:string}> } } } };
runInNewContext(readFileSync(new URL('../server/public/incident-report-model.js',import.meta.url),'utf8'),context);
const build = context.window.HazMatIQ.buildIncidentReportModel;
describe('Concise incident brief',()=>{
 it('does not repeat checklists or treat closure as successful mitigation',()=>{
  const report=build({incidentName:'Warehouse',status:'Completed',address:'10 Main St',chemicalName:'Ammonia',operationalChecklist:{tasks:[{label:'Entry',status:'Not Started'}]}});
  expect(report.brief).toContain('Ammonia'); expect(report.response).toBe(''); expect(report.outcome).not.toContain('mitigated'); expect(report.brief).not.toContain('Not Started');
 });
 it('keeps edited narrative including intentional blanks while automatic facts stay live',()=>{
  expect(build({incidentName:'Updated',reportNarrative:'Saved narrative'}).brief).toBe('Saved narrative');
  expect(build({incidentName:'Updated',reportNarrative:''}).brief).toBe('');
  expect(build({chemicalName:'Updated product'}).brief).toContain('Updated product');
 });
 it('shows only current modeled zones and never uses invalid placeholder data',()=>{
  expect(build({chemicalName:'No Current Data Exists'}).chemical).toBe('');
  const report=build({}, {output:{threatZones:[{threatRank:3,maxDownwindM:250,threshold:1100,units:'ppm'}]}});
  expect(report.zones[0]).toEqual({name:'AEGL-3',distance:'250 m',threshold:'1100 ppm'}); expect(build({}).zones).toEqual([]);
 });
 it('retains the report author without inventing a signature',()=>{expect(build({preparedBy:'Wade Simmons'}).preparedBy).toBe('Wade Simmons');expect(build({commanderName:'Other Person'}).preparedBy).toBe('');});
});
