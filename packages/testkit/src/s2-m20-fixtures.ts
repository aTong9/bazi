import type { EarthlyBranch, HeavenlyStem, Pillar } from "../../domain/src/birth-input.js";
import { analyzeM02, tenGodFor, type PillarPosition } from "../../m0-engine/src/m02.js";
import { analyzeM03 } from "../../m0-engine/src/m03.js";
import { analyzeM04 } from "../../m0-engine/src/m04.js";
import { analyzeM05, type BranchRelationType } from "../../m0-engine/src/m05.js";
import { analyzeM06, type M06EvidenceContext } from "../../m0-engine/src/m06.js";

export interface S2FixtureExecution {
  readonly testId: string;
  readonly moduleId: "M02" | "M03" | "M04" | "M05" | "M06";
  readonly passed: boolean;
  readonly assertion: string;
}

type Fixture = Omit<S2FixtureExecution, "passed"> & { run(): boolean };

export function runS2M20Fixtures(): readonly S2FixtureExecution[] {
  return Object.freeze(FIXTURES.map(({ testId, moduleId, assertion, run }) => ({
    testId, moduleId, assertion, passed: run(),
  })));
}

const FIXTURES: readonly Fixture[] = [
  fixture(1,"M02","branch polarity differs from hidden stem",() => {
    const r=m02(["甲","丙","戊","壬"],["子","寅","午","申"]); const h=r.pillars.year.branch.hiddenStems[0]; return r.pillars.year.branch.yinYang==="yang"&&h?.stem==="癸"&&h.yinYang==="yin";
  }),
  fixture(2,"M02","庚 is 七杀 for 甲",()=>tenGodFor("甲","庚")==="七杀"),
  fixture(3,"M02","庚 is 正官 for 乙",()=>tenGodFor("乙","庚")==="正官"),
  fixture(4,"M02","hidden stems are not automatically exposed",()=>m02(["甲","丙","戊","壬"],["丑","寅","午","申"]).pillars.year.branch.hiddenStems.every((h)=>!h.exposed)),
  fixture(5,"M03","provided pillars do not claim calendar boundary verification",()=>!analyzeM03(m02(["甲","丙","庚","壬"],["子","寅","午","申"])).calendarVerified),
  fixture(6,"M03","main hidden stem gives strong direct root",()=>rootCase("甲","寅","direct","strong")),
  fixture(7,"M03","residual hidden stem gives weak direct root",()=>rootCase("癸","辰","direct","weak")),
  fixture(8,"M03","same element opposite polarity is not direct root",()=>rootCase("甲","卯","same_element","strong")),
  fixture(9,"M03","a root does not publish day-master strength",()=>!("dayMasterStrength" in analyzeM03(m02(["甲","丙","甲","壬"],["申","寅","午","辰"])))),
  fixture(10,"M03","no direct root does not publish weakness",()=>{const r=analyzeM03(m02(["壬","乙","甲","癸"],["子","卯","午","酉"]));return r.rootStatus!=="rooted"&&!("dayMasterStrength" in r);}),
  ...([ ["甲","己"],["乙","庚"],["丙","辛"],["丁","壬"],["戊","癸"] ] as const).map((pair,index)=>fixture(11+index,"M04",`${pair.join("")} combine is recognized`,()=>hasStemRelation(pair[0],pair[1],"stem_combine"))),
  fixture(16,"M04","hidden 己 cannot replace a visible stem",()=>!analyzeM04(chart(["甲","丙","戊","庚"],["丑","寅","午","申"])).relations.some((r)=>r.type==="stem_combine"&&r.stems.includes("甲")&&r.stems.includes("己"))),
  fixture(17,"M04","one 己 and two 甲 retain contention instances",()=>{const r=analyzeM04(chart(["甲","己","甲","丙"],["子","丑","午","寅"]));return r.contentions.length===1&&r.relations.filter((x)=>x.type==="stem_combine"&&x.stems.includes("甲")&&x.stems.includes("己")).length===2;}),
  fixture(18,"M04","甲己 combine and 甲 controls 己 coexist",()=>{const r=analyzeM04(chart(["甲","己","丙","丁"],["子","丑","午","寅"]));return r.relations.some((x)=>x.type==="stem_combine"&&x.positions.join()==="year,month")&&r.relations.some((x)=>x.type==="stem_control"&&x.positions.join()==="year,month");}),
  fixture(19,"M05","子丑 six harmony recognized without transformation",()=>hasBranchRelation(["子","丑"],"six_harmony")),
  fixture(20,"M05","申子辰 complete three harmony",()=>hasBranchRelation(["申","子","辰"],"three_harmony")),
  fixture(21,"M05","申子 without 辰 is half harmony only",()=>hasBranchRelation(["申","子"],"half_harmony")&&!hasBranchRelation(["申","子"],"three_harmony")),
  fixture(22,"M05","申辰 without 子 is arch harmony",()=>hasBranchRelation(["申","辰"],"arch_harmony")&&!hasBranchRelation(["申","辰"],"half_harmony")),
  fixture(23,"M05","寅卯辰 complete three meeting",()=>hasBranchRelation(["寅","卯","辰"],"three_meeting")),
  fixture(24,"M05","寅申 clash recognized",()=>hasBranchRelation(["寅","申"],"clash")),
  fixture(25,"M05","寅巳申 complete punishment",()=>hasBranchRelation(["寅","巳","申"],"three_punishment")),
  fixture(26,"M05","寅巳 without 申 is not complete punishment",()=>!hasBranchRelation(["寅","巳"],"three_punishment")&&hasBranchRelation(["寅","巳"],"local_punishment")),
  fixture(27,"M05","巳申 harmony punishment and break coexist",()=>relationTypes(["巳","申"],["six_harmony","local_punishment","break"])),
  fixture(28,"M05","duplicate 寅 cannot replace missing 申",()=>!relations(["寅","寅","巳"]).some((r)=>r.type==="three_punishment")),
  m06Fixture(29,"rooted combine does not automatically transform",()=>stemCombineEffect("vetoed").some((e)=>e.effect==="transformation_candidate"&&e.status==="contradicted")),
  m06Fixture(30,"weaker combine participant is explicitly identified",()=>stemCombineEffect("unknown",{year:"strong",month:"weak"}).some((e)=>e.objectRef==="month"&&e.effect==="combination_pull"&&e.status==="supported")),
  m06Fixture(31,"transformation can be supported only with explicit thresholds",()=>stemCombineEffect("supported").filter((e)=>e.effect==="transformation_candidate").every((e)=>e.status==="supported")),
  m06Fixture(32,"contention contradicts exclusive transformation",()=>stemCombineEffect("contested").some((e)=>e.effect==="transformation_candidate"&&e.status==="contradicted")),
  m06Fixture(33,"strong six harmony binds without deleting participants",()=>{const r=branchEffects(["子","丑"],"six_harmony");return r.effects.filter((e)=>e.effect==="binding_candidate").length===2&&!r.effects.some((e)=>e.effect===("deleted" as never));}),
  m06Fixture(34,"clash always yields activation before strength change",()=>branchEffects(["寅","申"],"clash").effects.filter((e)=>e.effect==="activation_candidate").length===2),
  m06Fixture(35,"strong clash on a unique weak root can support damage",()=>branchEffects(["寅","申"],"clash",{objectStrength:{year:"weak",month:"strong"},uniqueRootTarget:"year"}).effects.some((e)=>e.effect==="root_damage_candidate"&&e.status==="supported")),
  m06Fixture(36,"weak attacker does not erase a strong clash target",()=>!branchEffects(["寅","申"],"clash",{objectStrength:{year:"strong",month:"weak"}}).effects.some((e)=>e.effect==="root_damage_candidate")),
  m06Fixture(37,"辰戌 clash only opens a storage candidate without evidence",()=>branchEffects(["辰","戌"],"clash").effects.some((e)=>e.effect==="opening_storage_candidate"&&e.status==="candidate")),
  m06Fixture(38,"storage opening can be supported with content and receiving path",()=>branchEffects(["辰","戌"],"clash",{openingStorage:"supported"}).effects.some((e)=>e.effect==="opening_storage_candidate"&&e.status==="supported")),
  m06Fixture(39,"complete punishment remains an activation candidate",()=>branchEffects(["寅","巳","申"],"three_punishment").effects.every((e)=>e.effect==="punishment_activation_candidate"&&e.status==="candidate")),
  m06Fixture(40,"complete punishment preserves overlapping relation effects",()=>{const r=allBranchEffects(["寅","巳","申"]);return new Set(r.effects.map((e)=>e.relationId)).size>=4;}),
  m06Fixture(41,"巳申 generates independent effects for all three relations",()=>{const r=allBranchEffects(["巳","申"]);return new Set(r.effects.filter((e)=>e.relationId.startsWith("M05:")).map((e)=>e.relationId)).size===3;}),
  m06Fixture(42,"M06 never publishes favorability or useful god",()=>allBranchEffects(["寅","申"]).forbiddenConclusions.includes("favorability")&&allBranchEffects(["寅","申"]).forbiddenConclusions.includes("useful_god")),
  { testId:"M20-REGRESSION-0144-V1.0",moduleId:"M05",assertion:"punishment does not publish fixed strength reduction",run:()=>!("strengthChange" in analyzeM05(nodes(["寅","巳","申"]))) },
  { testId:"M20-REGRESSION-0145-V1.0",moduleId:"M06",assertion:"a clashed root is not zeroed without extreme evidence",run:()=>!allBranchEffects(["寅","申"]).effects.some((e)=>e.effect==="root_damage_candidate") },
];

function fixture(index:number,moduleId:S2FixtureExecution["moduleId"],assertion:string,run:()=>boolean):Fixture {
  const group=index<=10?"BASE":index<=28?"REL":"EFFECT"; return {testId:`M20-${group}-${String(index).padStart(4,"0")}-V1.0`,moduleId,assertion,run};
}
function m06Fixture(index:number,assertion:string,run:()=>boolean):Fixture{return fixture(index,"M06",assertion,run);}
function chart(stems:readonly HeavenlyStem[],branches:readonly EarthlyBranch[]):{year:Pillar;month:Pillar;day:Pillar;hour:Pillar}{
  return {year:{stem:stems[0]??"甲",branch:branches[0]??"子"},month:{stem:stems[1]??"丙",branch:branches[1]??"寅"},day:{stem:stems[2]??"庚",branch:branches[2]??"午"},hour:{stem:stems[3]??"壬",branch:branches[3]??"申"}};
}
function m02(stems:readonly HeavenlyStem[],branches:readonly EarthlyBranch[]){return analyzeM02(chart(stems,branches));}
function rootCase(dayMaster:HeavenlyStem,branch:EarthlyBranch,kind:"direct"|"same_element",level:"strong"|"medium"|"weak"):boolean{
  const r=analyzeM03(m02(["庚","丙",dayMaster,"壬"],["申",branch,"午","子"]));return r.dayMasterRoots.some((x)=>x.position==="month"&&x.kind===kind&&x.level===level);
}
function hasStemRelation(a:HeavenlyStem,b:HeavenlyStem,type:"stem_combine"|"stem_control"):boolean{return analyzeM04(chart([a,b,"丙","丁"],["子","丑","午","寅"])).relations.some((r)=>r.type===type&&r.stems.includes(a)&&r.stems.includes(b));}
function nodes(branches:readonly EarthlyBranch[]){return branches.map((branch,index)=>({position:(["year","month","day","hour"] as const)[index]!,branch}));}
function relations(branches:readonly EarthlyBranch[]){return analyzeM05(nodes(branches)).relations;}
function hasBranchRelation(branches:readonly EarthlyBranch[],type:BranchRelationType):boolean{return relations(branches).some((r)=>r.type===type);}
function relationTypes(branches:readonly EarthlyBranch[],types:readonly BranchRelationType[]):boolean{const found=new Set(relations(branches).map((r)=>r.type));return types.every((type)=>found.has(type));}
function stemCombineEffect(transformation:"supported"|"vetoed"|"contested"|"unknown",objectStrength?:Partial<Record<PillarPosition,"strong"|"weak"|"unknown">>){
  const c=chart(["甲","己","丙","丁"],["寅","丑","午","申"]);const m02r=analyzeM02(c);const m04=analyzeM04(c);const relation=m04.relations.find((r)=>r.type==="stem_combine")!;
  return analyzeM06(analyzeM03(m02r),m04,analyzeM05(nodes(["寅","丑","午","申"])),{byRelationId:{[relation.id]:{transformation,...(objectStrength?{objectStrength}:{})}}}).effects.filter((e)=>e.relationId===relation.id);
}
function branchEffects(branches:readonly EarthlyBranch[],type:BranchRelationType,evidence?:M06EvidenceContext["byRelationId"][string]){
  const m05=analyzeM05(nodes(branches));const relation=m05.relations.find((r)=>r.type===type)!;const c=chart(["甲","丙","庚","壬"],branches);const m02r=analyzeM02(c);
  const result=analyzeM06(analyzeM03(m02r),analyzeM04(c),m05,evidence?{byRelationId:{[relation.id]:evidence}}:undefined);return {...result,effects:result.effects.filter((e)=>e.relationId===relation.id)};
}
function allBranchEffects(branches:readonly EarthlyBranch[]){const c=chart(["甲","丙","庚","壬"],branches);const m02r=analyzeM02(c);return analyzeM06(analyzeM03(m02r),analyzeM04(c),analyzeM05(nodes(branches)));}
