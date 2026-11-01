import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {describe,it,expect,vi} from 'vitest';
const command = readFileSync(new URL('../server/public/incident-command.js',import.meta.url),'utf8');
const script = readFileSync(new URL('../server/public/script.js',import.meta.url),'utf8');
describe('Tactical worksheet shared facts',()=>{
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
});
