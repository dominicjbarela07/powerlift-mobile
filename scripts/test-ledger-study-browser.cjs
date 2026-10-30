const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),{chromium,webkit}=require(require.resolve('@playwright/test',{paths:[root,path.dirname(root)]}));
const out=process.env.LEDGER_STUDY_EVIDENCE||path.join(root,'docs/validation/ledger-study-2026-10-30');fs.mkdirSync(out,{recursive:true});
let activeBrowser=null;
const scenes=['record','lift','movement','history','session','milestones','milestone','context','empty'];
(async()=>{
 const results=[];
 for(const[engine,type]of[['chromium',chromium],['webkit',webkit]]){
  const browser=await type.launch();activeBrowser=browser;
  const ctx=await browser.newContext({viewport:{width:390,height:844}}),p=await ctx.newPage();
  ctx.setDefaultTimeout(15000);const errors=[],requests=[],writes=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{requests.push(r.url());if(!['GET','HEAD'].includes(r.method()))writes.push({url:r.url(),method:r.method()})});
  await p.goto('http://127.0.0.1:8095/');await p.getByTestId('ledger-design-study').waitFor();await p.evaluate(()=>document.fonts.ready);
  const phone=p.getByTestId('ledger-design-study'),content=p.getByTestId('study-content');
  async function bodyHas(text){assert.ok((await phone.innerText()).includes(text),text)}
  async function close(){await p.getByRole('button',{name:'Close detail',exact:true}).click();await p.getByTestId('study-sheet').waitFor({state:'hidden'})}
  async function layout(label){
   const r=await phone.boundingBox(),v=p.viewportSize();assert.ok(r.height>600&&r.y+r.height<=v.height+1,`Phone fits ${label}: ${JSON.stringify(r)}`);
   const m=await phone.evaluate(el=>({overflow:document.documentElement.scrollWidth-innerWidth,dock:el.lastElementChild.getBoundingClientRect().toJSON(),controls:[...el.querySelectorAll('[role="button"],[role="tab"],input')].filter(e=>e.getClientRects().length).map(e=>{const q=e.getBoundingClientRect();return{label:e.getAttribute('aria-label')||e.textContent,width:q.width,height:q.height}})}));
   assert.ok(m.dock.bottom<=v.height+1&&m.dock.height>=60,'Ledger navigation stays visible');assert.ok(m.overflow<=1,'No horizontal page overflow');
   for(const c of m.controls)assert.ok(c.width>=43.9&&c.height>=43.9,`Undersized ${label}: ${JSON.stringify(c)}`);
   results.push({engine,kind:'layout',label,viewport:v,phone:r,dock:m.dock,controls:m.controls.length});
  }
  await layout('390-phone-record');
  for(const name of ['Squat','Bench press','Deadlift']){const b=await phone.getByText(name,{exact:true}).boundingBox();assert.ok(b&&b.y>0&&b.y+b.height<770,`${name} appears before scrolling`)}
  await p.screenshot({path:path.join(out,`${engine}-record-390.png`)});
  await p.getByRole('button',{name:/^Open Competition Squat,/}).click();await bodyHas('HEAVIEST LOGGED SINGLE');
  const chart=p.getByTestId('ledger-study-shared-chart');const before=await chart.locator('path').first().getAttribute('d');
  await p.getByTestId('study-range-6w').click();const after=await chart.locator('path').first().getAttribute('d');assert.notEqual(before,after,'Range changes actual plotted evidence');
  await p.getByTestId('study-metric-five').click();await bodyHas('5-rep record');
  await p.getByTestId('study-unit-toggle').click();await bodyHas('429.9');await p.getByTestId('study-unit-toggle').click();
  await p.getByTestId('study-rep-5').click();await p.getByTestId('study-sheet').waitFor();assert.match(await p.getByTestId('study-sheet').innerText(),/170[\s\S]*kg × 5[\s\S]*October 28, 2026/);await p.screenshot({path:path.join(out,`${engine}-set-proof.png`)});await close();
  await p.getByRole('button',{name:'Back to Records',exact:true}).click();await p.getByTestId('study-family-variants').click();await bodyHas('SQUAT FAMILY');await bodyHas('BENCH PRESS FAMILY');
  await p.getByRole('button',{name:/^Open 2-second Pause Squat,/}).click();await bodyHas('INDEPENDENT RECORD');await bodyHas('142.5');await p.getByRole('button',{name:'Back to Variants',exact:true}).click();assert.equal(await p.getByTestId('study-family-variants').getAttribute('aria-selected'),'true');
  await p.getByTestId('study-family-accessories').click();await p.getByRole('button',{name:/^Open Assisted Pull-up, Hammer Strength,/}).click();await bodyHas('2.5 kg less assistance');
  await p.getByTestId('study-brand-life-fitness').click();await bodyHas('FIRST LOGGED BASELINE');await bodyHas('No PR claimed');await p.getByTestId('study-brand-hammer-strength').click();
  await p.getByRole('button',{name:'Open latest performed set',exact:true}).click();await p.getByTestId('study-sheet').waitFor();assert.match(await p.getByTestId('study-sheet').innerText(),/assistance[\s\S]*Hammer Strength/);await close();
  await p.getByTestId('study-tab-history').click();await p.getByTestId('study-history-search').fill('Squat');assert.equal(await p.locator('[data-testid^="study-history-entry-"]').count(),3);
  await p.getByRole('button',{name:'Search the Ledger',exact:true}).click();await p.getByTestId('study-global-search').fill('bench');assert.equal(await p.getByTestId('study-sheet').getByRole('button',{name:/^Open /}).count(),2);await close();assert.equal(await p.getByTestId('study-history-search').inputValue(),'Squat');
  await p.getByTestId('study-history-entry-example-history-1').click();await bodyHas('Lower · Week 4');await p.getByTestId('study-session-set-competition-squat-6').click();await p.getByTestId('study-sheet').waitFor();assert.match(await p.getByTestId('study-sheet').innerText(),/October 28, 2026[\s\S]*Lower · Week 4/);await close();
  await p.getByRole('button',{name:'Show all Competition Squat sets',exact:true}).click();assert.equal(await p.getByRole('button',{name:'Inspect Competition Squat set 1',exact:true}).count(),1);
  await p.getByTestId('study-tab-records').click();await p.getByTestId('study-tab-history').click();await bodyHas('COMPLETED SESSION');await p.getByRole('button',{name:'Back to History',exact:true}).click();assert.equal(await p.getByTestId('study-history-search').inputValue(),'Squat');
  await p.getByTestId('study-history-search').fill('Upper');await p.getByTestId('study-history-prs').click();assert.equal(await p.locator('[data-testid^="study-history-entry-"]').count(),1);await p.getByTestId('study-history-entry-example-history-2').click();await bodyHas('Competition Bench Press');assert.equal(await p.getByRole('button',{name:'Inspect Competition Squat set 6',exact:true}).count(),0);
  await p.getByTestId('study-tab-milestones').click();await p.getByTestId('study-earned-club').click();await bodyHas('150 kg Squat club');await p.getByTestId('study-club-proof').click();await p.getByTestId('study-sheet').waitFor();assert.match(await p.getByTestId('study-sheet').innerText(),/August 10, 2026/);await p.keyboard.press('Escape');await p.getByTestId('study-sheet').waitFor({state:'hidden'});
  await p.getByRole('button',{name:'Back to Milestones',exact:true}).click();await p.getByTestId('study-unit-toggle').click();await p.getByTestId('study-earned-club').click();await bodyHas('405 lb Squat club');await p.getByTestId('study-club-proof').click();await p.getByTestId('study-sheet').waitFor();assert.match(await p.getByTestId('study-sheet').innerText(),/October 2, 2026/);await close();await p.getByRole('button',{name:'Back to Milestones',exact:true}).click();await p.getByTestId('study-unit-toggle').click();
  await p.getByRole('button',{name:'Strength tiers',exact:true}).click();await p.getByTestId('study-sheet').waitFor();await p.getByTestId('study-tier-total').click();assert.match(await p.getByTestId('study-sheet').innerText(),/not a meet total/);await p.screenshot({path:path.join(out,`${engine}-strength-reference.png`)});await close();
  await p.getByRole('button',{name:'Volume awards',exact:true}).click();await p.getByTestId('study-sheet').waitFor();assert.match(await p.getByTestId('study-sheet').innerText(),/486,000/);await p.getByTestId('study-volume-squat').click();assert.match(await p.getByTestId('study-sheet').innerText(),/180,000/);await p.screenshot({path:path.join(out,`${engine}-volume-collection.png`)});await close();
  for(let i=0;i<3;i++)await p.getByRole('button',{name:'Next storyboard screen',exact:true}).click();await bodyHas('Your record starts here.');await p.getByTestId('study-family-accessories').click();await bodyHas('Your accessory record will grow here.');
  await p.getByTestId('study-tab-history').click();await bodyHas('Your first Session goes here.');await p.getByTestId('study-tab-milestones').click();await bodyHas('Your first milestone is ahead.');assert.equal(await p.getByTestId('study-earned-club').count(),0);await p.getByTestId('study-tab-records').click();
  await p.getByRole('button',{name:'Training context',exact:true}).click();await bodyHas('Context follows your training.');assert.ok(!(await phone.innerText()).includes('83.2'));
  await ctx.close();
  // Review every storyboard state at three real phone viewport sizes.
  for(const[width,height]of[[360,780],[390,844],[430,932]]){
   const c=await browser.newContext({viewport:{width,height}}),page=await c.newPage();await page.goto('http://127.0.0.1:8095/');await page.getByTestId('ledger-design-study').waitFor();await page.evaluate(()=>document.fonts.ready);
   for(const scene of scenes){const r=await page.getByTestId('ledger-design-study').boundingBox();assert.ok(r.y+r.height<=height+1&&r.width<=width);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(out,`${engine}-${scene}-${width}.png`)});await page.getByRole('button',{name:'Next storyboard screen',exact:true}).click()}
   results.push({engine,kind:'nine-scene-responsive-pass',width,height,scenes:9});await c.close();
  }
  const d=await browser.newPage({viewport:{width:1500,height:1120}});await d.goto('http://127.0.0.1:8095/');await d.getByTestId('ledger-design-study').waitFor();await d.evaluate(()=>document.fonts.ready);const box=await d.getByTestId('ledger-design-study').boundingBox();assert.ok(box.height>=700&&box.y+box.height<1121);await d.screenshot({path:path.join(out,`${engine}-studio.png`)});
  if(engine==='chromium')await(await d.context().newCDPSession(d)).send('Emulation.setCPUThrottlingRate',{rate:4});
  const timings=[];for(const scene of ['lift','history','record']){const action=d.getByTestId('study-tour-'+scene);await action.evaluate(el=>{window.__studyPaint=null;el.addEventListener('click',()=>{const t=performance.now();requestAnimationFrame(()=>requestAnimationFrame(()=>{window.__studyPaint=performance.now()-t}))},{once:true,capture:true})});await action.click();await d.waitForFunction(()=>window.__studyPaint!=null);timings.push(await d.evaluate(()=>window.__studyPaint))}assert.ok(Math.max(...timings)<200);
  results.push({engine,kind:'actual-flows',flows:18,pointerPaintMs:timings,cpuSlowdown:engine==='chromium'?4:1,errors,writes,apiRequests:requests.filter(u=>!/127\.0\.0\.1:(8081|8095)/.test(u))});assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);assert.ok(requests.every(u=>/127\.0\.0\.1:(8081|8095)/.test(u)), 'No product service or API requests');await browser.close();activeBrowser=null;
 }
 const report={pass:true,platform:'Actual React Native Web via canonical npm-start Metro; no native simulator certification',results};fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:true,engines:2,sceneCaptures:54,flowGroups:36}));
})().catch(async e=>{console.error(e);if(activeBrowser)await activeBrowser.close();process.exitCode=1});
