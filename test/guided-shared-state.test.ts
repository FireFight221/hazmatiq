import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const script = readFileSync(new URL('../server/public/script.js', import.meta.url), 'utf8');
const section = (from: string, to: string) => script.slice(script.indexOf(from), script.indexOf(to));
const code = [
  section('const guidedPhaseDefinitions =', 'function guidedNavigationOrigin('),
  section('function readGuidedResponsePhaseState(', 'function createGuidedPhaseList('),
  section('function persistIncidentAssignment(', 'function createGuidedRoleAssignment('),
  section('function guidedIncidentAssignments(', 'function updateGuidedPhaseAssignmentLocation('),
].join('\n');
function setup(initial: Record<string, unknown> = {}) {
  let incident: Record<string, unknown> = { incidentId: 'training-1', operationalMode: 'Defensive', chemicalName: 'Training product', ...initial };
  const context = {
    getActiveIncident: () => incident,
    readIncidents: () => [incident],
    writeIncidents: (items: Record<string, unknown>[]) => { incident = items[0]; },
    getIncidentChemicalContext: () => ({ chemical: { id: 10 } }), activeChemical: null,
    incidentResponderIdentity: () => 'Training IC', renderIncidentLists: vi.fn(), renderIncidentCommandSnapshot: vi.fn(), renderIncidentCommandDashboard: vi.fn(),
    window: { dispatchEvent: vi.fn(), localStorage: { getItem: () => { throw new Error('Active incidents must not read planning state'); } } },
    CustomEvent: class { constructor(public type: string, public options: unknown) {} },
  };
  runInNewContext(code, context);
  return { run: (expression: string) => runInNewContext(expression, context), incident: () => incident, context };
}

describe('Shared operational plan state', () => {
  it('uses the same phase status for Command and Guidance and retains legacy checklist evidence', () => {
    const oldChecklist = { tasks: [{ id: 'ppe-entry', status: 'Complete', evidence: 'Radio check' }] };
    const app = setup({ operationalChecklist: oldChecklist });
    app.run("persistGuidedResponsePhaseState('mitigation-strategy', {status:'Accomplished', evidence:'Control task confirmed by radio'});");
    expect(app.run("guidedGoalStatus(readGuidedResponsePhaseState(getActiveIncident())['mitigation-strategy'])")).toBe('Accomplished');
    app.run("persistGuidedResponsePhaseState('mitigation-strategy', {status:'Needs Reassessment'});");
    expect(app.run("buildIncidentActionPlan(getActiveIncident()).phases[3].status")).toBe('Needs Reassessment');
    expect(app.incident().operationalChecklist).toEqual(oldChecklist);
    expect(app.context.renderIncidentCommandDashboard).toHaveBeenCalledTimes(2);
  });
  it('shares team edits, moves and removals across both pages without duplicate assignments', () => {
    const app = setup();
    app.run("persistIncidentAssignment({assignmentId:'entry-1', phaseId:'zones-resources', personnel:'Entry 1', unit:'HM1', responsibility:'Prepare entry', status:'Confirmed'});");
    app.run("persistIncidentAssignment({...guidedIncidentAssignments()[0], phaseId:'mitigation-strategy', responsibility:'Source control'}, 'zones-resources');");
    const teams = app.run('guidedIncidentAssignments()') as Record<string, unknown>[];
    expect(teams).toHaveLength(1);
    expect(teams[0]).toMatchObject({ assignmentId: 'entry-1', phaseId: 'mitigation-strategy', responsibility: 'Source control' });
    app.run("removeIncidentAssignment('entry-1', 'mitigation-strategy');");
    expect(app.run('guidedIncidentAssignments()')).toHaveLength(0);
    expect((app.incident().guidedResponseAssignmentHistory as unknown[])).toHaveLength(3);
  });
  it('preserves named assignment locations and resolves only the saved incident location', () => {
    const app = setup({ address: '100 Main Street', city: 'Birmingham', state: 'AL', latitude: 33.52, longitude: -86.8 });
    app.run("persistIncidentAssignment({assignmentId:'placed', phaseId:'zones-resources', personnel:'Entry 1', unit:'HM1', responsibility:'Prepare entry', locationLabel:'100 Main Street', status:'Confirmed'});");
    expect(app.run('guidedIncidentAssignments()[0]')).toMatchObject({ locationLabel: '100 Main Street', latitude: 33.52, longitude: -86.8, locationSource: 'Saved incident location' });
    app.run("persistIncidentAssignment({assignmentId:'unplaced', phaseId:'zones-resources', personnel:'Decon', unit:'HM2', responsibility:'Set corridor', locationLabel:'North gate', status:'Planned'});");
    expect(app.run("guidedIncidentAssignments().find((item) => item.assignmentId === 'unplaced')")).toMatchObject({ locationLabel: 'North gate', locationStatus: 'North gate', locationSource: 'Named location — not placed' });
    expect(app.run("guidedIncidentAssignments().find((item) => item.assignmentId === 'unplaced').latitude")).toBe('');
  });
  it('loads older flattened assignments without borrowing another planning session', () => {
    const app = setup({ guidedResponseAssignments: [{ assignmentId: 'legacy', phaseId: 'recon-assessment', personnel: 'Recon', status: 'Confirmed' }] });
    expect(app.run('guidedIncidentAssignments()')).toHaveLength(1);
    expect(app.run("readGuidedResponsePhaseState({incidentId:'another-incident'})")).toEqual({});
  });
  it('retains edited planned tasks and does not log completion when opening IAP drafts', () => {
    const app = setup();
    app.run("persistGuidedResponsePhaseState('mitigation-strategy', {planGoal:'Control the observed release.', planObjectives:['Perform the assigned control task.', 'Report monitoring results.']});");
    const before = (app.incident().incidentTimeline as unknown[]).length;
    app.run("persistGuidedResponsePhaseState('identify-isolate-notify', {}, {planOnly:true});");
    const plan = app.incident().operationalActionPlan as { phases: Array<Record<string, unknown>> };
    expect(plan.phases[3]).toMatchObject({ goal: 'Control the observed release.', objectives: ['Perform the assigned control task.', 'Report monitoring results.'], status: 'Not Started' });
    expect(app.incident().incidentTimeline).toHaveLength(before);
  });
  it('persists multiple Step 4 equipment selections without marking the phase complete', () => {
    const app = setup();
    app.run("persistGuidedResponsePhaseState('mitigation-strategy', {equipmentSelections:[{equipmentId:'3m-p110-chemical-pad',quantity:'2'},{equipmentId:'3m-p200-chemical-boom',quantity:'1'}]});");
    expect(app.run("readGuidedResponsePhaseState(getActiveIncident())['mitigation-strategy'].equipmentSelections")).toEqual([
      { equipmentId: '3m-p110-chemical-pad', quantity: '2' },
      { equipmentId: '3m-p200-chemical-boom', quantity: '1' },
    ]);
    expect(app.run("guidedGoalStatus(readGuidedResponsePhaseState(getActiveIncident())['mitigation-strategy'])")).toBe('Not Started');
  });
  it('records a named command role once and keeps the commander in sync after edits', () => {
    const app = setup();
    app.run("persistIncidentAssignment({assignmentId:'command',kind:'command-role',phaseId:'identify-isolate-notify',role:'Incident Commander',personnel:'Chief One',responsibility:'Incident Commander',status:'Confirmed'});");
    expect(app.incident().commanderName).toBe('Chief One');
    app.run("persistIncidentAssignment({...guidedIncidentAssignments()[0],personnel:'Chief Two'});");
    expect(app.incident().commanderName).toBe('Chief Two');
    expect(app.run('guidedIncidentAssignments()')).toHaveLength(1);
    app.run("removeIncidentAssignment('command','identify-isolate-notify');");
    expect(app.incident().commanderName).toBe('');
  });
  it('shares explicit worksheet checks without treating a populated field or check as a completed phase', () => {
    const app = setup({commanderName:'Chief One'});
    expect(app.run("readGuidedResponsePhaseState(getActiveIncident())['identify-isolate-notify']?.actionChecks")).toBeUndefined();
    app.run("persistGuidedActionCheck('establish-command',true);");
    expect(app.run("readGuidedResponsePhaseState(getActiveIncident())['identify-isolate-notify'].actionChecks['establish-command'].confirmed")).toBe(true);
    expect(app.run("guidedGoalStatus(readGuidedResponsePhaseState(getActiveIncident())['identify-isolate-notify'])")).toBe('Not Started');
    expect((app.incident().incidentTimeline as Array<{label:string}>).at(-1)?.label).toContain('Establish Command: Completed');
    app.run("persistGuidedActionCheck('establish-command',false);");
    expect(app.run("readGuidedResponsePhaseState(getActiveIncident())['identify-isolate-notify'].actionChecks['establish-command'].confirmed")).toBe(false);
  });

});
