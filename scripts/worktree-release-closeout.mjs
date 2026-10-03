import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {sha256} from './testflight-cumulative-integrity.mjs';

const defaultBackend='/Users/dominic/powerlifting_app_dev';
const registryPath=backend=>path.join(backend,'docs/release/worktree-lifecycle-registry.json');
const readRegistry=backend=>JSON.parse(fs.readFileSync(registryPath(backend),'utf8'));
export function assertRegisteredPublicationWorktree({root,backendRoot=process.env.STRENGTH_LEDGER_BACKEND_ROOT||defaultBackend}={}) {
  const registry=readRegistry(backendRoot),worktree=fs.realpathSync(root),entry=registry.worktrees[worktree];
  assert.ok(entry,'Release worktree has no recorded lifecycle/ownership; register its purpose, technical reason, starting SHA and source DEV state before publication');
  assert.ok(entry.durable||(entry.technicalReason&&entry.purpose&&entry.startingSha&&entry.sourceDevState&&entry.plannedChanges),'Temporary publication worktree lacks its required creation/accounting record');
  assert.notEqual(entry.classification,'AMBIGUOUS','Ambiguous worktree ownership blocks publication');
  assert.ok((registry.inventoryCoverage||[]).includes(worktree),'Publishing worktree must be covered by the complete worktree inventory');
  return {worktree,entry};
}

// Gate C is artifact verification. Workflow completion also requires durable DEV,
// assessed active worktrees, exact per-file accounting, and actual temporary removal.
export function runReleaseWorktreeCloseout({root,gateC,backendRoot=process.env.STRENGTH_LEDGER_BACKEND_ROOT||defaultBackend,activeAssessments,exportDir}={}) {
  const {worktree}=assertRegisteredPublicationWorktree({root,backendRoot});
  assert.equal(gateC.gate,'C');assert.equal(gateC.pass,true);assert.deepEqual(gateC.missing,[]);
  const publication=gateC.published;
  assert.match(publication.id,/^[a-zA-Z0-9-]+$/,'Exact publication identity required');
  const evidenceRoot=path.join(backendRoot,'.codex/release-artifacts',publication.id);
  fs.mkdirSync(evidenceRoot,{recursive:true});
  if(exportDir) fs.cpSync(exportDir,path.join(evidenceRoot,'validated-export'),{recursive:true});
  const gatePath=path.join(evidenceRoot,'release-gate-c.json');
  fs.writeFileSync(gatePath,JSON.stringify(gateC,null,2)+'\n');
  const registry=readRegistry(backendRoot),entry=registry.worktrees[worktree];
  entry.publication=publication;
  if(!entry.durable) entry.classification='COMPLETED';
  // Preserve the exact published commit after its temporary branch is closed.
  const anchor=`refs/archive/testflight-published/${publication.id}`;
  execFileSync('git',['update-ref',anchor,publication.gitCommitHash],{cwd:worktree});
  entry.historyAnchor=anchor;
  const devRoot=gateC.dev.worktree;
  const projectionPaths=['app.json','eas.json','config/governed-movement-art-taxonomy.json'];
  entry.accounting=(entry.accounting||[]).filter(item=>!projectionPaths.includes(item.path));
  for(const file of projectionPaths) {
    const source=sha256(fs.readFileSync(path.join(worktree,file))),dev=sha256(fs.readFileSync(path.join(devRoot,file)));
    if(source!==dev) entry.accounting.push({path:file,sourceSha256:source,canonicalSha256:dev,
      disposition:'AUTHORIZED_RELEASE_PROJECTION',evidence:{path:gatePath,sha256:sha256(fs.readFileSync(gatePath))},
      validationEvidence:'Exact published Gate C; mandatory projection lineage and governed catalog compatibility verified before publication'});
  }
  fs.writeFileSync(registryPath(backendRoot),JSON.stringify(registry,null,2)+'\n');
  const closeout=path.join(evidenceRoot,'worktree-closeout.json');
  const args=[path.join(backendRoot,'scripts/worktree_lifecycle.py'),'release-closeout','--worktree',worktree,
    '--dev-root',devRoot,'--registry',registryPath(backendRoot),'--published-gate-c',gatePath,'--output',closeout];
  if(registry.testflightRoot) args.push('--testflight-root',registry.testflightRoot);
  for(const repository of registry.repositoryRoots||[]) args.push('--repository',repository);
  if(activeAssessments) args.push('--active-assessments',path.resolve(activeAssessments));
  execFileSync('python3',args,{cwd:backendRoot,stdio:'inherit'});
  const receipt=JSON.parse(fs.readFileSync(closeout,'utf8'));
  assert.equal(receipt.workflowComplete,true,'Release closeout remains unfinished');
  assert.ok(receipt.tempWorktreeRemoved===true||receipt.tempWorktreeRemoved==='NOT_APPLICABLE_DURABLE_RELEASE_CHECKOUT');
  return {...receipt,receiptPath:closeout};
}
