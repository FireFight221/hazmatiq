import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {describe,it,expect,vi} from 'vitest';
const command = readFileSync(new URL('../server/public/incident-command.js',import.meta.url),'utf8');
const script = readFileSync(new URL('../server/public/script.js',import.meta.url),'utf8');
const worksheet = readFileSync(new URL('../server/public/command-worksheet.js',import.meta.url),'utf8');
const worksheetStyles = readFileSync(new URL('../server/public/command-worksheet.css',import.meta.url),'utf8');
describe('Tactical worksheet shared facts',()=>{
 it('keeps the worksheet order compact at desktop and stacked at tablet widths',()=>{
  expect(worksheet).toContain("card('Command Organization', 'full', 'Names Save Directly to Shared Assignments & ICS 201 / 203 / 214', 'command-organization')");
  expect(worksheet).toContain("resources.append(action('Add Assignment'");
  expect(worksheet).toContain('grid.append(info, chemical, org, weather, notes, comms, resources, staging, objectives, progress, live);');
  expect(worksheet).toContain('new window.ResizeObserver(resizeMap)');
  expect(worksheetStyles).toContain('"incident-info incident-info incident-info incident-info incident-info incident-info chemical-release');
  expect(worksheetStyles).toContain('"checklist checklist checklist checklist checklist live-map live-map');
  expect(worksheetStyles).toContain('@media (max-width: 900px)');
  expect(worksheetStyles).toContain('grid-template-areas:');
  expect(worksheetStyles).toContain('height: 360px; min-height: 300px;');
 });
 it('writes to the same incident and mirrors hidden legacy form values so later saves do not erase worksheet edits',()=>{
  let record = {incidentId:'training',notes:'Old note',incidentName:'Drill'};
  const input = {value:'Old note'};
  const api={getActiveIncident:()=>record,readIncidents:()=>[record],writeIncidents:(rows:typeof record[])=>{record=rows[0];},renderIncidentLists:vi.fn(),incidentResponderIdentity:()=> 'IC'};
  const fn=command.slice(command.indexOf('  function updateIncidentField('),command.indexOf('  function refreshIncidentCommand('));
  runInNewContext(`${fn}\nupdateIncidentField('notes','Radio update from Entry 1');`,{legacyApi:()=>api,setActiveIncidentState:vi.fn(),document:{getElementById:()=>input}});
  expect(record.notes).toBe('Radio update from Entry 1');expect(input.value).toBe(record.notes);expect(record.incidentId).toBe('training');expect(record.incidentName).toBe('Drill');
 });
 it('appends actual weather observations once without generating new observations during renders',()=>{
  const fn=script.slice(script.indexOf('function mergeIncidentWeatherLog('),script.indexOf('function getIncidentFormData('));
  const context={incident:{weatherObservations:[{observedAt:'2026-11-01T12:00:00Z',source:'Manual Entry',windSpeedMph:4}]} , weather:{observedAt:'2026-11-01T12:00:00Z',source:'Manual Entry',windSpeedMph:4}};
  expect(runInNewContext(`${fn}\nmergeIncidentWeatherLog(incident,weather)`,context)).toHaveLength(1);
  context.weather.observedAt='2026-11-01T12:05:00Z';expect(runInNewContext(`${fn}\nmergeIncidentWeatherLog(incident,weather)`,context)).toHaveLength(2);
  expect(runInNewContext(`${fn}\nmergeIncidentWeatherLog(incident,{})`,context)).toHaveLength(1);
 });
 it('autosaves a dirty worksheet entry and refuses a delayed save after switching incidents',()=>{
  const worksheet=readFileSync(new URL('../server/public/command-worksheet.js',import.meta.url),'utf8');
  const helper=worksheet.slice(worksheet.indexOf('  function autosave('),worksheet.indexOf('  function field('));
  const handlers:Record<string,()=>void>={};let current='one';let flush=()=>{};const persist=vi.fn();
  const input={dataset:{} as Record<string,string>,addEventListener:(type:string,handler:()=>void)=>{handlers[type]=handler;}};
  runInNewContext(`${helper}\nautosave(input,persist);`,{input,persist,context:()=>({incident:{incidentId:current}}),window:{clearTimeout:()=>{},setTimeout:(callback:()=>void)=>{flush=callback;return 1;}}});
  handlers.input();expect(input.dataset.dirty).toBe('true');flush();expect(persist).toHaveBeenCalledTimes(1);expect(input.dataset.dirty).toBeUndefined();
  handlers.input();current='two';flush();expect(persist).toHaveBeenCalledTimes(1);
 });

});
